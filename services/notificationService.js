import supabase from "../config/supabase.js";
import { emitNotificationToUser } from "../socket/notificationSocket.js";
import { sendPushNotification } from "./pushNotificationService.js";

export const getActivePushTokensByUserId = async (userId) => {
  const { data, error } = await supabase
    .from("user_push_tokens")
    .select("id, user_id, expo_push_token, device_id, platform, is_active")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
};

export const getNotificationsByUserId = async (userId) => {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, user_id, type, message, is_read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
};

export const createNotification = async ({
  userId,
  type,
  message,
  metadata = {},
}) => {
  const { data, error } = await supabase
    .from("notifications")
    .insert([
      {
        user_id: userId,
        type,
        message,
      },
    ])
    .select("id, user_id, type, message, is_read, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  emitNotificationToUser(userId, data);

  const pushTokens = await getActivePushTokensByUserId(userId);

  try {
    await sendPushNotification({
      userId,
      pushTokens: pushTokens.map((item) => item.expo_push_token),
      title: type,
      body: message,
      data: metadata,
    });
  } catch (pushError) {
    console.error("sendPushNotification error:", pushError.message);
  }

  return data;
};

export const markNotificationReadById = async (notificationId, userId) => {
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .select("id, user_id, type, message, is_read, created_at")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

export const markAllNotificationsReadByUserId = async (userId) => {
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
};

export const createMatchNotifications = async ({
  matchId,
  user1Id,
  user2Id,
  user1Name,
  user2Name,
}) => {
  return Promise.all([
    createNotification({
      userId: user1Id,
      type: "match",
      message: `You matched with ${user2Name || "someone"}!`,
      metadata: {
        match_id: matchId,
        matched_user_id: user2Id,
      },
    }),
    createNotification({
      userId: user2Id,
      type: "match",
      message: `You matched with ${user1Name || "someone"}!`,
      metadata: {
        match_id: matchId,
        matched_user_id: user1Id,
      },
    }),
  ]);
};

export const createMessageNotification = async ({
  matchId,
  senderId,
  receiverId,
  senderName,
  message,
  mediaUrl = null,
}) => {
  const notificationMessage = message?.trim()
    ? `${senderName || "Someone"} sent you a message`
    : `${senderName || "Someone"} sent you a media`;

  return createNotification({
    userId: receiverId,
    type: "message",
    message: notificationMessage,
    metadata: {
      match_id: matchId,
      sender_id: senderId,
      media_url: mediaUrl,
    },
  });
};

export const savePushToken = async ({
  userId,
  expoPushToken,
  deviceId = null,
  platform = null,
}) => {
  const { data, error } = await supabase
    .from("user_push_tokens")
    .upsert(
      [
        {
          user_id: userId,
          expo_push_token: expoPushToken,
          device_id: deviceId,
          platform,
          is_active: true,
        },
      ],
      {
        onConflict: "user_id,expo_push_token",
      }
    )
    .select("id, user_id, expo_push_token, device_id, platform, is_active, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

export const deactivatePushToken = async ({ userId, expoPushToken }) => {
  const { data, error } = await supabase
    .from("user_push_tokens")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("expo_push_token", expoPushToken)
    .select("id, user_id, expo_push_token, is_active")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};
