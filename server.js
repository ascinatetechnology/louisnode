import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import http from "http";
import { Server } from "socket.io";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import discoverRoutes from "./routes/discoverRoutes.js";
import matchesRoutes from "./routes/matchesRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";

import { registerChatSocket } from "./socket/chatSocket.js";

const app = express();

app.use(cors());
app.use(express.json());

app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));

app.get("/", (req, res) => {
  res.render("login");
});

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/discover", discoverRoutes);
app.use("/matches", matchesRoutes);
app.use("/chat", chatRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH"],
  },
});

registerChatSocket(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});