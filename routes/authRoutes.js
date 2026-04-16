import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  register,
  login,
  logout,
  sendOtp,
  verifyOtp,
  forgotPassword,
  resetPassword,
  verifyResetOtp,
  changePassword
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);

router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);

router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOtp);

router.post("/reset-password", resetPassword);
router.post("/change-password", verifyToken, changePassword);

export default router;