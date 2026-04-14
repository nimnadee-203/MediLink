import React, { useContext, useState } from "react";
import axios from 'axios';
import { AdminContext } from "../context/AdminContext";
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const navigate = useNavigate();
    const [state, setState] = useState('Admin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const { setAToken, setDToken, backendUrl } = useContext(AdminContext);

    const onSubmitHandler = async (event) => {
        event.preventDefault();
        try {
            const normalizedEmail = email.trim().toLowerCase();
            const normalizedPassword = password.trim();

            if (state === 'Admin') {
                const { data } = await axios.post(backendUrl + '/api/admin/login', { email: normalizedEmail, password: normalizedPassword });
                if (data.success) {
                    localStorage.setItem('aToken', data.token);
                    localStorage.removeItem('dToken');
                    setAToken(data.token);
                    setDToken('');
                    toast.success(data.message || "Logged in successfully!");
                    navigate('/');
                } else {
                    toast.error(data.message);
                }
            } else {
                const { data } = await axios.post(backendUrl + '/api/doctor/login', { email: normalizedEmail, password: normalizedPassword });
                if (data.success) {
                    localStorage.setItem('dToken', data.token);
                    localStorage.removeItem('aToken');
                    setAToken('');
                    setDToken(data.token);
                    toast.success(data.message || "Logged in successfully!");
                    navigate('/doctor-home');
                } else {
                    toast.error(data.message);
                }
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <h2>Welcome to MediSync</h2>
                    <p>
                        <span>{state}</span> Login
                    </p>
                </div>

                <form onSubmit={onSubmitHandler} className="login-form">
                    <div className="input-group">
                        <label>Email</label>
                        <input 
                            type="email" 
                            required 
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div className="input-group">
                        <label>Password</label>
                        <input 
                            type="password" 
                            required 
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button type="submit" className="login-btn">
                        Login
                    </button>

                    <div className="login-toggle">
                        {state === 'Admin' ? (
                            <p>
                                Are you a Doctor?{' '}
                                <span onClick={() => setState('Doctor')}>
                                    Login here
                                </span>
                            </p>
                        ) : (
                            <p>
                                Are you an Admin?{' '}
                                <span onClick={() => setState('Admin')}>
                                    Login here
                                </span>
                            </p>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
