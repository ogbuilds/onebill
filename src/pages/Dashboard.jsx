import React, { useState, useEffect, useMemo } from 'react';
import { useBusiness } from '@contexts/BusinessContext';
import { useAuth } from '@contexts/AuthContext';
import { getBusinessStats, getInvoicesByBusiness, getClientsByBusiness } from '@db/operations';
import { formatCurrency, getPerformanceLabel } from '@logic/gstEngine';
import {
    TrendingUp, TrendingDown, IndianRupee, FileText, Users, AlertCircle,
    Calendar, ChevronDown, ArrowUpRight, ArrowDownRight, Minus, Plus, Building2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const PERIOD_OPTIONS = [
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' },
    { value: 'fiscal', label: 'Fiscal Year' },
];

function getPeriodDates(period) {
    const now = new Date();
    let start, end;
    end = new Date(now);

    switch (period) {
        case 'week':
            start = new Date(now);
            start.setDate(now.getDate() - now.getDay());
            start.setHours(0, 0, 0, 0);
            break;
        case 'month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'quarter':
            const q = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), q * 3, 1);
            break;
        case 'year':
            start = new Date(now.getFullYear(), 0, 1);
            break;
        case 'fiscal':
            const fiscalStart = now.getMonth() >= 3
                ? new Date(now.getFullYear(), 3, 1)
                : new Date(now.getFullYear() - 1, 3, 1);
            start = fiscalStart;
            break;
        default:
            start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return { start: start.toISOString(), end: end.toISOString() };
}

function getPreviousPeriodDates(period) {
    const now = new Date();
    let start, end;

    switch (period) {
        case 'week':
            end = new Date(now);
            end.setDate(now.getDate() - now.getDay() - 1);
            start = new Date(end);
            start.setDate(end.getDate() - 6);
            break;
        case 'month':
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0);
            break;
        case 'quarter':
            const q = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), (q - 1) * 3, 1);
            end = new Date(now.getFullYear(), q * 3, 0);
            break;
        case 'year':
            start = new Date(now.getFullYear() - 1, 0, 1);
            end = new Date(now.getFullYear() - 1, 11, 31);
            break;
        case 'fiscal':
            const fiscalPrev = now.getMonth() >= 3
                ? new Date(now.getFullYear() - 1, 3, 1)
                : new Date(now.getFullYear() - 2, 3, 1);
            start = fiscalPrev;
            end = new Date(start.getFullYear() + 1, 2, 31);
            break;
        default:
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0);
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
}

export default function Dashboard() {
    const { user } = useAuth();
    const { currentBusiness, businesses } = useBusiness();
    const navigate = useNavigate();
    const [period, setPeriod] = useState('month');
    const [stats, setStats] = useState(null);
    const [prevStats, setPrevStats] = useState(null);
    const [recentInvoices, setRecentInvoices] = useState([]);
    const [topClients, setTopClients] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentBusiness?.id) {
            setLoading(false);
            return;
        }

        async function load() {
            setLoading(true);
            try {
                const { start, end } = getPeriodDates(period);
                const { start: prevStart, end: prevEnd } = getPreviousPeriodDates(period);

                const [currStats, prevStatsResult, invoices, clients] = await Promise.all([
                    getBusinessStats(currentBusiness.id, start, end),
                    getBusinessStats(currentBusiness.id, prevStart, prevEnd),
                    getInvoicesByBusiness(currentBusiness.id),
                    getClientsByBusiness(currentBusiness.id),
                ]);

                setStats(currStats);
                setPrevStats(prevStatsResult);
                setRecentInvoices(invoices.slice(0, 5));

                // Calculate top clients by billing
                const clientBilling = {};
                invoices.forEach(inv => {
                    if (inv.status !== 'deleted') {
                        clientBilling[inv.clientId] = (clientBilling[inv.clientId] || 0) + (inv.grandTotal || 0);
                    }
                });
                const sorted = Object.entries(clientBilling)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5);
                const clientDetails = sorted.map(([clientId, total]) => {
                    const client = clients.find(c => c.id === Number(clientId));
                    return { clientId, name: client?.name || 'Unknown', total };
                });
                setTopClients(clientDetails);
            } catch (err) {
                console.error('Dashboard load error:', err);
            }
            setLoading(false);
        }

        load();
    }, [currentBusiness?.id, period]);

    const performanceLabel = useMemo(() => {
        if (!stats || !prevStats) return null;
        return getPerformanceLabel(stats.totalBilled, prevStats.totalBilled);
    }, [stats, prevStats]);

    // No business state
    if (!currentBusiness) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon"><Building2 size={36} /></div>
                <h3>Welcome to OneBill!</h3>
                <p>Create your first business to get started with invoicing.</p>
                <button className="btn btn-primary" onClick={() => navigate('/settings')}>
                    <Plus size={16} /> Create Business
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '120px' }}>
                <div className="spinner spinner-lg" />
            </div>
        );
    }

    const billingChange = prevStats?.totalBilled
        ? (((stats?.totalBilled || 0) - prevStats.totalBilled) / prevStats.totalBilled * 100).toFixed(1)
        : 0;

    return (
        <div className="dashboard">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1>Dashboard</h1>
                    <p className="subtitle">Welcome back, {user?.name?.split(' ')[0]}! Here's your business overview.</p>
                </div>
                <div className="dashboard-controls">
                    <div className="period-selector">
                        <Calendar size={14} />
                        <select value={period} onChange={e => setPeriod(e.target.value)} className="form-select" style={{ border: 'none', background: 'transparent', paddingRight: '24px', fontSize: 'var(--font-size-sm)' }}>
                            {PERIOD_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>
                    <button className="btn btn-primary" onClick={() => navigate('/invoices/new')}>
                        <Plus size={16} /> New Invoice
                    </button>
                </div>
            </div>

            {/* Performance Label */}
            {performanceLabel && (
                <div className={`performance-banner performance-${performanceLabel.type}`}>
                    {performanceLabel.type === 'positive' && <TrendingUp size={18} />}
                    {performanceLabel.type === 'negative' && <TrendingDown size={18} />}
                    {performanceLabel.type === 'neutral' && <Minus size={18} />}
                    <span>Business Performance: <strong>{performanceLabel.label}</strong></span>
                    {billingChange != 0 && (
                        <span className="perf-change">
                            ({billingChange > 0 ? '+' : ''}{billingChange}% vs previous period)
                        </span>
                    )}
                </div>
            )}

            {/* KPI Cards */}
            <div className="kpi-grid">
                <div className="kpi-card">
                    <div className="kpi-label">Total Billing</div>
                    <div className="kpi-value">{formatCurrency(stats?.totalBilled || 0)}</div>
                    <div className={`kpi-change ${Number(billingChange) >= 0 ? 'positive' : 'negative'}`}>
                        {Number(billingChange) >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {Math.abs(billingChange)}%
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-label">Received</div>
                    <div className="kpi-value">{formatCurrency(stats?.totalReceived || 0)}</div>
                    <div className="kpi-change positive">
                        <FileText size={12} /> {stats?.paidCount || 0} paid
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-label">Pending</div>
                    <div className="kpi-value">{formatCurrency(stats?.totalPending || 0)}</div>
                    <div className="kpi-change neutral">
                        {stats?.unpaidCount || 0} unpaid · {stats?.partialCount || 0} partial
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-label">Overdue</div>
                    <div className="kpi-value" style={{ color: (stats?.overdueAmount || 0) > 0 ? 'var(--color-danger)' : undefined }}>
                        {formatCurrency(stats?.overdueAmount || 0)}
                    </div>
                    {(stats?.overdueCount || 0) > 0 && (
                        <div className="kpi-change negative">
                            <AlertCircle size={12} /> {stats.overdueCount} overdue
                        </div>
                    )}
                </div>
            </div>

            {/* Content Grid */}
            <div className="dashboard-grid">
                {/* Recent Invoices */}
                <div className="card dashboard-card">
                    <div className="dashboard-card-header">
                        <h3>Recent Invoices</h3>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/invoices')}>View All</button>
                    </div>
                    {recentInvoices.length === 0 ? (
                        <div className="dashboard-empty">
                            <FileText size={24} />
                            <p>No invoices yet</p>
                            <button className="btn btn-primary btn-sm" onClick={() => navigate('/invoices/new')}>Create First Invoice</button>
                        </div>
                    ) : (
                        <div className="dashboard-list">
                            {recentInvoices.map(inv => (
                                <div key={inv.id} className="dashboard-list-item" onClick={() => navigate(`/invoices/${inv.id}`)}>
                                    <div className="dli-left">
                                        <span className="dli-number">{inv.invoiceNumber}</span>
                                        <span className="dli-date">{new Date(inv.invoiceDate).toLocaleDateString('en-IN')}</span>
                                    </div>
                                    <div className="dli-right">
                                        <span className="dli-amount">{formatCurrency(inv.grandTotal)}</span>
                                        <span className={`badge badge-${inv.paymentStatus === 'paid' ? 'success' : inv.paymentStatus === 'partial' ? 'warning' : inv.paymentStatus === 'overdue' ? 'danger' : 'neutral'}`}>
                                            {inv.paymentStatus}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Top Clients */}
                <div className="card dashboard-card">
                    <div className="dashboard-card-header">
                        <h3>Top Clients</h3>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/clients')}>View All</button>
                    </div>
                    {topClients.length === 0 ? (
                        <div className="dashboard-empty">
                            <Users size={24} />
                            <p>No client data yet</p>
                            <button className="btn btn-primary btn-sm" onClick={() => navigate('/clients')}>Add Client</button>
                        </div>
                    ) : (
                        <div className="dashboard-list">
                            {topClients.map((c, i) => (
                                <div key={c.clientId} className="dashboard-list-item">
                                    <div className="dli-left">
                                        <span className="dli-rank">#{i + 1}</span>
                                        <span className="dli-name">{c.name}</span>
                                    </div>
                                    <div className="dli-right">
                                        <span className="dli-amount">{formatCurrency(c.total)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Stats */}
            <div className="dashboard-quick-stats">
                <div className="quick-stat">
                    <div className="qs-icon" style={{ background: 'var(--color-primary-bg)', color: 'var(--color-primary)' }}><FileText size={18} /></div>
                    <div className="qs-info">
                        <span className="qs-value">{stats?.totalInvoices || 0}</span>
                        <span className="qs-label">Total Invoices</span>
                    </div>
                </div>
                <div className="quick-stat">
                    <div className="qs-icon" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}><IndianRupee size={18} /></div>
                    <div className="qs-info">
                        <span className="qs-value">{stats?.paidCount || 0}</span>
                        <span className="qs-label">Paid</span>
                    </div>
                </div>
                <div className="quick-stat">
                    <div className="qs-icon" style={{ background: 'var(--color-warning-bg)', color: '#c58a00' }}><AlertCircle size={18} /></div>
                    <div className="qs-info">
                        <span className="qs-value">{stats?.unpaidCount || 0}</span>
                        <span className="qs-label">Unpaid</span>
                    </div>
                </div>
                <div className="quick-stat">
                    <div className="qs-icon" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}><TrendingDown size={18} /></div>
                    <div className="qs-info">
                        <span className="qs-value">{stats?.overdueCount || 0}</span>
                        <span className="qs-label">Overdue</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
