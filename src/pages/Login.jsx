import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { useToast } from '@contexts/ToastContext';
import { Receipt, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import './Auth.css';

export default function Login() {
    const { login } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!email || !password) { setError('Please fill in all fields.'); return; }

        setLoading(true);
        try {
            await login(email, password);
            toast.success('Welcome back!');
            navigate('/dashboard');
        } catch (err) {
            setError(err.message || 'Login failed.');
        }
        setLoading(false);
    };

    return (
        <div className="auth-page">
            <div className="auth-left">
                <div className="auth-brand">
                    <div className="auth-logo">
                        <Receipt size={28} />
                    </div>
                    <h1>OneBill</h1>
                    <p>Smart invoicing for Indian businesses</p>
                </div>
                <div className="auth-features">
                    <div className="auth-feature">
                        <span className="auth-feature-bullet" />
                        <span>GST & Non-GST Invoicing with auto tax calculation</span>
                    </div>
                    <div className="auth-feature">
                        <span className="auth-feature-bullet" />
                        <span>Multi-business support with real-time invoice preview</span>
                    </div>
                    <div className="auth-feature">
                        <span className="auth-feature-bullet" />
                        <span>CA collaboration workspace for GST filing</span>
                    </div>
                    <div className="auth-feature">
                        <span className="auth-feature-bullet" />
                        <span>Business insights with performance analytics</span>
                    </div>
                </div>
            </div>

            <div className="auth-right">
                <form className="auth-form" onSubmit={handleSubmit}>
                    <h2>Welcome back</h2>
                    <p className="auth-subtitle">Sign in to your OneBill account</p>

                    {error && <div className="auth-error">{error}</div>}

                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <div className="auth-input-group">
                            <Mail size={16} className="auth-input-icon" />
                            <input
                                type="email"
                                className="form-input"
                                placeholder="you@example.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                style={{ paddingLeft: '36px' }}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <div className="auth-input-group">
                            <Lock size={16} className="auth-input-icon" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="form-input"
                                placeholder="Enter your password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                style={{ paddingLeft: '36px', paddingRight: '40px' }}
                            />
                            <button
                                type="button"
                                className="auth-show-pw"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', marginTop: 'var(--space-4)' }}>
                        {loading ? <span className="spinner" /> : 'Sign In'}
                    </button>

                    <p className="auth-link-text">
                        Don't have an account? <Link to="/register">Create one</Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
