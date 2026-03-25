import supabase from "../config/supabase.js";


export const getProfile = async (req, res) => {

  const userId = req.user.id;

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) return res.status(400).json(error);

  res.json(data);
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

    const updateData = {
      ...(name && { name }),
      ...(dob && { dob }),
      ...(gender && { gender }),
      ...(match_gender && { match_gender }),
      ...(profile_image && { profile_image })
    };

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



// POST /users/videos
export const uploadVideo = async (req, res) => {

  const userId = req.user.id;
  const { video_url } = req.body;

  const { data, error } = await supabase
    .from("user_videos")
    .insert([
      {
        user_id: userId,
        video_url
      }
    ])
    .select();

  if (error) return res.status(400).json(error);

  res.json({
    message: "Video uploaded",
    data
  });
};