import supabase from "../config/supabase.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { generateOTP } from "../utils/otp.js";

import { sendEmail } from "../config/emailService.js";

const createAuthToken = (userId) => jwt.sign(
  { id: userId },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);

const encodeState = (state) => Buffer
  .from(JSON.stringify(state))
  .toString("base64url");

const decodeState = (state) => {
  try {
    return JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    return {};
  }
};

const redirectWithParams = (res, redirectUri, params) => {
  const url = new URL(redirectUri || "louis://signin");

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  return res.redirect(url.toString());
};

const getAppRedirectUri = (redirectUri) => {
  const fallbackRedirectUri = "louis://signin";

  if (!redirectUri) {
    return fallbackRedirectUri;
  }

  try {
    const url = new URL(redirectUri);
    const allowedProtocols = ["louis:", "exp:", "exps:"];

    if (allowedProtocols.includes(url.protocol)) {
      return redirectUri;
    }
  } catch {
    return fallbackRedirectUri;
  }

  return fallbackRedirectUri;
};

const getGoogleRedirectUri = (req) => {
  return process.env.GOOGLE_REDIRECT_URI
    || `https://${req.get("host")}/auth/google/callback`;
};

const getGoogleUserInfo = async (code, redirectUri) => {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    }).toString()
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok) {
    throw new Error(tokenData.error_description || tokenData.error || "Google token exchange failed");
  }

  const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`
    }
  });

  const googleUser = await userInfoResponse.json();

  if (!userInfoResponse.ok) {
    throw new Error(googleUser.error_description || googleUser.error || "Google profile fetch failed");
  }

  return googleUser;
};

const findOrCreateGoogleUser = async (googleUser) => {
  const email = googleUser.email?.trim().toLowerCase();

  if (!email || googleUser.email_verified !== true) {
    throw new Error("Google account email is not verified");
  }

  const { data: existingUser } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (existingUser) {
    return existingUser;
  }

  const randomPassword = await bcrypt.hash(`google:${googleUser.sub}:${Date.now()}`, 10);

  const { data: newUser, error } = await supabase
    .from("users")
    .insert([{
      name: googleUser.name || email.split("@")[0],
      email,
      password: randomPassword
    }])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return newUser;
};


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

    if (user.two_step_enabled === true) {
      if (!user.email) {
        return res.status(400).json({
          message: "Two-step verification requires an email address"
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

      const temporaryToken = jwt.sign(
        { id: user.id, purpose: "two_step_login" },
        process.env.JWT_SECRET,
        { expiresIn: "10m" }
      );

      return res.json({
        message: "Two-step verification required",
        requires_two_step: true,
        email: user.email,
        temporary_token: temporaryToken
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

export const googleLoginStart = async (req, res) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({
        message: "Google login is not configured"
      });
    }

    const appRedirectUri = getAppRedirectUri(req.query.redirect_uri);
    const redirectUri = getGoogleRedirectUri(req);

    const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleAuthUrl.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
    googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set("scope", "openid email profile");
    googleAuthUrl.searchParams.set("prompt", "select_account");
    googleAuthUrl.searchParams.set("state", encodeState({ appRedirectUri }));

    return res.redirect(googleAuthUrl.toString());
  } catch (err) {
    console.error("GOOGLE LOGIN START ERROR:", err);
    return res.status(500).json({
      message: "Google login failed",
      error: err.message
    });
  }
};

export const googleLoginCallback = async (req, res) => {
  const { appRedirectUri } = decodeState(req.query.state);

  try {
    const { code, error } = req.query;

    if (error) {
      return redirectWithParams(res, appRedirectUri, { error });
    }

    if (!code) {
      return redirectWithParams(res, appRedirectUri, { error: "Missing Google authorization code" });
    }

    const googleUser = await getGoogleUserInfo(code, getGoogleRedirectUri(req));
    const user = await findOrCreateGoogleUser(googleUser);
    const token = createAuthToken(user.id);

    return redirectWithParams(res, appRedirectUri, { token });
  } catch (err) {
    console.error("GOOGLE LOGIN CALLBACK ERROR:", err);
    return redirectWithParams(res, appRedirectUri, {
      error: err.message || "Google login failed"
    });
  }
};

export const verifyTwoStepLogin = async (req, res) => {
  try {
    const { temporary_token, otp } = req.body;

    if (!temporary_token || !otp) {
      return res.status(400).json({
        message: "Temporary token and OTP required"
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(temporary_token, process.env.JWT_SECRET);
    } catch (tokenError) {
      return res.status(401).json({
        message: "Two-step session expired"
      });
    }

    if (decoded?.purpose !== "two_step_login" || !decoded?.id) {
      return res.status(401).json({
        message: "Invalid two-step session"
      });
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", decoded.id)
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

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    await supabase
      .from("otp_codes")
      .delete()
      .eq("id", otpRow.id);

    return res.json({
      message: "Login successful",
      token,
      user
    });
  } catch (err) {
    console.error("VERIFY TWO STEP LOGIN ERROR:", err);
    return res.status(500).json({
      message: "Two-step verification failed",
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


export const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        message: "Current password and new password are required"
      });
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, password")
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

    const hashedPassword = await bcrypt.hash(new_password, 10);

    const { error } = await supabase
      .from("users")
      .update({ password: hashedPassword })
      .eq("id", userId);

    if (error) {
      return res.status(400).json(error);
    }

    return res.json({
      message: "Password changed successfully"
    });

  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

export const logout = async (req, res) => {
  res.json({ message: "Logout success (client remove token)" });
};
