import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getClientById, getInvoicesByClient, updateClient } from '@db/operations';
import { formatCurrency, INDIAN_STATES } from '@logic/gstEngine';
import { ArrowLeft, Edit3, FileText, Save, X, User, ChevronRight } from 'lucide-react';

export default function ClientDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [client, setClient] = useState(null);
    const [invoices, setInvoices] = useState([]);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            setLoading(true);
            const c = await getClientById(Number(id));
            if (c) {
                setClient(c);
                setForm(c);
                const invs = await getInvoicesByClient(c.id);
                setInvoices(invs.filter(i => i.status !== 'deleted'));
            }
            setLoading(false);
        }
        load();
    }, [id]);

    const handleSave = async () => {
        await updateClient(Number(id), form);
        setClient({ ...client, ...form });
        setEditing(false);
    };

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '100px' }}><div className="spinner spinner-lg" /></div>;
    if (!client) return <div className="empty-state"><h3>Client not found</h3></div>;

    const totalBilled = invoices.reduce((s, i) => s + (i.grandTotal || 0), 0);
    const totalPaid = invoices.filter(i => i.paymentStatus === 'paid').reduce((s, i) => s + (i.grandTotal || 0), 0);

    return (
        <div style={{ maxWidth: '900px' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/clients')} style={{ marginBottom: 'var(--space-4)' }}>
                <ArrowLeft size={14} /> Back to Clients
            </button>

            <div className="card" style={{ padding: 'var(--space-6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                        <div className="avatar avatar-lg" style={{ background: 'var(--color-primary)', color: '#fff' }}>
                            {client.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                            <h2 style={{ fontWeight: 700, fontSize: 'var(--font-size-xl)' }}>{client.name}</h2>
                            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                {[client.email, client.phone].filter(Boolean).join(' · ')}
                            </p>
                        </div>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditing(!editing)}>
                        {editing ? <><X size={14} /> Cancel</> : <><Edit3 size={14} /> Edit</>}
                    </button>
                </div>

                {editing ? (
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                            <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
                            <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={form.email || ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
                            <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone || ''} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
                            <div className="form-group">
                                <label className="form-label">State</label>
                                <select className="form-select" value={form.state || ''} onChange={e => setForm(p => ({ ...p, state: e.target.value }))}>
                                    <option value="">Select</option>
                                    {INDIAN_STATES.map(s => <option key={s.code} value={s.name}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                            <label className="form-label">Address</label>
                            <input className="form-input" value={form.address || ''} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
                        </div>
                        <button className="btn btn-primary" onClick={handleSave}><Save size={14} /> Save Changes</button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
                        <div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginBottom: '2px' }}>Address</div>
                            <div style={{ fontSize: 'var(--font-size-sm)' }}>{client.address || '-'}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginBottom: '2px' }}>State</div>
                            <div style={{ fontSize: 'var(--font-size-sm)' }}>{client.state || '-'}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginBottom: '2px' }}>GST Type</div>
                            <span className={`badge ${client.gstType === 'registered' ? 'badge-primary' : 'badge-neutral'}`}>{client.gstType}</span>
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginBottom: '2px' }}>GSTIN</div>
                            <div style={{ fontSize: 'var(--font-size-sm)', fontFamily: 'monospace' }}>{client.gstin || '-'}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginBottom: '2px' }}>PAN</div>
                            <div style={{ fontSize: 'var(--font-size-sm)', fontFamily: 'monospace' }}>{client.pan || '-'}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* KPIs */}
            <div className="kpi-grid" style={{ marginTop: 'var(--space-5)' }}>
                <div className="kpi-card"><div className="kpi-label">Total Billed</div><div className="kpi-value">{formatCurrency(totalBilled)}</div></div>
                <div className="kpi-card"><div className="kpi-label">Received</div><div className="kpi-value">{formatCurrency(totalPaid)}</div></div>
                <div className="kpi-card"><div className="kpi-label">Outstanding</div><div className="kpi-value">{formatCurrency(totalBilled - totalPaid)}</div></div>
                <div className="kpi-card"><div className="kpi-label">Invoices</div><div className="kpi-value">{invoices.length}</div></div>
            </div>

            {/* Invoice History */}
            <div className="card" style={{ marginTop: 'var(--space-5)', overflow: 'hidden' }}>
                <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontWeight: 600 }}><FileText size={16} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />Invoice History</h3>
                </div>
                {invoices.length === 0 ? (
                    <div style={{ padding: 'var(--space-10)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>No invoices yet for this client</div>
                ) : (
                    <table className="data-table">
                        <thead><tr><th>Invoice #</th><th>Date</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
                        <tbody>
                            {invoices.map(inv => (
                                <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/invoices/${inv.id}`)}>
                                    <td><strong>{inv.invoiceNumber}</strong></td>
                                    <td>{new Date(inv.invoiceDate).toLocaleDateString('en-IN')}</td>
                                    <td><span className={`badge ${inv.invoiceType === 'gst' ? 'badge-primary' : 'badge-neutral'}`}>{inv.invoiceType?.toUpperCase()}</span></td>
                                    <td>{formatCurrency(inv.grandTotal)}</td>
                                    <td><span className={`badge badge-${inv.paymentStatus === 'paid' ? 'success' : inv.paymentStatus === 'partial' ? 'warning' : 'info'}`}>{inv.paymentStatus}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
