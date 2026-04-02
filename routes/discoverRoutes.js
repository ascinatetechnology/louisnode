import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  getDiscoveryPreferences,
  saveDiscoveryFilters,
  getDiscoverUsers,
  swipeUser
} from "../controllers/discoverController.js";

const router = express.Router();

router.get("/preferences", verifyToken, getDiscoveryPreferences);
router.post("/filter", verifyToken, saveDiscoveryFilters);
router.post("/swipe", verifyToken, swipeUser);
router.get("/", verifyToken, getDiscoverUsers);

export default router;