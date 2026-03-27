import supabase from "../config/supabase.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { generateOTP } from "../utils/otp.js";

import { sendEmail } from "../config/emailService.js";


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



export const sendOtp = async (req, res) => {
  try {
    console.log("📩 sendOtp API called");

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    const otp = generateOTP();
    console.log("Generated OTP:", otp);

    const { error } = await supabase
      .from("otp_codes")
      .insert([{ email, otp }]);

    if (error) {
      console.error("❌ Supabase Error:", error);
      return res.status(500).json(error);
    }

    console.log("✅ OTP saved to DB");

    await sendEmail(email, otp);

    res.json({
      message: "OTP sent successfully"
    });

  } catch (err) {
    console.error("🔥 SEND OTP ERROR:", err);

    res.status(500).json({
      error: err.message
    });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP required"
      });
    }

    const { data, error } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("email", email)
      .eq("otp", otp)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return res.status(400).json({
        message: "Invalid OTP"
      });
    }

    const now = new Date();
    const createdAt = new Date(data.created_at);
    const diff = (now - createdAt) / 1000;

    if (diff > 300) {
      return res.status(400).json({
        message: "OTP expired"
      });
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
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

    await supabase
      .from("otp_codes")
      .delete()
      .eq("id", data.id);

    return res.json({
      message: "Email verified successfully",
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
    let { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        message: "Email/Phone and password required"
      });
    }

    identifier = identifier.trim();

    let query;
    if (identifier.includes("@")) {

      query = supabase
        .from("users")
        .select("*")
        .eq("email", identifier)
        .single();
    } else {
      if (!identifier.startsWith("+")) {
        identifier = "+91" + identifier;
      }

      query = supabase
        .from("users")
        .select("*")
        .eq("phone", identifier)
        .single();
    }

    const { data: user, error } = await query;

    if (error || !user) {
      return res.status(400).json({
        message: "User not found"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid password"
      });
    }


    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user
    });

  } catch (err) {
    console.error("🔥 LOGIN ERROR:", err);

    res.status(500).json({
      message: "Login failed",
      error: err.message
    });
  }
};



export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email required"
      });
    }

    // ✅ check user exists
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const otp = generateOTP();

    // ✅ save OTP
    await supabase
      .from("otp_codes")
      .insert([{ email, otp }]);

    // ✅ send email (Brevo)
    await sendEmail(email, otp);

    return res.json({
      message: "OTP sent to email"
    });

  } catch (err) {
    console.error("🔥 FORGOT PASSWORD ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

export const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP required"
      });
    }

    const { data, error } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("email", email)
      .eq("otp", otp)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return res.status(400).json({
        message: "Invalid OTP"
      });
    }

    // ⏱ expiry check (5 min)
    const diff = (new Date() - new Date(data.created_at)) / 1000;

    if (diff > 300) {
      return res.status(400).json({
        message: "OTP expired"
      });
    }

    return res.json({
      message: "OTP verified"
    });

  } catch (err) {
    console.error("🔥 VERIFY RESET OTP ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password required"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { error } = await supabase
      .from("users")
      .update({ password: hashedPassword })
      .eq("email", email);

    if (error) {
      return res.status(400).json(error);
    }

    // 🧹 delete all OTPs for this email
    await supabase
      .from("otp_codes")
      .delete()
      .eq("email", email);

    return res.json({
      message: "Password reset successful"
    });

  } catch (err) {
    console.error("🔥 RESET PASSWORD ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

export const logout = async (req, res) => {
  res.json({ message: "Logout success (client remove token)" });
};
