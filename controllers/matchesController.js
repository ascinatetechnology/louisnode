import supabase from "../config/supabase.js";

export const getMyMatches = async (req, res) => {
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
        message: "No matches found",
        count: 0,
        users: [],
      });
    }

    const matchedUserIds = matches.map((match) =>
      match.user1_id === userId ? match.user2_id : match.user1_id
    );

    const { data: users, error: usersError } = await supabase
      .from("users")
      .select(`
        *,
        user_videos (
          video_url,
          thumbnail_url,
          created_at
        )
      `)
      .in("id", matchedUserIds);

    if (usersError) {
      return res.status(400).json(usersError);
    }

    const finalUsers = (users || []).map((user) => {
      let latestVideo = null;
      let latestThumbnail = null;

      if (user.user_videos && user.user_videos.length > 0) {
        const latestMedia = [...user.user_videos].sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        )[0];

        latestVideo = latestMedia?.video_url || null;
        latestThumbnail = latestMedia?.thumbnail_url || null;
      }

      const relatedMatch = matches.find(
        (m) => m.user1_id === user.id || m.user2_id === user.id
      );

      return {
        ...user,
        video_url: latestVideo,
        thumbnail_url: latestThumbnail,
        match_id: relatedMatch?.id || null,
        matched_at: relatedMatch?.created_at || null,
      };
    });

    return res.json({
      message: "Matches fetched successfully",
      count: finalUsers.length,
      users: finalUsers,
    });
  } catch (err) {
    console.error("🔥 getMyMatches error:", err);
    return res.status(500).json({ error: err.message });
  }
};
export const unmatchUser = async (req, res) => {
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

    const isAllowed = match.user1_id === userId || match.user2_id === userId;

    if (!isAllowed) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const { data: updatedMatch, error: updateError } = await supabase
      .from("matches")
      .update({ status: "unmatched" })
      .eq("id", matchId)
      .select("id, user1_id, user2_id, status, created_at")
      .single();

    if (updateError) {
      return res.status(400).json(updateError);
    }

    return res.json({
      message: "User unmatched successfully",
      match: updatedMatch,
    });
  } catch (err) {
    console.error("unmatchUser error:", err);
    return res.status(500).json({ error: err.message });
  }
};
