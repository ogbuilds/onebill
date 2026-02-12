import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useBusiness } from '@contexts/BusinessContext';
import { useAuth } from '@contexts/AuthContext';
import { useToast } from '@contexts/ToastContext';
import { updateBusiness, getBusinessById, grantCAAccess, revokeCAAccess, getCAAccessByBusiness, saveAutoClearanceSettings, getAutoClearanceSettings, getIntegrationSettings, saveIntegrationSettings } from '@db/operations';
import { INDIAN_STATES, validateGSTIN } from '@logic/gstEngine';
import {
    Building2, Palette, Users, Bell, ChevronRight, Save, Plus, X, Trash2,
    Upload, CreditCard, Shield, Zap, Globe, Check
} from 'lucide-react';
import './Settings.css';

import { fetchBankDetails } from '@services/gstService';

export default function SettingsPage() {
    return (
        <div className="settings-page">
            <div className="page-header">
                <h1>Settings</h1>
                <p className="subtitle">Manage your business and app settings</p>
            </div>

            <div className="settings-layout">
                <nav className="settings-nav">
                    <NavLink to="/settings" end className={({ isActive }) => `settings-nav-item ${isActive ? 'active' : ''}`}>
                        <Building2 size={16} /> Business Details
                    </NavLink>
                    <NavLink to="/settings/branding" className={({ isActive }) => `settings-nav-item ${isActive ? 'active' : ''}`}>
                        <Palette size={16} /> Branding
                    </NavLink>
                    <NavLink to="/settings/bank" className={({ isActive }) => `settings-nav-item ${isActive ? 'active' : ''}`}>
                        <CreditCard size={16} /> Bank Details
                    </NavLink>
                    <NavLink to="/settings/ca-access" className={({ isActive }) => `settings-nav-item ${isActive ? 'active' : ''}`}>
                        <Shield size={16} /> CA Access
                    </NavLink>
                    <NavLink to="/settings/auto-clearance" className={({ isActive }) => `settings-nav-item ${isActive ? 'active' : ''}`}>
                        <Zap size={16} /> Payment Automation
                    </NavLink>
                    <NavLink to="/settings/integrations" className={({ isActive }) => `settings-nav-item ${isActive ? 'active' : ''}`}>
                        <Globe size={16} /> Integrations (GST)
                    </NavLink>
                </nav>

                <div className="settings-content">
                    <Routes>
                        <Route index element={<BusinessSettings />} />
                        <Route path="branding" element={<BrandingSettings />} />
                        <Route path="bank" element={<BankSettings />} />
                        <Route path="ca-access" element={<CAAccessSettings />} />
                        <Route path="auto-clearance" element={<AutoClearanceSettings />} />
                        <Route path="integrations" element={<IntegrationsSettings />} />
                    </Routes>
                </div>
            </div>
        </div>
    );
}

function BusinessSettings() {
    const { currentBusiness, editBusiness } = useBusiness();
    const toast = useToast();
    const [form, setForm] = useState({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (currentBusiness) setForm({ ...currentBusiness });
    }, [currentBusiness]);

    const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSave = async () => {
        if (!form.businessName) { toast.error('Business name is required.'); return; }
        if (form.gstin) {
            const { valid, error } = validateGSTIN(form.gstin);
            if (!valid) { toast.error(error); return; }
        }
        setSaving(true);
        try {
            await editBusiness(currentBusiness.id, form);
            toast.success('Business details updated!');
        } catch (err) { toast.error(err.message); }
        setSaving(false);
    };

    if (!currentBusiness) return <div className="empty-state"><h3>No business selected</h3></div>;

    return (
        <div>
            <h2 className="settings-section-title">Business Information</h2>
            <div className="settings-form">
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Business Name <span className="required">*</span></label>
                        <input className="form-input" value={form.businessName || ''} onChange={e => update('businessName', e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Business Type</label>
                        <select className="form-select" value={form.businessType || ''} onChange={e => update('businessType', e.target.value)}>
                            <option value="">Select</option>
                            <option value="sole_proprietorship">Sole Proprietorship</option>
                            <option value="partnership">Partnership</option>
                            <option value="llp">LLP</option>
                            <option value="pvt_ltd">Private Limited</option>
                            <option value="public_ltd">Public Limited</option>
                            <option value="freelancer">Freelancer</option>
                        </select>
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input className="form-input" value={form.email || ''} onChange={e => update('email', e.target.value)} type="email" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Phone</label>
                        <input className="form-input" value={form.phone || ''} onChange={e => update('phone', e.target.value)} />
                    </div>
                </div>
                <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                    <label className="form-label">Address</label>
                    <textarea className="form-textarea" rows={2} value={form.address || ''} onChange={e => update('address', e.target.value)} />
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">State</label>
                        <select className="form-select" value={form.state || ''} onChange={e => update('state', e.target.value)}>
                            <option value="">Select State</option>
                            {INDIAN_STATES.map(s => <option key={s.code} value={s.name}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">GSTIN</label>
                        <input className="form-input" value={form.gstin || ''} onChange={e => update('gstin', e.target.value.toUpperCase())} maxLength={15} placeholder="22AAAAA0000A1Z5" />
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">PAN</label>
                        <input className="form-input" value={form.pan || ''} onChange={e => update('pan', e.target.value.toUpperCase())} maxLength={10} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Invoice Prefix</label>
                        <input className="form-input" value={form.invoicePrefix || ''} onChange={e => update('invoicePrefix', e.target.value)} placeholder="INV" />
                    </div>
                </div>

                <h3 className="settings-section-title" style={{ marginTop: 'var(--space-6)' }}>Defaults</h3>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Default Invoice Type</label>
                        <select className="form-select" value={form.defaultInvoiceType || 'gst'} onChange={e => update('defaultInvoiceType', e.target.value)}>
                            <option value="gst">GST Invoice</option>
                            <option value="non-gst">Non-GST Invoice</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Default Payment Terms (days)</label>
                        <input type="number" className="form-input" value={form.defaultPaymentTerms || 30} onChange={e => update('defaultPaymentTerms', Number(e.target.value))} min="0" />
                    </div>
                </div>
                <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                    <label className="form-label">Default Terms & Conditions</label>
                    <textarea className="form-textarea" rows={3} value={form.defaultTerms || ''} onChange={e => update('defaultTerms', e.target.value)} placeholder="Payment is due within the specified terms..." />
                </div>

                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
}

function BrandingSettings() {
    const { currentBusiness, editBusiness } = useBusiness();
    const toast = useToast();
    const [branding, setBranding] = useState({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (currentBusiness?.branding) setBranding({ ...currentBusiness.branding });
    }, [currentBusiness]);

    const update = (k, v) => setBranding(p => ({ ...p, [k]: v }));

    const handleSave = async () => {
        setSaving(true);
        try {
            await editBusiness(currentBusiness.id, { branding });
            toast.success('Branding updated!');
        } catch (err) { toast.error(err.message); }
        setSaving(false);
    };

    const handleFileUpload = (key) => (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => update(key, reader.result);
        reader.readAsDataURL(file);
    };

    if (!currentBusiness) return null;

    return (
        <div>
            <h2 className="settings-section-title">Branding & Appearance</h2>
            <div className="settings-form">
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Primary Color</label>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                            <input type="color" value={branding.primaryColor || '#6C5CE7'} onChange={e => update('primaryColor', e.target.value)} style={{ width: '40px', height: '36px', border: 'none', padding: 0, cursor: 'pointer' }} />
                            <input className="form-input" value={branding.primaryColor || '#6C5CE7'} onChange={e => update('primaryColor', e.target.value)} maxLength={7} style={{ flex: 1 }} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Font Family</label>
                        <select className="form-select" value={branding.fontFamily || 'Inter'} onChange={e => update('fontFamily', e.target.value)}>
                            <option value="Inter">Inter</option>
                            <option value="Roboto">Roboto</option>
                            <option value="Lato">Lato</option>
                            <option value="Open Sans">Open Sans</option>
                            <option value="Poppins">Poppins</option>
                        </select>
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                    <label className="form-label">Logo</label>
                    <div className="upload-area">
                        {branding.logo ? (
                            <div className="upload-preview">
                                <img src={branding.logo} alt="Logo" style={{ maxHeight: '60px' }} />
                                <button className="btn btn-ghost btn-sm" onClick={() => update('logo', '')}><X size={14} /></button>
                            </div>
                        ) : (
                            <label className="upload-placeholder">
                                <Upload size={20} />
                                <span className="upload-text">Upload Logo (max 2MB)</span>
                                <input type="file" accept="image/*" hidden onChange={handleFileUpload('logo')} />
                            </label>
                        )}
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Signature</label>
                        <div className="upload-area">
                            {branding.signature ? (
                                <div className="upload-preview">
                                    <img src={branding.signature} alt="Signature" style={{ maxHeight: '50px' }} />
                                    <button className="btn btn-ghost btn-sm" onClick={() => update('signature', '')}><X size={14} /></button>
                                </div>
                            ) : (
                                <label className="upload-placeholder">
                                    <Upload size={16} />
                                    <span>Upload Signature</span>
                                    <input type="file" accept="image/*" hidden onChange={handleFileUpload('signature')} />
                                </label>
                            )}
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Stamp</label>
                        <div className="upload-area">
                            {branding.stamp ? (
                                <div className="upload-preview">
                                    <img src={branding.stamp} alt="Stamp" style={{ maxHeight: '50px' }} />
                                    <button className="btn btn-ghost btn-sm" onClick={() => update('stamp', '')}><X size={14} /></button>
                                </div>
                            ) : (
                                <label className="upload-placeholder">
                                    <Upload size={16} />
                                    <span>Upload Stamp</span>
                                    <input type="file" accept="image/*" hidden onChange={handleFileUpload('stamp')} />
                                </label>
                            )}
                        </div>
                    </div>
                </div>

                <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ marginTop: 'var(--space-4)' }}>
                    <Save size={14} /> {saving ? 'Saving...' : 'Save Branding'}
                </button>
            </div>
        </div>
    );
}

function BankSettings() {
    const { currentBusiness, editBusiness } = useBusiness();
    const toast = useToast();
    const [bank, setBank] = useState({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (currentBusiness?.bankDetails) setBank({ ...currentBusiness.bankDetails });
    }, [currentBusiness]);

    const update = (k, v) => setBank(p => ({ ...p, [k]: v }));

    const handleIFSCBlur = async () => {
        if (!bank.ifsc || bank.ifsc.length < 11) return;
        try {
            // The service now handles lookups via a secure platform-managed serverless function.
            const data = await fetchBankDetails(bank.ifsc);
            if (data) {
                setBank(p => ({
                    ...p,
                    bankName: data.BANK || p.bankName,
                    branch: data.BRANCH || p.branch,
                    city: data.CITY || p.city,
                    state: data.STATE || p.state,
                }));
                toast.success('Bank details fetched!');
            }
        } catch (e) { /* ignore */ }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await editBusiness(currentBusiness.id, { bankDetails: bank });
            toast.success('Bank details updated!');
        } catch (err) { toast.error(err.message); }
        setSaving(false);
    };

    if (!currentBusiness) return null;

    return (
        <div>
            <h2 className="settings-section-title">Bank Details</h2>
            <p className="subtitle" style={{ marginBottom: 'var(--space-5)' }}>These details will appear on your invoices</p>
            <div className="settings-form">
                <div className="form-row">
                    <div className="form-group"><label className="form-label">Account Name</label><input className="form-input" value={bank.accountName || ''} onChange={e => update('accountName', e.target.value)} /></div>
                    <div className="form-group"><label className="form-label">Account Number</label><input className="form-input" value={bank.accountNumber || ''} onChange={e => update('accountNumber', e.target.value)} /></div>
                </div>
                <div className="form-row">
                    <div className="form-group"><label className="form-label">Bank Name</label><input className="form-input" value={bank.bankName || ''} onChange={e => update('bankName', e.target.value)} /></div>
                    <div className="form-group"><label className="form-label">IFSC Code</label><input className="form-input" value={bank.ifsc || ''} onChange={e => update('ifsc', e.target.value.toUpperCase())} onBlur={handleIFSCBlur} /></div>
                </div>
                <div className="form-row">
                    <div className="form-group"><label className="form-label">Branch</label><input className="form-input" value={bank.branch || ''} onChange={e => update('branch', e.target.value)} /></div>
                    <div className="form-group"><label className="form-label">UPI ID</label><input className="form-input" value={bank.upiId || ''} onChange={e => update('upiId', e.target.value)} placeholder="business@upi" /></div>
                </div>

                <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ marginTop: 'var(--space-4)' }}>
                    <Save size={14} /> {saving ? 'Saving...' : 'Save Bank Details'}
                </button>
            </div>
        </div>
    );
}

function CAAccessSettings() {
    const { currentBusiness } = useBusiness();
    const toast = useToast();
    const [accessList, setAccessList] = useState([]);
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(true);

    const load = async () => {
        if (!currentBusiness?.id) return;
        setLoading(true);
        const list = await getCAAccessByBusiness(currentBusiness.id);
        setAccessList(list);
        setLoading(false);
    };

    useEffect(() => { load(); }, [currentBusiness?.id]);

    const handleGrant = async () => {
        if (!email) { toast.error('Enter CA email.'); return; }
        try {
            await grantCAAccess({ businessId: currentBusiness.id, caEmail: email, permissions: ['view', 'export'] });
            toast.success('Access granted!');
            setEmail('');
            load();
        } catch (err) { toast.error(err.message); }
    };

    const handleRevoke = async (id) => {
        await revokeCAAccess(id);
        toast.success('Access revoked.');
        load();
    };

    if (!currentBusiness) return null;

    return (
        <div>
            <h2 className="settings-section-title">CA Access</h2>
            <p className="subtitle" style={{ marginBottom: 'var(--space-5)' }}>Grant your Chartered Accountant access to view your data for GST filing</p>

            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
                <input className="form-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="CA's email address" style={{ maxWidth: '300px' }} />
                <button className="btn btn-primary" onClick={handleGrant}><Plus size={14} /> Grant Access</button>
            </div>

            {accessList.length === 0 ? (
                <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                    No CA access granted yet
                </div>
            ) : (
                <div className="card" style={{ overflow: 'hidden' }}>
                    <table className="data-table">
                        <thead><tr><th>Email</th><th>Status</th><th>Granted</th><th></th></tr></thead>
                        <tbody>
                            {accessList.map(a => (
                                <tr key={a.id}>
                                    <td>{a.caEmail}</td>
                                    <td><span className={`badge badge-${a.status === 'active' ? 'success' : 'neutral'}`}>{a.status}</span></td>
                                    <td>{new Date(a.createdAt).toLocaleDateString('en-IN')}</td>
                                    <td><button className="btn btn-ghost btn-sm" onClick={() => handleRevoke(a.id)}><Trash2 size={14} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function AutoClearanceSettings() {
    const { currentBusiness } = useBusiness();
    const toast = useToast();
    const [settings, setSettings] = useState({
        enabled: false,
        exactAmountMatch: true,
        requireDateMatch: false,
        autoUpdateInvoiceStatus: true
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!currentBusiness?.id) return;
        getAutoClearanceSettings(currentBusiness.id).then(s => {
            if (s) setSettings(prev => ({ ...prev, ...s }));
        });
    }, [currentBusiness?.id]);

    const update = (k, v) => setSettings(p => ({ ...p, [k]: v }));

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveAutoClearanceSettings({ ...settings, businessId: currentBusiness.id });
            toast.success('Settings saved');
        } catch (err) {
            toast.error('Failed to save');
        }
        setSaving(false);
    };

    if (!currentBusiness) return null;

    return (
        <div>
            <h2 className="settings-section-title">Payment Automation</h2>
            <p className="subtitle" style={{ marginBottom: 'var(--space-5)' }}>Configure how AI helps you verify and clear payments</p>

            <div className="card-flat" style={{ marginBottom: 'var(--space-4)', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                        <div style={{ fontWeight: '600' }}>AI Payment Verification</div>
                        <div style={{ fontSize: '13px', color: '#666' }}>Automatically scan uploaded payment screenshots</div>
                    </div>
                    <label className="toggle">
                        <input type="checkbox" checked={settings.enabled} onChange={e => update('enabled', e.target.checked)} />
                        <span className="toggle-slider" />
                    </label>
                </div>

                {settings.enabled && (
                    <div style={{ borderTop: '1px solid #eee', paddingTop: '16px' }}>
                        <label className="fsp-toggle" style={{ marginBottom: '12px' }}>
                            <label className="toggle">
                                <input type="checkbox" checked={settings.exactAmountMatch} onChange={e => update('exactAmountMatch', e.target.checked)} />
                                <span className="toggle-slider" />
                            </label>
                            <div>
                                <div>Require Exact Amount Match</div>
                                <div style={{ fontSize: '12px', color: '#666' }}>Only verify if extracted amount matches invoice total exactly</div>
                            </div>
                        </label>

                        <label className="fsp-toggle" style={{ marginBottom: '12px' }}>
                            <label className="toggle">
                                <input type="checkbox" checked={settings.requireDateMatch} onChange={e => update('requireDateMatch', e.target.checked)} />
                                <span className="toggle-slider" />
                            </label>
                            <div>
                                <div>Require Date Match</div>
                                <div style={{ fontSize: '12px', color: '#666' }}>Verify that payment date is close to invoice date</div>
                            </div>
                        </label>

                        <label className="fsp-toggle">
                            <label className="toggle">
                                <input type="checkbox" checked={settings.autoUpdateInvoiceStatus} onChange={e => update('autoUpdateInvoiceStatus', e.target.checked)} />
                                <span className="toggle-slider" />
                            </label>
                            <div>
                                <div>Auto-Update Invoice Status</div>
                                <div style={{ fontSize: '12px', color: '#666' }}>Mark invoice as 'Paid' when AI verification passes with high confidence</div>
                            </div>
                        </label>
                    </div>
                )}
            </div>

            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <Save size={14} /> {saving ? 'Saving...' : 'Save Settings'}
            </button>
        </div>
    );
}

function IntegrationsSettings() {
    const { currentBusiness } = useBusiness();
    const toast = useToast();
    const [settings, setSettings] = useState({
        enableRealTimeGst: false
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!currentBusiness?.id) return;
        getIntegrationSettings(currentBusiness.id).then(s => {
            if (s) setSettings(prev => ({ ...prev, ...s }));
        });
    }, [currentBusiness?.id]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveIntegrationSettings({ ...settings, businessId: currentBusiness.id });
            toast.success('Integration settings saved');
        } catch (err) {
            toast.error('Failed to save');
        }
        setSaving(false);
    };

    if (!currentBusiness) return null;

    return (
        <div>
            <h2 className="settings-section-title">Integrations</h2>
            <p className="subtitle" style={{ marginBottom: 'var(--space-5)' }}>Connect third-party services</p>

            <div className="card-flat" style={{ marginBottom: 'var(--space-4)', padding: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Globe size={18} /> GST API Integration
                </h3>
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
                    Real-time GSTIN verification is enabled. You can auto-populate business details by entering a GSTIN.
                </p>

                <div className="form-group">
                    <label className="form-label">API Status</label>
                    <div className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Check size={12} /> Managed by Platform
                    </div>
                </div>

                <div className="checkbox-group" style={{ marginTop: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={settings.enableRealTimeGst}
                            onChange={e => setSettings(p => ({ ...p, enableRealTimeGst: e.target.checked }))}
                        />
                        Enable Real-time GSTIN Fetching
                    </label>
                </div>

                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? <span className="spinner" /> : 'Save Integration'}
                    </button>
                </div>
            </div>
        </div>
    );
}
