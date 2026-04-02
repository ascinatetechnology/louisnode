import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";

import {
  getProfile,
  updateProfile,
  uploadPhoto,
  deletePhoto,
  setPrimaryPhoto,
  uploadVideo,
  saveAnswers,
  updateFullProfile,
  updateUserInterests,
  updateLocation
} from "../controllers/userController.js";

const router = express.Router();

router.get("/me", verifyToken, getProfile);
router.put("/update-profile", verifyToken, updateProfile);
router.post("/save-answers", verifyToken, saveAnswers);

router.put("/update-full-profile", verifyToken, updateFullProfile);
router.post("/update-interests", verifyToken, updateUserInterests);
router.post("/videos", verifyToken, uploadVideo);
router.put("/update-location", verifyToken, updateLocation);
router.post("/photos", verifyToken, uploadPhoto);
router.delete("/photos/:id", verifyToken, deletePhoto);
router.patch("/photos/:id/primary", verifyToken, setPrimaryPhoto);

export default router;