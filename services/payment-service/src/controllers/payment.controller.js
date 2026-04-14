import Payment from "../models/paymentModel.js";
import { getStripe } from "../config/stripe.js";

export const createPayment = async (req, res) => {
  try {
    const { paymentId, patientId, doctorId, amount, currency, status, provider } = req.body;

    const payment = new Payment({
      paymentId,
      patientId,
      doctorId,
      amount,
      currency,
      status,
      provider,
    });

    const savedPayment = await payment.save();
    res.status(201).json(savedPayment);
  } catch (error) {
    console.error("Failed to create payment", error);
    res.status(400).json({ error: error.message });
  }
};

export const createPaymentIntent = async (req, res) => {
  try {
    const stripe = getStripe();

    if (!stripe) {
      return res.status(500).json({ error: "Stripe secret key is not configured" });
    }

    const { paymentId, patientId, doctorId, amount, currency = "usd" } = req.body;

    if (!paymentId || !patientId || !amount) {
      return res.status(400).json({ error: "paymentId, patientId, and amount are required" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount) * 100),
      currency: String(currency).toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        paymentId,
        patientId,
        doctorId: doctorId || "",
      },
    });

    const payment = new Payment({
      paymentId,
      patientId,
      doctorId,
      amount,
      currency,
      status: "pending",
      provider: "stripe",
      stripePaymentIntentId: paymentIntent.id,
    });

    const savedPayment = await payment.save();

    res.status(201).json({
      payment: savedPayment,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("Failed to create payment intent", error);
    res.status(400).json({ error: error.message });
  }
};

export const listPayments = async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });
    res.status(200).json(payments);
  } catch (error) {
    console.error("Failed to list payments", error);
    res.status(500).json({ error: error.message });
  }
};

export const getPaymentByPaymentId = async (req, res) => {
  try {
    const payment = await Payment.findOne({ paymentId: req.params.paymentId });

    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    res.status(200).json(payment);
  } catch (error) {
    console.error("Failed to get payment", error);
    res.status(500).json({ error: error.message });
  }
};
