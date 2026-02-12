import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { BusinessProvider, useBusiness } from '@contexts/BusinessContext';
import Sidebar from '@components/layout/Sidebar';
import Login from '@pages/Login';
import Register from '@pages/Register';
import Dashboard from '@pages/Dashboard';
import Invoices from '@pages/Invoices';
import NewInvoice from '@pages/NewInvoice';
import Clients from '@pages/Clients';
import ClientDetail from '@pages/ClientDetail';
import Items from '@pages/Items';
import Purchases from '@pages/Purchases';
import Reports from '@pages/Reports';
import CAWorkspace from '@pages/CAWorkspace';
import SettingsPage from '@pages/Settings';
import Onboarding from '@pages/Onboarding';
import SalarySlips from '@pages/SalarySlips';
import ClientPayment from '@pages/ClientPayment';

function AppShell() {
    const { businesses, loading } = useBusiness();

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--color-bg)' }}>
                <div className="spinner spinner-lg" />
            </div>
        );
    }

    if (businesses.length === 0) {
        return <Onboarding />;
    }

    return (
        <div className="app-layout">
            <Sidebar />
            <main className="app-main">
                <div className="app-content">
                    <Routes>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/invoices" element={<Invoices />} />
                        <Route path="/invoices/new" element={<NewInvoice />} />
                        <Route path="/invoices/:id" element={<NewInvoice />} />
                        <Route path="/clients" element={<Clients />} />
                        <Route path="/clients/:id" element={<ClientDetail />} />
                        <Route path="/items" element={<Items />} />
                        <Route path="/purchases" element={<Purchases />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/salary-slips" element={<SalarySlips />} />
                        <Route path="/ca" element={<CAWorkspace />} />
                        <Route path="/settings/*" element={<SettingsPage />} />
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                </div>
            </main>
        </div>
    );
}

function ProtectedLayout() {
    return (
        <BusinessProvider>
            <AppShell />
        </BusinessProvider>
    );
}

export default function App() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--color-bg)' }}>
                <div className="spinner spinner-lg" />
            </div>
        );
    }

    return (
        <Routes>
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" replace />} />
            <Route path="/register" element={!user ? <Register /> : <Navigate to="/dashboard" replace />} />
            <Route path="/pay/:token" element={<ClientPayment />} />
            <Route path="/*" element={user ? <ProtectedLayout /> : <Navigate to="/login" replace />} />
        </Routes>
    );
}
