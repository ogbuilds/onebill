import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { getCAAccessByCA, getBusinessById, getInvoicesByBusiness, getPurchasesByBusiness } from '@db/operations';
import { formatCurrency } from '@logic/gstEngine';
import { Briefcase, FileText, ShoppingCart, Download, Building2 } from 'lucide-react';

export default function CAWorkspace() {
    const { user } = useAuth();
    const [accessList, setAccessList] = useState([]);
    const [businesses, setBusinesses] = useState([]);
    const [selectedBiz, setSelectedBiz] = useState(null);
    const [invoices, setInvoices] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.id) return;
        async function load() {
            setLoading(true);
            const access = await getCAAccessByCA(user.id);
            const bizList = await Promise.all(
                access.filter(a => a.status === 'active').map(a => getBusinessById(a.businessId))
            );
            setAccessList(access.filter(a => a.status === 'active'));
            setBusinesses(bizList.filter(Boolean));
            if (bizList.length > 0) setSelectedBiz(bizList[0]);
            setLoading(false);
        }
        load();
    }, [user?.id]);

    useEffect(() => {
        if (!selectedBiz?.id) return;
        async function loadBizData() {
            const [invs, prch] = await Promise.all([
                getInvoicesByBusiness(selectedBiz.id),
                getPurchasesByBusiness(selectedBiz.id),
            ]);
            setInvoices(invs.filter(i => i.status !== 'deleted'));
            setPurchases(prch.filter(p => !p.isDeleted));
        }
        loadBizData();
    }, [selectedBiz?.id]);

    const stats = useMemo(() => {
        const totalSales = invoices.reduce((s, i) => s + (i.grandTotal || 0), 0);
        const totalTax = invoices.reduce((s, i) => s + (i.cgst || 0) + (i.sgst || 0) + (i.igst || 0), 0);
        const totalPurchases = purchases.reduce((s, p) => s + (p.totalAmount || 0), 0);
        const totalITC = purchases.reduce((s, p) => s + (p.totalTax || 0), 0);
        return { totalSales, totalTax, totalPurchases, totalITC, netGST: totalTax - totalITC };
    }, [invoices, purchases]);

    if (user?.role !== 'ca' && user?.role !== 'admin') {
        return <div className="empty-state"><h3>CA Workspace</h3><p>This section is only accessible to Chartered Accountants.</p></div>;
    }

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '100px' }}><div className="spinner spinner-lg" /></div>;

    if (businesses.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon"><Briefcase size={36} /></div>
                <h3>No businesses linked</h3>
                <p>Ask your clients to grant you access to their businesses</p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1100px' }}>
            <div className="page-header">
                <div><h1>CA Workspace</h1><p className="subtitle">Manage GST filings for your clients</p></div>
            </div>

            {/* Business Selector */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
                {businesses.map(biz => (
                    <button
                        key={biz.id}
                        className={`card ${selectedBiz?.id === biz.id ? '' : ''}`}
                        style={{
                            padding: 'var(--space-3) var(--space-5)',
                            cursor: 'pointer',
                            border: selectedBiz?.id === biz.id ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                            background: selectedBiz?.id === biz.id ? 'var(--color-primary-bg)' : 'var(--color-surface)',
                            display: 'flex', alignItems: 'center', gap: 'var(--space-3)'
                        }}
                        onClick={() => setSelectedBiz(biz)}
                    >
                        <Building2 size={16} />
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{biz.businessName}</div>
                            {biz.gstin && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'monospace' }}>{biz.gstin}</div>}
                        </div>
                    </button>
                ))}
            </div>

            {/* KPIs */}
            <div className="kpi-grid">
                <div className="kpi-card"><div className="kpi-label">Sales</div><div className="kpi-value">{formatCurrency(stats.totalSales)}</div></div>
                <div className="kpi-card"><div className="kpi-label">Tax Collected</div><div className="kpi-value">{formatCurrency(stats.totalTax)}</div></div>
                <div className="kpi-card"><div className="kpi-label">Input Credit</div><div className="kpi-value">{formatCurrency(stats.totalITC)}</div></div>
                <div className="kpi-card"><div className="kpi-label">Net GST Payable</div><div className="kpi-value" style={{ color: stats.netGST >= 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{formatCurrency(Math.abs(stats.netGST))}</div></div>
            </div>

            {/* Tabs */}
            <div className="tabs" style={{ marginTop: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
                <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
                <button className={`tab ${activeTab === 'sales' ? 'active' : ''}`} onClick={() => setActiveTab('sales')}>Sales Invoices</button>
                <button className={`tab ${activeTab === 'purchases' ? 'active' : ''}`} onClick={() => setActiveTab('purchases')}>Purchase Entries</button>
            </div>

            {activeTab === 'overview' && (
                <div className="card" style={{ padding: 'var(--space-6)' }}>
                    <h3 style={{ marginBottom: 'var(--space-4)', fontWeight: 600 }}>GST Filing Summary - {selectedBiz?.businessName}</h3>
                    <div style={{ fontSize: 'var(--font-size-sm)', lineHeight: 2 }}>
                        <p>GSTIN: <strong style={{ fontFamily: 'monospace' }}>{selectedBiz?.gstin || 'Not provided'}</strong></p>
                        <p>Total Sales Invoices: <strong>{invoices.length}</strong></p>
                        <p>Total Purchase Entries: <strong>{purchases.length}</strong></p>
                        <p>Output Tax: <strong>{formatCurrency(stats.totalTax)}</strong></p>
                        <p>Input Tax Credit: <strong>{formatCurrency(stats.totalITC)}</strong></p>
                        <p>Net GST Payable: <strong style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-lg)' }}>{formatCurrency(stats.netGST)}</strong></p>
                    </div>
                </div>
            )}

            {activeTab === 'sales' && (
                <div className="card" style={{ overflow: 'hidden' }}>
                    <table className="data-table">
                        <thead><tr><th>Invoice #</th><th>Date</th><th>Client</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th></tr></thead>
                        <tbody>
                            {invoices.map(inv => (
                                <tr key={inv.id}>
                                    <td><strong>{inv.invoiceNumber}</strong></td>
                                    <td>{new Date(inv.invoiceDate).toLocaleDateString('en-IN')}</td>
                                    <td>{inv.clientName || '-'}</td>
                                    <td>{formatCurrency(inv.subtotal)}</td>
                                    <td>{formatCurrency(inv.cgst)}</td>
                                    <td>{formatCurrency(inv.sgst)}</td>
                                    <td>{formatCurrency(inv.igst)}</td>
                                    <td><strong>{formatCurrency(inv.grandTotal)}</strong></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'purchases' && (
                <div className="card" style={{ overflow: 'hidden' }}>
                    <table className="data-table">
                        <thead><tr><th>Invoice #</th><th>Vendor</th><th>Date</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th></tr></thead>
                        <tbody>
                            {purchases.map(p => (
                                <tr key={p.id}>
                                    <td><strong>{p.invoiceNumber}</strong></td>
                                    <td>{p.vendorName}</td>
                                    <td>{new Date(p.purchaseDate).toLocaleDateString('en-IN')}</td>
                                    <td>{formatCurrency(p.taxableAmount)}</td>
                                    <td>{formatCurrency(p.cgst)}</td>
                                    <td>{formatCurrency(p.sgst)}</td>
                                    <td>{formatCurrency(p.igst)}</td>
                                    <td><strong>{formatCurrency(p.totalAmount)}</strong></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
