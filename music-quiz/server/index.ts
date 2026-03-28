import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { roomHandlers } from "./handlers/roomHandlers";
import { gameHandlers } from "./handlers/gameHandlers"; // 추가
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const app = express();
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
// Next.js(3000)에서 오는 요청 허용
app.use(
  cors({
    origin: [CLIENT_URL, "http://127.0.0.1:3000", "http://localhost:3000"],
  })
);
app.use(express.json());
const allowedOrigins = [
  "https://cadetbluee-project-musicquiz.vercel.app",
  "https://project-musicquiz.vercel.app",
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  /https:\/\/.*\.vercel\.app$/,
];

console.log("CLIENT_URL:", process.env.CLIENT_URL);
console.log("허용된 origins:", allowedOrigins); // origin → allowedOrigins
// Express 위에 Socket.io 서버를 얹음
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [CLIENT_URL, "http://127.0.0.1:3000", "http://localhost:3000"],
  },
});

// 클라이언트가 접속했을 때
io.on("connection", (socket) => {
  console.log("유저 접속:", socket.id);

  // 방 관련 이벤트 등록 (handlers 파일에서 관리)
  roomHandlers(io, socket);
  gameHandlers(io, socket);
  socket.on("disconnect", () => {
    console.log("유저 퇴장:", socket.id);
  });
});

httpServer.listen(4000, () => {
  console.log("CLIENT_URL:", process.env.CLIENT_URL);
});
