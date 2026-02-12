import React, { useState } from 'react';
import { useBusiness } from '@contexts/BusinessContext';
import { useToast } from '@contexts/ToastContext';
import { INDIAN_STATES, validateGSTIN } from '@logic/gstEngine';
import { fetchGSTDetails, fetchBankDetails, fetchPincodeDetails } from '@services/gstService';
import { getIntegrationSettings } from '@db/operations';
import {
    Building2, ArrowRight, Sparkles, Receipt, TrendingUp, Shield,
    User, MapPin, CreditCard, Palette, ArrowLeft, Check, Upload, X, Loader2
} from 'lucide-react';
import './Onboarding.css';

const BUSINESS_TYPES = [
    { value: 'sole_proprietorship', label: 'Sole Proprietorship', icon: '👤' },
    { value: 'partnership', label: 'Partnership', icon: '🤝' },
    { value: 'llp', label: 'LLP', icon: '📋' },
    { value: 'pvt_ltd', label: 'Private Limited', icon: '🏢' },
    { value: 'public_ltd', label: 'Public Limited', icon: '🏛️' },
    { value: 'freelancer', label: 'Freelancer', icon: '💻' },
];

export default function Onboarding() {
    const { addBusiness } = useBusiness();
    const toast = useToast();
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);

    // Form State
    const [fetchingGst, setFetchingGst] = useState(false);

    // Form State
    const [form, setForm] = useState({
        // Step 1: Basics
        businessName: '',
        businessType: '',
        email: '',
        phone: '',

        // Step 2: Location & Tax
        address: '',
        state: '',
        gstin: '',
        pan: '',
        invoicePrefix: 'INV',
        invoiceCounter: 1,

        // Step 3: Bank
        bankAccountName: '',
        bankAccountNumber: '',
        bankIfsc: '',
        bankName: '',
        bankBranch: '',
        upiId: '',

        // Step 4: Branding
        primaryColor: '#6C5CE7',
        fontFamily: 'Inter',
        logo: null,
        signature: null,
        stamp: null
    });

    const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleGSTINBlur = async () => {
        if (!form.gstin || form.gstin.length < 15) return;

        const { valid, error } = validateGSTIN(form.gstin);
        if (!valid) {
            toast.error(error);
            return;
        }

        // Try to fetch details
        setFetchingGst(true);
        try {
            // Since we are in onboarding/new biz, we might not have a businessId yet to fetch settings
            // However, we might have saved global settings or user preferences.
            // For now, prompt if key is missing or try to fetch if we can.
            // Actually, in Onboarding, we likely don't have settings saved for THIS business yet.
            // But if the user is ALREADY logged in and creating a NEW business, we might have access to OTHER business settings?
            // Or we assume the user has configured this globally.
            // Requirement said "Settings Page". 
            // If this is first run, they won't have a key.
            // We'll proceed with fetch and handle error gracefully (e.g. "Configure API key in settings for auto-fetch")

            // Check if there are any existing businesses to get a key from, or if we need a global store.
            // For now, we'll try to fetch with a placeholder or prompt.
            // BETTER APPROACH: Allow entering key directly here if not found? 
            // Or just fail silently for now if no key.

            // Let's try to get settings from ANY business if available (since keys are likely same for owner)
            // This is a bit hacky but works for MVP.
            // Ideal: Global User Settings.

            // Simulating a check for now, assuming we might find one.
            // If not, we just show a toast "API Key not configured".

            // Wait, we can't easily get the key here if it's stored per business and we are creating the first one.
            // We will skip auto-fetch if no key is found, or ask user to enter it?
            // Let's try to fetch without key (if service allows trial) or alert user.

            // Actually, let's look for a key in a "user" preference if we moved it there? 
            // No, we put it in `integrations` store with `businessId`.

            // If this is the FIRST business, they can't have set the key yet.
            // So auto-fetch won't work for the VERY first business unless we allow entering key in Onboarding.

            // Let's add a small "Have a GST API Key?" link or just skip for now.
            // But if they are adding a 2nd business, we can reuse key.

            // Proceeding with fetch, assuming service might handle it or we catch error.
            // The service now handles lookups via a secure platform-managed serverless function.
            const details = await fetchGSTDetails(form.gstin);

            if (details) {
                toast.success('Business details fetched!');
                setForm(prev => ({
                    ...prev,
                    businessName: details.legalName || prev.businessName,
                    address: details.address || prev.address,
                    state: details.state || prev.state,
                }));
            }
        } catch (err) {
            console.log('GST Fetch skipped/failed:', err.message);
            if (err.message.includes('Server misconfigured')) {
                toast.error('GST lookup service currently unavailable.');
            }
        }
        setFetchingGst(false);
    };

    const handleIFSCBlur = async () => {
        if (!form.bankIfsc || form.bankIfsc.length < 11) return;
        try {
            const data = await fetchBankDetails(form.bankIfsc);
            if (data) {
                setForm(p => ({
                    ...p,
                    bankName: data.BANK || p.bankName,
                    bankBranch: data.BRANCH || p.bankBranch
                }));
                toast.success('Bank details fetched!');
            }
        } catch (e) {
            // silent fail
        }
    };

    const handlePincodeBlur = async () => {
        if (!form.pincode || form.pincode.length < 6) return;
        try {
            const data = await fetchPincodeDetails(form.pincode);
            if (data) {
                setForm(p => ({
                    ...p,
                    city: data.city || p.city,
                    state: data.state || p.state,
                }));
                toast.success('Location fetched!');
            }
        } catch (e) {
            // silent 
        }
    };

    const handleFileUpload = (key) => (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            toast.error('File size must be less than 2MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => update(key, reader.result);
        reader.readAsDataURL(file);
    };

    const nextStep = () => {
        if (step === 1) {
            if (!form.businessName.trim()) { toast.error('Enter business name'); return; }
            if (!form.businessType) { toast.error('Select business type'); return; }
        }
        if (step === 2) {
            if (!form.state) { toast.error('Select state'); return; }
            if (form.gstin) {
                const { valid, error } = validateGSTIN(form.gstin);
                if (!valid) { toast.error(error); return; }
            }
        }
        setStep(p => p + 1);
    };

    const prevStep = () => setStep(p => p - 1);

    const handleFinish = async () => {
        setSaving(true);
        try {
            // Construct business object matching operations.js schema
            const businessData = {
                businessName: form.businessName,
                businessType: form.businessType,
                email: form.email,
                phone: form.phone,
                address: form.address,
                state: form.state,
                gstin: form.gstin,
                pan: form.pan,
                invoicePrefix: form.invoicePrefix,
                invoiceCounter: Number(form.invoiceCounter) - 1, // Store current, so next is +1

                branding: {
                    primaryColor: form.primaryColor,
                    fontFamily: form.fontFamily,
                    logo: form.logo,
                    signature: form.signature,
                    stamp: form.stamp,
                },

                bankDetails: {
                    accountName: form.bankAccountName,
                    accountNumber: form.bankAccountNumber,
                    ifsc: form.bankIfsc,
                    bankName: form.bankName,
                    branch: form.bankBranch,
                    upiId: form.upiId,
                }
            };

            await addBusiness(businessData);
            toast.success('🎉 Business created! Welcome to OneBill!');
        } catch (err) {
            toast.error(err.message);
        }
        setSaving(false);
    };

    return (
        <div className="onboarding-page">
            <div className="onboarding-container">
                {/* Left - Hero */}
                <div className="onboarding-hero">
                    <div className="onboarding-hero-content">
                        <div className="onboarding-badge">
                            <Sparkles size={14} /> Quick Setup
                        </div>
                        <h1>Welcome to <span className="gradient-text">OneBill</span></h1>
                        <p>Let's get your business ready for invoicing in just a few steps.</p>

                        <div className="onboarding-features">
                            <div className={`feature-item ${step === 1 ? 'active-feature' : ''}`}>
                                <div className="feature-icon"><Building2 size={18} /></div>
                                <div><strong>Business Basics</strong><span>Identity & Contact</span></div>
                            </div>
                            <div className={`feature-item ${step === 2 ? 'active-feature' : ''}`}>
                                <div className="feature-icon"><MapPin size={18} /></div>
                                <div><strong>Location & Tax</strong><span>Address & GST</span></div>
                            </div>
                            <div className={`feature-item ${step === 3 ? 'active-feature' : ''}`}>
                                <div className="feature-icon"><CreditCard size={18} /></div>
                                <div><strong>Bank Details</strong><span>For Receiving Payments</span></div>
                            </div>
                            <div className={`feature-item ${step === 4 ? 'active-feature' : ''}`}>
                                <div className="feature-icon"><Palette size={18} /></div>
                                <div><strong>Branding</strong><span>Logo & Colors</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right - Form */}
                <div className="onboarding-form-section">
                    <div className="onboarding-steps">
                        {[1, 2, 3, 4].map(s => (
                            <React.Fragment key={s}>
                                <div className={`step-indicator ${step >= s ? 'active' : ''}`}>{s}</div>
                                {s < 4 && <div className={`step-line ${step > s ? 'active' : ''}`} />}
                            </React.Fragment>
                        ))}
                    </div>

                    <div className="step-content">
                        {step === 1 && (
                            <div className="animate-fade-in">
                                <h2>Business Basics</h2>
                                <p className="step-desc">Tell us about your company</p>

                                <div className="form-group">
                                    <label className="form-label">Business Name <span className="required">*</span></label>
                                    <input className="form-input" value={form.businessName} onChange={e => update('businessName', e.target.value)} placeholder="Acme Corp" autoFocus />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Business Type <span className="required">*</span></label>
                                    <div className="business-types-grid">
                                        {BUSINESS_TYPES.map(type => (
                                            <div
                                                key={type.value}
                                                className={`business-type-card ${form.businessType === type.value ? 'selected' : ''}`}
                                                onClick={() => update('businessType', type.value)}
                                            >
                                                <div className="type-icon">{type.icon}</div>
                                                <div className="type-label">{type.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Email</label>
                                        <input type="email" className="form-input" value={form.email} onChange={e => update('email', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Phone</label>
                                        <input type="tel" className="form-input" value={form.phone} onChange={e => update('phone', e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="animate-fade-in">
                                <h2>Location & Tax</h2>
                                <p className="step-desc">Where are you located?</p>

                                <div className="form-group">
                                    <label className="form-label">Address</label>
                                    <textarea className="form-textarea" rows={2} value={form.address} onChange={e => update('address', e.target.value)} />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">State <span className="required">*</span></label>
                                        <select className="form-select" value={form.state} onChange={e => update('state', e.target.value)}>
                                            <option value="">Select State</option>
                                            {INDIAN_STATES.map(s => <option key={s.code} value={s.name}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">GSTIN</label>
                                        <div className="input-with-icon-right">
                                            <input
                                                className="form-input"
                                                value={form.gstin}
                                                onChange={e => update('gstin', e.target.value.toUpperCase())}
                                                maxLength={15}
                                                onBlur={handleGSTINBlur}
                                                placeholder="27ABCDE1234F1Z5"
                                            />
                                            {fetchingGst && <Loader2 size={16} className="spinner input-icon" />}
                                        </div>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">PAN</label>
                                        <input className="form-input" value={form.pan} onChange={e => update('pan', e.target.value.toUpperCase())} maxLength={10} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Start Invoice No.</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input className="form-input" style={{ width: '80px' }} value={form.invoicePrefix} onChange={e => update('invoicePrefix', e.target.value)} placeholder="INV" />
                                            <input type="number" className="form-input" style={{ flex: 1 }} value={form.invoiceCounter} onChange={e => update('invoiceCounter', e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="animate-fade-in">
                                <h2>Bank Details</h2>
                                <p className="step-desc">Display these on your invoices</p>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Account Name</label>
                                        <input className="form-input" value={form.bankAccountName} onChange={e => update('bankAccountName', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Account Number</label>
                                        <input className="form-input" value={form.bankAccountNumber} onChange={e => update('bankAccountNumber', e.target.value)} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">IFSC Code</label>
                                        <input className="form-input" value={form.bankIfsc} onChange={e => update('bankIfsc', e.target.value.toUpperCase())} onBlur={handleIFSCBlur} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Bank Name</label>
                                        <input className="form-input" value={form.bankName} onChange={e => update('bankName', e.target.value)} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Branch</label>
                                        <input className="form-input" value={form.bankBranch} onChange={e => update('bankBranch', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">UPI ID</label>
                                        <input className="form-input" value={form.upiId} onChange={e => update('upiId', e.target.value)} placeholder="user@upi" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 4 && (
                            <div className="animate-fade-in">
                                <h2>Branding</h2>
                                <p className="step-desc">Make your invoices look professional</p>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Primary Color</label>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <input type="color" value={form.primaryColor} onChange={e => update('primaryColor', e.target.value)} style={{ width: '40px', height: '38px', padding: 0, border: 'none', cursor: 'pointer' }} />
                                            <input className="form-input" value={form.primaryColor} onChange={e => update('primaryColor', e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Font</label>
                                        <select className="form-select" value={form.fontFamily} onChange={e => update('fontFamily', e.target.value)}>
                                            <option value="Inter">Inter</option>
                                            <option value="Roboto">Roboto</option>
                                            <option value="Lato">Lato</option>
                                            <option value="Poppins">Poppins</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Logo</label>
                                    <div className="upload-box-simple">
                                        {form.logo ? (
                                            <div className="upload-preview-row">
                                                <img src={form.logo} alt="Logo" />
                                                <button className="btn btn-ghost btn-sm" onClick={() => update('logo', null)}><X size={14} /></button>
                                            </div>
                                        ) : (
                                            <label className="btn btn-secondary btn-sm">
                                                <Upload size={14} /> Upload Logo
                                                <input type="file" hidden accept="image/*" onChange={handleFileUpload('logo')} />
                                            </label>
                                        )}
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Signature</label>
                                        <div className="upload-box-simple">
                                            {form.signature ? (
                                                <div className="upload-preview-row">
                                                    <img src={form.signature} alt="Sig" />
                                                    <button className="btn btn-ghost btn-sm" onClick={() => update('signature', null)}><X size={14} /></button>
                                                </div>
                                            ) : (
                                                <label className="btn btn-secondary btn-sm">
                                                    <Upload size={14} /> Upload Sig
                                                    <input type="file" hidden accept="image/*" onChange={handleFileUpload('signature')} />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="onboarding-footer">
                        {step > 1 ? (
                            <button className="btn btn-ghost" onClick={prevStep}>
                                <ArrowLeft size={16} /> Back
                            </button>
                        ) : (
                            <div />
                        )}

                        {step < 4 ? (
                            <button className="btn btn-primary" onClick={nextStep}>
                                Next Step <ArrowRight size={16} />
                            </button>
                        ) : (
                            <button className="btn btn-primary" onClick={handleFinish} disabled={saving}>
                                {saving ? <span className="spinner" /> : <><Check size={16} /> Complete Setup</>}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
