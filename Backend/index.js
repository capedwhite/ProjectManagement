import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import projectMemberRoutes from "./routes/projectMembersRoute.js";
import { searchUser } from "./controller/userController.js";
import prisma from "./db/prisma.js";

const app = express();

app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/user", searchUser)
app.use("/api/projects/member", projectMemberRoutes)
app.use("/uploads", express.static("uploads"));
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});
const httpServer = createServer(app); // wrap Express in a raw HTTP server

export const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL, credentials: true },
});

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Client tells us which project's chat room they want to join
  socket.on("join-project", (projectId) => {
    socket.join(`project-${projectId}`);
    console.log(`Socket ${socket.id} joined project-${projectId}`);
  });

  socket.on("leave-project", (projectId) => {
    socket.leave(`project-${projectId}`);
  });

  // Client sends a chat message
  socket.on("send-message", async (data) => {
    const { projectId, text, userId, userName } = data;

const message = await prisma.message.create({
    data: { text, projectId: Number(projectId), userId: Number(userId) },
    include: { user: { select: { id: true, name: true } } },
  });

  io.to(`project-${projectId}`).emit("new-message", message);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});
const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => { // listen on httpServer now, not app
  console.log(`Server running on http://localhost:${PORT}`);
});

