import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authenticateUser, createUser, getUserById, updateUser } from '@db/operations';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedUserId = localStorage.getItem('onebill_user_id');
        if (savedUserId) {
            getUserById(Number(savedUserId)).then(u => {
                if (u) setUser(u);
                setLoading(false);
            }).catch(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = useCallback(async (email, password) => {
        const u = await authenticateUser(email, password);
        setUser(u);
        localStorage.setItem('onebill_user_id', u.id);
        return u;
    }, []);

    const register = useCallback(async ({ name, email, phone, password, role }) => {
        const id = await createUser({ name, email, phone, password, role });
        const u = await getUserById(id);
        setUser(u);
        localStorage.setItem('onebill_user_id', u.id);
        return u;
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        localStorage.removeItem('onebill_user_id');
        localStorage.removeItem('onebill_business_id');
    }, []);

    const refreshUser = useCallback(async () => {
        if (user?.id) {
            const u = await getUserById(user.id);
            setUser(u);
        }
    }, [user?.id]);

    const updatePreferences = useCallback(async (prefs) => {
        if (!user?.id) return;
        const updated = await updateUser(user.id, {
            preferences: { ...user.preferences, ...prefs },
        });
        setUser(updated);
    }, [user]);

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, updatePreferences }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
