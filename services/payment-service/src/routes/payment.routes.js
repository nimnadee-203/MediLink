import express from "express";
import {
  createPayment,
  createPaymentIntent,
  listPayments,
  getPaymentByPaymentId,
} from "../controllers/payment.controller.js";

const router = express.Router();

router.post("/", createPayment);
router.post("/create-intent", createPaymentIntent);
router.get("/", listPayments);
router.get("/:paymentId", getPaymentByPaymentId);

export default router;
