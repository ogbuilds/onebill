import Dexie from 'dexie';

const db = new Dexie('OneBillDB');

db.version(1).stores({
    users: '++id, email, phone, role',
    businesses: '++id, userId, gstin, businessName, state',
    clients: '++id, businessId, name, phone, email, gstin, gstType',
    items: '++id, businessId, name, type, hsnSac, isActive',
    invoices: '++id, businessId, clientId, invoiceNumber, invoiceType, invoiceDate, dueDate, paymentStatus, status, createdAt',
    purchases: '++id, businessId, supplierGstin, invoiceDate, gstPeriod',
    caAccess: '++id, caUserId, businessId',
    payments: '++id, invoiceId, businessId, date, amount, mode',
});

db.version(2).stores({
    users: '++id, email, phone, role',
    businesses: '++id, userId, gstin, businessName, state',
    clients: '++id, businessId, name, phone, email, gstin, gstType',
    items: '++id, businessId, name, type, hsnSac, isActive',
    invoices: '++id, businessId, clientId, invoiceNumber, invoiceType, invoiceDate, dueDate, paymentStatus, status, createdAt',
    purchases: '++id, businessId, supplierGstin, invoiceDate, gstPeriod',
    caAccess: '++id, caUserId, businessId',
    payments: '++id, invoiceId, businessId, date, amount, mode',
    invoicePreferences: '++id, businessId, name, isDefault',
    employees: '++id, businessId, name, email, designation, pan, employeeId',
    salarySlips: '++id, businessId, employeeId, month, year, status',
    paymentSubmissions: '++id, invoiceId, businessId, status, submittedAt',
});

db.version(3).stores({
    users: '++id, email, phone, role',
    businesses: '++id, userId, gstin, businessName, state',
    clients: '++id, businessId, name, phone, email, gstin, gstType',
    items: '++id, businessId, name, type, hsnSac, isActive',
    invoices: '++id, businessId, clientId, invoiceNumber, invoiceType, invoiceDate, dueDate, paymentStatus, status, paymentLinkToken, paymentLinkStatus, createdAt',
    purchases: '++id, businessId, supplierGstin, invoiceDate, gstPeriod',
    caAccess: '++id, caUserId, businessId',
    payments: '++id, invoiceId, businessId, date, amount, mode',
    invoicePreferences: '++id, businessId, name, isDefault',
    employees: '++id, businessId, name, email, designation, pan, employeeId',
    salarySlips: '++id, businessId, employeeId, month, year, status',
    paymentSubmissions: '++id, invoiceId, businessId, status, submittedAt', // Keeping for backward compat if needed, but likely replaced by paymentConfirmations
    paymentConfirmations: '++id, invoiceId, businessId, aiStatus, businessDecision, submittedAt',
    autoClearanceSettings: '++id, businessId',
    integrations: '++id, businessId', // For storing API keys and third-party configs
});

export default db;
