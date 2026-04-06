import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { getMyMatches } from "../controllers/matchesController.js";

const router = express.Router();

router.get("/", verifyToken, getMyMatches);

export default router;