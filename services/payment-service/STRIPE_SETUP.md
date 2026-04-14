# Payment Service - Stripe Integration Guide

## Overview
The Payment Service handles all payment processing using Stripe, including payment intent creation and webhook event handling.

## Setup Instructions

### 1. Environment Variables
Make sure you have the following in your `.env` file:

```env
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_test_your_webhook_secret_here
MONGO_URI=your_mongodb_connection_string
PORT=8019
```

### 2. Getting Your Stripe Webhook Secret

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **Webhooks**
3. Click **Add an endpoint**
4. Endpoint URL: `http://your-domain.com/payments/webhook` (for production) or use Stripe CLI for local testing
5. Select events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.refunded`
6. Copy the signing secret (starts with `whsec_`) to your `.env` file as `STRIPE_WEBHOOK_SECRET`

### 3. Local Testing with Stripe CLI

For local development, use [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
# Install Stripe CLI and authenticate
stripe login

# Forward webhook events to your local server
stripe listen --forward-to localhost:8019/payments/webhook

# This will give you a webhook signing secret to use in .env
```

## API Endpoints

### Create Payment Intent
**POST** `/payments/create-intent`

Request body:
```json
{
  "paymentId": "PAY-XXXXX",
  "patientId": "patient-123",
  "doctorId": "doctor-456",
  "amount": 50.00,
  "currency": "usd"
}
```

Response:
```json
{
  "payment": { ... },
  "paymentIntentId": "pi_xxxxx",
  "clientSecret": "pi_xxxxx_secret_xxxxx"
}
```

### List Payments
**GET** `/payments`

### Get Payment by ID
**GET** `/payments/:paymentId`

### Create Payment Record
**POST** `/payments`

Request body:
```json
{
  "paymentId": "PAY-XXXXX",
  "patientId": "patient-123",
  "doctorId": "doctor-456",
  "amount": 50.00,
  "currency": "usd",
  "status": "pending",
  "provider": "stripe"
}
```

## Webhook Events

The service automatically handles these Stripe events:

- **payment_intent.succeeded**: Updates payment status to "succeeded"
- **payment_intent.payment_failed**: Updates payment status to "failed"
- **payment_intent.canceled**: Updates payment status to "cancelled"
- **charge.refunded**: Updates payment status to "refunded"

## Payment Statuses

- `pending`: Payment intent created, awaiting confirmation
- `succeeded`: Payment successfully processed
- `failed`: Payment failed
- `cancelled`: Payment was cancelled
- `refunded`: Payment was refunded

## Implementing in Frontend

```javascript
// 1. Create payment intent
const response = await fetch('/payments/create-intent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    paymentId: 'PAY-ABC123',
    patientId: 'patient-123',
    doctorId: 'doctor-456',
    amount: 50.00,
    currency: 'usd'
  })
});

const { clientSecret } = await response.json();

// 2. Use clientSecret with Stripe Elements/Payment Element
const stripe = Stripe('pk_test_your_public_key');
const elements = stripe.elements({ clientSecret });
const paymentElement = elements.create('payment');
paymentElement.mount('#payment-element');

// 3. Handle payment submission
document.getElementById('payment-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const { error, paymentIntent } = await stripe.confirmPayment({
    elements,
    confirmParams: {
      return_url: 'https://example.com/success',
    },
  });

  if (error) {
    console.error('Payment failed:', error);
  } else if (paymentIntent.status === 'succeeded') {
    console.log('Payment successful!');
  }
});
```

## Best Practices

1. **Always use Stripe's official libraries** on the client side
2. **Never store raw card data** - only use Stripe's tokenization
3. **Use Payment Intents** for better security and retry logic
4. **Implement proper error handling** and user feedback
5. **Test webhooks locally** before deploying to production
6. **Keep Stripe SDK updated** to latest version
7. **Use HTTPS in production** - required for Stripe
8. **Store `clientSecret`** temporarily, don't log it

## Troubleshooting

### Webhook events not received
- Verify endpoint URL is correct
- Check webhook signing secret in `.env`
- Ensure server is running and accessible
- Monitor Stripe Dashboard for failed delivery attempts

### Payment intent creation fails
- Verify `STRIPE_SECRET_KEY` is correct and not revoked
- Check request body has required fields
- Ensure amount is at least $0.50 (50 cents)

### Duplicate payments
- Idempotency keys are now generated automatically
- Check payment records in database before retrying

## Security Notes

- ✅ Webhook signature verification is implemented
- ✅ Raw body required for signature verification
- ✅ Idempotency keys prevent duplicate charges
- ✅ Payment metadata tracks all relevant IDs
- ⚠️ Keep `STRIPE_SECRET_KEY` secure (never expose in frontend)
- ⚠️ HTTPS required in production
