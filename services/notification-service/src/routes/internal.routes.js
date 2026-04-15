import express from "express";
import { requireInternalSecret } from "../middleware/internalAuth.js";
import {
  createNotification,
  listNotifications,
  markNotificationRead
} from "../controllers/internal.controller.js";

const router = express.Router();

router.use(requireInternalSecret);

router.post("/notifications", createNotification);
router.get("/notifications", listNotifications);
router.patch("/notifications/:id/read", markNotificationRead);

export default router;
