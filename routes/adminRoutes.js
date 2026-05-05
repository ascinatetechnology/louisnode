import express from "express";
import { verifyAdminPage, verifyAdminToken } from "../middleware/adminMiddleware.js";
import {
  adminLogin,
  adminLogout,
  renderAdminDashboard,
  getAdminReportDashboard,
  listAdminUsers,
  getAdminUser,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  banUser,
  unbanUser,
  removeAbusiveProfile
} from "../controllers/adminController.js";

const router = express.Router();

router.post("/login", adminLogin);
router.post("/logout", adminLogout);
router.get("/dashboard", verifyAdminPage, renderAdminDashboard);
router.get("/reports/dashboard", verifyAdminToken, getAdminReportDashboard);
router.get("/users", verifyAdminToken, listAdminUsers);
router.post("/users", verifyAdminToken, createAdminUser);
router.get("/users/:userId", verifyAdminToken, getAdminUser);
router.patch("/users/:userId", verifyAdminToken, updateAdminUser);
router.delete("/users/:userId", verifyAdminToken, deleteAdminUser);
router.patch("/users/:userId/ban", verifyAdminToken, banUser);
router.patch("/users/:userId/unban", verifyAdminToken, unbanUser);
router.delete("/users/:userId/remove-profile", verifyAdminToken, removeAbusiveProfile);

export default router;
