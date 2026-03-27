import { io, Socket } from "socket.io-client";

// 앱 전체에서 소켓 하나만 유지
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
      autoConnect: false, // 수동으로 연결
    });
  }
  return socket;
}
export function resetSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
