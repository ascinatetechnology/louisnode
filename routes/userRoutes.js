import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";

import {
  getBlockedProfiles,
  getSavedProfiles,
  getProfile,
  getUserProfileById,
  removeSavedProfile,
  saveProfile,
  updateProfile,
  uploadPhoto,
  deletePhoto,
  setPrimaryPhoto,
  uploadVideo,
  saveAnswers,
  updateFullProfile,
  updateUserInterests,
  updateLocation,
  blockUser,
  unblockUser,
  reportUser,
  getNearbyUsers,
  deleteAccount,
  submitVerification
} from "../controllers/userController.js";

const router = express.Router();

router.get("/me", verifyToken, getProfile);
router.get("/saved-profiles", verifyToken, getSavedProfiles);
router.get("/blocked-profiles", verifyToken, getBlockedProfiles);
router.get("/nearby", verifyToken, getNearbyUsers);
router.post("/delete-account", verifyToken, deleteAccount);
router.post("/save-profile", verifyToken, saveProfile);
router.delete("/save-profile/:savedUserId", verifyToken, removeSavedProfile);
router.get("/:id", verifyToken, getUserProfileById);
router.put("/update-profile", verifyToken, updateProfile);
router.post("/block-user", verifyToken, blockUser);
router.delete("/block-user/:blockedUserId", verifyToken, unblockUser);
router.post("/report-user", verifyToken, reportUser);

router.post("/save-answers", verifyToken, saveAnswers);

router.put("/update-full-profile", verifyToken, updateFullProfile);
router.post("/update-interests", verifyToken, updateUserInterests);
router.post("/videos", verifyToken, uploadVideo);
router.put("/update-location", verifyToken, updateLocation);
router.post("/photos", verifyToken, uploadPhoto);
router.delete("/photos/:id", verifyToken, deletePhoto);
router.patch("/photos/:id/primary", verifyToken, setPrimaryPhoto);
router.post("/verify-identity", verifyToken, submitVerification);

export default router;


