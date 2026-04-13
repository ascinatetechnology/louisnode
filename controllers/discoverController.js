import supabase from "../config/supabase.js";
import { createMatchNotifications } from "../services/notificationService.js";

// GET /discover/preferences
export const getDiscoveryPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("discovery_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return res.status(400).json(error);
    }

    return res.json(
      data || {
        gender_preference: "everyone",
        age_min: 18,
        age_max: 60,
        distance_km: 50
      }
    );
  } catch (err) {
    console.error("🔥 getDiscoveryPreferences error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const saveDiscoveryFilters = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      gender_preference,
      age_min,
      age_max,
      distance_km
    } = req.body;

    const { data: existing, error: existingError } = await supabase
      .from("discovery_preferences")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError) {
      return res.status(400).json(existingError);
    }

    let result;
    let dbError;

    if (existing?.id) {
      const { data, error } = await supabase
        .from("discovery_preferences")
        .update({
          gender_preference,
          age_min,
          age_max,
          distance_km
        })
        .eq("user_id", userId)
        .select()
        .single();

      result = data;
      dbError = error;
    } else {
      const { data, error } = await supabase
        .from("discovery_preferences")
        .insert([
          {
            user_id: userId,
            gender_preference,
            age_min,
            age_max,
            distance_km
          }
        ])
        .select()
        .single();

      result = data;
      dbError = error;
    }

    if (dbError) {
      return res.status(400).json(dbError);
    }

    return res.json({
      message: "Discovery preferences saved successfully",
      preferences: result
    });
  } catch (err) {
    console.error("🔥 saveDiscoveryFilters error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const getDiscoverUsers = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: currentUser, error: currentUserError } = await supabase
      .from("users")
      .select("id, gender, dob, latitude, longitude")
      .eq("id", userId)
      .single();

    if (currentUserError || !currentUser) {
      return res.status(404).json({ message: "Current user not found" });
    }

    const { data: prefs } = await supabase
      .from("discovery_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const genderPreference = prefs?.gender_preference || "everyone";
    const ageMin = prefs?.age_min ?? 18;
    const ageMax = prefs?.age_max ?? 60;
    const distanceKm = prefs?.distance_km ?? 50;

    const { data: likedUsers } = await supabase
      .from("likes")
      .select("liked_user_id")
      .eq("user_id", userId);

    const likedIds = likedUsers?.map(item => item.liked_user_id) || [];

    const { data: blockedUsers } = await supabase
      .from("blocks")
      .select("blocked_user_id")
      .eq("user_id", userId);

    const blockedIds = blockedUsers?.map(item => item.blocked_user_id) || [];

    const { data: matches } = await supabase
      .from("matches")
      .select("user1_id, user2_id")
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .eq("status", "active");

    const matchedIds =
      matches?.map(match =>
        match.user1_id === userId ? match.user2_id : match.user1_id
      ) || [];

    let query = supabase
      .from("users")
      .select(`
        *,
        user_videos (
          video_url,
          thumbnail_url,
          created_at
        )
      `)
      .neq("id", userId)
      .eq("profile_visibility", true)
      .not("dob", "is", null);

    if (genderPreference && genderPreference.toLowerCase() !== "everyone") {
      query = query.ilike("gender", genderPreference);
    }

    const { data: users, error: usersError } = await query;

    if (usersError) {
      return res.status(400).json(usersError);
    }

    let filteredUsers = (users || []).filter(user => {
      const age = calculateAgeFromDob(user.dob);

      if (age === null) return false;

      return (
        age >= ageMin &&
        age <= ageMax &&
        !likedIds.includes(user.id) &&
        !blockedIds.includes(user.id) &&
        !matchedIds.includes(user.id)
      );
    });

    if (
      currentUser.latitude &&
      currentUser.longitude &&
      filteredUsers.length > 0
    ) {
      filteredUsers = filteredUsers.filter(user => {
        if (!user.latitude || !user.longitude) return false;

        const distance = calculateDistanceKm(
          currentUser.latitude,
          currentUser.longitude,
          user.latitude,
          user.longitude
        );

        user.distance_km = Number(distance.toFixed(1));
        user.age = calculateAgeFromDob(user.dob);

        return distance <= distanceKm;
      });
    } else {
      filteredUsers = filteredUsers.map(user => ({
        ...user,
        age: calculateAgeFromDob(user.dob)
      }));
    }

    const finalUsers = filteredUsers.map(user => {
      let latestVideo = null;
      let latestThumbnail = null;

      if (user.user_videos && user.user_videos.length > 0) {
        const latestMedia = [...user.user_videos].sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        )[0];

        latestVideo = latestMedia?.video_url || null;
        latestThumbnail = latestMedia?.thumbnail_url || null;
      }

      return {
        ...user,
        video_url: latestVideo,
        thumbnail_url: latestThumbnail
      };
    });

    return res.json({
      message: "Discover users fetched successfully",
      count: finalUsers.length,
      users: finalUsers
    });
  } catch (err) {
    console.error("🔥 getDiscoverUsers error:", err);
    return res.status(500).json({ error: err.message });
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
  const R = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};


export const swipeUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const { target_user_id, action } = req.body;

    if (!target_user_id || !action) {
      return res.status(400).json({ message: "Invalid request" });
    }

    if (action === "pass") {
      return res.json({ message: "User skipped" });
    }

    const { data: currentUser, error: currentUserError } = await supabase
      .from("users")
      .select("id, name")
      .eq("id", userId)
      .single();

    if (currentUserError || !currentUser) {
      return res.status(404).json({ message: "Current user not found" });
    }

    const { data: targetUser, error: targetUserError } = await supabase
      .from("users")
      .select("id, name")
      .eq("id", target_user_id)
      .single();

    if (targetUserError || !targetUser) {
      return res.status(404).json({ message: "Target user not found" });
    }

    const { error: likeError } = await supabase
      .from("likes")
      .insert([
        {
          user_id: userId,
          liked_user_id: target_user_id
        }
      ]);

    if (likeError) {
      return res.status(400).json(likeError);
    }

    const { data: existingLike } = await supabase
      .from("likes")
      .select("*")
      .eq("user_id", target_user_id)
      .eq("liked_user_id", userId)
      .maybeSingle();

    if (existingLike) {
      const { data: match, error: matchError } = await supabase
        .from("matches")
        .insert([
          {
            user1_id: userId,
            user2_id: target_user_id,
            status: "active"
          }
        ])
        .select()
        .single();

      if (matchError) {
        return res.status(400).json(matchError);
      }

      await createMatchNotifications({
        matchId: match.id,
        user1Id: userId,
        user2Id: target_user_id,
        user1Name: currentUser.name,
        user2Name: targetUser.name
      });

      return res.json({
        message: "It's a match ❤️",
        match
      });
    }

    return res.json({
      message: "Liked successfully"
    });

  } catch (err) {
    console.error("🔥 swipe error:", err);
    res.status(500).json({ error: err.message });
  }
};
