import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  getNotifications,
  getNotificationPreferences,
  markAllNotificationsRead,
  markNotificationRead,
  registerPushToken,
  removePushToken,
  updateNotificationPreferences,
} from "../controllers/notificationController.js";

const router = express.Router();

router.get("/", verifyToken, getNotifications);
router.get("/preferences", verifyToken, getNotificationPreferences);
router.patch("/preferences", verifyToken, updateNotificationPreferences);
router.post("/push-token", verifyToken, registerPushToken);
router.delete("/push-token", verifyToken, removePushToken);
router.post("/read", verifyToken, markNotificationRead);
router.post("/read-all", verifyToken, markAllNotificationsRead);

export default router;
