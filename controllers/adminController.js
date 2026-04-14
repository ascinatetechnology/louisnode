import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import supabase from "../config/supabase.js";

const getSeverityFromReason = (reason = "") => {
  const normalized = String(reason).toLowerCase();

  if (
    normalized.includes("under 18") ||
    normalized.includes("abusive") ||
    normalized.includes("harassment") ||
    normalized.includes("hate")
  ) {
    return "high";
  }

  if (
    normalized.includes("fake") ||
    normalized.includes("scam") ||
    normalized.includes("spam")
  ) {
    return "medium";
  }

  return "low";
};

const getSuggestedAction = (reason = "", count = 1) => {
  const normalized = String(reason).toLowerCase();

  if (
    count >= 3 ||
    normalized.includes("abusive") ||
    normalized.includes("harassment") ||
    normalized.includes("hate")
  ) {
    return "Ban user";
  }

  if (
    normalized.includes("fake") ||
    normalized.includes("under 18") ||
    normalized.includes("inappropriate")
  ) {
    return "Remove profile";
  }

  return "Review and remove";
};

const updateUserModerationState = async (userId, updates) => {
  const { data, error } = await supabase
    .from("users")
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq("id", userId)
    .select("id, name, profile_visibility, is_banned, banned_at, removed_at, moderation_status")
    .single();

  if (error) {
    throw error;
  }

  return data;
};

const buildDashboardPayload = async () => {
  const { data: reportRows, error } = await supabase
    .from("reports")
    .select(`
      id,
      reporter_id,
      reported_user_id,
      reason,
      description,
      status,
      created_at,
      reported_user:reported_user_id (
        id,
        name
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const { data: moderatedUsers, error: usersError } = await supabase
    .from("users")
    .select("id, moderation_status, is_banned, removed_at");

  if (usersError) {
    throw usersError;
  }

  const reports = (reportRows || []).map((item) => ({
    report_id: item.id,
    reported_user_id: item.reported_user_id,
    reported_name: item.reported_user?.name || "Unknown User",
    reason: item.reason || "No reason provided",
    description: item.description || "",
    severity: getSeverityFromReason(item.reason),
    status: item.status || "pending",
    reported_at: item.created_at
  }));

  const summary = {
    open_reports: reports.filter(
      (item) => item.status === "pending" || item.status === "open"
    ).length,
    banned_users: (moderatedUsers || []).filter(
      (user) => user.is_banned === true || user.moderation_status === "banned"
    ).length,
    abusive_profiles_removed: (moderatedUsers || []).filter(
      (user) => user.moderation_status === "removed" || user.removed_at
    ).length,
    escalated_cases: reports.filter(
      (item) => item.status === "escalated" || item.status === "under_review"
    ).length
  };

  const groupedByUser = new Map();

  reports.forEach((item) => {
    const existing = groupedByUser.get(item.reported_user_id);

    if (!existing) {
      groupedByUser.set(item.reported_user_id, {
        user_id: item.reported_user_id,
        name: item.reported_name,
        issue: item.reason,
        action_suggested: getSuggestedAction(item.reason, 1),
        report_count: 1,
        latest_status: item.status,
        latest_reported_at: item.reported_at
      });
      return;
    }

    existing.report_count += 1;

    if (new Date(item.reported_at) > new Date(existing.latest_reported_at)) {
      existing.issue = item.reason;
      existing.latest_status = item.status;
      existing.latest_reported_at = item.reported_at;
    }

    existing.action_suggested = getSuggestedAction(existing.issue, existing.report_count);
  });

  const flaggedProfiles = Array.from(groupedByUser.values())
    .sort((a, b) => {
      if (b.report_count !== a.report_count) {
        return b.report_count - a.report_count;
      }

      return new Date(b.latest_reported_at) - new Date(a.latest_reported_at);
    })
    .slice(0, 6);

  return {
    summary,
    reports: reports.slice(0, 12),
    flaggedProfiles
  };
};

export const renderAdminDashboard = async (req, res) => {
  try {
    const dashboard = await buildDashboardPayload();

    res.render("admin-dashboard", dashboard);
  } catch (error) {
    console.error("renderAdminDashboard error:", error);
    res.render("admin-dashboard", {
      summary: {
        open_reports: 0,
        banned_users: 0,
        abusive_profiles_removed: 0,
        escalated_cases: 0
      },
      reports: [],
      flaggedProfiles: []
    });
  }
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
  buildDashboardPayload()
    .then((dashboard) => {
      return res.json({
        message: "Admin report dashboard fetched successfully",
        summary: dashboard.summary,
        reports: dashboard.reports,
        flagged_profiles: dashboard.flaggedProfiles
      });
    })
    .catch((error) => {
      console.error("getAdminReportDashboard error:", error);
      return res.status(500).json({
        message: "Failed to fetch admin report dashboard",
        error: error.message
      });
    });
};

export const banUser = async (req, res) => {
  const userId = req.params.userId?.trim();
  const { reason = "Violation reported by admin" } = req.body || {};

  if (!userId) {
    return res.status(400).json({
      message: "userId is required"
    });
  }

  try {
    const user = await updateUserModerationState(userId, {
      profile_visibility: false,
      is_banned: true,
      banned_at: new Date().toISOString(),
      removed_at: null,
      moderation_status: "banned"
    });

    const { data, error } = await supabase
      .from("reports")
      .update({
        status: "banned"
      })
      .eq("reported_user_id", userId)
      .in("status", ["pending", "open", "under_review", "escalated"])
      .select();

    if (error) {
      return res.status(400).json(error);
    }

    return res.json({
      message: "User banned successfully",
      data: {
        user_id: userId,
        user,
        status: "banned",
        reason,
        affected_reports: data?.length || 0,
        banned_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("banUser error:", error);
    return res.status(500).json({
      message: "Failed to ban user",
      error: error.message
    });
  }
};

export const unbanUser = async (req, res) => {
  const userId = req.params.userId?.trim();

  if (!userId) {
    return res.status(400).json({
      message: "userId is required"
    });
  }

  try {
    const user = await updateUserModerationState(userId, {
      profile_visibility: true,
      is_banned: false,
      banned_at: null,
      moderation_status: "active"
    });

    const { data, error } = await supabase
      .from("reports")
      .update({
        status: "pending"
      })
      .eq("reported_user_id", userId)
      .eq("status", "banned")
      .select();

    if (error) {
      return res.status(400).json(error);
    }

    return res.json({
      message: "User unbanned successfully",
      data: {
        user_id: userId,
        user,
        status: "pending",
        affected_reports: data?.length || 0,
        unbanned_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("unbanUser error:", error);
    return res.status(500).json({
      message: "Failed to unban user",
      error: error.message
    });
  }
};

export const removeAbusiveProfile = async (req, res) => {
  const userId = req.params.userId?.trim();
  const { reason = "Abusive profile removed by admin" } = req.body || {};

  if (!userId) {
    return res.status(400).json({
      message: "userId is required"
    });
  }

  try {
    const user = await updateUserModerationState(userId, {
      profile_visibility: false,
      is_banned: false,
      banned_at: null,
      removed_at: new Date().toISOString(),
      moderation_status: "removed"
    });

    const { data, error } = await supabase
      .from("reports")
      .update({
        status: "removed"
      })
      .eq("reported_user_id", userId)
      .in("status", ["pending", "open", "under_review", "escalated", "banned"])
      .select();

    if (error) {
      return res.status(400).json(error);
    }

    return res.json({
      message: "Abusive profile removed successfully",
      data: {
        user_id: userId,
        user,
        status: "removed",
        reason,
        affected_reports: data?.length || 0,
        removed_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("removeAbusiveProfile error:", error);
    return res.status(500).json({
      message: "Failed to remove abusive profile",
      error: error.message
    });
  }
};
