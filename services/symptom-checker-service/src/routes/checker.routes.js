import express from "express";
import { analyzeSymptoms, getCheckHistory } from "../controllers/checker.controller.js";

const router = express.Router();

router.post("/analyze", analyzeSymptoms);
router.get("/history/:userId", getCheckHistory);

export default router;
