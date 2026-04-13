import supabase from "../config/supabase.js";
import { createMessageNotification } from "../services/notificationService.js";

export const registerChatSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 Socket connected:", socket.id);

    socket.on("join_chat", async ({ match_id, user_id }) => {
      try {
        if (!match_id || !user_id) return;

        const { data: match, error } = await supabase
          .from("matches")
          .select("id, user1_id, user2_id, status")
          .eq("id", match_id)
          .eq("status", "active")
          .single();

        if (error || !match) {
          socket.emit("socket_error", { message: "Invalid match" });
          return;
        }

        const isAllowed =
          match.user1_id === user_id || match.user2_id === user_id;

        if (!isAllowed) {
          socket.emit("socket_error", { message: "Unauthorized chat access" });
          return;
        }

        socket.join(`chat:${match_id}`);
        socket.emit("joined_chat", { match_id });
      } catch (err) {
        console.log("🔥 join_chat error:", err);
        socket.emit("socket_error", { message: "Join chat failed" });
      }
    });

    socket.on("leave_chat", ({ match_id }) => {
      if (!match_id) return;
      socket.leave(`chat:${match_id}`);
    });

    socket.on("typing_start", ({ match_id, user_id, name }) => {
      if (!match_id || !user_id) return;

      socket.to(`chat:${match_id}`).emit("typing_started", {
        match_id,
        user_id,
        name: name || "Someone",
      });
    });

    socket.on("typing_stop", ({ match_id, user_id }) => {
      if (!match_id || !user_id) return;

      socket.to(`chat:${match_id}`).emit("typing_stopped", {
        match_id,
        user_id,
      });
    });

    socket.on("send_message", async (payload, callback) => {
      try {
        const { match_id, sender_id, message = "", media_url = null } = payload;

        if (!match_id || !sender_id) {
          callback?.({ ok: false, message: "match_id and sender_id are required" });
          return;
        }

        if (!message?.trim() && !media_url) {
          callback?.({ ok: false, message: "Message or media_url is required" });
          return;
        }

        const { data: match, error: matchError } = await supabase
          .from("matches")
          .select("id, user1_id, user2_id, status")
          .eq("id", match_id)
          .eq("status", "active")
          .single();

        if (matchError || !match) {
          callback?.({ ok: false, message: "Invalid match" });
          return;
        }

        const isAllowed =
          match.user1_id === sender_id || match.user2_id === sender_id;

        if (!isAllowed) {
          callback?.({ ok: false, message: "Unauthorized sender" });
          return;
        }

        const receiverId =
          match.user1_id === sender_id ? match.user2_id : match.user1_id;

        const { data: sender, error: senderError } = await supabase
          .from("users")
          .select("id, name")
          .eq("id", sender_id)
          .single();

        if (senderError || !sender) {
          callback?.({ ok: false, message: "Sender not found" });
          return;
        }

        const { data: insertedMessage, error: insertError } = await supabase
          .from("messages")
          .insert([
            {
              match_id,
              sender_id,
              message: message?.trim() || null,
              media_url,
              is_read: false,
            },
          ])
          .select()
          .single();

        if (insertError) {
          callback?.({ ok: false, message: insertError.message });
          return;
        }

        await createMessageNotification({
          matchId: match_id,
          senderId: sender_id,
          receiverId,
          senderName: sender.name,
          message,
          mediaUrl: media_url,
        });

        io.to(`chat:${match_id}`).emit("message_received", insertedMessage);

        callback?.({
          ok: true,
          message: insertedMessage,
        });
      } catch (err) {
        console.log("🔥 send_message error:", err);
        callback?.({ ok: false, message: "Failed to send message" });
      }
    });

    socket.on("mark_read", async ({ match_id, user_id }, callback) => {
      try {
        if (!match_id || !user_id) {
          callback?.({ ok: false, message: "match_id and user_id required" });
          return;
        }

        const { error } = await supabase
          .from("messages")
          .update({ is_read: true })
          .eq("match_id", match_id)
          .neq("sender_id", user_id)
          .eq("is_read", false);

        if (error) {
          callback?.({ ok: false, message: error.message });
          return;
        }

        io.to(`chat:${match_id}`).emit("messages_read", {
          match_id,
          reader_id: user_id,
        });

        callback?.({ ok: true });
      } catch (err) {
        console.log("🔥 mark_read error:", err);
        callback?.({ ok: false, message: "Failed to mark read" });
      }
    });

    socket.on("disconnect", () => {
      console.log("🔴 Socket disconnected:", socket.id);
    });
  });
};
