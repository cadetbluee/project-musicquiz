import { Server, Socket } from "socket.io";
import { rooms, generateRoomCode, generatePlayerId, Player } from "../rooms";

export function roomHandlers(io: Server, socket: Socket) {
  // 방 생성 이벤트
  socket.on("room:create", ({ nickname, genre, rounds }) => {
    const code = generateRoomCode();
    const playerId = generatePlayerId(); // 방장 ID 발급

    const host: Player = {
      playerId,
      socketId: socket.id,
      nickname,
      score: 0,
      isHost: true,
    };

    // 방 생성 후 rooms Map에 저장
    rooms.set(code, {
      code,
      players: [host],
      genre,
      rounds,
      isPlaying: false,
      tracks: [],
      currentRound: 0,
      answeredPlayers: [],
      roundStartTime: 0,
    });

    // 이 소켓을 방 코드로 된 room에 참가시킴
    // Socket.io의 room 기능 → 같은 room에만 이벤트 전송 가능해짐
    socket.join(code);

    // 방장한테만 방 코드 전달
    socket.emit("room:created", { code, playerId });
    console.log(`방 생성: ${code} / 방장: ${nickname}`);
  });
  socket.on("room:leave", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const index = room.players.findIndex((p) => p.socketId === socket.id);
    if (index === -1) return;

    const wasHost = room.players[index].isHost;
    const nickname = room.players[index].nickname;
    room.players.splice(index, 1);

    console.log(`방 퇴장: ${roomCode} / 닉네임: ${nickname}`);

    if (room.players.length === 0) {
      rooms.delete(roomCode);
      console.log(`방 삭제: ${roomCode}`);
      return;
    }

    if (wasHost) room.players[0].isHost = true;

    socket.leave(roomCode);
    io.to(roomCode).emit("room:update", { players: room.players });
  });
  // 방 입장 이벤트
  socket.on("room:join", ({ roomCode, nickname, playerId }) => {
    const room = rooms.get(roomCode);

    // 존재하지 않는 방
    if (!room) {
      socket.emit("room:error", { message: "존재하지 않는 방이에요" });
      return;
    }

    // 이미 게임 중인 방
    if (room.isPlaying) {
      socket.emit("room:error", { message: "이미 게임이 시작된 방이에요" });
      return;
    }
    // playerId로 기존 플레이어 확인 (재연결 케이스)
    const existing = room.players.find((p) => p.playerId === playerId);
    if (existing) {
      // 재연결 — socketId만 업데이트
      existing.socketId = socket.id;
      socket.join(roomCode);
      io.to(roomCode).emit("room:update", { players: room.players });
      return;
    }
    // 닉네임 중복 체크 (진짜 다른 사람)
    const nicknameExists = room.players.some((p) => p.nickname === nickname);
    if (nicknameExists) {
      socket.emit("room:error", { message: "이미 사용 중인 닉네임이에요" });
      return;
    }
    // 새 플레이어 — 새 playerId 발급
    const newPlayerId = generatePlayerId();
    const newPlayer: Player = {
      playerId: newPlayerId,
      socketId: socket.id,
      nickname,
      score: 0,
      isHost: false,
    };
    room.players.push(newPlayer);
    socket.join(roomCode);
    // 입장한 본인한테 playerId 전달
    socket.emit("room:joined", { playerId: newPlayerId });
    // 방 전체 인원한테 업데이트된 플레이어 목록 전송
    io.to(roomCode).emit("room:update", { players: room.players });
    console.log(`방 입장: ${roomCode} / 닉네임: ${nickname}`);
  });
  // 방장이 대기실 페이지로 이동할 때 재연결
  socket.on("room:rejoin", ({ roomCode, nickname }) => {
    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit("room:error", { message: "방을 찾을 수 없어요" });
      return;
    }

    // 기존 방장 socketId 업데이트
    const host = room.players.find((p) => p.isHost);
    if (host) host.socketId = socket.id;

    socket.join(roomCode);
    io.to(roomCode).emit("room:update", { players: room.players });
  });
  // 현재 방 인원 조회
  socket.on("room:getPlayers", ({ roomCode }) => {
    console.log("getPlayers 요청:", roomCode);
    const room = rooms.get(roomCode);
    console.log("방 찾음:", !!room, "인원:", room?.players.length);
    if (!room) {
      socket.emit("room:error", { message: "방을 찾을 수 없어요" });
      return;
    }
    socket.emit("room:update", { players: room.players });
  });
  // 연결 끊겼을 때 방에서 제거
  socket.on("disconnect", () => {
    rooms.forEach((room, code) => {
      const index = room.players.findIndex((p) => p.socketId === socket.id);
      if (index === -1) return;

      const player = room.players[index];
      console.log(
        `disconnect 감지: ${player.nickname} / socketId: ${socket.id}`
      );

      const wasHost = room.players[index].isHost;

      setTimeout(() => {
        const currentRoom = rooms.get(code);
        if (!currentRoom) return;

        const currentPlayer = currentRoom.players[index];
        console.log(
          `5초 후 확인 - 현재 socketId: ${currentPlayer?.socketId} / 끊긴 socketId: ${socket.id}`
        );

        if (!currentPlayer || currentPlayer.socketId !== socket.id) {
          console.log("재연결 감지 → 삭제 안 함");
          return;
        }

        console.log(`${player.nickname} 방에서 제거`);
        currentRoom.players.splice(index, 1);

        if (currentRoom.players.length === 0) {
          rooms.delete(code);
          return;
        }

        if (wasHost) currentRoom.players[0].isHost = true;
        io.to(code).emit("room:update", { players: currentRoom.players });
      }, 5000);
    });
  });
}
