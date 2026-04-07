import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  getChatList,
  getMessagesByMatch,
  sendMessage,
  markMessagesRead,
} from "../controllers/chatController.js";

const router = express.Router();

router.get("/", verifyToken, getChatList);
router.get("/:matchId/messages", verifyToken, getMessagesByMatch);
router.post("/:matchId/message", verifyToken, sendMessage);
router.patch("/:matchId/read", verifyToken, markMessagesRead);

export default router;