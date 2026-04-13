import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  registerPushToken,
  removePushToken,
} from "../controllers/notificationController.js";

const router = express.Router();

router.get("/", verifyToken, getNotifications);
router.post("/push-token", verifyToken, registerPushToken);
router.delete("/push-token", verifyToken, removePushToken);
router.post("/read", verifyToken, markNotificationRead);
router.post("/read-all", verifyToken, markAllNotificationsRead);

export default router;
