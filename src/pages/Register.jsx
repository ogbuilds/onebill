import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { useToast } from '@contexts/ToastContext';
import { Receipt, Mail, Lock, User, Phone, Eye, EyeOff } from 'lucide-react';
import './Auth.css';

export default function Register() {
    const { register } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!form.name || !form.email || !form.password) {
            setError('Name, email, and password are required.');
            return;
        }
        if (form.password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }
        if (form.password !== form.confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            await register({ name: form.name, email: form.email, phone: form.phone, password: form.password, role: 'admin' });
            toast.success('Account created! Welcome to OneBill.');
            navigate('/dashboard');
        } catch (err) {
            setError(err.message || 'Registration failed.');
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
                    <div className="auth-feature"><span className="auth-feature-bullet" /><span>GST & Non-GST Invoicing</span></div>
                    <div className="auth-feature"><span className="auth-feature-bullet" /><span>Multi-business & multi-user</span></div>
                    <div className="auth-feature"><span className="auth-feature-bullet" /><span>Real-time invoice preview</span></div>
                    <div className="auth-feature"><span className="auth-feature-bullet" /><span>CA workspace & GST reports</span></div>
                </div>
            </div>

            <div className="auth-right">
                <form className="auth-form" onSubmit={handleSubmit}>
                    <h2>Create your account</h2>
                    <p className="auth-subtitle">Get started with OneBill in minutes</p>

                    {error && <div className="auth-error">{error}</div>}

                    <div className="form-group">
                        <label className="form-label">Full Name <span className="required">*</span></label>
                        <div className="auth-input-group">
                            <User size={16} className="auth-input-icon" />
                            <input type="text" className="form-input" placeholder="Your name" value={form.name} onChange={e => update('name', e.target.value)} style={{ paddingLeft: '36px' }} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Email <span className="required">*</span></label>
                        <div className="auth-input-group">
                            <Mail size={16} className="auth-input-icon" />
                            <input type="email" className="form-input" placeholder="you@example.com" value={form.email} onChange={e => update('email', e.target.value)} style={{ paddingLeft: '36px' }} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Phone</label>
                        <div className="auth-input-group">
                            <Phone size={16} className="auth-input-icon" />
                            <input type="tel" className="form-input" placeholder="+91 98765 43210" value={form.phone} onChange={e => update('phone', e.target.value)} style={{ paddingLeft: '36px' }} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label">Password <span className="required">*</span></label>
                            <div className="auth-input-group">
                                <Lock size={16} className="auth-input-icon" />
                                <input type={showPassword ? 'text' : 'password'} className="form-input" placeholder="Min 6 chars" value={form.password} onChange={e => update('password', e.target.value)} style={{ paddingLeft: '36px' }} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Confirm Password <span className="required">*</span></label>
                            <input type={showPassword ? 'text' : 'password'} className="form-input" placeholder="Re-enter" value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} />
                        </div>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 'var(--space-2) 0' }}>
                        <input type="checkbox" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} />
                        Show passwords
                    </label>

                    <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', marginTop: 'var(--space-4)' }}>
                        {loading ? <span className="spinner" /> : 'Create Account'}
                    </button>

                    <p className="auth-link-text">
                        Already have an account? <Link to="/login">Sign in</Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
