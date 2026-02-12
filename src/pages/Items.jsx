import React, { useState, useEffect } from 'react';
import { useBusiness } from '@contexts/BusinessContext';
import { useToast } from '@contexts/ToastContext';
import { getItemsByBusiness, createItem, updateItem, deleteItem } from '@db/operations';
import { GST_RATES, COMMON_HSN_SAC, formatCurrency } from '@logic/gstEngine';
import { Plus, Search, Package, Edit3, Trash2, X, Save } from 'lucide-react';

export default function Items() {
    const { currentBusiness } = useBusiness();
    const toast = useToast();
    const [items, setItems] = useState([]);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        if (!currentBusiness?.id) return;
        setLoading(true);
        const list = await getItemsByBusiness(currentBusiness.id);
        setItems(list);
        setLoading(false);
    };

    useEffect(() => { load(); }, [currentBusiness?.id]);

    const filtered = search
        ? items.filter(i => i.name?.toLowerCase().includes(search.toLowerCase()) || i.hsnSac?.includes(search))
        : items;

    const handleDelete = async (id, name) => {
        if (!confirm(`Deactivate item "${name}"?`)) return;
        await deleteItem(id);
        toast.success('Item deactivated.');
        load();
    };

    if (!currentBusiness) return <div className="empty-state"><h3>Select a business first</h3></div>;

    return (
        <div style={{ width: '100%' }}>
            <div className="page-header">
                <div>
                    <h1>Items & Services</h1>
                    <p className="subtitle">{items.length} item{items.length !== 1 ? 's' : ''}</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setEditItem(null); setShowModal(true); }}>
                    <Plus size={16} /> Add Item
                </button>
            </div>

            <div style={{ marginBottom: 'var(--space-5)' }}>
                <div className="search-box" style={{ maxWidth: '400px' }}>
                    <Search size={16} className="search-icon" />
                    <input placeholder="Search items or HSN/SAC..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}><div className="spinner spinner-lg" /></div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon"><Package size={36} /></div>
                    <h3>{items.length === 0 ? 'No items yet' : 'No matching items'}</h3>
                    <p>Add your products and services with HSN/SAC codes and GST rates</p>
                    {items.length === 0 && <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Add Item</button>}
                </div>
            ) : (
                <div className="card" style={{ overflow: 'hidden' }}>
                    <table className="data-table">
                        <thead><tr><th>Name</th><th>Type</th><th>HSN/SAC</th><th>GST Rate</th><th>Price</th><th></th></tr></thead>
                        <tbody>
                            {filtered.map(item => (
                                <tr key={item.id}>
                                    <td><strong>{item.name}</strong>{item.description && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>{item.description}</div>}</td>
                                    <td><span className={`badge ${item.type === 'service' ? 'badge-primary' : 'badge-info'}`}>{item.type}</span></td>
                                    <td style={{ fontFamily: 'monospace' }}>{item.hsnSac || '-'}</td>
                                    <td>{item.defaultGstRate}%</td>
                                    <td>{formatCurrency(item.defaultPrice)}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button className="btn btn-ghost btn-sm" onClick={() => { setEditItem(item); setShowModal(true); }}><Edit3 size={14} /></button>
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(item.id, item.name)}><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <ItemModal
                    businessId={currentBusiness.id}
                    item={editItem}
                    onClose={() => { setShowModal(false); setEditItem(null); }}
                    onDone={() => { setShowModal(false); setEditItem(null); load(); }}
                />
            )}
        </div>
    );
}

function ItemModal({ businessId, item, onClose, onDone }) {
    const toast = useToast();
    const [form, setForm] = useState({
        name: item?.name || '',
        type: item?.type || 'service',
        hsnSac: item?.hsnSac || '',
        defaultGstRate: item?.defaultGstRate ?? 18,
        defaultPrice: item?.defaultPrice || 0,
        description: item?.description || '',
    });
    const [saving, setSaving] = useState(false);
    const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSave = async () => {
        if (!form.name) { toast.error('Item name is required.'); return; }
        setSaving(true);
        try {
            if (item?.id) {
                await updateItem(item.id, form);
                toast.success('Item updated!');
            } else {
                await createItem({ ...form, businessId });
                toast.success('Item added!');
            }
            onDone();
        } catch (err) {
            toast.error(err.message);
        }
        setSaving(false);
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                <div className="modal-header"><h2>{item ? 'Edit Item' : 'Add Item'}</h2><button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button></div>
                <div className="modal-body">
                    <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                        <label className="form-label">Item Name <span className="required">*</span></label>
                        <input className="form-input" value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Website Design" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label">Type</label>
                            <select className="form-select" value={form.type} onChange={e => update('type', e.target.value)}>
                                <option value="service">Service</option>
                                <option value="goods">Goods</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">HSN/SAC Code</label>
                            <input className="form-input" value={form.hsnSac} onChange={e => update('hsnSac', e.target.value)} placeholder="998314" list="hsn-suggestions" />
                            <datalist id="hsn-suggestions">
                                {COMMON_HSN_SAC.map(h => <option key={h.code} value={h.code}>{h.description}</option>)}
                            </datalist>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label">Default GST Rate</label>
                            <select className="form-select" value={form.defaultGstRate} onChange={e => update('defaultGstRate', Number(e.target.value))}>
                                {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Default Price (₹)</label>
                            <input type="number" className="form-input" value={form.defaultPrice} onChange={e => update('defaultPrice', Number(e.target.value))} min="0" step="0.01" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea className="form-textarea" rows={2} value={form.description} onChange={e => update('description', e.target.value)} placeholder="Brief description..." />
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? <span className="spinner" /> : (item ? 'Update' : 'Add Item')}</button>
                </div>
            </div>
        </div>
    );
}
