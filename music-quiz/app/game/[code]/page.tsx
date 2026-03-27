"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSocket, resetSocket } from "@/lib/socket";

interface Score {
  playerId: string;
  nickname: string;
  score: number;
}

interface CorrectAnswer {
  title: string;
  artist: string;
  albumImage: string;
}

// 게임 진행 단계
type Phase =
  | "waiting" // 라운드 시작 대기
  | "playing" // 노래 재생 중
  | "correct" // 정답 맞춤
  | "roundEnd" // 라운드 종료
  | "gameEnd"; // 게임 종료

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [phase, setPhase] = useState<Phase>("waiting");
  const [roundNum, setRoundNum] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [albumImage, setAlbumImage] = useState("");
  const [answer, setAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState(30);
  const [scores, setScores] = useState<Score[]>([]);
  const [finalScores, setFinalScores] = useState<Score[]>([]);
  const [correctAnswer, setCorrectAnswer] = useState<CorrectAnswer | null>(
    null
  );
  const [correctNickname, setCorrectNickname] = useState("");
  const [correctScore, setCorrectScore] = useState(0);
  const [myNickname, setMyNickname] = useState("");

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const savedNickname = sessionStorage.getItem("nickname") || "";
    setMyNickname(savedNickname);

    const socket = getSocket();

    // 라운드 시작
    socket.on(
      "round:start",
      ({ roundNum, totalRounds, previewUrl, albumImage }) => {
        setRoundNum(roundNum);
        setTotalRounds(totalRounds);
        setAlbumImage(albumImage);
        setAnswer("");
        setCorrectAnswer(null);
        setCorrectNickname("");
        setPhase("playing");
        setTimeLeft(30);
        setMyAnswered(false);
        // 노래 재생
        if (audioRef.current) {
          audioRef.current.src = previewUrl;
          audioRef.current.play();
        }

        // 타이머 시작
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              clearInterval(timerRef.current!);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    );

    // 정답자 발생
    socket.on("answer:correct", ({ nickname, score, totalScore }) => {
      setCorrectNickname(nickname);
      setCorrectScore(score);
      setPhase("correct");

      // 내가 맞춘 경우
      if (nickname === savedNickname) {
        setMyAnswered(true);
      }

      if (nickname === savedNickname && audioRef.current) {
        audioRef.current.pause();
      }
    });

    // 오답
    socket.on("answer:wrong", () => {
      // 입력창 흔들기 효과용 (CSS로 처리)
      const input = document.getElementById("answer-input");
      input?.classList.add("shake");
      setTimeout(() => input?.classList.remove("shake"), 500);
    });

    // 라운드 종료
    socket.on("round:end", ({ correctAnswer, scores }) => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioRef.current) audioRef.current.pause();

      setCorrectAnswer(correctAnswer);
      setScores(scores.sort((a: Score, b: Score) => b.score - a.score));
      setPhase("roundEnd");
    });

    // 게임 종료
    socket.on("game:end", ({ finalScores }) => {
      setFinalScores(finalScores);
      setPhase("gameEnd");
    });

    return () => {
      socket.off("round:start");
      socket.off("answer:correct");
      socket.off("answer:wrong");
      socket.off("round:end");
      socket.off("game:end");
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioRef.current) audioRef.current.pause();

      socket.emit("room:leave", { roomCode: code });
      resetSocket();
    };
  }, [code]);
  const [myAnswered, setMyAnswered] = useState(false);
  // 정답 제출
  function submitAnswer() {
    if (!answer.trim()) return;
    if (phase !== "playing" && phase !== "correct") return;
    if (myAnswered) return;
    const socket = getSocket();
    socket.emit("answer:submit", { roomCode: code, answer });
    setAnswer("");
  }

  // Enter 키로 제출
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") submitAnswer();
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4">
      <audio ref={audioRef} />

      {/* 대기 중 */}
      {phase === "waiting" && (
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🎵</div>
          <p className="text-gray-400">게임 시작 대기 중...</p>
        </div>
      )}

      {/* 게임 진행 중 */}
      {(phase === "playing" || phase === "correct") && (
        <div className="w-full max-w-md">
          {/* 라운드 + 타이머 */}
          <div className="flex justify-between items-center mb-6">
            <span className="text-gray-400 text-sm">
              {roundNum} / {totalRounds} 라운드
            </span>
            <div
              className={`text-2xl font-bold ${
                timeLeft <= 10 ? "text-red-400" : "text-white"
              }`}
            >
              {timeLeft}초
            </div>
          </div>

          {/* 앨범 이미지 (블러 처리) */}
          <div className="relative w-full aspect-square rounded-2xl overflow-hidden mb-6">
            {albumImage && (
              <img
                src={albumImage}
                alt="album"
                className="w-full h-full object-cover blur-xl scale-110"
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-8xl">🎵</div>
            </div>
          </div>

          {/* 정답자 알림 */}
          {phase === "correct" && (
            <div className="bg-green-500 rounded-xl px-4 py-3 mb-4 text-center">
              <p className="font-bold">
                {correctNickname === myNickname
                  ? `🎉 정답! +${correctScore}점`
                  : `${correctNickname}님이 맞췄어요! +${correctScore}점`}
              </p>
            </div>
          )}

          {/* 정답 입력 — playing 이거나 correct 인데 내가 아직 못 맞춘 경우 */}
          {(phase === "playing" || phase === "correct") && !myAnswered && (
            <div className="flex gap-2">
              <input
                id="answer-input"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="노래 제목 또는 가수 이름"
                className="flex-1 bg-gray-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500"
                autoComplete="off"
              />
              <button
                onClick={submitAnswer}
                className="bg-purple-600 hover:bg-purple-500 px-4 py-3 rounded-xl font-bold transition-colors"
              >
                제출
              </button>
            </div>
          )}
          {/* 내가 맞춘 경우 */}
          {myAnswered && (phase === "playing" || phase === "correct") && (
            <div className="text-center text-green-400 font-bold py-3">
              🎉 정답! 다른 플레이어를 기다리는 중...
            </div>
          )}
        </div>
      )}

      {/* 라운드 종료 */}
      {phase === "roundEnd" && correctAnswer && (
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <p className="text-gray-400 text-sm mb-3">정답</p>
            <img
              src={correctAnswer.albumImage}
              alt="album"
              className="w-32 h-32 rounded-xl mx-auto mb-3 object-cover"
            />
            <p className="text-xl font-bold">{correctAnswer.title}</p>
            <p className="text-gray-400">{correctAnswer.artist}</p>
          </div>

          {/* 점수 현황 */}
          <div className="bg-gray-900 rounded-2xl p-4">
            <p className="text-gray-400 text-sm mb-3">현재 점수</p>
            <div className="space-y-2">
              {scores.map((s, i) => (
                <div
                  key={s.playerId}
                  className="flex items-center gap-3 bg-gray-800 rounded-xl px-4 py-2"
                >
                  <span className="text-gray-400 w-6 text-sm">{i + 1}</span>
                  <span
                    className={`flex-1 ${
                      s.nickname === myNickname
                        ? "text-purple-400 font-bold"
                        : "text-white"
                    }`}
                  >
                    {s.nickname}
                  </span>
                  <span className="font-bold">{s.score}점</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-gray-500 text-sm mt-4">
            {roundNum < totalRounds
              ? "잠시 후 다음 라운드..."
              : "잠시 후 결과 발표..."}
          </p>
        </div>
      )}

      {/* 게임 종료 */}
      {phase === "gameEnd" && (
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-6xl mb-3">🏆</div>
            <h2 className="text-2xl font-bold">게임 종료!</h2>
            <p className="text-yellow-400 font-bold mt-1">
              🥇 {finalScores[0]?.nickname} 우승!
            </p>
          </div>

          <div className="bg-gray-900 rounded-2xl p-4 mb-6">
            <div className="space-y-2">
              {finalScores.map((s: any) => (
                <div
                  key={s.playerId}
                  className="flex items-center gap-3 bg-gray-800 rounded-xl px-4 py-3"
                >
                  <span className="text-xl w-8">
                    {s.rank === 1
                      ? "🥇"
                      : s.rank === 2
                      ? "🥈"
                      : s.rank === 3
                      ? "🥉"
                      : `${s.rank}위`}
                  </span>
                  <span
                    className={`flex-1 font-medium ${
                      s.nickname === myNickname
                        ? "text-purple-400 font-bold"
                        : "text-white"
                    }`}
                  >
                    {s.nickname}
                  </span>
                  <span className="font-bold">{s.score}점</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              resetSocket(); // 소켓 리셋 후 이동
              router.push("/");
            }}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition-colors"
          >
            홈으로
          </button>
        </div>
      )}

      {/* 흔들기 애니메이션 */}
      <style jsx>{`
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-8px);
          }
          75% {
            transform: translateX(8px);
          }
        }
        .shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </main>
  );
}
