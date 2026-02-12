import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '@contexts/BusinessContext';
import { getInvoicesByBusiness, getClientsByBusiness } from '@db/operations';
import { formatCurrency } from '@logic/gstEngine';
import { Plus, Search, Filter, FileText, Download, Send, Eye } from 'lucide-react';
import './Invoices.css';

const STATUS_FILTERS = ['all', 'draft', 'final', 'paid', 'unpaid', 'partial', 'overdue'];

import { Link as LinkIcon, Copy } from 'lucide-react';

export default function Invoices() {
    const { currentBusiness } = useBusiness();
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState([]);
    const [clients, setClients] = useState([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [issuingLink, setIssuingLink] = useState(null);

    // ... (load logic remains same)

    useEffect(() => {
        if (!currentBusiness?.id) return;
        async function load() {
            setLoading(true);
            const [invs, cls] = await Promise.all([
                getInvoicesByBusiness(currentBusiness.id),
                getClientsByBusiness(currentBusiness.id),
            ]);
            setInvoices(invs.filter(i => i.status !== 'deleted'));
            setClients(cls);
            setLoading(false);
        }
        load();
    }, [currentBusiness?.id]);

    const loadData = async () => {
        const invs = await getInvoicesByBusiness(currentBusiness.id);
        const cls = await getClientsByBusiness(currentBusiness.id);
        setInvoices(invs.filter(i => i.status !== 'deleted'));
        setClients(cls);
    };

    const clientMap = useMemo(() => {
        const m = {};
        clients.forEach(c => { m[c.id] = c; });
        return m;
    }, [clients]);

    const filtered = useMemo(() => {
        let result = invoices;
        if (statusFilter !== 'all') {
            if (statusFilter === 'draft' || statusFilter === 'final') {
                result = result.filter(i => i.status === statusFilter);
            } else if (statusFilter === 'issued') {
                result = result.filter(i => i.paymentLinkStatus === 'issued');
            } else {
                result = result.filter(i => i.paymentStatus === statusFilter);
            }
        }
        if (typeFilter !== 'all') {
            result = result.filter(i => i.invoiceType === typeFilter);
        }
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(i =>
                i.invoiceNumber?.toLowerCase().includes(q) ||
                clientMap[i.clientId]?.name?.toLowerCase().includes(q)
            );
        }
        return result;
    }, [invoices, statusFilter, typeFilter, search, clientMap]);

    const getStatusBadge = (inv) => {
        if (inv.status === 'draft') return <span className="badge badge-neutral">Draft</span>;
        switch (inv.paymentStatus) {
            case 'paid': return <span className="badge badge-success">Paid</span>;
            case 'partial': return <span className="badge badge-warning">Partial</span>;
            case 'overdue': return <span className="badge badge-danger">Overdue</span>;
            default: return <span className="badge badge-info">Unpaid</span>;
        }
    };

    const getLinkStatusBadge = (inv) => {
        if (!inv.paymentLinkToken) return <span className="badge badge-neutral">-</span>;
        if (inv.paymentStatus === 'paid') return <span className="badge badge-success">Paid</span>;
        return <span className="badge badge-primary">Issued</span>;
    };

    const handleIssueLink = async (e, invoice) => {
        e.stopPropagation();
        if (invoice.paymentLinkToken) {
            const url = `${window.location.origin}/pay/${invoice.paymentLinkToken}`;
            navigator.clipboard.writeText(url);
            // toast.success('Link copied!'); // Toast context needed if we utilize it
            alert('Payment link copied to clipboard!');
        } else {
            setIssuingLink(invoice.id);
            try {
                // We need to dynamically import this to avoid circular dependencies if any, 
                // or just ensure it's imported at the top. 
                // Assuming it's available in operations.
                const { issuePaymentLink } = await import('@db/operations');
                await issuePaymentLink(invoice.id);
                await loadData();
            } catch (err) {
                console.error(err);
                alert('Failed to issue link');
            }
            setIssuingLink(null);
        }
    };

    if (!currentBusiness) {
        return <div className="empty-state"><h3>Select a business to view invoices</h3></div>;
    }

    return (
        <div className="invoices-page">
            <div className="page-header">
                <div>
                    <h1>Invoices</h1>
                    <p className="subtitle">{filtered.length} invoice{filtered.length !== 1 ? 's' : ''}</p>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/invoices/new')}>
                    <Plus size={16} /> New Invoice
                </button>
            </div>

            {/* Filters */}
            <div className="invoice-filters">
                <div className="search-box" style={{ flex: 1 }}>
                    <Search size={16} className="search-icon" />
                    <input placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>

                <div className="filter-pills">
                    {STATUS_FILTERS.map(f => (
                        <button
                            key={f}
                            className={`filter-pill ${statusFilter === f ? 'active' : ''}`}
                            onClick={() => setStatusFilter(f)}
                        >
                            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>

                <select className="form-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ width: 'auto' }}>
                    <option value="all">All Types</option>
                    <option value="gst">GST</option>
                    <option value="non-gst">Non-GST</option>
                </select>
            </div>

            {/* Invoice Table */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}><div className="spinner spinner-lg" /></div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon"><FileText size={36} /></div>
                    <h3>{invoices.length === 0 ? 'No invoices yet' : 'No matching invoices'}</h3>
                    <p>{invoices.length === 0 ? 'Create your first invoice to get started' : 'Try adjusting your search or filters'}</p>
                    {invoices.length === 0 && (
                        <button className="btn btn-primary" onClick={() => navigate('/invoices/new')}>
                            <Plus size={16} /> Create Invoice
                        </button>
                    )}
                </div>
            ) : (
                <div className="card" style={{ overflow: 'hidden' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Invoice #</th>
                                <th>Client</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Payment Link</th>
                                <th className="right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(inv => (
                                <tr key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)} style={{ cursor: 'pointer' }}>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Due: {new Date(inv.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{inv.invoiceNumber}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{inv.invoiceType === 'gst' ? 'GST Invoice' : 'Invoice'}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{clientMap[inv.clientId]?.name || 'Unknown'}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{clientMap[inv.clientId]?.phone || ''}</div>
                                    </td>
                                    <td><strong>{formatCurrency(inv.grandTotal)}</strong></td>
                                    <td>{getStatusBadge(inv)}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {getLinkStatusBadge(inv)}
                                            {inv.status !== 'draft' && (
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={(e) => handleIssueLink(e, inv)}
                                                    title={inv.paymentLinkToken ? "Copy Payment Link" : "Issue Payment Link"}
                                                    disabled={issuingLink === inv.id}
                                                >
                                                    {issuingLink === inv.id ? <span className="spinner spinner-sm" /> : (
                                                        inv.paymentLinkToken ? <Copy size={14} /> : <LinkIcon size={14} />
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="right">
                                        <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); navigate(`/invoices/${inv.id}`); }}>
                                            <Eye size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
