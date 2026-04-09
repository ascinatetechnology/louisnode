import supabase from "../config/supabase.js";


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
    const interestIds = interestData.map(item => item.interest_id);
    res.json({
      ...user,
      video_url: videoData?.[0]?.video_url || null,
      interests: interestIds
    });

  } catch (err) {
    console.error("🔥 getProfile crash:", err);
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
      .select("id, image_url, is_primary, created_at")
      .eq("user_id", profileId)
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
        is_primary: false
      }
    ])
    .select();

  if (error) return res.status(400).json(error);

  res.json({
    message: "Photo uploaded Successfull",
    data
  });
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


