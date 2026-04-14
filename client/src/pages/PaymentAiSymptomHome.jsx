import React from 'react';
import { Link } from 'react-router-dom';

function PaymentAiSymptomHome() {
  return (
    <main className="page-shell">
      <div className="notice-card">
        <h1>MediSync AI Client</h1>
        <p>
          Open the payment screen at <strong>/payment</strong>.
        </p>
        <p>
          Try the symptom checker at <strong>/symptom-checker</strong>.
        </p>
        <Link className="home-link" to="/payment">
          Go to payment page
        </Link>
        <Link className="home-link" to="/symptom-checker">
          Go to symptom checker
        </Link>
      </div>
    </main>
  );
}

export default PaymentAiSymptomHome;
