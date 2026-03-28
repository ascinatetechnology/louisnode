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