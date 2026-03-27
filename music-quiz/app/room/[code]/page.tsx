"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { getSocket, resetSocket } from "@/lib/socket";
interface Player {
  socketId: string;
  nickname: string;
  score: number;
  isHost: boolean;
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [socket, setSocket] = useState<Socket | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [nickname, setNickname] = useState("");
  const [isHost, setIsHost] = useState(false);
  const isGameStarting = useRef(false);
  useEffect(() => {
    const savedNickname = sessionStorage.getItem("nickname") || "";
    const savedIsHost = sessionStorage.getItem("isHost") === "true";
    const savedPlayerId = sessionStorage.getItem("playerId") || "";

    setNickname(savedNickname);
    setIsHost(savedIsHost);

    // 새로 연결하지 않고 기존 소켓 재사용
    const socket = getSocket();
    setSocket(socket);

    socket.on("game:started", () => {
      isGameStarting.current = true;
      router.push(`/game/${code}`);
    });

    // 이미 연결된 소켓이니까 바로 이벤트만 등록
    // 방장은 이미 방에 있으니 rejoin 불필요
    // 참가자는 이미 room:join 완료된 상태
    socket.on("room:update", ({ players }: { players: Player[] }) => {
      setPlayers(players);
      // 내 isHost 상태도 업데이트
      const savedNickname = sessionStorage.getItem("nickname") || "";
      const me = players.find((p) => p.nickname === savedNickname);
      if (me) {
        setIsHost(me.isHost);
      }
    });

    socket.on("room:error", ({ message }: { message: string }) => {
      alert(message);
      router.push("/");
    });

    // 현재 방 인원 요청
    socket.emit("room:getPlayers", { roomCode: code });

    return () => {
      // 페이지 떠날 때 (뒤로가기, 홈으로, 탭 닫기 모두 해당)
      socket.off("room:update");
      socket.off("room:error");

      // 게임 시작이 아닐 때만 방 나가기
      if (!isGameStarting.current) {
        socket.emit("room:leave", { roomCode: code });
        resetSocket();
      }
    };
  }, [code, router]);

  // 방 코드 클립보드 복사
  function copyCode() {
    navigator.clipboard.writeText(code);
    alert("방 코드가 복사됐어요!");
  }

  // 게임 시작 (방장만)
  function handleStart() {
    if (players.length < 2) {
      alert("최소 2명이 필요해요!");
      return;
    }
    socket?.emit("game:start", { roomCode: code });
  }

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <p className="text-gray-400 text-sm mb-2">대기실</p>
          <div
            onClick={copyCode}
            className="inline-flex items-center gap-2 bg-gray-900 rounded-xl px-6 py-3 cursor-pointer hover:bg-gray-800 transition-colors"
          >
            <span className="text-white font-bold text-2xl tracking-widest">
              {code}
            </span>
            <span className="text-gray-400 text-sm">복사</span>
          </div>
          <p className="text-gray-500 text-xs mt-2">
            친구에게 코드를 알려주세요
          </p>
        </div>

        {/* 플레이어 목록 */}
        <div className="bg-gray-900 rounded-2xl p-6 mb-4">
          <h2 className="text-gray-400 text-sm mb-4">
            참가자 {players.length}명
          </h2>
          <div className="space-y-3">
            {players.map((player) => (
              <div
                key={player.socketId}
                className="flex items-center gap-3 bg-gray-800 rounded-xl px-4 py-3"
              >
                {/* 아바타 */}
                <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {player.nickname[0]?.toUpperCase()}
                </div>
                <span className="text-white font-medium flex-1">
                  {player.nickname}
                </span>
                {/* 방장 배지 */}
                {player.isHost && (
                  <span className="text-xs bg-yellow-500 text-yellow-950 font-bold px-2 py-0.5 rounded-full">
                    방장
                  </span>
                )}
                {/* 본인 표시 */}
                {player.nickname === nickname && (
                  <span className="text-xs text-gray-500">나</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 게임 시작 버튼 (방장만) */}
        {isHost ? (
          <button
            onClick={handleStart}
            disabled={players.length < 2}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {players.length < 2 ? "2명 이상 필요해요" : "게임 시작!"}
          </button>
        ) : (
          <div className="text-center text-gray-500 text-sm py-3">
            방장이 게임을 시작할 때까지 기다려주세요...
          </div>
        )}
      </div>
    </main>
  );
}
