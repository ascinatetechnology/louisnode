import express from "express";

import {
  getSubscriptionPlans,
  createSubscription,
  activateSubscription
} from "../controllers/subscriptionController.js";

const router = express.Router();

router.get(
  "/plans",
  getSubscriptionPlans
);

router.post(
  "/create-subscription",
  createSubscription
);

router.post(
  "/activate",
  activateSubscription
);

export default router;