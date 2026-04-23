import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { getMyMatches, unmatchUser } from "../controllers/matchesController.js";

const router = express.Router();

router.get("/", verifyToken, getMyMatches);
router.patch("/:matchId/unmatch", verifyToken, unmatchUser);

export default router;
