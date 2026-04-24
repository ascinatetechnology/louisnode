import {
  deactivatePushToken,
  getNotificationsByUserId,
  markAllNotificationsReadByUserId,
  markNotificationReadById,
  savePushToken,
} from "../services/notificationService.js";
import supabase from "../config/supabase.js";

export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = await getNotificationsByUserId(userId);

    return res.json({
      message: "Notifications fetched successfully",
      count: notifications.length,
      notifications,
    });
  } catch (err) {
    console.error("getNotifications error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const getNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("users")
      .select("notify_new_matches, notify_messages, notify_likes")
      .eq("id", userId)
      .single();

    if (error) {
      return res.status(400).json(error);
    }

    return res.json({
      notify_new_matches: data?.notify_new_matches !== false,
      notify_messages: data?.notify_messages !== false,
      notify_likes: data?.notify_likes !== false,
    });
  } catch (err) {
    console.error("getNotificationPreferences error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notify_new_matches, notify_messages, notify_likes } = req.body;

    if (
      typeof notify_new_matches !== "boolean" ||
      typeof notify_messages !== "boolean" ||
      typeof notify_likes !== "boolean"
    ) {
      return res.status(400).json({
        message: "notify_new_matches, notify_messages, and notify_likes must be true or false",
      });
    }

    const { data, error } = await supabase
      .from("users")
      .update({
        notify_new_matches,
        notify_messages,
        notify_likes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select("id, notify_new_matches, notify_messages, notify_likes")
      .single();

    if (error) {
      return res.status(400).json(error);
    }

    return res.json({
      message: "Notification preferences updated successfully",
      preferences: data,
    });
  } catch (err) {
    console.error("updateNotificationPreferences error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notification_id } = req.body;

    if (!notification_id) {
      return res.status(400).json({
        message: "notification_id is required",
      });
    }

    const notification = await markNotificationReadById(notification_id, userId);

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found",
      });
    }

    return res.json({
      message: "Notification marked as read",
      notification,
    });
  } catch (err) {
    console.error("markNotificationRead error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const updatedNotifications = await markAllNotificationsReadByUserId(userId);

    return res.json({
      message: "All notifications marked as read",
      updated_count: updatedNotifications.length,
    });
  } catch (err) {
    console.error("markAllNotificationsRead error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const registerPushToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { expo_push_token, device_id, platform } = req.body;

    if (!expo_push_token) {
      return res.status(400).json({
        message: "expo_push_token is required",
      });
    }

    const token = await savePushToken({
      userId,
      expoPushToken: expo_push_token,
      deviceId: device_id,
      platform,
    });

    return res.json({
      message: "Push token saved successfully",
      token,
    });
  } catch (err) {
    console.error("registerPushToken error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const removePushToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { expo_push_token } = req.body;

    if (!expo_push_token) {
      return res.status(400).json({
        message: "expo_push_token is required",
      });
    }

    const token = await deactivatePushToken({
      userId,
      expoPushToken: expo_push_token,
    });

    if (!token) {
      return res.status(404).json({
        message: "Push token not found",
      });
    }

    return res.json({
      message: "Push token removed successfully",
      token,
    });
  } catch (err) {
    console.error("removePushToken error:", err);
    return res.status(500).json({ error: err.message });
  }
};
