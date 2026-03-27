// 방 하나의 구조 정의
import { randomUUID } from "crypto";

export interface Player {
  playerId: string; // 추가 — 고유 식별자
  socketId: string;
  nickname: string;
  score: number;
  isHost: boolean;
}
export interface Room {
  code: string;
  players: Player[];
  genre: string;
  rounds: number;
  isPlaying: boolean;
  // 게임 진행용 필드 추가
  tracks: any[]
  currentRound: number
  answeredPlayers: string[]  // 이번 라운드에 정답 맞춘 playerId 목록
  roundTimer?: ReturnType<typeof setTimeout>
  roundStartTime: number
}

// 전체 방 목록 (메모리 저장)
// key: 방 코드, value: 방 정보
export const rooms = new Map<string, Room>();

// 6자리 랜덤 방 코드 생성 (예: "A3F9K2")
export function generateRoomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  // 혹시 중복이면 재생성
  return rooms.has(code) ? generateRoomCode() : code;
}
// 고유 플레이어 ID 발급
export function generatePlayerId(): string {
  return randomUUID();
}
