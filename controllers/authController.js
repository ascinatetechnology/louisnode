import supabase from "../config/supabase.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { generateOTP } from "../utils/otp.js";
import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const register = async (req, res) => {
  try {
    let { name, email, phone, password } = req.body;

    if (!email && !phone) {
      return res.status(400).json({
        message: "Email or phone is required"
      });
    }

    if (!password) {
      return res.status(400).json({
        message: "Password is required"
      });
    }
    if (phone) {
      phone = phone.trim();

      if (!phone.startsWith("+")) {
        phone = "+91" + phone;
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from("users")
      .insert([
        {
          name: name || null,
          email: email || null,
          phone: phone || null,
          password: hashedPassword
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(400).json(error);
    }

    res.json({
      message: "User registered successfully",
      user: data
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const sendPhoneOtp = async (req, res) => {
  try {
    console.log("📩 sendPhoneOtp API called");

    let { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Phone required" });
    }

    phone = phone.trim();

    if (!phone.startsWith("+")) {
      return res.status(400).json({
        message: "Phone must include country code (e.g. +91...)"
      });
    }

    await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({
        to: phone,
        channel: "sms"
      });

    console.log("✅ OTP sent:", phone);

    await supabase.from("otp_codes").insert([
      {
        phone,
        otp: null
      }
    ]);

    return res.json({
      message: "OTP sent successfully"
    });

  } catch (err) {
    console.error("🔥 PHONE OTP ERROR:", err);

    return res.status(500).json({
      message: "Failed to send OTP",
      error: err.message
    });
  }
};

export const verifyPhoneOtp = async (req, res) => {
  try {
    let { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        message: "Phone and OTP required"
      });
    }
    phone = phone.trim();
    const verification = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({
        to: phone,
        code: otp
      });

    console.log("Twilio status:", verification.status);

    if (verification.status !== "approved") {
      return res.status(400).json({
        message: "Invalid OTP"
      });
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("phone", phone)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        message: "User not found"
      });
    }
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Phone verified successfully",
      token,
      user
    });

  } catch (err) {
    console.error("🔥 VERIFY OTP ERROR:", err);

    return res.status(500).json({
      message: "Verification failed",
      error: err.message
    });
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

export const logout = async (req, res) => {
  res.json({ message: "Logout success (client remove token)" });
};
