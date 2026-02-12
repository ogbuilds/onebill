import React, { useState, useEffect } from 'react';
import { useBusiness } from '@contexts/BusinessContext';
import { useToast } from '@contexts/ToastContext';
import { getPurchasesByBusiness, createPurchase, deletePurchase } from '@db/operations';
import { formatCurrency, INDIAN_STATES, GST_RATES } from '@logic/gstEngine';
import { Plus, Search, ShoppingCart, Trash2, X, ChevronDown } from 'lucide-react';

export default function Purchases() {
    const { currentBusiness } = useBusiness();
    const toast = useToast();
    const [purchases, setPurchases] = useState([]);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        if (!currentBusiness?.id) return;
        setLoading(true);
        const list = await getPurchasesByBusiness(currentBusiness.id);
        setPurchases(list.filter(p => !p.isDeleted));
        setLoading(false);
    };

    useEffect(() => { load(); }, [currentBusiness?.id]);

    const filtered = search
        ? purchases.filter(p => p.vendorName?.toLowerCase().includes(search.toLowerCase()) || p.invoiceNumber?.includes(search))
        : purchases;

    const handleDelete = async (id) => {
        if (!confirm('Delete this purchase entry?')) return;
        await deletePurchase(id);
        toast.success('Deleted.');
        load();
    };

    if (!currentBusiness) return <div className="empty-state"><h3>Select a business first</h3></div>;

    return (
        <div style={{ width: '100%' }}>
            <div className="page-header">
                <div><h1>Purchase Entries</h1><p className="subtitle">Record and track your purchases for input tax credit</p></div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Add Purchase</button>
            </div>

            <div style={{ marginBottom: 'var(--space-5)' }}>
                <div className="search-box" style={{ maxWidth: '400px' }}>
                    <Search size={16} className="search-icon" />
                    <input placeholder="Search by vendor or invoice..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}><div className="spinner spinner-lg" /></div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon"><ShoppingCart size={36} /></div>
                    <h3>{purchases.length === 0 ? 'No purchases recorded' : 'No matching purchases'}</h3>
                    <p>Record your purchase invoices for ITC tracking and CA filing</p>
                    {purchases.length === 0 && <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Add Purchase</button>}
                </div>
            ) : (
                <div className="card" style={{ overflow: 'hidden' }}>
                    <table className="data-table">
                        <thead><tr><th>Invoice #</th><th>Vendor</th><th>Date</th><th>Taxable</th><th>GST</th><th>Total</th><th></th></tr></thead>
                        <tbody>
                            {filtered.map(p => (
                                <tr key={p.id}>
                                    <td><strong>{p.invoiceNumber}</strong></td>
                                    <td>{p.vendorName}</td>
                                    <td>{new Date(p.purchaseDate).toLocaleDateString('en-IN')}</td>
                                    <td>{formatCurrency(p.taxableAmount)}</td>
                                    <td>{formatCurrency(p.totalTax)}</td>
                                    <td><strong>{formatCurrency(p.totalAmount)}</strong></td>
                                    <td><button className="btn btn-ghost btn-sm" onClick={() => handleDelete(p.id)}><Trash2 size={14} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <PurchaseModal businessId={currentBusiness.id} onClose={() => setShowModal(false)} onDone={() => { setShowModal(false); load(); }} />
            )}
        </div>
    );
}

function PurchaseModal({ businessId, onClose, onDone }) {
    const toast = useToast();
    const [form, setForm] = useState({
        vendorName: '', vendorGstin: '', invoiceNumber: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        taxableAmount: 0, gstRate: 18, cgst: 0, sgst: 0, igst: 0,
        totalTax: 0, totalAmount: 0, supplyType: 'intra-state',
        description: '',
    });
    const [saving, setSaving] = useState(false);
    const update = (k, v) => {
        setForm(p => {
            const next = { ...p, [k]: v };
            // Recalculate taxes
            const taxable = Number(next.taxableAmount) || 0;
            const rate = Number(next.gstRate) || 0;
            const tax = (taxable * rate) / 100;
            if (next.supplyType === 'intra-state') {
                next.cgst = Math.round(tax / 2 * 100) / 100;
                next.sgst = Math.round(tax / 2 * 100) / 100;
                next.igst = 0;
            } else {
                next.igst = Math.round(tax * 100) / 100;
                next.cgst = 0;
                next.sgst = 0;
            }
            next.totalTax = Math.round(tax * 100) / 100;
            next.totalAmount = Math.round((taxable + tax) * 100) / 100;
            return next;
        });
    };

    const handleSave = async () => {
        if (!form.vendorName) { toast.error('Vendor name required.'); return; }
        if (!form.invoiceNumber) { toast.error('Invoice number required.'); return; }
        setSaving(true);
        try {
            await createPurchase({ ...form, businessId });
            toast.success('Purchase recorded!');
            onDone();
        } catch (err) { toast.error(err.message); }
        setSaving(false);
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                <div className="modal-header"><h2>Add Purchase</h2><button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button></div>
                <div className="modal-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                        <div className="form-group"><label className="form-label">Vendor Name <span className="required">*</span></label><input className="form-input" value={form.vendorName} onChange={e => update('vendorName', e.target.value)} /></div>
                        <div className="form-group"><label className="form-label">Vendor GSTIN</label><input className="form-input" value={form.vendorGstin} onChange={e => update('vendorGstin', e.target.value.toUpperCase())} maxLength={15} /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                        <div className="form-group"><label className="form-label">Invoice # <span className="required">*</span></label><input className="form-input" value={form.invoiceNumber} onChange={e => update('invoiceNumber', e.target.value)} /></div>
                        <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={form.purchaseDate} onChange={e => update('purchaseDate', e.target.value)} /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                        <div className="form-group"><label className="form-label">Taxable Amt (₹)</label><input type="number" className="form-input" value={form.taxableAmount} onChange={e => update('taxableAmount', Number(e.target.value))} min="0" /></div>
                        <div className="form-group">
                            <label className="form-label">GST Rate</label>
                            <select className="form-select" value={form.gstRate} onChange={e => update('gstRate', Number(e.target.value))}>
                                {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Supply</label>
                            <select className="form-select" value={form.supplyType} onChange={e => update('supplyType', e.target.value)}>
                                <option value="intra-state">Intra-State</option>
                                <option value="inter-state">Inter-State</option>
                            </select>
                        </div>
                    </div>
                    <div className="card" style={{ padding: 'var(--space-3)', background: 'var(--color-bg)', marginBottom: 'var(--space-4)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', marginBottom: '4px' }}>
                            <span>CGST:</span><span>{formatCurrency(form.cgst)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', marginBottom: '4px' }}>
                            <span>SGST:</span><span>{formatCurrency(form.sgst)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', marginBottom: '4px' }}>
                            <span>IGST:</span><span>{formatCurrency(form.igst)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', fontWeight: 700, borderTop: '1px solid var(--color-border)', paddingTop: '4px' }}>
                            <span>Total:</span><span>{formatCurrency(form.totalAmount)}</span>
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea className="form-textarea" rows={2} value={form.description} onChange={e => update('description', e.target.value)} />
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? <span className="spinner" /> : 'Save'}</button>
                </div>
            </div>
        </div>
    );
}
