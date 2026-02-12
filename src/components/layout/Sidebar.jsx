import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { useBusiness } from '@contexts/BusinessContext';
import {
    LayoutDashboard,
    FileText,
    Users,
    Package,
    ShoppingCart,
    BarChart3,
    Briefcase,
    Settings,
    LogOut,
    ChevronDown,
    Building2,
    Plus,
    Receipt,
    Wallet,
} from 'lucide-react';
import './Sidebar.css';

const NAV_ITEMS = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/invoices', icon: FileText, label: 'Invoices' },
    { path: '/clients', icon: Users, label: 'Clients' },
    { path: '/items', icon: Package, label: 'Items & Services' },
    { path: '/purchases', icon: ShoppingCart, label: 'Purchases' },
    { path: '/reports', icon: BarChart3, label: 'Reports' },
    { path: '/salary-slips', icon: Wallet, label: 'Salary Slips' },
];

const CA_NAV = { path: '/ca', icon: Briefcase, label: 'CA Workspace' };
const SETTINGS_NAV = { path: '/settings', icon: Settings, label: 'Settings' };

export default function Sidebar() {
    const { user, logout } = useAuth();
    const { businesses, currentBusiness, switchBusiness } = useBusiness();
    const location = useLocation();
    const [bizDropdownOpen, setBizDropdownOpen] = React.useState(false);

    const isCA = user?.role === 'ca' || user?.role === 'admin';

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    };

    return (
        <aside className="sidebar">
            {/* Logo */}
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon">
                    <Receipt size={22} />
                </div>
                <span className="sidebar-logo-text">OneBill</span>
            </div>

            {/* Business Switcher */}
            {businesses.length > 0 && (
                <div className="sidebar-business-switcher">
                    <button
                        className="biz-switch-btn"
                        onClick={() => setBizDropdownOpen(!bizDropdownOpen)}
                    >
                        <div className="biz-avatar" style={{ background: currentBusiness?.branding?.primaryColor || 'var(--color-primary)' }}>
                            {getInitials(currentBusiness?.businessName)}
                        </div>
                        <div className="biz-info">
                            <span className="biz-name truncate">{currentBusiness?.businessName || 'Select Business'}</span>
                            <span className="biz-gstin truncate">{currentBusiness?.gstin || 'No GSTIN'}</span>
                        </div>
                        <ChevronDown size={14} className={`biz-chevron ${bizDropdownOpen ? 'open' : ''}`} />
                    </button>

                    {bizDropdownOpen && (
                        <div className="biz-dropdown">
                            {businesses.map(b => (
                                <button
                                    key={b.id}
                                    className={`biz-dropdown-item ${b.id === currentBusiness?.id ? 'active' : ''}`}
                                    onClick={() => { switchBusiness(b.id); setBizDropdownOpen(false); }}
                                >
                                    <div className="biz-avatar-sm" style={{ background: b.branding?.primaryColor || 'var(--color-primary)' }}>
                                        {getInitials(b.businessName)}
                                    </div>
                                    <span className="truncate">{b.businessName}</span>
                                </button>
                            ))}
                            <NavLink
                                to="/settings/business/new"
                                className="biz-dropdown-item add-business"
                                onClick={() => setBizDropdownOpen(false)}
                            >
                                <Plus size={14} />
                                <span>Add Business</span>
                            </NavLink>
                        </div>
                    )}
                </div>
            )}

            {/* Navigation */}
            <nav className="sidebar-nav">
                <div className="sidebar-nav-label">MENU</div>
                {NAV_ITEMS.map(item => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                    >
                        <item.icon size={18} />
                        <span>{item.label}</span>
                    </NavLink>
                ))}

                {isCA && (
                    <>
                        <div className="sidebar-nav-divider" />
                        <div className="sidebar-nav-label">PROFESSIONAL</div>
                        <NavLink
                            to={CA_NAV.path}
                            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                        >
                            <CA_NAV.icon size={18} />
                            <span>{CA_NAV.label}</span>
                        </NavLink>
                    </>
                )}

                <div className="sidebar-nav-divider" />
                <NavLink
                    to={SETTINGS_NAV.path}
                    className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                >
                    <SETTINGS_NAV.icon size={18} />
                    <span>{SETTINGS_NAV.label}</span>
                </NavLink>
            </nav>

            {/* User Profile */}
            <div className="sidebar-user">
                <div className="sidebar-user-info">
                    <div className="sidebar-user-avatar" style={{ background: 'var(--color-primary)' }}>
                        {getInitials(user?.name)}
                    </div>
                    <div className="sidebar-user-details">
                        <span className="sidebar-user-name truncate">{user?.name || 'User'}</span>
                        <span className="sidebar-user-email truncate">{user?.email || ''}</span>
                    </div>
                </div>
                <button className="sidebar-logout-btn" onClick={logout} title="Logout">
                    <LogOut size={16} />
                </button>
            </div>
        </aside>
    );
}
