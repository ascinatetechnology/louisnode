import supabase from "../config/supabase.js";

export const getChatList = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select("id, user1_id, user2_id, status, created_at")
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (matchesError) {
      return res.status(400).json(matchesError);
    }

    if (!matches || matches.length === 0) {
      return res.json({
        message: "No chats found",
        count: 0,
        chats: [],
      });
    }

    const otherUserIds = matches.map((match) =>
      match.user1_id === userId ? match.user2_id : match.user1_id
    );

    const { data: users, error: usersError } = await supabase
      .from("users")
      .select(`
        id,
        name,
        location,
        profile_image,
        is_online,
        user_videos (
          thumbnail_url,
          created_at
        )
      `)
      .in("id", otherUserIds);

    if (usersError) {
      return res.status(400).json(usersError);
    }

    const matchIds = matches.map((m) => m.id);

    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("id, match_id, sender_id, message, media_url, is_read, created_at")
      .in("match_id", matchIds)
      .order("created_at", { ascending: false });

    if (messagesError) {
      return res.status(400).json(messagesError);
    }

    const chats = matches.map((match) => {
      const otherUserId =
        match.user1_id === userId ? match.user2_id : match.user1_id;

      const otherUser = users?.find((u) => u.id === otherUserId);

      const matchMessages =
        messages?.filter((msg) => msg.match_id === match.id) || [];

      const lastMessage = matchMessages[0] || null;

      const unreadCount = matchMessages.filter(
        (msg) => msg.sender_id !== userId && msg.is_read === false
      ).length;

      let thumbnailUrl = null;

      if (otherUser?.user_videos?.length > 0) {
        const latestMedia = [...otherUser.user_videos].sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        )[0];

        thumbnailUrl = latestMedia?.thumbnail_url || null;
      }

      return {
        match_id: match.id,
        user_id: otherUser?.id || null,
        name: otherUser?.name || "Unknown",
        location: otherUser?.location || "",
        profile_image: otherUser?.profile_image || null,
        thumbnail_url: thumbnailUrl,
        is_online: otherUser?.is_online || false,
        last_message:
          lastMessage?.message ||
          (lastMessage?.media_url ? "Sent a media" : "Start chatting"),
        last_message_at: lastMessage?.created_at || match.created_at,
        unread_count: unreadCount,
      };
    });

    chats.sort(
      (a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0)
    );

    return res.json({
      message: "Chats fetched successfully",
      count: chats.length,
      chats,
    });
  } catch (err) {
    console.log("🔥 getChatList error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const getMessagesByMatch = async (req, res) => {
  try {
    const userId = req.user.id;
    const { matchId } = req.params;

    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id, user1_id, user2_id, status")
      .eq("id", matchId)
      .eq("status", "active")
      .single();

    if (matchError || !match) {
      return res.status(404).json({ message: "Match not found" });
    }

    const isAllowed =
      match.user1_id === userId || match.user2_id === userId;

    if (!isAllowed) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const { data: messages, error } = await supabase
      .from("messages")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });

    if (error) {
      return res.status(400).json(error);
    }

    return res.json({
      message: "Messages fetched successfully",
      count: messages?.length || 0,
      messages: messages || [],
    });
  } catch (err) {
    console.log("🔥 getMessagesByMatch error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { matchId } = req.params;
    const { message, media_url } = req.body;

    if (!message?.trim() && !media_url) {
      return res.status(400).json({ message: "Message or media_url is required" });
    }

    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id, user1_id, user2_id, status")
      .eq("id", matchId)
      .eq("status", "active")
      .single();

    if (matchError || !match) {
      return res.status(404).json({ message: "Match not found" });
    }

    const isAllowed =
      match.user1_id === userId || match.user2_id === userId;

    if (!isAllowed) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const { data, error } = await supabase
      .from("messages")
      .insert([
        {
          match_id: matchId,
          sender_id: userId,
          message: message?.trim() || null,
          media_url: media_url || null,
          is_read: false,
        },
      ])
      .select()
      .single();

    if (error) {
      return res.status(400).json(error);
    }

    return res.json({
      message: "Message sent successfully",
      data,
    });
  } catch (err) {
    console.log("🔥 sendMessage error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const markMessagesRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { matchId } = req.params;

    const { error } = await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("match_id", matchId)
      .neq("sender_id", userId)
      .eq("is_read", false);

    if (error) {
      return res.status(400).json(error);
    }

    return res.json({
      message: "Messages marked as read",
    });
  } catch (err) {
    console.log("🔥 markMessagesRead error:", err);
    return res.status(500).json({ error: err.message });
  }
};