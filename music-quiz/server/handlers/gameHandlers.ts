import { Server, Socket } from "socket.io";
import { rooms } from "../rooms";
import { getKoreanVariants, normalize, loadCache } from "../translationCache";

// Last.fm 한국 차트 → Deezer 미리듣기 매칭
async function fetchTracks(genre: string) {
  // Last.fm 장르별 태그 매핑
  const tagMap: Record<string, string> = {
    "k-pop": "k-pop",
    pop: "pop",
    "hip-hop": "hip-hop",
    rock: "rock",
  };

  const tag = tagMap[genre] || "k-pop";

  // Last.fm 태그 기반 인기 차트 가져오기
  const lastfmRes = await fetch(
    `https://ws.audioscrobbler.com/2.0/?method=tag.gettoptracks&tag=${tag}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=30`
  );
  const lastfmData = await lastfmRes.json();
  const tracks = lastfmData.tracks?.track;

  if (!tracks || tracks.length === 0) return [];

  // 각 곡을 Deezer에서 검색해서 미리듣기 매칭
  const results = await Promise.all(
    tracks.map(async (track: any) => {
      const query = `track:"${track.name}" artist:"${track.artist.name}"`;
      const deezerRes = await fetch(
        `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`
      );
      const deezerData = await deezerRes.json();
      const deezerTrack = deezerData.data?.[0];

      if (!deezerTrack || !deezerTrack.preview) return null;

      return {
        id: deezerTrack.id,
        title: track.name, // Last.fm 제목 사용 (정답 체크용)
        artist: track.artist.name, // Last.fm 아티스트 사용
        previewUrl: deezerTrack.preview,
        albumImage: deezerTrack.album.cover_medium,
      };
    })
  );

  const filtered = results.filter(Boolean);
  console.log(`${genre} 트랙 매칭 완료: ${filtered.length}개`);
  return filtered;
}

// 배열에서 랜덤으로 n개 뽑기
function pickRandom(arr: any[], n: number) {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}
// 정답 체크 (영어 + 한글 모두 허용)
async function checkAnswer(answer: string, track: any): Promise<boolean> {
  const normalizedAnswer = normalize(answer);

  // 1. 제목 체크
  const titleVariants = await getKoreanVariants(track.title);
  if (titleVariants.includes(normalizedAnswer)) return true;

  // 2. feat. 제거한 제목 체크
  const titleWithoutFeat = track.title
    .replace(/\(feat\..*?\)/gi, "")
    .replace(/\(ft\..*?\)/gi, "")
    .replace(/feat\..*$/gi, "")
    .trim();

  if (titleWithoutFeat !== track.title) {
    const titleNoFeatVariants = await getKoreanVariants(titleWithoutFeat);
    if (titleNoFeatVariants.includes(normalizedAnswer)) return true;
  }

  // 3. 아티스트 체크 (여러 명이면 한 명만 맞춰도 정답)
  const artists = track.artist.split(/[,&x×]/).map((a: string) => a.trim());

  for (const artist of artists) {
    const artistVariants = await getKoreanVariants(artist);
    if (artistVariants.includes(normalizedAnswer)) return true;

    // 이름 일부만 써도 정답
    const nameParts = artist.split(" ");
    for (const part of nameParts) {
      if (part.length > 1) {
        const partVariants = await getKoreanVariants(part);
        if (partVariants.includes(normalizedAnswer)) return true;
      }
    }
  }

  return false;
}

export function gameHandlers(io: Server, socket: Socket) {
  // 게임 시작
  socket.on("game:start", async ({ roomCode }) => {
    const room = rooms.get(roomCode);

    if (!room) return;

    // 방장만 게임 시작 가능
    const host = room.players.find((p) => p.socketId === socket.id);
    if (!host?.isHost) {
      socket.emit("room:error", { message: "방장만 게임을 시작할 수 있어요" });
      return;
    }

    if (room.players.length < 2) {
      socket.emit("room:error", { message: "최소 2명이 필요해요" });
      return;
    }

    // 트랙 가져오기
    const tracks = await fetchTracks(room.genre);
    if (tracks.length < room.rounds) {
      socket.emit("room:error", {
        message: "트랙이 부족해요. 다른 장르를 선택해주세요",
      });
      return;
    }

    // 라운드 수만큼 트랙 랜덤 선택
    const selectedTracks = pickRandom(
      tracks,
      Math.min(room.rounds, tracks.length)
    );

    // 방 상태 업데이트
    room.isPlaying = true;
    room.tracks = selectedTracks; // rooms.ts 에 tracks 필드 추가 필요
    room.currentRound = 0;
    room.answeredPlayers = [];
    room.rounds = selectedTracks.length;

    // 모든 플레이어 점수 초기화
    room.players.forEach((p) => (p.score = 0));

    // 게임 시작 전 백그라운드에서 번역 캐시 미리 생성
    selectedTracks.forEach((track: any) => {
      getKoreanVariants(track.title);
      getKoreanVariants(track.artist);
    });

    // 게임 시작 알림
    io.to(roomCode).emit("game:started");

    // 1초 후 첫 라운드 시작
    setTimeout(() => startRound(io, roomCode), 3000);
  });
  socket.on("answer:submit", async ({ roomCode, answer }) => {
    const room = rooms.get(roomCode);
    if (!room || !room.isPlaying) return;

    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) return;

    // 이미 이번 라운드에 정답 맞춘 플레이어면 무시
    if (room.answeredPlayers.includes(player.playerId)) return;

    const track = room.tracks[room.currentRound - 1];
    const isCorrect = await checkAnswer(answer, track);
    if (!isCorrect) {
      socket.emit("answer:wrong");
      return;
    }

    // 정답! — 빠를수록 점수 높게 (최대 1000점)
    const timeTaken = Date.now() - room.roundStartTime; // roundStartTime 필드 필요
    const score = Math.max(100, 1000 - Math.floor(timeTaken / 30));

    player.score += score;
    room.answeredPlayers.push(player.playerId);

    // 정답자 전체에게 알림
    io.to(roomCode).emit("answer:correct", {
      nickname: player.nickname,
      score,
      totalScore: player.score,
    });

    // 모두 정답 맞추면 바로 라운드 종료
    if (room.answeredPlayers.length === room.players.length) {
      clearTimeout(room.roundTimer);
      setTimeout(() => endRound(io, roomCode), 2000);
    }
  });
}

// 라운드 시작 (외부에서도 호출하기 위해 export)
export function startRound(io: Server, roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.currentRound += 1;
  room.answeredPlayers = [];
  room.roundStartTime = Date.now();

  if (room.currentRound > room.tracks.length) {
    console.log("트랙 소진 → 게임 종료");
    endGame(io, roomCode);
    return;
  }
  const track = room.tracks[room.currentRound - 1];

  console.log(
    `라운드 ${room.currentRound} 시작: ${track.title} - ${track.artist}`
  );

  // 정답은 서버만 알고 있고 previewUrl만 클라이언트에 전송
  io.to(roomCode).emit("round:start", {
    roundNum: room.currentRound,
    totalRounds: room.rounds,
    previewUrl: track.previewUrl,
    albumImage: track.albumImage,
  });

  // 30초 후 라운드 종료
  room.roundTimer = setTimeout(() => {
    endRound(io, roomCode);
  }, 30000);
}

// 라운드 종료
export function endRound(io: Server, roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const track = room.tracks[room.currentRound - 1];

  // 정답 공개 + 현재 점수 전송
  io.to(roomCode).emit("round:end", {
    correctAnswer: {
      title: track.title,
      artist: track.artist,
      albumImage: track.albumImage,
    },
    scores: room.players.map((p) => ({
      playerId: p.playerId,
      nickname: p.nickname,
      score: p.score,
    })),
  });

  // 마지막 라운드면 게임 종료
  if (room.currentRound >= room.rounds) {
    setTimeout(() => endGame(io, roomCode), 3000);
    return;
  }

  // 다음 라운드는 5초 후
  setTimeout(() => startRound(io, roomCode), 5000);
}

// 게임 종료
function endGame(io: Server, roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;

  // 점수 내림차순 정렬
  const finalScores = [...room.players]
    .sort((a, b) => b.score - a.score)
    .map((p, index) => ({
      rank: index + 1,
      playerId: p.playerId,
      nickname: p.nickname,
      score: p.score,
    }));

  io.to(roomCode).emit("game:end", { finalScores });

  // 방 초기화
  room.isPlaying = false;
  room.currentRound = 0;
  room.tracks = [];
  room.answeredPlayers = [];
}
