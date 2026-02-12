import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getBusinessesByUser, getBusinessById, createBusiness, updateBusiness } from '@db/operations';
import { useAuth } from './AuthContext';

const BusinessContext = createContext(null);

export function BusinessProvider({ children }) {
    const { user } = useAuth();
    const [businesses, setBusinesses] = useState([]);
    const [currentBusiness, setCurrentBusiness] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadBusinesses = useCallback(async () => {
        if (!user?.id) {
            setBusinesses([]);
            setCurrentBusiness(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const list = await getBusinessesByUser(user.id);
            setBusinesses(list);

            const savedId = localStorage.getItem('onebill_business_id');
            const saved = savedId ? list.find(b => b.id === Number(savedId)) : null;
            const defaultBiz = saved || (user.defaultBusinessId ? list.find(b => b.id === user.defaultBusinessId) : null) || list[0] || null;

            setCurrentBusiness(defaultBiz);
            if (defaultBiz) localStorage.setItem('onebill_business_id', defaultBiz.id);
        } catch (err) {
            console.error('Failed to load businesses', err);
        }
        setLoading(false);
    }, [user?.id, user?.defaultBusinessId]);

    useEffect(() => {
        loadBusinesses();
    }, [loadBusinesses]);

    const switchBusiness = useCallback((businessId) => {
        const biz = businesses.find(b => b.id === businessId);
        if (biz) {
            setCurrentBusiness(biz);
            localStorage.setItem('onebill_business_id', biz.id);
        }
    }, [businesses]);

    const addBusiness = useCallback(async (data) => {
        if (!user?.id) return;
        const id = await createBusiness({ ...data, userId: user.id });
        await loadBusinesses();
        return id;
    }, [user?.id, loadBusinesses]);

    const editBusiness = useCallback(async (id, updates) => {
        await updateBusiness(id, updates);
        await loadBusinesses();
    }, [loadBusinesses]);

    return (
        <BusinessContext.Provider value={{
            businesses,
            currentBusiness,
            loading,
            switchBusiness,
            addBusiness,
            editBusiness,
            refreshBusinesses: loadBusinesses,
        }}>
            {children}
        </BusinessContext.Provider>
    );
}

export function useBusiness() {
    const ctx = useContext(BusinessContext);
    if (!ctx) throw new Error('useBusiness must be used within BusinessProvider');
    return ctx;
}
