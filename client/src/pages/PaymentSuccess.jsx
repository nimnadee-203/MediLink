import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../styles/payment-notification-ai.css';

function PaymentSuccess() {
  const location = useLocation();
  const navigate = useNavigate();
  const paymentData = location.state || {};

  return (
    <div className="payment-page-shell">
      <div className="success-container">
        <div className="success-card">
          <div className="success-icon">✓</div>
          <h1>Payment Successful!</h1>
          
          <div className="success-message">
            <p>Your payment has been processed successfully.</p>
            <p>A confirmation email will be sent to you shortly.</p>
          </div>

          <div className="payment-details">
            <div className="detail-row">
              <span className="detail-label">Payment ID</span>
              <span className="detail-value">{paymentData.paymentId || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Amount</span>
              <span className="detail-value">Rs {paymentData.amount || '0.00'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Patient ID</span>
              <span className="detail-value">{paymentData.patientId || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Doctor ID</span>
              <span className="detail-value">{paymentData.doctorId || 'N/A'}</span>
            </div>
          </div>

          <button 
            onClick={() => navigate('/')}
            className="btn-back-home"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaymentSuccess;
