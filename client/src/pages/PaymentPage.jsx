import React, { useMemo, useState } from 'react';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useLocation, useNavigate } from 'react-router-dom';
import '../styles/payment-notification-ai.css';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');
const paymentApiBaseUrl = import.meta.env.VITE_PAYMENT_API_BASE_URL || 'http://localhost:8019';

function CheckoutForm({ initialForm }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);

  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  const amountLabel = useMemo(() => {
    if (!form.amount) {
      return 'Rs 0.00';
    }
    const numericAmount = Number(form.amount);
    if (Number.isNaN(numericAmount)) {
      return 'Rs 0.00';
    }
    return `Rs ${numericAmount.toFixed(2)}`;
  }, [form.amount]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handlePay = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      setMessage('Stripe is still loading. Please wait...');
      return;
    }

    setStatus('processing');
    setMessage('Processing your payment...');

    try {
      // Step 1: Create payment intent
      const intentResponse = await fetch(`${paymentApiBaseUrl}/payments/create-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const intentData = await intentResponse.json();
      if (!intentResponse.ok) throw new Error(intentData.error || 'Unable to create payment intent');

      const clientSecret = intentData.clientSecret;

      // Step 2: Confirm payment with card details
      const cardNumberElement = elements.getElement(CardNumberElement);
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardNumberElement,
          billing_details: {
            name: `${form.firstName} ${form.lastName}`.trim(),
          },
        },
      });

      if (result.error) {
        setStatus('error');
        setMessage(result.error.message || 'Payment failed');
        return;
      }

      if (result.paymentIntent?.status === 'succeeded') {
        setStatus('success');
        setMessage('Payment succeeded! Redirecting...');
        setTimeout(() => {
          navigate('/payment-success', { 
            state: { 
              paymentId: form.paymentId,
              amount: form.amount,
              patientId: form.patientId,
              doctorId: form.doctorId,
              appointmentDate: form.appointmentDate
            } 
          });
        }, 1500);
        return;
      }

      setStatus('idle');
      setMessage('Payment completed with an unexpected status.');
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'An error occurred during payment processing');
    }
  };

  return (
    <div className="payment-wrapper">
      {/* Left Column - Payment Form */}
      <div className="payment-form-box">
        {/* Header */}
        <div className="payment-header">
          <h2>💳 Payment Details</h2>
        </div>

        <form onSubmit={handlePay} className="payment-form" autoComplete="off">
          {/* Payment Methods */}
          <div className="payment-methods-group">
            <label className="group-label">Pay with</label>
            <div className="payment-methods-buttons">
              <button 
                type="button"
                className={`payment-btn ${form.paymentMethod === 'visa' ? 'active' : ''}`}
                onClick={() => setForm({...form, paymentMethod: 'visa'})}
                title="Visa"
              >
                💳 Visa
              </button>
              <button 
                type="button"
                className={`payment-btn ${form.paymentMethod === 'mastercard' ? 'active' : ''}`}
                onClick={() => setForm({...form, paymentMethod: 'mastercard'})}
                title="Mastercard"
              >
                🏧 Mastercard
              </button>
              <button 
                type="button"
                className={`payment-btn ${form.paymentMethod === 'amex' ? 'active' : ''}`}
                onClick={() => setForm({...form, paymentMethod: 'amex'})}
                title="Amex"
              >
                💰 Amex
              </button>
              <button 
                type="button"
                className={`payment-btn ${form.paymentMethod === 'paypal' ? 'active' : ''}`}
                onClick={() => setForm({...form, paymentMethod: 'paypal'})}
                title="PayPal"
              >
                🅿️ PayPal
              </button>
            </div>
          </div>

          {/* Card Type Selection */}
          <div className="form-field">
            <label htmlFor="cardType">Credit card</label>
            <select 
              id="cardType"
              name="cardType"
              value={form.cardType}
              onChange={handleChange}
              className="select-field"
            >
              <option value="credit">Credit Card</option>
              <option value="debit">Debit Card</option>
            </select>
          </div>

          {/* Name Fields */}
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="firstName">First name</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                placeholder=""
                autoComplete="off"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="lastName">Last name</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                placeholder=""
                autoComplete="off"
                required
              />
            </div>
          </div>

          {/* Card Info */}
          <div className="form-field">
            <label>Card number</label>
            <div className="card-element-box">
              <CardNumberElement 
                options={{ 
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#1a1d29',
                      '::placeholder': {
                        color: '#aeb5c0',
                      },
                    },
                    invalid: {
                      color: '#ef4444',
                    },
                  },
                }} 
              />
            </div>
          </div>

          {/* Expiry & CVV */}
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="expiry">Expiry Date</label>
              <div className="card-element-box">
                <CardExpiryElement 
                  options={{ 
                    style: {
                      base: {
                        fontSize: '16px',
                        color: '#1a1d29',
                        '::placeholder': {
                          color: '#aeb5c0',
                        },
                      },
                      invalid: {
                        color: '#ef4444',
                      },
                    },
                  }} 
                />
              </div>
            </div>
            <div className="form-field">
              <label htmlFor="cvv">CVV</label>
              <div className="card-element-box">
                <CardCvcElement 
                  options={{ 
                    style: {
                      base: {
                        fontSize: '16px',
                        color: '#1a1d29',
                        '::placeholder': {
                          color: '#aeb5c0',
                        },
                      },
                      invalid: {
                        color: '#ef4444',
                      },
                    },
                  }} 
                />
              </div>
            </div>
          </div>

          {/* IDs and Amount Fields */}
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="paymentId">Payment ID</label>
              <input
                type="text"
                id="paymentId"
                name="paymentId"
                value={form.paymentId}
                onChange={handleChange}
                placeholder="PAY-1001"
                autoComplete="off"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="patientId">Patient ID</label>
              <input
                type="text"
                id="patientId"
                name="patientId"
                value={form.patientId}
                onChange={handleChange}
                placeholder="PAT-2001"
                autoComplete="off"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="doctorId">Doctor ID</label>
              <input
                type="text"
                id="doctorId"
                name="doctorId"
                value={form.doctorId}
                onChange={handleChange}
                placeholder="DOC-3001"
                autoComplete="off"
              />
            </div>
            <div className="form-field">
              <label htmlFor="amount">Amount</label>
              <input
                type="number"
                id="amount"
                name="amount"
                value={form.amount}
                onChange={handleChange}
                placeholder="0.00"
                min="1"
                step="0.01"
                autoComplete="off"
                required
              />
            </div>
          </div>

          {/* Pay Now Button */}
          <button
            type="submit"
            className="btn-pay-now"
            disabled={!stripe || status === 'processing'}
          >
            ◉ {status === 'processing' ? 'Processing...' : `Pay Now - ${amountLabel}`}
          </button>

          {/* Secondary Buttons */}
          <div className="button-group">
            <button type="button" className="btn-cancel">
              Cancel Booking
            </button>
          </div>

          {/* Message */}
          {message && (
            <div className={`payment-message ${status}`}>
              {message}
            </div>
          )}
        </form>
      </div>

      {/* Right Column - Payment Summary */}
      <div className="payment-summary-box">
        <div className="summary-header">
          <h2>Payment summary</h2>
        </div>

        <div className="summary-items">
          <div className="summary-row">
            <span className="summary-label">Service</span>
            <span className="summary-value">Medical Consultation</span>
          </div>

          <div className="summary-row">
            <span className="summary-label">Doctor ID</span>
            <span className="summary-value">{form.doctorId || '—'}</span>
          </div>

          <div className="summary-row">
            <span className="summary-label">Patient ID</span>
            <span className="summary-value">{form.patientId || '—'}</span>
          </div>

          <div className="summary-row">
            <span className="summary-label">Type</span>
            <span className="summary-value">Consultation</span>
          </div>

          <div className="summary-row">
            <span className="summary-label">Duration</span>
            <span className="summary-value">30 minutes</span>
          </div>

          <div className="summary-divider"></div>

          <div className="summary-row">
            <span className="summary-label">Rate</span>
            <span className="summary-value">Rs 5,000 / session</span>
          </div>

          <div className="summary-row">
            <span className="summary-label">Sessions</span>
            <span className="summary-value">1</span>
          </div>

          <div className="summary-row">
            <span className="summary-label">Calculation</span>
            <span className="summary-value">{amountLabel}</span>
          </div>

          <div className="summary-divider"></div>

          <div className="summary-row total-row">
            <span className="summary-label">Total due</span>
            <span className="summary-total">{amountLabel}</span>
          </div>

          {/* Security Notice */}
          <div className="security-notice">
            <div className="security-check">✓</div>
            <div className="security-info">
              <strong>Secure Payment</strong>
              <p>Your payment information is encrypted and secure. We use industry-standard security measures to protect your data.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentPage() {
  const location = useLocation();
  const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
  const routeState = location.state || {};

  const initialForm = useMemo(
    () => ({
      firstName: '',
      lastName: '',
      paymentId: routeState.appointmentId || `PAY-${Date.now()}`,
      patientId: routeState.patientId || '',
      doctorId: routeState.doctorId || '',
      appointmentDate: routeState.appointmentDate || '',
      amount: routeState.amount ? String(routeState.amount) : '',
      currency: 'lkr',
      cardType: 'credit',
      paymentMethod: 'visa'
    }),
    [routeState]
  );

  if (!stripeKey) {
    return (
      <main className="payment-page-shell">
        <div className="notice-card">
          <h1>Stripe publishable key missing</h1>
          <p>Add <code>VITE_STRIPE_PUBLISHABLE_KEY</code> to <code>client/.env</code> before testing checkout.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="payment-page-shell">
      <Elements stripe={stripePromise}>
        <CheckoutForm initialForm={initialForm} />
      </Elements>
    </main>
  );
}

export default PaymentPage;
