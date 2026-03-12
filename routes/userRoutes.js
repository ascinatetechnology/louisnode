import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";

import {
  getProfile,
  updateProfile,
  uploadPhoto,
  deletePhoto,
  setPrimaryPhoto,
  uploadVideo
} from "../controllers/userController.js";

const router = express.Router();

router.get("/me", verifyToken, getProfile);
router.put("/me", verifyToken, updateProfile);

router.post("/photos", verifyToken, uploadPhoto);
router.delete("/photos/:id", verifyToken, deletePhoto);
router.patch("/photos/:id/primary", verifyToken, setPrimaryPhoto);

router.post("/videos", verifyToken, uploadVideo);

export default router;