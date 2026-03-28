import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkLoaded, ClerkLoading, ClerkProvider } from '@clerk/clerk-react';
import App from './App.jsx';
import './index.css';

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected app error'
    };
  }

  componentDidCatch(error) {
    console.error('App crashed:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: '#f3f4f6' }}>
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', maxWidth: '560px', width: '100%' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700 }}>Something went wrong</h2>
            <p style={{ margin: 0, color: '#374151' }}>{this.state.errorMessage}</p>
            <p style={{ margin: '12px 0 0', color: '#6b7280', fontSize: '14px' }}>
              Refresh the page. If the issue persists, check browser console logs.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

if (!clerkPublishableKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in client/.env');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/signin">
      <ClerkLoading>
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f3f4f6' }}>
          <p style={{ color: '#374151', fontWeight: 600 }}>Loading authentication...</p>
        </div>
      </ClerkLoading>
      <ClerkLoaded>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </ClerkLoaded>
    </ClerkProvider>
  </React.StrictMode>
);
