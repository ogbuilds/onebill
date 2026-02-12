import React, { useState, useEffect, useMemo } from 'react';
import { useBusiness } from '@contexts/BusinessContext';
import { getInvoicesByBusiness, getPurchasesByBusiness, getClientsByBusiness } from '@db/operations';
import { formatCurrency } from '@logic/gstEngine';
import { BarChart3, TrendingUp, Download, Calendar } from 'lucide-react';

const PERIOD_OPTIONS = [
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' },
    { value: 'fiscal', label: 'FY 2024-25' },
];

export default function Reports() {
    const { currentBusiness } = useBusiness();
    const [invoices, setInvoices] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [clients, setClients] = useState([]);
    const [period, setPeriod] = useState('quarter');
    const [activeTab, setActiveTab] = useState('summary');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentBusiness?.id) return;
        async function load() {
            setLoading(true);
            const [invs, prch, cls] = await Promise.all([
                getInvoicesByBusiness(currentBusiness.id),
                getPurchasesByBusiness(currentBusiness.id),
                getClientsByBusiness(currentBusiness.id),
            ]);
            setInvoices(invs.filter(i => i.status !== 'deleted'));
            setPurchases(prch.filter(p => !p.isDeleted));
            setClients(cls);
            setLoading(false);
        }
        load();
    }, [currentBusiness?.id]);

    const stats = useMemo(() => {
        const totalSales = invoices.reduce((s, i) => s + (i.grandTotal || 0), 0);
        const totalTaxCollected = invoices.reduce((s, i) => s + (i.cgst || 0) + (i.sgst || 0) + (i.igst || 0), 0);
        const totalPurchases = purchases.reduce((s, p) => s + (p.totalAmount || 0), 0);
        const totalITC = purchases.reduce((s, p) => s + (p.totalTax || 0), 0);
        const totalCGST = invoices.reduce((s, i) => s + (i.cgst || 0), 0);
        const totalSGST = invoices.reduce((s, i) => s + (i.sgst || 0), 0);
        const totalIGST = invoices.reduce((s, i) => s + (i.igst || 0), 0);
        const netGSTPayable = totalTaxCollected - totalITC;

        // Monthly breakdown
        const months = {};
        invoices.forEach(inv => {
            const m = new Date(inv.invoiceDate).toLocaleString('en-IN', { month: 'short', year: '2-digit' });
            if (!months[m]) months[m] = { sales: 0, tax: 0, invoices: 0 };
            months[m].sales += inv.grandTotal || 0;
            months[m].tax += (inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0);
            months[m].invoices += 1;
        });

        return { totalSales, totalTaxCollected, totalPurchases, totalITC, totalCGST, totalSGST, totalIGST, netGSTPayable, months };
    }, [invoices, purchases]);

    if (!currentBusiness) return <div className="empty-state"><h3>Select a business first</h3></div>;

    return (
        <div style={{ width: '100%' }}>
            <div className="page-header">
                <div><h1>Reports</h1><p className="subtitle">Business analytics and GST summaries</p></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                        <Calendar size={14} />
                        <select value={period} onChange={e => setPeriod(e.target.value)} style={{ border: 'none', background: 'transparent', fontSize: 'var(--font-size-sm)' }}>
                            {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs" style={{ marginBottom: 'var(--space-5)' }}>
                {['summary', 'gst', 'monthly'].map(t => (
                    <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
                        {t === 'summary' ? 'Summary' : t === 'gst' ? 'GST Report' : 'Monthly Breakdown'}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}><div className="spinner spinner-lg" /></div>
            ) : (
                <>
                    {activeTab === 'summary' && (
                        <>
                            <div className="kpi-grid">
                                <div className="kpi-card"><div className="kpi-label">Total Sales</div><div className="kpi-value">{formatCurrency(stats.totalSales)}</div><div className="kpi-change neutral">{invoices.length} invoices</div></div>
                                <div className="kpi-card"><div className="kpi-label">Tax Collected</div><div className="kpi-value">{formatCurrency(stats.totalTaxCollected)}</div></div>
                                <div className="kpi-card"><div className="kpi-label">Total Purchases</div><div className="kpi-value">{formatCurrency(stats.totalPurchases)}</div><div className="kpi-change neutral">{purchases.length} entries</div></div>
                                <div className="kpi-card"><div className="kpi-label">Input Tax Credit</div><div className="kpi-value">{formatCurrency(stats.totalITC)}</div></div>
                            </div>
                            <div className="card" style={{ padding: 'var(--space-6)', marginTop: 'var(--space-5)' }}>
                                <h3 style={{ marginBottom: 'var(--space-4)', fontWeight: 600 }}>Profit & Loss Summary</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border-light)' }}><span>Total Sales Revenue</span><strong>{formatCurrency(stats.totalSales)}</strong></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border-light)' }}><span>Total Purchases</span><strong style={{ color: 'var(--color-danger)' }}>-{formatCurrency(stats.totalPurchases)}</strong></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3) 0', fontWeight: 700, fontSize: 'var(--font-size-lg)', borderTop: '2px solid var(--color-text)' }}><span>Gross Profit</span><span style={{ color: (stats.totalSales - stats.totalPurchases) >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{formatCurrency(stats.totalSales - stats.totalPurchases)}</span></div>
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border-light)' }}><span>Tax Collected</span><strong>{formatCurrency(stats.totalTaxCollected)}</strong></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border-light)' }}><span>Input Tax Credit</span><strong style={{ color: 'var(--color-success)' }}>-{formatCurrency(stats.totalITC)}</strong></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3) 0', fontWeight: 700, fontSize: 'var(--font-size-lg)', borderTop: '2px solid var(--color-text)' }}><span>Net GST Payable</span><span style={{ color: stats.netGSTPayable >= 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{formatCurrency(Math.abs(stats.netGSTPayable))}</span></div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'gst' && (
                        <div className="card" style={{ overflow: 'hidden' }}>
                            <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border-light)' }}>
                                <h3 style={{ fontWeight: 600 }}>GST Tax Breakdown</h3>
                            </div>
                            <table className="data-table">
                                <thead><tr><th>Tax Type</th><th className="right">Output Tax (Sales)</th><th className="right">Input Tax (Purchases)</th><th className="right">Net Payable</th></tr></thead>
                                <tbody>
                                    <tr>
                                        <td><strong>CGST</strong></td>
                                        <td className="right">{formatCurrency(stats.totalCGST)}</td>
                                        <td className="right">{formatCurrency(purchases.reduce((s, p) => s + (p.cgst || 0), 0))}</td>
                                        <td className="right"><strong>{formatCurrency(stats.totalCGST - purchases.reduce((s, p) => s + (p.cgst || 0), 0))}</strong></td>
                                    </tr>
                                    <tr>
                                        <td><strong>SGST</strong></td>
                                        <td className="right">{formatCurrency(stats.totalSGST)}</td>
                                        <td className="right">{formatCurrency(purchases.reduce((s, p) => s + (p.sgst || 0), 0))}</td>
                                        <td className="right"><strong>{formatCurrency(stats.totalSGST - purchases.reduce((s, p) => s + (p.sgst || 0), 0))}</strong></td>
                                    </tr>
                                    <tr>
                                        <td><strong>IGST</strong></td>
                                        <td className="right">{formatCurrency(stats.totalIGST)}</td>
                                        <td className="right">{formatCurrency(purchases.reduce((s, p) => s + (p.igst || 0), 0))}</td>
                                        <td className="right"><strong>{formatCurrency(stats.totalIGST - purchases.reduce((s, p) => s + (p.igst || 0), 0))}</strong></td>
                                    </tr>
                                    <tr style={{ background: 'var(--color-primary-bg)' }}>
                                        <td><strong>Total</strong></td>
                                        <td className="right"><strong>{formatCurrency(stats.totalTaxCollected)}</strong></td>
                                        <td className="right"><strong>{formatCurrency(stats.totalITC)}</strong></td>
                                        <td className="right"><strong style={{ color: 'var(--color-primary)' }}>{formatCurrency(stats.netGSTPayable)}</strong></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'monthly' && (
                        <div className="card" style={{ overflow: 'hidden' }}>
                            <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border-light)' }}>
                                <h3 style={{ fontWeight: 600 }}>Monthly Breakdown</h3>
                            </div>
                            {Object.keys(stats.months).length === 0 ? (
                                <div style={{ padding: 'var(--space-10)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>No data yet</div>
                            ) : (
                                <table className="data-table">
                                    <thead><tr><th>Month</th><th className="right">Invoices</th><th className="right">Sales</th><th className="right">Tax</th></tr></thead>
                                    <tbody>
                                        {Object.entries(stats.months).map(([month, data]) => (
                                            <tr key={month}>
                                                <td><strong>{month}</strong></td>
                                                <td className="right">{data.invoices}</td>
                                                <td className="right">{formatCurrency(data.sales)}</td>
                                                <td className="right">{formatCurrency(data.tax)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
