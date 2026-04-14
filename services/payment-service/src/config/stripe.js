import Stripe from "stripe";

export const getStripe = () => {
	const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";

	if (!stripeSecretKey) {
		return null;
	}

	return new Stripe(stripeSecretKey);
};