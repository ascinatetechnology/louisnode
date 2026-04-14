import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import supabase from "../config/supabase.js";

const mockSummary = {
  open_reports: 18,
  banned_users: 7,
  abusive_profiles_removed: 11,
  escalated_cases: 4
};

const mockReports = [
  {
    report_id: "RPT-1001",
    reported_user_id: "USR-204",
    reported_name: "Alex Carter",
    reason: "Abusive language",
    severity: "high",
    status: "open",
    reported_at: "2026-04-14T09:00:00.000Z"
  },
  {
    report_id: "RPT-1002",
    reported_user_id: "USR-118",
    reported_name: "Nina Brooks",
    reason: "Fake profile",
    severity: "medium",
    status: "under_review",
    reported_at: "2026-04-13T18:20:00.000Z"
  },
  {
    report_id: "RPT-1003",
    reported_user_id: "USR-305",
    reported_name: "Daniel Reed",
    reason: "Spam links",
    severity: "high",
    status: "open",
    reported_at: "2026-04-12T13:40:00.000Z"
  }
];

const mockFlaggedProfiles = [
  {
    user_id: "USR-204",
    name: "Alex Carter",
    issue: "Repeated abusive messages",
    action_suggested: "Ban user"
  },
  {
    user_id: "USR-118",
    name: "Nina Brooks",
    issue: "Stolen photos suspected",
    action_suggested: "Remove profile"
  },
  {
    user_id: "USR-305",
    name: "Daniel Reed",
    issue: "Promotional spam in bio",
    action_suggested: "Review and remove"
  }
];

export const renderAdminDashboard = (req, res) => {
  res.render("admin-dashboard", {
    summary: mockSummary,
    reports: mockReports,
    flaggedProfiles: mockFlaggedProfiles
  });
};

export const adminLogin = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password?.trim();

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required"
      });
    }

    const { data: admin, error } = await supabase
      .from("admins")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !admin) {
      return res.status(401).json({
        message: "Invalid admin credentials"
      });
    }

    if (admin.status && admin.status !== "active") {
      return res.status(403).json({
        message: "Admin account is not active"
      });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid admin credentials"
      });
    }

    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        role: admin.role || "admin"
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("adminToken", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000
    });

    return res.json({
      message: "Admin login successful",
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        status: admin.status
      }
    });
  } catch (err) {
    console.error("adminLogin error:", err);
    return res.status(500).json({
      message: "Admin login failed",
      error: err.message
    });
  }
};

export const adminLogout = (req, res) => {
  res.clearCookie("adminToken", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  return res.json({
    message: "Admin logout successful"
  });
};

export const getAdminReportDashboard = (req, res) => {
  return res.json({
    message: "Admin report dashboard fetched successfully",
    summary: mockSummary,
    reports: mockReports,
    flagged_profiles: mockFlaggedProfiles
  });
};

export const banUser = (req, res) => {
  const userId = req.params.userId?.trim();
  const { reason = "Violation reported by admin" } = req.body || {};

  if (!userId) {
    return res.status(400).json({
      message: "userId is required"
    });
  }

  return res.json({
    message: "User banned successfully",
    data: {
      user_id: userId,
      status: "banned",
      reason,
      banned_at: new Date().toISOString()
    }
  });
};

export const unbanUser = (req, res) => {
  const userId = req.params.userId?.trim();

  if (!userId) {
    return res.status(400).json({
      message: "userId is required"
    });
  }

  return res.json({
    message: "User unbanned successfully",
    data: {
      user_id: userId,
      status: "active",
      unbanned_at: new Date().toISOString()
    }
  });
};

export const removeAbusiveProfile = (req, res) => {
  const userId = req.params.userId?.trim();
  const { reason = "Abusive profile removed by admin" } = req.body || {};

  if (!userId) {
    return res.status(400).json({
      message: "userId is required"
    });
  }

  return res.json({
    message: "Abusive profile removed successfully",
    data: {
      user_id: userId,
      status: "removed",
      reason,
      removed_at: new Date().toISOString()
    }
  });
};
