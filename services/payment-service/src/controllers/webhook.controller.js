import Payment from "../models/paymentModel.js";
import { getStripe } from "../config/stripe.js";

export const handleStripeWebhook = async (req, res) => {
  const stripe = getStripe();

  if (!stripe) {
    return res.status(500).json({ error: "Stripe secret key is not configured" });
  }

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn("STRIPE_WEBHOOK_SECRET is not configured");
    return res.status(400).json({ error: "Webhook secret not configured" });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (error) {
    console.error(`Webhook signature verification failed: ${error.message}`);
    return res.status(400).json({ error: `Webhook Error: ${error.message}` });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object);
        break;

      case "payment_intent.canceled":
        await handlePaymentIntentCanceled(event.data.object);
        break;

      case "charge.refunded":
        await handleChargeRefunded(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error(`Error processing webhook: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

const handlePaymentIntentSucceeded = async (paymentIntent) => {
  try {
    const payment = await Payment.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (!payment) {
      console.warn(`Payment not found for PaymentIntent: ${paymentIntent.id}`);
      return;
    }

    payment.status = "succeeded";
    await payment.save();

    console.log(`Payment ${payment.paymentId} marked as succeeded`);
  } catch (error) {
    console.error(`Error updating payment to succeeded: ${error.message}`);
    throw error;
  }
};

const handlePaymentIntentFailed = async (paymentIntent) => {
  try {
    const payment = await Payment.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (!payment) {
      console.warn(`Payment not found for PaymentIntent: ${paymentIntent.id}`);
      return;
    }

    payment.status = "failed";
    await payment.save();

    console.log(`Payment ${payment.paymentId} marked as failed`);
  } catch (error) {
    console.error(`Error updating payment to failed: ${error.message}`);
    throw error;
  }
};

const handlePaymentIntentCanceled = async (paymentIntent) => {
  try {
    const payment = await Payment.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (!payment) {
      console.warn(`Payment not found for PaymentIntent: ${paymentIntent.id}`);
      return;
    }

    payment.status = "cancelled";
    await payment.save();

    console.log(`Payment ${payment.paymentId} marked as cancelled`);
  } catch (error) {
    console.error(`Error updating payment to cancelled: ${error.message}`);
    throw error;
  }
};

const handleChargeRefunded = async (charge) => {
  try {
    const payment = await Payment.findOne({
      stripePaymentIntentId: charge.payment_intent,
    });

    if (!payment) {
      console.warn(`Payment not found for Charge: ${charge.id}`);
      return;
    }

    payment.status = "refunded";
    await payment.save();

    console.log(`Payment ${payment.paymentId} marked as refunded`);
  } catch (error) {
    console.error(`Error updating payment to refunded: ${error.message}`);
    throw error;
  }
};
