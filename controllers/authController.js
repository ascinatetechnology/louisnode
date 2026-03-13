import supabase from "../config/supabase.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { generateOTP } from "../utils/otp.js";
import transporter from "../config/mailer.js";

export const register = async (req, res) => {
  try {
    const { name, email, phone, password, bio, gender, age, latitude, longitude} = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from("users")
      .insert([{ name, email, phone, password: hashedPassword, bio, gender, age, latitude, longitude }])
      .select()
      .single();

    if (error) return res.status(400).json(error);

    res.json({
      message: "User registered successfully",
      user: data
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) {
      return res.status(400).json({ message: "User not found" });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const logout = async (req, res) => {
  res.json({ message: "Logout success (client remove token)" });
};

export const sendOtp = async (req, res) => {
  try {
    console.log("📩 sendOtp API called");

    const { email } = req.body;

    if (!email) {
      console.log("❌ Email missing");
      return res.status(400).json({ message: "Email required" });
    }

    const otp = generateOTP();

    console.log("Generated OTP:", otp);

    // Save OTP in database
    const { data, error } = await supabase
      .from("otp_codes")
      .insert([{ email, otp }]);

    if (error) {
      console.error("❌ Supabase Insert Error:", error);
      return res.status(500).json(error);
    }

    console.log("✅ OTP saved to database");

    // Send Email
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code",
      html: `<h2>Your OTP is ${otp}</h2>`
    });

    console.log("📧 Email sent:", info.response);

    res.json({
      message: "OTP sent successfully"
    });

  } catch (err) {
    console.error("🔥 SEND OTP ERROR:", err);

    res.status(500).json({
      error: err.message,
      code: err.code
    });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const { data } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("email", email)
      .eq("otp", otp)
      .single();

    if (!data) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    res.json({ message: "OTP verified" });

  } catch (err) {
    res.status(500).json(err);
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  const otp = generateOTP();

  await supabase
    .from("otp_codes")
    .insert([{ email, otp }]);

  res.json({
    message: "OTP sent for password reset",
    otp
  });
};

export const resetPassword = async (req, res) => {
  const { email, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const { error } = await supabase
    .from("users")
    .update({ password: hashedPassword })
    .eq("email", email);

  if (error) {
    return res.status(400).json(error);
  }

  res.json({
    message: "Password reset successful"
  });
};