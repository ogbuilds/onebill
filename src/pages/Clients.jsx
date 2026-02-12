import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '@contexts/BusinessContext';
import { useToast } from '@contexts/ToastContext';
import { getClientsByBusiness, createClient, deleteClient, getIntegrationSettings } from '@db/operations';
import { validateGSTIN, INDIAN_STATES, formatCurrency } from '@logic/gstEngine';
import { fetchGSTDetails } from '@services/gstService';
import GstPortalLink from '@components/GstPortalLink';
import { Plus, Search, Users, X, FileText, ChevronRight, Trash2, Loader2, ExternalLink } from 'lucide-react';

export default function Clients() {
    const { currentBusiness } = useBusiness();
    const toast = useToast();
    const navigate = useNavigate();
    const [clients, setClients] = useState([]);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);

    const loadClients = async () => {
        if (!currentBusiness?.id) return;
        setLoading(true);
        const cls = await getClientsByBusiness(currentBusiness.id);
        setClients(cls.filter(c => !c.isDeleted));
        setLoading(false);
    };

    useEffect(() => { loadClients(); }, [currentBusiness?.id]);

    const filtered = search
        ? clients.filter(c =>
            c.name?.toLowerCase().includes(search.toLowerCase()) ||
            c.email?.toLowerCase().includes(search.toLowerCase()) ||
            c.phone?.includes(search) ||
            c.gstin?.includes(search)
        )
        : clients;

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete client "${name}"? This will soft-delete the client.`)) return;
        await deleteClient(id);
        toast.success('Client deleted.');
        loadClients();
    };

    if (!currentBusiness) {
        return <div className="empty-state"><h3>Select a business first</h3></div>;
    }

    return (
        <div style={{ width: '100%' }}>
            <div className="page-header">
                <div>
                    <h1>Clients</h1>
                    <p className="subtitle">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={16} /> Add Client
                </button>
            </div>

            <div style={{ marginBottom: 'var(--space-5)' }}>
                <div className="search-box" style={{ maxWidth: '400px' }}>
                    <Search size={16} className="search-icon" />
                    <input placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}><div className="spinner spinner-lg" /></div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon"><Users size={36} /></div>
                    <h3>{clients.length === 0 ? 'No clients yet' : 'No matching clients'}</h3>
                    <p>{clients.length === 0 ? 'Add your first client to start invoicing' : 'Try a different search term'}</p>
                    {clients.length === 0 && (
                        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Add Client</button>
                    )}
                </div>
            ) : (
                <div className="card" style={{ overflow: 'hidden' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>State</th>
                                <th>GST Type</th>
                                <th>GSTIN</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(c => (
                                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/clients/${c.id}`)}>
                                    <td><strong>{c.name}</strong></td>
                                    <td>{c.email || '-'}</td>
                                    <td>{c.phone || '-'}</td>
                                    <td>{c.state || '-'}</td>
                                    <td><span className={`badge ${c.gstType === 'registered' ? 'badge-primary' : 'badge-neutral'}`}>{c.gstType}</span></td>
                                    <td style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>{c.gstin || '-'}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); navigate(`/clients/${c.id}`); }}>
                                                <ChevronRight size={14} />
                                            </button>
                                            <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); handleDelete(c.id, c.name); }}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <ClientModal
                    businessId={currentBusiness.id}
                    onClose={() => setShowModal(false)}
                    onDone={() => { setShowModal(false); loadClients(); }}
                />
            )}
        </div>
    );
}

function ClientModal({ businessId, onClose, onDone }) {
    const toast = useToast();
    const [form, setForm] = useState({
        name: '', email: '', phone: '', address: '', state: '',
        gstin: '', pan: '', gstType: 'unregistered',
    });
    const [saving, setSaving] = useState(false);
    const [fetchingGst, setFetchingGst] = useState(false);
    const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleGSTINBlur = async () => {
        if (!form.gstin || form.gstin.length < 15) return;

        const { valid, error } = validateGSTIN(form.gstin);
        if (!valid) {
            toast.error(error);
            return;
        }

        try {
            // Fetch details (No API key needed, handled by serverless proxy)
            const details = await fetchGSTDetails(form.gstin);

            if (details) {
                toast.success('Client details fetched!');
                setForm(prev => ({
                    ...prev,
                    name: details.legalName || details.tradeName || prev.name,
                    address: details.address || prev.address,
                    state: details.state || prev.state,
                }));
            }
        } catch (err) {
            console.error(err);
            toast.error(err.message || 'Failed to fetch GST details');
        }
        setFetchingGst(false);
    };

    const handleSave = async () => {
        if (!form.name) { toast.error('Client name is required.'); return; }
        if (form.gstin) {
            const { valid, error } = validateGSTIN(form.gstin);
            if (!valid) { toast.error(error); return; }
        }
        setSaving(true);
        try {
            await createClient({ ...form, businessId });
            toast.success('Client added!');
            onDone();
        } catch (err) {
            toast.error(err.message);
        }
        setSaving(false);
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                <div className="modal-header">
                    <h2>Add Client</h2>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
                </div>
                <div className="modal-body">
                    <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                        <label className="form-label">Name <span className="required">*</span></label>
                        <input className="form-input" value={form.name} onChange={e => update('name', e.target.value)} placeholder="Client or company name" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                        <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={form.email} onChange={e => update('email', e.target.value)} type="email" /></div>
                        <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={e => update('phone', e.target.value)} /></div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                        <label className="form-label">Address</label>
                        <input className="form-input" value={form.address} onChange={e => update('address', e.target.value)} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label">State</label>
                            <select className="form-select" value={form.state} onChange={e => update('state', e.target.value)}>
                                <option value="">Select</option>
                                {INDIAN_STATES.map(s => <option key={s.code} value={s.name}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">GST Type</label>
                            <select className="form-select" value={form.gstType} onChange={e => update('gstType', e.target.value)}>
                                <option value="registered">Registered</option>
                                <option value="unregistered">Unregistered</option>
                                <option value="composition">Composition</option>
                                <option value="non-gst">Non-GST</option>
                            </select>
                        </div>
                    </div>
                    {form.gstType === 'registered' && (
                        <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                            <label className="form-label">GSTIN</label>
                            <div className="input-with-icon-right">
                                <input
                                    className="form-input"
                                    value={form.gstin}
                                    onChange={e => update('gstin', e.target.value.toUpperCase())}
                                    maxLength={15}
                                    placeholder="22AAAAA0000A1Z5"
                                    onBlur={handleGSTINBlur}
                                />
                                {fetchingGst && <Loader2 size={16} className="spinner input-icon" />}
                            </div>
                            <GstPortalLink gstin={form.gstin} />
                        </div>
                    )}
                    <div className="form-group">
                        <label className="form-label">PAN</label>
                        <input className="form-input" value={form.pan} onChange={e => update('pan', e.target.value.toUpperCase())} maxLength={10} placeholder="AAAAA0000A" />
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? <span className="spinner" /> : 'Add Client'}</button>
                </div>
            </div>
        </div>
    );
}
