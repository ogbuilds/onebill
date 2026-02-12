import db from './database';

/* ===========================
   User Operations
   =========================== */
export async function createUser({ name, email, phone, password, role = 'user' }) {
    const existing = await db.users.where('email').equals(email).first();
    if (existing) throw new Error('A user with this email already exists.');

    // Simple hash for local-first MVP (fix bcrypt browser crash)
    const passwordHash = btoa(password);
    const id = await db.users.add({
        name,
        email,
        phone: phone || '',
        role,
        passwordHash,
        defaultBusinessId: null,
        preferences: {
            theme: 'light',
            dateFormat: 'DD/MM/YYYY',
            fiscalYearStart: 'april',
        },
        createdAt: new Date().toISOString(),
    });
    return id;
}

export async function authenticateUser(email, password) {
    const user = await db.users.where('email').equals(email).first();
    if (!user) throw new Error('Invalid email or password.');

    // Simple comparison
    const valid = user.passwordHash === btoa(password);
    if (!valid) throw new Error('Invalid email or password.');

    return user;
}

export async function getUserById(id) {
    return db.users.get(id);
}

export async function updateUser(id, updates) {
    await db.users.update(id, updates);
    return db.users.get(id);
}

export async function getAllUsers() {
    return db.users.toArray();
}

/* ===========================
   Business Operations
   =========================== */
export async function createBusiness(data) {
    const id = await db.businesses.add({
        ...data,
        invoiceCounter: data.invoiceCounter || 0,
        currency: data.currency || 'INR',
        branding: data.branding || {
            logo: null,
            stamp: null,
            signature: null,
            primaryColor: '#6C5CE7',
            secondaryColor: '#1A1D2E',
            textColor: '#1A1D2E',
            fontFamily: 'Inter',
        },
        bankDetails: data.bankDetails || {
            accountName: '',
            accountNumber: '',
            ifsc: '',
            bankName: '',
            branch: '',
            upiId: '',
        },
        defaultTemplateId: data.defaultTemplateId || 'minimal',
        defaultTerms: data.defaultTerms || 'Payment is due within 30 days.',
        defaultInvoiceType: data.defaultInvoiceType || 'gst',
        createdAt: new Date().toISOString(),
    });
    return id;
}

export async function getBusinessesByUser(userId) {
    return db.businesses.where('userId').equals(userId).toArray();
}

export async function getBusinessById(id) {
    return db.businesses.get(id);
}

export async function updateBusiness(id, updates) {
    await db.businesses.update(id, updates);
    return db.businesses.get(id);
}

export async function deleteBusiness(id) {
    await db.businesses.delete(id);
}

/* ===========================
   Client Operations
   =========================== */
export async function createClient(data) {
    const id = await db.clients.add({
        ...data,
        gstType: data.gstType || 'unregistered',
        invoicePreferences: data.invoicePreferences || {
            defaultInvoiceType: 'gst',
            defaultGstRate: 18,
            defaultItems: [],
            defaultPaymentTerms: 30,
            defaultTemplateId: null,
        },
        signatureData: data.signatureData || null,
        notes: data.notes || '',
        createdAt: new Date().toISOString(),
    });
    return id;
}

export async function getClientsByBusiness(businessId) {
    return db.clients.where('businessId').equals(businessId).toArray();
}

export async function getClientById(id) {
    return db.clients.get(id);
}

export async function updateClient(id, updates) {
    await db.clients.update(id, updates);
    return db.clients.get(id);
}

export async function deleteClient(id) {
    await db.clients.update(id, { isDeleted: true });
}

/* ===========================
   Item / Service Operations
   =========================== */
export async function createItem(data) {
    const id = await db.items.add({
        ...data,
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdAt: new Date().toISOString(),
    });
    return id;
}

export async function getItemsByBusiness(businessId) {
    return db.items.where('businessId').equals(businessId).filter(i => i.isActive !== false).toArray();
}

export async function getItemById(id) {
    return db.items.get(id);
}

export async function updateItem(id, updates) {
    await db.items.update(id, updates);
    return db.items.get(id);
}

export async function deleteItem(id) {
    await db.items.update(id, { isActive: false });
}

/* ===========================
   Invoice Operations
   =========================== */
export async function getNextInvoiceNumber(businessId) {
    const business = await db.businesses.get(businessId);
    if (!business) throw new Error('Business not found');

    const prefix = business.invoicePrefix || 'INV';
    const counter = (business.invoiceCounter || 0) + 1;
    const padded = String(counter).padStart(4, '0');
    return { number: `${prefix}-${padded}`, counter };
}

export async function createInvoice(data) {
    const { counter } = await getNextInvoiceNumber(data.businessId);

    const id = await db.invoices.add({
        ...data,
        paymentStatus: data.paymentStatus || 'unpaid',
        payments: data.payments || [],
        sendHistory: data.sendHistory || [],
        exportHistory: data.exportHistory || [],
        status: data.status || 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });

    await db.businesses.update(data.businessId, { invoiceCounter: counter });
    return id;
}

export async function getInvoicesByBusiness(businessId) {
    return db.invoices.where('businessId').equals(businessId).reverse().sortBy('createdAt');
}

export async function getInvoicesByClient(clientId) {
    return db.invoices.where('clientId').equals(clientId).reverse().sortBy('createdAt');
}

export async function getInvoiceById(id) {
    return db.invoices.get(id);
}

export async function updateInvoice(id, updates) {
    await db.invoices.update(id, { ...updates, updatedAt: new Date().toISOString() });
    return db.invoices.get(id);
}

export async function deleteInvoice(id) {
    await db.invoices.update(id, { status: 'deleted', updatedAt: new Date().toISOString() });
}

/* ===========================
   Payment Operations
   =========================== */
export async function recordPayment(invoiceId, paymentData) {
    const invoice = await db.invoices.get(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    const payment = {
        ...paymentData,
        id: Date.now(),
        date: paymentData.date || new Date().toISOString(),
    };

    const payments = [...(invoice.payments || []), payment];
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    let paymentStatus = 'unpaid';
    if (totalPaid >= invoice.grandTotal) {
        paymentStatus = 'paid';
    } else if (totalPaid > 0) {
        paymentStatus = 'partial';
    }

    await db.invoices.update(invoiceId, { payments, paymentStatus, updatedAt: new Date().toISOString() });

    const paymentId = await db.payments.add({
        invoiceId,
        businessId: invoice.businessId,
        ...payment,
    });

    return paymentId;
}

/* ===========================
   Purchase Operations
   =========================== */
export async function createPurchase(data) {
    const id = await db.purchases.add({
        ...data,
        createdAt: new Date().toISOString(),
    });
    return id;
}

export async function getPurchasesByBusiness(businessId) {
    return db.purchases.where('businessId').equals(businessId).toArray();
}

export async function getPurchaseById(id) {
    return db.purchases.get(id);
}

export async function updatePurchase(id, updates) {
    await db.purchases.update(id, updates);
    return db.purchases.get(id);
}

export async function deletePurchase(id) {
    await db.purchases.delete(id);
}

/* ===========================
   CA Access Operations
   =========================== */
export async function grantCAAccess(data) {
    const { businessId, caUserId, caEmail, permissions = ['view'] } = data;
    const identifier = caUserId || caEmail;

    const existing = await db.caAccess
        .where('businessId').equals(businessId)
        .filter(ca => ca.caUserId === identifier || ca.caEmail === identifier)
        .first();
    if (existing) {
        await db.caAccess.update(existing.id, { permissions, status: 'active' });
        return existing.id;
    }
    return db.caAccess.add({
        businessId,
        caUserId: caUserId || null,
        caEmail: caEmail || null,
        permissions,
        status: 'active',
        createdAt: new Date().toISOString(),
    });
}

export async function getCAAccessByBusiness(businessId) {
    return db.caAccess.where('businessId').equals(businessId).toArray();
}

export async function getCAAccessByCA(caUserId) {
    return db.caAccess.where('caUserId').equals(caUserId).toArray();
}

export async function getCABusinesses(caUserId) {
    const accesses = await db.caAccess.where('caUserId').equals(caUserId).filter(a => a.status === 'active').toArray();
    const businessIds = accesses.map(a => a.businessId);
    if (businessIds.length === 0) return [];
    return db.businesses.where('id').anyOf(businessIds).toArray();
}

export async function revokeCAAccess(id) {
    await db.caAccess.update(id, { status: 'revoked' });
}

/* ===========================
   Dashboard / Analytics
   =========================== */
export async function getBusinessStats(businessId, startDate, endDate) {
    const allInvoices = await db.invoices
        .where('businessId').equals(businessId)
        .filter(inv => {
            if (inv.status === 'deleted') return false;
            const d = new Date(inv.invoiceDate);
            return d >= new Date(startDate) && d <= new Date(endDate);
        })
        .toArray();

    const totalBilled = allInvoices.reduce((s, inv) => s + (inv.grandTotal || 0), 0);
    const totalReceived = allInvoices
        .filter(inv => inv.paymentStatus === 'paid')
        .reduce((s, inv) => s + (inv.grandTotal || 0), 0);
    const partialReceived = allInvoices
        .filter(inv => inv.paymentStatus === 'partial')
        .reduce((s, inv) => {
            const paid = (inv.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
            return s + paid;
        }, 0);

    const now = new Date();
    const overdue = allInvoices.filter(inv =>
        (inv.paymentStatus === 'unpaid' || inv.paymentStatus === 'partial') &&
        new Date(inv.dueDate) < now
    );

    return {
        totalInvoices: allInvoices.length,
        totalBilled,
        totalReceived: totalReceived + partialReceived,
        totalPending: totalBilled - totalReceived - partialReceived,
        overdueCount: overdue.length,
        overdueAmount: overdue.reduce((s, inv) => {
            const paid = (inv.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
            return s + (inv.grandTotal || 0) - paid;
        }, 0),
        paidCount: allInvoices.filter(i => i.paymentStatus === 'paid').length,
        unpaidCount: allInvoices.filter(i => i.paymentStatus === 'unpaid').length,
        partialCount: allInvoices.filter(i => i.paymentStatus === 'partial').length,
    };
}

// ===========================
//    Invoice Preferences
//    =========================== */
export async function saveInvoicePreference(data) {
    if (data.isDefault) {
        // Unset any existing default for this business
        const existing = await db.invoicePreferences.where({ businessId: data.businessId }).toArray();
        for (const pref of existing) {
            if (pref.isDefault) await db.invoicePreferences.update(pref.id, { isDefault: false });
        }
    }
    if (data.id) {
        await db.invoicePreferences.update(data.id, data);
        return data.id;
    }
    return db.invoicePreferences.add({ ...data, createdAt: new Date().toISOString() });
}

export async function getInvoicePreferences(businessId) {
    return db.invoicePreferences.where({ businessId }).toArray();
}

export async function deleteInvoicePreference(id) {
    return db.invoicePreferences.delete(id);
}

// ===========================
//    Employee Operations
//    =========================== */
export async function createEmployee(data) {
    return db.employees.add({
        ...data,
        createdAt: new Date().toISOString(),
        isActive: true,
    });
}

export async function getEmployeesByBusiness(businessId) {
    return db.employees.where({ businessId }).toArray();
}

export async function getEmployeeById(id) {
    return db.employees.get(id);
}

export async function updateEmployee(id, updates) {
    return db.employees.update(id, updates);
}

export async function deleteEmployee(id) {
    return db.employees.delete(id);
}

// ===========================
//    Salary Slip Operations
//    =========================== */
export async function createSalarySlip(data) {
    return db.salarySlips.add({
        ...data,
        createdAt: new Date().toISOString(),
        status: data.status || 'draft',
    });
}

export async function getSalarySlipsByBusiness(businessId) {
    return db.salarySlips.where({ businessId }).toArray();
}

export async function getSalarySlipById(id) {
    return db.salarySlips.get(id);
}

export async function updateSalarySlip(id, updates) {
    return db.salarySlips.update(id, updates);
}

export async function deleteSalarySlip(id) {
    return db.salarySlips.delete(id);
}

// ===========================
//    Payment Submissions
//    =========================== */
export async function createPaymentSubmission(data) {
    return db.paymentSubmissions.add({
        ...data,
        submittedAt: new Date().toISOString(),
        status: 'pending',
    });
}

export async function getPaymentSubmissionsByBusiness(businessId) {
    return db.paymentSubmissions.where({ businessId }).toArray();
}

export async function getPaymentSubmissionsByInvoice(invoiceId) {
    return db.paymentSubmissions.where({ invoiceId }).toArray();
}

export async function updatePaymentSubmission(id, updates) {
    return db.paymentSubmissions.update(id, updates);
}

/* ===========================
   Payment Link & Auto-Clearance Operations
   =========================== */

function generatePaymentToken() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function issuePaymentLink(invoiceId) {
    const invoice = await db.invoices.get(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    const token = generatePaymentToken();
    const updates = {
        paymentLinkToken: token,
        paymentLinkStatus: 'issued', // draft, issued, expired, paid
        updatedAt: new Date().toISOString()
    };

    await db.invoices.update(invoiceId, updates);
    return { ...invoice, ...updates };
}

export async function getInvoiceByPaymentToken(token) {
    return db.invoices.where('paymentLinkToken').equals(token).first();
}

export async function createPaymentConfirmation(data) {
    return db.paymentConfirmations.add({
        ...data,
        aiStatus: data.aiStatus || 'pending', // pending, passed, failed
        businessDecision: data.businessDecision || 'pending', // pending, accepted, rejected
        submittedAt: new Date().toISOString(),
    });
}

export async function getPaymentConfirmationsByInvoice(invoiceId) {
    return db.paymentConfirmations.where({ invoiceId }).reverse().sortBy('submittedAt');
}

export async function updatePaymentConfirmation(id, updates) {
    return db.paymentConfirmations.update(id, updates);
}

export async function getAutoClearanceSettings(businessId) {
    return db.autoClearanceSettings.where({ businessId }).first();
}

export async function saveAutoClearanceSettings(data) {
    if (data.id) {
        await db.autoClearanceSettings.update(data.id, data);
        return data.id;
    }
    const existing = await getAutoClearanceSettings(data.businessId);
    if (existing) {
        await db.autoClearanceSettings.update(existing.id, data);
        return existing.id;
    }
    return db.autoClearanceSettings.add(data);
}

export async function getIntegrationSettings(businessId) {
    return db.integrations.where({ businessId }).first();
}

export async function saveIntegrationSettings(data) {
    if (data.id) {
        await db.integrations.update(data.id, data);
        return data.id;
    }
    const existing = await getIntegrationSettings(data.businessId);
    if (existing) {
        await db.integrations.update(existing.id, data);
        return existing.id;
    }
    return db.integrations.add(data);
}
