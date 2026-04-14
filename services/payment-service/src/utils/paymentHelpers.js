import crypto from 'crypto';

/**
 * Generate a unique idempotency key for Stripe requests
 * This prevents duplicate charges if the request is retried
 */
export const generateIdempotencyKey = (patientId, amount, timestamp) => {
  const data = `${patientId}-${amount}-${timestamp}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Generate a unique payment ID
 */
export const generatePaymentId = () => {
  return `PAY-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
};

/**
 * Validate payment amount (must be positive and at least $0.50)
 */
export const isValidPaymentAmount = (amount) => {
  const minAmount = 0.50;
  return typeof amount === 'number' && amount >= minAmount && !isNaN(amount);
};

/**
 * Format currency code to lowercase
 */
export const formatCurrency = (currency) => {
  return String(currency).toLowerCase().trim();
};
