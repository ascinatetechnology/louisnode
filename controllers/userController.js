import supabase from "../config/supabase.js";
import bcrypt from "bcryptjs";
import { generateOTP } from "../utils/otp.js";
import { sendEmail } from "../config/emailService.js";


export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (userError) {
      return res.status(400).json(userError);
    }

    const { data: videoData, error: videoError } = await supabase
      .from("user_videos")
      .select("video_url")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (videoError) {
      return res.status(400).json(videoError);
    }

    const { data: interestData, error: interestError } = await supabase
      .from("user_interests")
      .select("interest_id")
      .eq("user_id", userId);

    if (interestError) {
      return res.status(400).json(interestError);
    }

    const { data: photoData, error: photoError } = await supabase
      .from("user_photos")
      .select("id, image_url, is_primary, is_public, created_at")
      .eq("user_id", userId)
      .eq("is_public", true)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    if (photoError) {
      return res.status(400).json(photoError);
    }

    const interestIds = interestData.map(item => item.interest_id);

    res.json({
      ...user,
      video_url: videoData?.[0]?.video_url || null,
      interests: interestIds,
      photos: photoData || []
    });

  } catch (err) {
    console.error("getProfile crash:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getUserProfileById = async (req, res) => {
  try {
    const viewerId = req.user.id;
    const profileId = req.params.id?.trim();

    if (!profileId) {
      return res.status(400).json({
        message: "Valid user id is required"
      });
    }

    const { data: viewer, error: viewerError } = await supabase
      .from("users")
      .select("id, latitude, longitude")
      .eq("id", viewerId)
      .single();

    if (viewerError || !viewer) {
      return res.status(404).json({
        message: "Current user not found"
      });
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", profileId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (user.profile_visibility === false && viewerId !== user.id) {
      return res.status(404).json({
        message: "Profile not available"
      });
    }

    if (user.profile_visibility_mode === "liked" && viewerId !== user.id) {
      const { data: likedViewer } = await supabase
        .from("likes")
        .select("id")
        .eq("user_id", profileId)
        .eq("liked_user_id", viewerId)
        .maybeSingle();

      if (!likedViewer) {
        return res.status(404).json({
          message: "Profile not available"
        });
      }
    }

    if (
      viewerId !== user.id &&
      (user.is_banned === true || user.moderation_status === "removed")
    ) {
      return res.status(404).json({
        message: "Profile not available"
      });
    }

    const { data: videoRows, error: videoError } = await supabase
      .from("user_videos")
      .select("video_url, thumbnail_url, created_at")
      .eq("user_id", profileId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (videoError) {
      return res.status(400).json(videoError);
    }

    const { data: photoRows, error: photoError } = await supabase
      .from("user_photos")
      .select("id, image_url, is_primary, is_public, created_at")
      .eq("user_id", profileId)
      .eq("is_public", true)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    if (photoError) {
      return res.status(400).json(photoError);
    }

    const { data: interestRows, error: interestError } = await supabase
      .from("user_interests")
      .select("interest_id")
      .eq("user_id", profileId);

    if (interestError) {
      return res.status(400).json(interestError);
    }

    const age = calculateAgeFromDob(user.dob);
    const latestVideo = videoRows?.[0] || null;

    let distanceKm = null;

    if (
      viewer?.latitude &&
      viewer?.longitude &&
      user?.latitude &&
      user?.longitude
    ) {
      distanceKm = Number(
        calculateDistanceKm(
          viewer.latitude,
          viewer.longitude,
          user.latitude,
          user.longitude
        ).toFixed(1)
      );
    }

    return res.json({
      message: "Profile details fetched successfully",
      user: {
        ...user,
        age,
        distance_km: distanceKm,
        video_url: latestVideo?.video_url || null,
        thumbnail_url: latestVideo?.thumbnail_url || null,
        photos: photoRows || [],
        interests: (interestRows || []).map(item => item.interest_id)
      }
    });
  } catch (err) {
    console.error("getUserProfileById error:", err);
    return res.status(500).json({
      error: err.message
    });
  }
};

export const getNearbyUsers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude, radius = 20 } = req.query;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        message: "Latitude and longitude are required"
      });
    }

    const myLat = parseFloat(latitude);
    const myLng = parseFloat(longitude);
    const maxRadius = parseFloat(radius);

    if (isNaN(myLat) || isNaN(myLng) || isNaN(maxRadius)) {
      return res.status(400).json({
        message: "Invalid latitude, longitude, or radius"
      });
    }

    const { data: currentUser, error: currentUserError } = await supabase
      .from("users")
      .select("id, gender, match_gender, location_enabled")
      .eq("id", userId)
      .single();

    if (currentUserError || !currentUser) {
      return res.status(404).json({
        message: "Current user not found"
      });
    }

    if (currentUser.location_enabled === false) {
      return res.status(403).json({
        message: "Location access is turned off"
      });
    }

    const { data: blockedRows } = await supabase
      .from("blocks")
      .select("blocked_user_id")
      .eq("user_id", userId);

    const blockedUserIds = (blockedRows || []).map(item => item.blocked_user_id);

    const { data: likedMeRows } = await supabase
      .from("likes")
      .select("user_id")
      .eq("liked_user_id", userId);

    const usersWhoLikedMe = (likedMeRows || []).map(item => item.user_id);

    const { data: users, error } = await supabase
      .from("users")
      .select(`
        id,
        name,
        dob,
        gender,
        match_gender,
        profile_image,
        latitude,
        longitude,
        location_enabled,
        profile_visibility,
        profile_visibility_mode,
        is_banned,
        moderation_status,
        location,
        is_verified
      `)
      .neq("id", userId)
      .eq("profile_visibility", true)
      .eq("location_enabled", true)
      .eq("is_banned", false)
      .neq("moderation_status", "removed")
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (error) {
      return res.status(400).json(error);
    }

    const filteredUsers = (users || [])
      .filter(user => !blockedUserIds.includes(user.id))
      .filter(user => user.profile_visibility_mode !== "liked" || usersWhoLikedMe.includes(user.id))
      .filter(user => {
        const iMatchUser =
          !currentUser.match_gender ||
          currentUser.match_gender === "BOTH" ||
          currentUser.match_gender === user.gender;

        const userMatchesMe =
          !user.match_gender ||
          user.match_gender === "BOTH" ||
          user.match_gender === currentUser.gender;

        return iMatchUser && userMatchesMe;
      })
      .map(user => {
        const distance_km = Number(
          calculateDistanceKm(
            myLat,
            myLng,
            parseFloat(user.latitude),
            parseFloat(user.longitude)
          ).toFixed(1)
        );

        return {
          ...user,
          age: calculateAgeFromDob(user.dob),
          distance_km
        };
      })
      .filter(user => user.distance_km <= maxRadius)
      .sort((a, b) => a.distance_km - b.distance_km);

    return res.json({
      message: "Nearby users fetched successfully",
      count: filteredUsers.length,
      users: filteredUsers
    });
  } catch (err) {
    console.error("getNearbyUsers error:", err);
    return res.status(500).json({
      error: err.message
    });
  }
};

export const saveProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { target_user_id } = req.body;

    if (!target_user_id) {
      return res.status(400).json({
        message: "target_user_id is required"
      });
    }

    if (target_user_id === userId) {
      return res.status(400).json({
        message: "You cannot save your own profile"
      });
    }

    const { data: targetUser, error: targetUserError } = await supabase
      .from("users")
      .select("id")
      .eq("id", target_user_id)
      .single();

    if (targetUserError || !targetUser) {
      return res.status(404).json({
        message: "Target user not found"
      });
    }

    const { data, error } = await supabase
      .from("saved_profiles")
      .upsert(
        [
          {
            user_id: userId,
            saved_user_id: target_user_id
          }
        ],
        {
          onConflict: "user_id,saved_user_id"
        }
      )
      .select()
      .single();

    if (error) {
      return res.status(400).json(error);
    }

    return res.json({
      message: "Profile saved successfully",
      saved_profile: data
    });
  } catch (err) {
    console.error("saveProfile error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const removeSavedProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const savedUserId = req.params.savedUserId?.trim();

    if (!savedUserId) {
      return res.status(400).json({
        message: "savedUserId is required"
      });
    }

    const { error } = await supabase
      .from("saved_profiles")
      .delete()
      .eq("user_id", userId)
      .eq("saved_user_id", savedUserId);

    if (error) {
      return res.status(400).json(error);
    }

    return res.json({
      message: "Saved profile removed successfully"
    });
  } catch (err) {
    console.error("removeSavedProfile error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const getSavedProfiles = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: savedRows, error: savedError } = await supabase
      .from("saved_profiles")
      .select(`
        id,
        created_at,
        saved_user_id,
        users:saved_user_id (
          id,
          name,
          dob,
          location,
          profile_image,
          is_verified
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (savedError) {
      return res.status(400).json(savedError);
    }

    const savedUserIds = (savedRows || []).map(item => item.saved_user_id);

    let videoRows = [];

    if (savedUserIds.length > 0) {
      const { data, error } = await supabase
        .from("user_videos")
        .select("user_id, video_url, thumbnail_url, created_at")
        .in("user_id", savedUserIds)
        .order("created_at", { ascending: false });

      if (error) {
        return res.status(400).json(error);
      }

      videoRows = data || [];
    }

    const latestVideoByUserId = {};
    videoRows.forEach((item) => {
      if (!latestVideoByUserId[item.user_id]) {
        latestVideoByUserId[item.user_id] = item;
      }
    });

    const users = (savedRows || [])
      .filter(item => item?.users)
      .map((item) => {
        const savedUser = item.users;
        const latestVideo = latestVideoByUserId[savedUser.id];

        return {
          ...savedUser,
          age: calculateAgeFromDob(savedUser.dob),
          saved_at: item.created_at,
          video_url: latestVideo?.video_url || null,
          thumbnail_url: latestVideo?.thumbnail_url || null
        };
      });

    return res.json({
      message: "Saved profiles fetched successfully",
      count: users.length,
      users
    });
  } catch (err) {
    console.error("getSavedProfiles error:", err);
    return res.status(500).json({ error: err.message });
  }
};


export const getBlockedProfiles = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: viewer, error: viewerError } = await supabase
      .from("users")
      .select("id, latitude, longitude")
      .eq("id", userId)
      .single();

    if (viewerError || !viewer) {
      return res.status(404).json({
        message: "Current user not found"
      });
    }

    const { data: blockedRows, error: blockedError } = await supabase
      .from("blocks")
      .select(`
        id,
        created_at,
        blocked_user_id,
        users:blocked_user_id (
          id,
          name,
          dob,
          location,
          profile_image,
          latitude,
          longitude,
          is_verified
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (blockedError) {
      return res.status(400).json(blockedError);
    }

    const blockedUserIds = (blockedRows || []).map(item => item.blocked_user_id);

    let videoRows = [];

    if (blockedUserIds.length > 0) {
      const { data, error } = await supabase
        .from("user_videos")
        .select("user_id, video_url, thumbnail_url, created_at")
        .in("user_id", blockedUserIds)
        .order("created_at", { ascending: false });

      if (error) {
        return res.status(400).json(error);
      }

      videoRows = data || [];
    }

    const latestVideoByUserId = {};
    videoRows.forEach((item) => {
      if (!latestVideoByUserId[item.user_id]) {
        latestVideoByUserId[item.user_id] = item;
      }
    });

    const users = (blockedRows || [])
      .filter(item => item?.users)
      .map((item) => {
        const blockedUser = item.users;
        const latestVideo = latestVideoByUserId[blockedUser.id];

        let distanceKm = null;

        if (
          viewer?.latitude &&
          viewer?.longitude &&
          blockedUser?.latitude &&
          blockedUser?.longitude
        ) {
          distanceKm = Number(
            calculateDistanceKm(
              viewer.latitude,
              viewer.longitude,
              blockedUser.latitude,
              blockedUser.longitude
            ).toFixed(1)
          );
        }

        return {
          ...blockedUser,
          age: calculateAgeFromDob(blockedUser.dob),
          blocked_at: item.created_at,
          distance_km: distanceKm,
          video_url: latestVideo?.video_url || null,
          thumbnail_url: latestVideo?.thumbnail_url || null
        };
      });

    return res.json({
      message: "Blocked profiles fetched successfully",
      count: users.length,
      users
    });
  } catch (err) {
    console.error("getBlockedProfiles error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const blockUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const { blocked_user_id } = req.body;

    if (!blocked_user_id) {
      return res.status(400).json({
        message: "blocked_user_id is required"
      });
    }

    if (blocked_user_id === userId) {
      return res.status(400).json({
        message: "You cannot block yourself"
      });
    }

    const { data: targetUser, error: targetUserError } = await supabase
      .from("users")
      .select("id")
      .eq("id", blocked_user_id)
      .single();

    if (targetUserError || !targetUser) {
      return res.status(404).json({
        message: "Target user not found"
      });
    }

    const { data, error } = await supabase
      .from("blocks")
      .insert([
        {
          user_id: userId,
          blocked_user_id
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(400).json(error);
    }

    return res.json({
      message: "User blocked successfully",
      block: data
    });
  } catch (err) {
    console.error("blockUser error:", err);
    return res.status(500).json({ error: err.message });
  }
};


export const unblockUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const blockedUserId = req.params.blockedUserId?.trim();

    if (!blockedUserId) {
      return res.status(400).json({
        message: "blockedUserId is required"
      });
    }

    const { error } = await supabase
      .from("blocks")
      .delete()
      .eq("user_id", userId)
      .eq("blocked_user_id", blockedUserId);

    if (error) {
      return res.status(400).json(error);
    }

    return res.json({
      message: "User unblocked successfully"
    });
  } catch (err) {
    console.error("unblockUser error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const reportUser = async (req, res) => {
  try {
    const reporterId = req.user.id;
    const { reported_user_id, reason, description } = req.body;

    if (!reported_user_id) {
      return res.status(400).json({
        message: "reported_user_id is required"
      });
    }

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({
        message: "reason is required"
      });
    }

    if (reported_user_id === reporterId) {
      return res.status(400).json({
        message: "You cannot report yourself"
      });
    }

    const { data: targetUser, error: targetUserError } = await supabase
      .from("users")
      .select("id")
      .eq("id", reported_user_id)
      .single();

    if (targetUserError || !targetUser) {
      return res.status(404).json({
        message: "Reported user not found"
      });
    }

    const payload = {
      reporter_id: reporterId,
      reported_user_id,
      reason: String(reason).trim(),
      description: description ? String(description).trim() : null,
      status: "pending"
    };

    const { data, error } = await supabase
      .from("reports")
      .insert([payload])
      .select()
      .single();

    if (error) {
      return res.status(400).json(error);
    }

    return res.json({
      message: "Report submitted successfully",
      report: data
    });
  } catch (err) {
    console.error("reportUser error:", err);
    return res.status(500).json({
      error: err.message
    });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { current_password, feedback_reason, feedback_note } = req.body;

    if (!current_password || !String(current_password).trim()) {
      return res.status(400).json({
        message: "Current password is required"
      });
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, password")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const isMatch = await bcrypt.compare(current_password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Current password is incorrect"
      });
    }

    if (feedback_reason && String(feedback_reason).trim()) {
      const { error: feedbackError } = await supabase
        .from("account_deletion_feedback")
        .insert([
          {
            user_id: userId,
            reason: String(feedback_reason).trim(),
            note: feedback_note ? String(feedback_note).trim() : null
          }
        ]);

      if (
        feedbackError &&
        feedbackError.code !== "42P01" &&
        feedbackError.code !== "42501"
      ) {
        return res.status(400).json(feedbackError);
      }
    }

    const { data: matchRows, error: matchLookupError } = await supabase
      .from("matches")
      .select("id")
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

    if (matchLookupError) {
      return res.status(400).json(matchLookupError);
    }

    const matchIds = (matchRows || []).map(match => match.id);

    if (matchIds.length > 0) {
      const { error: messageDeleteError } = await supabase
        .from("messages")
        .delete()
        .in("match_id", matchIds);

      if (messageDeleteError) {
        return res.status(400).json(messageDeleteError);
      }
    }

    const deleteTasks = [
      supabase.from("blocks").delete().eq("user_id", userId),
      supabase.from("blocks").delete().eq("blocked_user_id", userId),
      supabase.from("discovery_preferences").delete().eq("user_id", userId),
      supabase.from("likes").delete().eq("user_id", userId),
      supabase.from("likes").delete().eq("liked_user_id", userId),
      supabase.from("reports").delete().eq("reporter_id", userId),
      supabase.from("reports").delete().eq("reported_user_id", userId),
      supabase.from("saved_profiles").delete().eq("user_id", userId),
      supabase.from("saved_profiles").delete().eq("saved_user_id", userId),
      supabase.from("notifications").delete().eq("user_id", userId),
      supabase.from("user_answers").delete().eq("user_id", userId),
      supabase.from("user_interests").delete().eq("user_id", userId),
      supabase.from("user_photos").delete().eq("user_id", userId),
      supabase.from("user_push_tokens").delete().eq("user_id", userId),
      supabase.from("user_videos").delete().eq("user_id", userId),
      supabase.from("subscriptions").delete().eq("user_id", userId),
      supabase.from("matches").delete().eq("user1_id", userId),
      supabase.from("matches").delete().eq("user2_id", userId)
    ];

    if (user.email) {
      deleteTasks.push(
        supabase.from("otp_codes").delete().eq("email", user.email)
      );
    }

    const results = await Promise.all(deleteTasks);
    const failedTask = results.find(result => result.error);

    if (failedTask?.error) {
      return res.status(400).json(failedTask.error);
    }

    const { error: userDeleteError } = await supabase
      .from("users")
      .delete()
      .eq("id", userId);

    if (userDeleteError) {
      return res.status(400).json(userDeleteError);
    }

    return res.json({
      message: "Account deleted successfully"
    });
  } catch (err) {
    console.error("deleteAccount error:", err);
    return res.status(500).json({
      error: err.message
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      name,
      dob,
      gender,
      match_gender,
      profile_image
    } = req.body;

    const updateData = {};

    if (name !== undefined && name !== null && name !== "") {
      updateData.name = name;
    }

    if (dob !== undefined && dob !== null && dob !== "") {
      updateData.dob = dob;
    }

    if (gender !== undefined && gender !== null && gender !== "") {
      updateData.gender = gender;
    }

    if (match_gender !== undefined && match_gender !== null && match_gender !== "") {
      updateData.match_gender = match_gender;
    }

    if (profile_image !== undefined && profile_image !== null && profile_image !== "") {
      updateData.profile_image = profile_image;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: "No data provided to update"
      });
    }

    const { data, error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      console.error("❌ Update error:", error);
      return res.status(400).json(error);
    }

    res.json({
      message: "Profile updated",
      user: data
    });

  } catch (err) {
    console.error("🔥 Update crash:", err);
    res.status(500).json({ error: err.message });
  }
};

export const updateFullProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      name,
      dob,
      bio,
      looking_for,
      personality_tag,
      location
    } = req.body;

    const updateData = {};

    if (name) updateData.name = name;
    if (dob) updateData.dob = dob;
    if (bio) updateData.bio = bio;
    if (looking_for) updateData.looking_for = looking_for;
    if (personality_tag) updateData.personality_tag = personality_tag;
    if (location) updateData.location = location;

    const { data, error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", userId)
      .select()
      .single();

    if (error) return res.status(400).json(error);

    res.json({
      message: "Profile updated",
      user: data
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateUserInterests = async (req, res) => {
  try {
    const userId = req.user.id;
    const { interest_ids } = req.body;

    await supabase
      .from("user_interests")
      .delete()
      .eq("user_id", userId);

    const payload = interest_ids.map(id => ({
      user_id: userId,
      interest_id: id
    }));

    const { data, error } = await supabase
      .from("user_interests")
      .insert(payload);

    if (error) return res.status(400).json(error);

    res.json({
      message: "Interests updated",
      data
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const saveAnswers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ message: "Invalid answers format" });
    }

    const payload = answers.map(a => ({
      user_id: userId,
      question_id: a.question_id,
      answer: a.answer
    }));

    const { data, error } = await supabase
      .from("user_answers")
      .insert(payload);

    if (error) {
      return res.status(400).json({ error });
    }

    res.json({
      message: "Answers saved successfully",
      data
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateLocation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        message: "Latitude and longitude are required"
      });
    }

    const { data: currentUser, error: currentUserError } = await supabase
      .from("users")
      .select("id, location_enabled")
      .eq("id", userId)
      .single();

    if (currentUserError || !currentUser) {
      return res.status(404).json({
        message: "Current user not found"
      });
    }

    if (currentUser.location_enabled === false) {
      return res.status(403).json({
        message: "Location access is turned off"
      });
    }

    const { data, error } = await supabase
      .from("users")
      .update({
        latitude,
        longitude,
        updated_at: new Date().toISOString()
      })
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      return res.status(400).json(error);
    }

    return res.json({
      message: "Location updated successfully",
      user: data
    });
  } catch (err) {
    console.error("🔥 UPDATE LOCATION ERROR:", err);
    return res.status(500).json({
      message: "Location update failed",
      error: err.message
    });
  }
};


export const uploadPhoto = async (req, res) => {

  const userId = req.user.id;
  const { image_url } = req.body;

  const { data, error } = await supabase
    .from("user_photos")
    .insert([
      {
        user_id: userId,
        image_url,
        is_primary: false,
        is_public: true
      }
    ])
    .select();

  if (error) return res.status(400).json(error);

  res.json({
    message: "Photo uploaded Successfull",
    data
  });
};

export const updateLocationAccess = async (req, res) => {
  try {
    const userId = req.user.id;
    const { location_enabled, latitude, longitude } = req.body;

    if (typeof location_enabled !== "boolean") {
      return res.status(400).json({
        message: "location_enabled must be true or false"
      });
    }

    const updateData = {
      location_enabled,
      updated_at: new Date().toISOString()
    };

    if (location_enabled) {
      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({
          message: "Latitude and longitude are required when location is enabled"
        });
      }

      updateData.latitude = latitude;
      updateData.longitude = longitude;
    } else {
      updateData.latitude = null;
      updateData.longitude = null;
    }

    const { data, error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", userId)
      .select("id, location_enabled, latitude, longitude")
      .single();

    if (error) {
      return res.status(400).json(error);
    }

    return res.json({
      message: "Location access updated successfully",
      user: data
    });
  } catch (err) {
    console.error("updateLocationAccess error:", err);
    return res.status(500).json({
      error: err.message
    });
  }
};

export const getSecuritySettings = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("users")
      .select("id, email, two_step_enabled")
      .eq("id", userId)
      .single();

    if (error) {
      return res.status(400).json(error);
    }

    return res.json({
      email: data.email,
      two_step_enabled: data.two_step_enabled === true
    });
  } catch (err) {
    console.error("getSecuritySettings error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const sendTwoStepEmailCode = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (!user.email) {
      return res.status(400).json({
        message: "Email is required for two-step verification"
      });
    }

    const otp = generateOTP();

    const { error: otpError } = await supabase
      .from("otp_codes")
      .insert([{ email: user.email, otp }]);

    if (otpError) {
      return res.status(500).json(otpError);
    }

    await sendEmail(user.email, otp);

    return res.json({
      message: "Verification code sent",
      email: user.email
    });
  } catch (err) {
    console.error("sendTwoStepEmailCode error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const verifyEnableTwoStep = async (req, res) => {
  try {
    const userId = req.user.id;
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({
        message: "OTP is required"
      });
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const { data: otpRow, error: otpError } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("email", user.email)
      .eq("otp", otp)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpRow) {
      return res.status(400).json({
        message: "Invalid OTP"
      });
    }

    const diff = (new Date() - new Date(otpRow.created_at)) / 1000;

    if (diff > 300) {
      return res.status(400).json({
        message: "OTP expired"
      });
    }

    const { data, error } = await supabase
      .from("users")
      .update({
        two_step_enabled: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", userId)
      .select("id, email, two_step_enabled")
      .single();

    if (error) {
      return res.status(400).json(error);
    }

    await supabase
      .from("otp_codes")
      .delete()
      .eq("id", otpRow.id);

    return res.json({
      message: "Two-step verification enabled",
      user: data
    });
  } catch (err) {
    console.error("verifyEnableTwoStep error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const disableTwoStep = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("users")
      .update({
        two_step_enabled: false,
        updated_at: new Date().toISOString()
      })
      .eq("id", userId)
      .select("id, email, two_step_enabled")
      .single();

    if (error) {
      return res.status(400).json(error);
    }

    return res.json({
      message: "Two-step verification disabled",
      user: data
    });
  } catch (err) {
    console.error("disableTwoStep error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const updateProfileVisibility = async (req, res) => {
  try {
    const userId = req.user.id;
    const { profile_visibility, visibility_mode } = req.body;
    const allowedModes = ["everyone", "liked", "hidden"];

    if (typeof profile_visibility !== "boolean") {
      return res.status(400).json({
        message: "profile_visibility must be true or false"
      });
    }

    if (!allowedModes.includes(visibility_mode)) {
      return res.status(400).json({
        message: "visibility_mode must be everyone, liked, or hidden"
      });
    }

    const { data, error } = await supabase
      .from("users")
      .update({
        profile_visibility,
        profile_visibility_mode: visibility_mode,
        updated_at: new Date().toISOString()
      })
      .eq("id", userId)
      .select("id, profile_visibility, profile_visibility_mode")
      .single();

    if (error) {
      return res.status(400).json(error);
    }

    return res.json({
      message: "Profile visibility updated successfully",
      user: data
    });
  } catch (err) {
    console.error("updateProfileVisibility error:", err);
    return res.status(500).json({
      error: err.message
    });
  }
};

export const submitVerification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { document_image_url, selfie_image_url } = req.body;

    if (!document_image_url || !selfie_image_url) {
      return res.status(400).json({
        message: "document_image_url and selfie_image_url are required"
      });
    }

    const { error: photoError } = await supabase
      .from("user_photos")
      .insert([
        {
          user_id: userId,
          image_url: document_image_url,
          is_primary: false,
          is_public: false
        },
        {
          user_id: userId,
          image_url: selfie_image_url,
          is_primary: false,
          is_public: false
        }
      ]);

    if (photoError) {
      return res.status(400).json(photoError);
    }

    const { data: user, error: updateError } = await supabase
      .from("users")
      .update({
        is_verified: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", userId)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json(updateError);
    }

    return res.json({
      message: "Verification submitted successfully",
      user
    });
  } catch (err) {
    console.error("submitVerification error:", err);
    return res.status(500).json({
      error: err.message
    });
  }
};



// DELETE /users/photos/{id}
export const deletePhoto = async (req, res) => {

  const { id } = req.params;

  const { error } = await supabase
    .from("user_photos")
    .delete()
    .eq("id", id);

  if (error) return res.status(400).json(error);

  res.json({ message: "Photo deleted" });
};



// PATCH /users/photos/{id}/primary
export const setPrimaryPhoto = async (req, res) => {

  const userId = req.user.id;
  const { id } = req.params;

  await supabase
    .from("user_photos")
    .update({ is_primary: false })
    .eq("user_id", userId);

  const { error } = await supabase
    .from("user_photos")
    .update({ is_primary: true })
    .eq("id", id);

  if (error) return res.status(400).json(error);

  res.json({ message: "Primary photo updated" });
};



export const uploadVideo = async (req, res) => {
  try {
    const userId = req.user.id;
    const { video_url, thumbnail_url } = req.body;

    const { data, error } = await supabase
      .from("user_videos")
      .insert([
        {
          user_id: userId,
          video_url,
          thumbnail_url
        }
      ])
      .select();

    if (error) return res.status(400).json(error);

    res.json({
      message: "Video uploaded",
      data
    });
  } catch (err) {
    console.error("🔥 uploadVideo error:", err);
    res.status(500).json({ error: err.message });
  }
};

const calculateAgeFromDob = (dob) => {
  if (!dob) return null;

  const birthDate = new Date(dob);
  const today = new Date();

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
};

const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  const toRad = value => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
};


