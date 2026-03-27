"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

export default function Home() {
  const router = useRouter();

  // 탭 전환 (방 만들기 / 입장하기)
  const [tab, setTab] = useState<"create" | "join">("create");

  // 입력값
  const [nickname, setNickname] = useState("");
  const [genre, setGenre] = useState("k-pop");
  const [rounds, setRounds] = useState(5);
  const [roomCode, setRoomCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 방 만들기
  function handleCreate() {
    if (!nickname.trim()) {
      setError("닉네임을 입력해주세요");
      return;
    }
    setLoading(true);
    setError("");

    const socket = getSocket();
    socket.connect(); // 수동 연결

    socket.off("room:created"); // 이전 리스너 제거
    socket.off("room:error");

    socket.on("connect", () => {
      socket.emit("room:create", { nickname, genre, rounds });
    });

    socket.on(
      "room:created",
      ({ code, playerId }: { code: string; playerId: string }) => {
        sessionStorage.setItem("nickname", nickname);
        sessionStorage.setItem("roomCode", code);
        sessionStorage.setItem("isHost", "true");
        sessionStorage.setItem("playerId", playerId);
        // disconnect 안 하고 그냥 이동
        router.push(`/room/${code}`);
      }
    );

    socket.on("room:error", ({ message }: { message: string }) => {
      setError(message);
      setLoading(false);
    });
  }

  // 방 입장하기
  function handleJoin() {
    if (!nickname.trim()) {
      setError("닉네임을 입력해주세요");
      return;
    }
    if (!roomCode.trim()) {
      setError("방 코드를 입력해주세요");
      return;
    }
    setLoading(true);
    setError("");

    const socket = getSocket();
    socket.connect();

    socket.off("room:joined");
    socket.off("room:error");

    socket.on("connect", () => {
      socket.emit("room:join", {
        roomCode: roomCode.toUpperCase(),
        nickname,
        playerId: "",
      });
    });

    socket.on("room:joined", ({ playerId }: { playerId: string }) => {
      sessionStorage.setItem("nickname", nickname);
      sessionStorage.setItem("roomCode", roomCode.toUpperCase());
      sessionStorage.setItem("isHost", "false");
      sessionStorage.setItem("playerId", playerId);
      router.push(`/room/${roomCode.toUpperCase()}`);
    });

    socket.on("room:error", ({ message }: { message: string }) => {
      setError(message);
      setLoading(false);
    });
  }
  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 타이틀 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🎵 뮤직 퀴즈</h1>
          <p className="text-gray-400">친구들과 함께 노래 맞추기!</p>
        </div>

        {/* 탭 */}
        <div className="flex bg-gray-900 rounded-xl p-1 mb-6">
          <button
            onClick={() => {
              setTab("create");
              setError("");
            }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "create"
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            방 만들기
          </button>
          <button
            onClick={() => {
              setTab("join");
              setError("");
            }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "join"
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            입장하기
          </button>
        </div>

        {/* 카드 */}
        <div className="bg-gray-900 rounded-2xl p-6 space-y-4">
          {/* 닉네임 (공통) */}
          <div>
            <label className="text-gray-400 text-sm mb-1 block">닉네임</label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임 입력"
              maxLength={10}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* 방 만들기 전용 */}
          {tab === "create" && (
            <>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">장르</label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="k-pop">K-POP</option>
                  <option value="pop">팝</option>
                  <option value="hip-hop">힙합</option>
                  <option value="rock">록</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">
                  라운드 수: {rounds}
                </label>
                <input
                  type="range"
                  min={3}
                  max={10}
                  value={rounds}
                  onChange={(e) => setRounds(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
                <div className="flex justify-between text-gray-500 text-xs mt-1">
                  <span>3</span>
                  <span>10</span>
                </div>
              </div>
            </>
          )}

          {/* 입장하기 전용 */}
          {tab === "join" && (
            <div>
              <label className="text-gray-400 text-sm mb-1 block">
                방 코드
              </label>
              <input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="6자리 코드 입력"
                maxLength={6}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 tracking-widest text-center text-lg font-bold"
              />
            </div>
          )}

          {/* 에러 메시지 */}
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          {/* 버튼 */}
          <button
            onClick={tab === "create" ? handleCreate : handleJoin}
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {loading
              ? "연결 중..."
              : tab === "create"
              ? "방 만들기"
              : "입장하기"}
          </button>
        </div>
      </div>
    </main>
  );
}
