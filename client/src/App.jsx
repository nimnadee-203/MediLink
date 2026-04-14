import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PaymentAiSymptomHome from './pages/PaymentAiSymptomHome';
import PaymentPage from './pages/PaymentPage';
import PaymentSuccess from './pages/PaymentSuccess';
import SymptomCheckerPage from './pages/SymptomCheckerPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PaymentAiSymptomHome />} />
        <Route path="/payment" element={<PaymentPage />} />
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route path="/symptom-checker" element={<SymptomCheckerPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
