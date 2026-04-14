import express from "express";
import { verifyAdminPage, verifyAdminToken } from "../middleware/adminMiddleware.js";
import {
  adminLogin,
  adminLogout,
  renderAdminDashboard,
  getAdminReportDashboard,
  banUser,
  unbanUser,
  removeAbusiveProfile
} from "../controllers/adminController.js";

const router = express.Router();

router.post("/login", adminLogin);
router.post("/logout", adminLogout);
router.get("/dashboard", verifyAdminPage, renderAdminDashboard);
router.get("/reports/dashboard", verifyAdminToken, getAdminReportDashboard);
router.patch("/users/:userId/ban", verifyAdminToken, banUser);
router.patch("/users/:userId/unban", verifyAdminToken, unbanUser);
router.delete("/users/:userId/remove-profile", verifyAdminToken, removeAbusiveProfile);

export default router;
