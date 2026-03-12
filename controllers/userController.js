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

  const userId = req.user.id;

  const { name, bio, gender, location } = req.body;

  const { data, error } = await supabase
    .from("users")
    .update({
      name,
      bio,
      gender,
      location
    })
    .eq("id", userId)
    .select();

  if (error) return res.status(400).json(error);

  res.json({
    message: "Profile updated",
    data
  });
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