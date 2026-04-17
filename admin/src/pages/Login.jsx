import React from 'react';
import { SignIn } from '@clerk/clerk-react';

const Login = () => {
    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <h2>Welcome to MediSync</h2>
                    <p><span>Admin / Doctor</span> Authentication</p>
                </div>
                <SignIn
                    routing="path"
                    path="/signin"
                    forceRedirectUrl="/signin"
                    fallbackRedirectUrl="/signin"
                    signUpUrl={null}
                    appearance={{
                        layout: {
                            logoPlacement: 'none'
                        },
                        elements: {
                            footerAction: { display: 'none' },
                            footerActionText: { display: 'none' },
                            footerActionLink: { display: 'none' },
                            card: { boxShadow: 'none', border: 'none', background: 'transparent' }
                        }
                    }}
                />
            </div>
        </div>
    );
};

export default Login;
