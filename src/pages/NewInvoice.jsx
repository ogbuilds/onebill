import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { COMMON_HSN_CODES } from '../data/hsnData.js';
import { useNavigate, useParams } from 'react-router-dom';
import { useBusiness } from '@contexts/BusinessContext';
import { useToast } from '@contexts/ToastContext';
import {
    getClientsByBusiness, getItemsByBusiness, createInvoice, getNextInvoiceNumber,
    updateInvoice, getInvoiceById, createClient, getClientById, createItem,
    saveInvoicePreference, getInvoicePreferences,
    getPaymentConfirmationsByInvoice, updatePaymentConfirmation, issuePaymentLink, getAutoClearanceSettings, recordPayment
} from '@db/operations';
import {
    calculateInvoiceTotals, formatCurrency, INDIAN_STATES, GST_RATES,
    validateGSTIN, numberToWords, COMMON_HSN_SAC
} from '@logic/gstEngine';
import { analyzePaymentScreenshot } from '@logic/paymentAnalyzer';
import {
    Save, Send, Eye, EyeOff, Plus, Trash2, Search, X, User,
    ChevronDown, FileText, Calendar, IndianRupee, Building2, Settings2,
    Package, Landmark, QrCode, Download, Palette, Type,
    Link as LinkIcon, CheckCircle, AlertTriangle, XCircle, RefreshCw, ExternalLink
} from 'lucide-react';
import InvoicePreview from '@components/invoice/InvoicePreview';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import './NewInvoice.css';

const DUE_DATE_PRESETS = [
    { label: 'Due on Receipt', days: 0 },
    { label: '7 Days', days: 7 },
    { label: '15 Days', days: 15 },
    { label: '30 Days', days: 30 },
    { label: '45 Days', days: 45 },
    { label: '60 Days', days: 60 },
];

function addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

const EMPTY_LINE_ITEM = {
    itemId: null,
    name: '',
    description: '',
    hsnSac: '',
    quantity: 1,
    unitPrice: 0,
    gstRate: 18,
    discount: 0,
};

export default function NewInvoice() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentBusiness } = useBusiness();
    const toast = useToast();

    // Data
    const [clients, setClients] = useState([]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    // Invoice State
    const [invoiceType, setInvoiceType] = useState('gst');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState(addDays(new Date().toISOString().split('T')[0], 30));
    const [clientId, setClientId] = useState(null);
    const [selectedClient, setSelectedClient] = useState(null);
    const [lineItems, setLineItems] = useState([{ ...EMPTY_LINE_ITEM }]);
    const [notes, setNotes] = useState('');
    const [termsConditions, setTermsConditions] = useState('');
    const [showPreview, setShowPreview] = useState(true);
    const [saving, setSaving] = useState(false);

    // Bank details (per-invoice, pre-filled from business)
    const [bankDetails, setBankDetails] = useState({
        accountName: '', accountNumber: '', ifsc: '', bankName: '', upiId: '', bankLogo: '', qrCode: '',
    });

    // New item modal
    const [showNewItemModal, setShowNewItemModal] = useState(false);
    const [activeItemRowForModal, setActiveItemRowForModal] = useState(null);

    // Customization
    const [brandingColor, setBrandingColor] = useState('#6C5CE7');
    const [brandingFont, setBrandingFont] = useState('Inter, sans-serif');
    const [savedPreferences, setSavedPreferences] = useState([]);
    const [preferenceName, setPreferenceName] = useState('');

    // PDF & Send
    const previewRef = React.useRef(null);
    const [showSendModal, setShowSendModal] = useState(false);
    const [downloading, setDownloading] = useState(false);

    // Client search
    const [clientSearch, setClientSearch] = useState('');
    const [showClientDropdown, setShowClientDropdown] = useState(false);
    const [showNewClientModal, setShowNewClientModal] = useState(false);

    // Item search per row
    const [activeItemRow, setActiveItemRow] = useState(null);
    const [itemSearch, setItemSearch] = useState('');

    // Field visibility
    const [fieldVisibility, setFieldVisibility] = useState({
        gstin: true,
        hsn: true,
        discount: false,
        signature: true,
        stamp: true,
        bankDetails: true,
        notes: true,
        terms: true,
    });
    const [showFieldSettings, setShowFieldSettings] = useState(false);

    // Payment Proofs & Links
    const [paymentConfirmations, setPaymentConfirmations] = useState([]);
    const [analyzingProofId, setAnalyzingProofId] = useState(null);
    const [paymentLink, setPaymentLink] = useState(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    // Load data
    useEffect(() => {
        if (!currentBusiness?.id) return;

        async function load() {
            setLoading(true);
            try {
                const [clientList, itemList] = await Promise.all([
                    getClientsByBusiness(currentBusiness.id),
                    getItemsByBusiness(currentBusiness.id),
                ]);
                setClients(clientList);
                setItems(itemList);

                setInvoiceType(currentBusiness.defaultInvoiceType || 'gst');
                setTermsConditions(currentBusiness.defaultTerms || '');

                // Pre-fill bank details from business
                if (currentBusiness.bankDetails) {
                    setBankDetails(prev => ({
                        ...prev,
                        accountName: currentBusiness.bankDetails.accountName || '',
                        accountNumber: currentBusiness.bankDetails.accountNumber || '',
                        ifsc: currentBusiness.bankDetails.ifsc || '',
                        bankName: currentBusiness.bankDetails.bankName || '',
                        upiId: currentBusiness.bankDetails.upiId || '',
                        bankLogo: currentBusiness.bankDetails.bankLogo || '',
                        qrCode: currentBusiness.bankDetails.qrCode || '',
                    }));
                }

                // Pre-fill branding from business
                if (currentBusiness.branding?.primaryColor) setBrandingColor(currentBusiness.branding.primaryColor);
                if (currentBusiness.branding?.fontFamily) setBrandingFont(currentBusiness.branding.fontFamily);

                // Load saved preferences
                try {
                    const prefs = await getInvoicePreferences(currentBusiness.id);
                    setSavedPreferences(prefs);
                } catch (e) { /* ignore if table doesn't exist yet */ }

                if (id) {
                    // Edit mode
                    const inv = await getInvoiceById(Number(id));
                    if (inv) {
                        setInvoiceNumber(inv.invoiceNumber);
                        setInvoiceDate(inv.invoiceDate);
                        setDueDate(inv.dueDate);
                        setInvoiceType(inv.invoiceType || 'gst');
                        setClientId(inv.clientId);
                        setSelectedClient(clientList.find(c => c.id === inv.clientId) || null);
                        setLineItems(inv.lineItems?.length ? inv.lineItems : [{ ...EMPTY_LINE_ITEM }]);
                        setNotes(inv.notes || '');
                        setTermsConditions(inv.termsConditions || '');
                        setFieldVisibility(inv.fieldVisibility || fieldVisibility);
                        setPaymentLink({ token: inv.paymentLinkToken, status: inv.paymentLinkStatus });

                        // Load payment confirmations
                        const confs = await getPaymentConfirmationsByInvoice(Number(id));
                        setPaymentConfirmations(confs);
                    }
                } else {
                    // New invoice - get next number
                    const { number } = await getNextInvoiceNumber(currentBusiness.id);
                    setInvoiceNumber(number);
                }
            } catch (err) {
                console.error('Load error:', err);
            }
            setLoading(false);
        }
        load();
    }, [currentBusiness?.id, id]);

    // ... (filters/totals/handlers remain same until new handlers)

    // Phase K: Draft Saving
    useEffect(() => {
        if (id) return; // Edit mode - no local draft
        if (!currentBusiness?.id) return;

        const draftKey = `invoice_draft_${currentBusiness.id}`;

        // Load on mount
        const saved = localStorage.getItem(draftKey);
        if (saved) {
            try {
                const d = JSON.parse(saved);
                if (d.ts && (Date.now() - d.ts > 7 * 24 * 60 * 60 * 1000)) {
                    localStorage.removeItem(draftKey);
                    return;
                }
                if (d.invoiceNumber) setInvoiceNumber(d.invoiceNumber);
                if (d.invoiceDate) setInvoiceDate(d.invoiceDate);
                if (d.dueDate) setDueDate(d.dueDate);
                if (d.clientId) { setClientId(d.clientId); setSelectedClient(d.selectedClient); }
                if (d.lineItems) setLineItems(d.lineItems);
                if (d.notes) setNotes(d.notes);
                if (d.termsConditions) setTermsConditions(d.termsConditions);
                if (d.fieldVisibility) setFieldVisibility(d.fieldVisibility);
            } catch (e) {
                console.error("Failed to load draft");
            }
        }
    }, [id, currentBusiness?.id]);

    useEffect(() => {
        if (id) return;
        if (!currentBusiness?.id) return;

        const draftKey = `invoice_draft_${currentBusiness.id}`;
        const draftData = {
            invoiceNumber, invoiceDate, dueDate, clientId, selectedClient,
            lineItems, notes, termsConditions, fieldVisibility,
            ts: Date.now()
        };

        const handler = setTimeout(() => {
            localStorage.setItem(draftKey, JSON.stringify(draftData));
        }, 1000);

        return () => clearTimeout(handler);
    }, [
        invoiceNumber, invoiceDate, dueDate, clientId, selectedClient,
        lineItems, notes, termsConditions, fieldVisibility,
        id, currentBusiness?.id
    ]);

    // Filter clients
    const filteredClients = useMemo(() => {
        if (!clientSearch) return clients;
        const q = clientSearch.toLowerCase();
        return clients.filter(c =>
            c.name?.toLowerCase().includes(q) ||
            c.email?.toLowerCase().includes(q) ||
            c.phone?.includes(q) ||
            c.gstin?.includes(q)
        );
    }, [clients, clientSearch]);

    // Filter items
    const filteredItems = useMemo(() => {
        if (!itemSearch) return items;
        const q = itemSearch.toLowerCase();
        return items.filter(i =>
            i.name?.toLowerCase().includes(q) ||
            i.hsnSac?.includes(q) ||
            i.description?.toLowerCase().includes(q)
        );
    }, [items, itemSearch]);

    // Calculate totals
    const totals = useMemo(() => {
        return calculateInvoiceTotals({
            businessGstin: currentBusiness?.gstin || '',
            clientGstin: selectedClient?.gstin || '',
            businessState: currentBusiness?.state || '',
            clientState: selectedClient?.state || '',
            lineItems,
            isGST: invoiceType === 'gst',
            roundOff: true,
        });
    }, [currentBusiness?.gstin, currentBusiness?.state, selectedClient?.gstin, selectedClient?.state, lineItems, invoiceType]);

    // Handlers
    const selectClient = useCallback((client) => {
        setClientId(client.id);
        setSelectedClient(client);
        setClientSearch('');
        setShowClientDropdown(false);

        // Apply client preferences
        if (client.invoicePreferences) {
            if (client.invoicePreferences.defaultInvoiceType) {
                setInvoiceType(client.invoicePreferences.defaultInvoiceType);
            }
            if (client.invoicePreferences.defaultPaymentTerms) {
                setDueDate(addDays(invoiceDate, client.invoicePreferences.defaultPaymentTerms));
            }
        }
    }, [invoiceDate]);

    const clearClient = () => {
        setClientId(null);
        setSelectedClient(null);
    };

    const updateLineItem = (index, field, value) => {
        setLineItems(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const selectItemForRow = (index, item) => {
        setLineItems(prev => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                itemId: item.id,
                name: item.name,
                description: item.description || '',
                hsnSac: item.hsnSac || '',
                unitPrice: item.defaultPrice || 0,
                gstRate: item.defaultGstRate || 18,
            };
            return updated;
        });
        setActiveItemRow(null);
        setItemSearch('');
    };

    const addLineItem = () => {
        setLineItems(prev => [...prev, { ...EMPTY_LINE_ITEM }]);
    };

    const removeLineItem = (index) => {
        if (lineItems.length <= 1) return;
        setLineItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleDueDatePreset = (days) => {
        setDueDate(addDays(invoiceDate, days));
    };

    const handleSave = async (status = 'draft') => {
        if (!currentBusiness?.id) return;
        if (!clientId) { toast.error('Please select a client.'); return; }
        if (!invoiceNumber) { toast.error('Invoice number is required.'); return; }
        if (lineItems.every(li => !li.name && li.unitPrice === 0)) {
            toast.error('Please add at least one line item.');
            return;
        }

        setSaving(true);
        try {
            const invoiceData = {
                businessId: currentBusiness.id,
                clientId,
                invoiceNumber,
                invoiceType,
                invoiceDate,
                dueDate,
                placeOfSupply: selectedClient?.state || currentBusiness.state || '',
                lineItems: totals.lineItems,
                subtotal: totals.subtotal,
                cgst: totals.cgst,
                sgst: totals.sgst,
                igst: totals.igst,
                totalTax: totals.totalTax,
                roundOff: totals.roundOff,
                grandTotal: totals.grandTotal,
                notes,
                termsConditions,
                templateId: currentBusiness.defaultTemplateId || 'minimal',
                fieldVisibility,
                bankDetails,
                status: status || 'draft',
                paymentStatus: 'unpaid',
            };

            if (id) {
                await updateInvoice(Number(id), invoiceData);
                toast.success('Invoice updated');
            } else {
                await createInvoice(invoiceData);
                toast.success('Invoice created');
                // Clear local draft
                const draftKey = `invoice_draft_${currentBusiness.id}`;
                localStorage.removeItem(draftKey);
            }

            navigate('/invoices');
        } catch (err) {
            toast.error(err.message || 'Failed to save invoice.');
        }
        setSaving(false);
    };
    const handleIssueLink = async () => {
        if (!id) return;
        try {
            const updated = await issuePaymentLink(Number(id));
            setPaymentLink({ token: updated.paymentLinkToken, status: updated.paymentLinkStatus });
            toast.success('Payment link generated!');
        } catch (err) {
            toast.error('Failed to issue link');
        }
    };

    const handleAnalyzeProof = async (confirmation) => {
        setAnalyzingProofId(confirmation.id);
        try {
            const result = await analyzePaymentScreenshot(confirmation.screenshot, { grandTotal: totals.grandTotal });

            let updated = {
                ...confirmation,
                aiStatus: result.status, // verified, manual_review, failed
                aiConfidence: result.score,
                aiDetails: result.analysis,
            };

            // Check Auto-Clearance Settings
            const settings = await getAutoClearanceSettings(currentBusiness.id);
            let autoCleared = false;

            if (settings?.enabled && result.status === 'verified') {
                let matches = true;
                if (settings.exactAmountMatch && !result.foundAmount) matches = false;

                if (matches && settings.autoUpdateInvoiceStatus) {
                    updated.businessDecision = 'accepted';
                    autoCleared = true;

                    // Record Payment automatically
                    await recordPayment(Number(id), {
                        amount: result.extracted.amount || totals.grandTotal,
                        date: result.extracted.date || new Date().toISOString(),
                        mode: 'upi',
                        reference: result.extracted.utr || 'Auto-cleared by AI',
                        notes: `Auto-verified by AI (Score: ${result.score})`
                    });

                    // Update local invoice state if needed, or rely on reload?
                    // Ideally reload or update local state
                }
            }

            await updatePaymentConfirmation(confirmation.id, updated);
            setPaymentConfirmations(prev => prev.map(p => p.id === confirmation.id ? updated : p));

            if (autoCleared) {
                toast.success('Payment verified & recorded automatically!');
                // Trigger reload to show PAID status?
                // For now, toast is enough, user can refresh or we can update local paymentStatus
            } else {
                toast.success('Analysis complete');
            }
        } catch (err) {
            console.error(err);
            toast.error('Analysis failed');
        }
        setAnalyzingProofId(null);
    };

    const handleProofDecision = async (confirmation, decision) => {
        try {
            const updated = { ...confirmation, businessDecision: decision };
            await updatePaymentConfirmation(confirmation.id, updated);
            setPaymentConfirmations(prev => prev.map(p => p.id === confirmation.id ? updated : p));
            toast.success(`Proof ${decision}`);

            // If accepted, update invoice status to paid?
            // This would ideally be a separate action or prompted
            if (decision === 'accepted') {
                // Optionally mark invoice as paid
            }
        } catch (err) {
            toast.error('Failed to update decision');
        }
    };

    const downloadPDF = async () => {
        const el = previewRef.current;
        if (!el) { toast.error('Preview is not visible. Enable preview first.'); return; }
        setDownloading(true);
        try {
            const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`${invoiceNumber || 'Invoice'}.pdf`);
            toast.success('PDF downloaded!');
        } catch (err) {
            console.error(err);
            toast.error('Failed to generate PDF.');
        }
        setDownloading(false);
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '100px' }}>
                <div className="spinner spinner-lg" />
            </div>
        );
    }

    return (
        <div className="new-invoice-page">
            {/* Top Bar */}
            <div className="invoice-topbar">
                <div className="invoice-topbar-left">
                    <h1>{id ? 'Edit Invoice' : 'New Invoice'}</h1>
                    <p className="subtitle">Create and preview your invoice</p>
                </div>
                <div className="invoice-topbar-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowPreview(!showPreview)}>
                        {showPreview ? <EyeOff size={14} /> : <Eye size={14} />} {showPreview ? 'Hide' : 'Show'} Preview
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowFieldSettings(!showFieldSettings)}>
                        <Settings2 size={14} /> Customize
                    </button>
                    {showPreview && (
                        <button className="btn btn-ghost btn-sm" onClick={downloadPDF} disabled={downloading}>
                            {downloading ? <span className="spinner" /> : <><Download size={14} /> PDF</>}
                        </button>
                    )}
                    <button className="btn btn-secondary" onClick={() => handleSave('draft')} disabled={saving}>
                        <Save size={14} /> Save Draft
                    </button>
                    <button className="btn btn-primary" onClick={() => handleSave('final')} disabled={saving}>
                        <Send size={14} /> Finalize
                    </button>
                    {id && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowSendModal(true)}>
                            <Send size={14} /> Send
                        </button>
                    )}
                </div>
            </div>

            {/* Customization Panel */}
            {showFieldSettings && (
                <div className="field-settings-panel card">
                    <div className="fsp-header">
                        <h4><Settings2 size={14} /> Invoice Customization</h4>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowFieldSettings(false)}><X size={14} /></button>
                    </div>

                    {/* Field Visibility */}
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--space-2)' }}>Field Visibility</div>
                        <div className="fsp-grid">
                            {Object.entries(fieldVisibility).map(([key, val]) => (
                                <label key={key} className="fsp-toggle">
                                    <label className="toggle">
                                        <input type="checkbox" checked={val} onChange={e => setFieldVisibility(prev => ({ ...prev, [key]: e.target.checked }))} />
                                        <span className="toggle-slider" />
                                    </label>
                                    <span>{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Colors & Fonts */}
                    <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
                        <div className="form-group" style={{ flex: '0 0 auto' }}>
                            <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}><Palette size={12} /> Primary Color</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <input type="color" value={brandingColor} onChange={e => setBrandingColor(e.target.value)} style={{ width: '36px', height: '30px', border: 'none', borderRadius: '6px', cursor: 'pointer' }} />
                                <input type="text" className="form-input" value={brandingColor} onChange={e => setBrandingColor(e.target.value)} style={{ width: '90px', fontSize: 'var(--font-size-xs)', fontFamily: 'monospace' }} />
                            </div>
                        </div>
                        <div className="form-group" style={{ flex: '1 1 140px' }}>
                            <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}><Type size={12} /> Font Family</label>
                            <select className="form-select" value={brandingFont} onChange={e => setBrandingFont(e.target.value)} style={{ fontSize: 'var(--font-size-sm)' }}>
                                <option value="Inter, sans-serif">Inter</option>
                                <option value="Roboto, sans-serif">Roboto</option>
                                <option value="Outfit, sans-serif">Outfit</option>
                                <option value="'DM Sans', sans-serif">DM Sans</option>
                                <option value="'Source Sans 3', sans-serif">Source Sans</option>
                                <option value="Georgia, serif">Georgia (Serif)</option>
                                <option value="'Courier New', monospace">Courier New</option>
                            </select>
                        </div>
                    </div>

                    {/* Save / Load Preferences */}
                    <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ flex: '1 1 120px', marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>Preference Name</label>
                            <input type="text" className="form-input" value={preferenceName} onChange={e => setPreferenceName(e.target.value)} placeholder="e.g. Modern Blue" style={{ fontSize: 'var(--font-size-xs)' }} />
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={async () => {
                            if (!preferenceName.trim()) return;
                            try {
                                await saveInvoicePreference({
                                    businessId: currentBusiness?.id,
                                    name: preferenceName.trim(),
                                    isDefault: false,
                                    fieldVisibility,
                                    primaryColor: brandingColor,
                                    fontFamily: brandingFont,
                                });
                                const prefs = await getInvoicePreferences(currentBusiness?.id);
                                setSavedPreferences(prefs);
                                setPreferenceName('');
                                toast.success('Preference saved!');
                            } catch (e) { toast.error('Failed to save'); }
                        }}>Save</button>
                        {savedPreferences.length > 0 && (
                            <select className="form-select" style={{ fontSize: 'var(--font-size-xs)', maxWidth: '140px' }} onChange={e => {
                                const pref = savedPreferences.find(p => p.id === Number(e.target.value));
                                if (pref) {
                                    if (pref.fieldVisibility) setFieldVisibility(pref.fieldVisibility);
                                    if (pref.primaryColor) setBrandingColor(pref.primaryColor);
                                    if (pref.fontFamily) setBrandingFont(pref.fontFamily);
                                    toast.success(`Loaded: ${pref.name}`);
                                }
                            }}>
                                <option value="">Load saved...</option>
                                {savedPreferences.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        )}
                    </div>
                </div>
            )}

            <div className="invoice-workspace">
                {/* LEFT: Invoice Form */}
                <div className="invoice-form-container">
                    {/* Invoice Type Toggle */}
                    <div className="invoice-type-toggle">
                        <button
                            className={`type-btn ${invoiceType === 'gst' ? 'active' : ''}`}
                            onClick={() => setInvoiceType('gst')}
                        >
                            GST Invoice
                        </button>
                        <button
                            className={`type-btn ${invoiceType === 'non-gst' ? 'active' : ''}`}
                            onClick={() => setInvoiceType('non-gst')}
                        >
                            Non-GST Invoice
                        </button>
                    </div>

                    {/* Invoice Header Section */}
                    <div className="form-section">
                        <h3 className="form-section-title">
                            <FileText size={16} /> Invoice Details
                        </h3>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Invoice Number <span className="required">*</span></label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={invoiceNumber}
                                    onChange={e => setInvoiceNumber(e.target.value)}
                                    placeholder="INV-0001"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Invoice Date</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={invoiceDate}
                                    onChange={e => setInvoiceDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Due Date</label>
                            <div className="due-date-row">
                                <input
                                    type="date"
                                    className="form-input"
                                    value={dueDate}
                                    onChange={e => setDueDate(e.target.value)}
                                />
                                <div className="due-presets">
                                    {DUE_DATE_PRESETS.map(p => (
                                        <button key={p.days} className="btn btn-ghost btn-sm" onClick={() => handleDueDatePreset(p.days)}>
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Client Section */}
                    <div className="form-section">
                        <h3 className="form-section-title">
                            <User size={16} /> Client Details
                        </h3>

                        {selectedClient ? (
                            <div className="selected-client-card">
                                <div className="scc-info">
                                    <strong>{selectedClient.name}</strong>
                                    {selectedClient.gstin && <span className="scc-gstin">GSTIN: {selectedClient.gstin}</span>}
                                    <span className="scc-detail">
                                        {[selectedClient.email, selectedClient.phone, selectedClient.state].filter(Boolean).join(' · ')}
                                    </span>
                                </div>
                                <button className="btn btn-ghost btn-sm" onClick={clearClient}><X size={14} /></button>
                            </div>
                        ) : (
                            <div className="client-search-container">
                                <div className="search-box">
                                    <Search size={16} className="search-icon" />
                                    <input
                                        type="text"
                                        placeholder="Search clients by name, email, phone..."
                                        value={clientSearch}
                                        onChange={e => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                                        onFocus={() => setShowClientDropdown(true)}
                                    />
                                </div>
                                {showClientDropdown && (
                                    <div className="client-dropdown">
                                        {filteredClients.length === 0 ? (
                                            <div className="client-dropdown-empty">
                                                <p>No clients found</p>
                                                <button className="btn btn-primary btn-sm" onClick={() => setShowNewClientModal(true)}>
                                                    <Plus size={12} /> Add New Client
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                {filteredClients.map(c => (
                                                    <button key={c.id} className="client-option" onClick={() => selectClient(c)}>
                                                        <div className="co-avatar">{c.name?.[0]?.toUpperCase()}</div>
                                                        <div className="co-info">
                                                            <span className="co-name">{c.name}</span>
                                                            <span className="co-detail">{c.email || c.phone || ''}{c.gstin ? ` · ${c.gstin}` : ''}</span>
                                                        </div>
                                                    </button>
                                                ))}
                                                <button className="client-option add-new" onClick={() => setShowNewClientModal(true)}>
                                                    <Plus size={14} />
                                                    <span>Add New Client</span>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {invoiceType === 'gst' && selectedClient && (
                            <div className="gst-info-bar">
                                <span>
                                    {selectedClient.state === currentBusiness?.state
                                        ? '📍 Intra-State (CGST + SGST)'
                                        : '📍 Inter-State (IGST)'}
                                </span>
                                {selectedClient.gstin && <span>GSTIN: {selectedClient.gstin}</span>}
                            </div>
                        )}
                    </div>

                    {/* Line Items Section */}
                    <div className="form-section">
                        <h3 className="form-section-title">
                            <IndianRupee size={16} /> Items & Services
                        </h3>

                        <div className="line-items-table">
                            <div className="li-header">
                                <div className="li-col li-item">Item</div>
                                {fieldVisibility.hsn && <div className="li-col li-hsn">HSN/SAC</div>}
                                <div className="li-col li-qty">Qty</div>
                                <div className="li-col li-price">Price</div>
                                {fieldVisibility.discount && <div className="li-col li-disc">Disc%</div>}
                                {invoiceType === 'gst' && <div className="li-col li-gst">GST%</div>}
                                <div className="li-col li-total">Total</div>
                                <div className="li-col li-action" />
                            </div>

                            {lineItems.map((li, idx) => {
                                const calc = totals.lineItems[idx];
                                return (
                                    <div key={idx} className="li-row">
                                        <div className="li-col li-item">
                                            <div className="item-cell">
                                                <input
                                                    type="text"
                                                    className="li-input"
                                                    placeholder="Search item..."
                                                    value={li.name}
                                                    onChange={e => {
                                                        updateLineItem(idx, 'name', e.target.value);
                                                        setItemSearch(e.target.value);
                                                        setActiveItemRow(idx);
                                                    }}
                                                    onFocus={() => { setActiveItemRow(idx); setItemSearch(li.name); }}
                                                    onBlur={() => setTimeout(() => setActiveItemRow(null), 200)}
                                                />
                                                {activeItemRow === idx && (
                                                    <div className="item-dropdown">
                                                        {filteredItems.map(item => (
                                                            <button key={item.id} className="item-option" onMouseDown={() => selectItemForRow(idx, item)}>
                                                                <span>{item.name}</span>
                                                                <span className="io-price">{formatCurrency(item.defaultPrice)}</span>
                                                            </button>
                                                        ))}
                                                        <button className="item-option add-new" onMouseDown={() => { setActiveItemRowForModal(idx); setShowNewItemModal(true); setActiveItemRow(null); }}>
                                                            <Plus size={14} />
                                                            <span>Add New Item / Service</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            {li.description && (
                                                <input
                                                    type="text"
                                                    className="li-desc-input"
                                                    placeholder="Description"
                                                    value={li.description}
                                                    onChange={e => updateLineItem(idx, 'description', e.target.value)}
                                                />
                                            )}
                                        </div>

                                        {fieldVisibility.hsn && (
                                            <div className="li-col li-hsn">
                                                <input type="text" className="li-input" value={li.hsnSac} onChange={e => updateLineItem(idx, 'hsnSac', e.target.value)} placeholder="Code" list="hsn-list" />
                                            </div>
                                        )}

                                        <div className="li-col li-qty">
                                            <input type="number" className="li-input" value={li.quantity} onChange={e => updateLineItem(idx, 'quantity', Number(e.target.value))} min="0" step="1" />
                                        </div>

                                        <div className="li-col li-price">
                                            <input type="number" className="li-input" value={li.unitPrice} onChange={e => updateLineItem(idx, 'unitPrice', Number(e.target.value))} min="0" step="0.01" />
                                        </div>

                                        {fieldVisibility.discount && (
                                            <div className="li-col li-disc">
                                                <input type="number" className="li-input" value={li.discount} onChange={e => updateLineItem(idx, 'discount', Number(e.target.value))} min="0" max="100" step="0.5" />
                                            </div>
                                        )}

                                        {invoiceType === 'gst' && (
                                            <div className="li-col li-gst">
                                                <select className="li-input li-select" value={li.gstRate} onChange={e => updateLineItem(idx, 'gstRate', Number(e.target.value))}>
                                                    {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                                                </select>
                                            </div>
                                        )}

                                        <div className="li-col li-total">
                                            <span className="li-total-value">{formatCurrency(calc?.lineTotal || 0)}</span>
                                        </div>

                                        <div className="li-col li-action">
                                            <button className="btn btn-ghost btn-sm" onClick={() => removeLineItem(idx)} disabled={lineItems.length <= 1}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}

                            <button className="add-item-btn" onClick={addLineItem}>
                                <Plus size={14} /> Add Item
                            </button>
                        </div>
                    </div>

                    {/* Summary Section */}
                    <div className="form-section invoice-summary-section">
                        <div className="summary-row">
                            <span>Subtotal</span>
                            <span>{formatCurrency(totals.subtotal)}</span>
                        </div>
                        {invoiceType === 'gst' && (
                            <div className="summary-info-box" style={{
                                margin: 'var(--space-2) 0',
                                padding: 'var(--space-2)',
                                background: 'var(--color-bg)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 'var(--font-size-xs)',
                                color: 'var(--color-text-secondary)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Place of Supply:</span>
                                    <strong>{totals.placeOfSupplyCode ? `${totals.placeOfSupply} (${totals.placeOfSupplyCode})` : totals.placeOfSupply}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                                    <span>Tax Type:</span>
                                    <strong>{totals.isIntraState ? 'Intra-State (CGST + SGST)' : 'Inter-State (IGST)'}</strong>
                                </div>
                            </div>
                        )}
                        {invoiceType === 'gst' && totals.isIntraState && (
                            <>
                                <div className="summary-row">
                                    <span>CGST</span>
                                    <span>{formatCurrency(totals.cgst)}</span>
                                </div>
                                <div className="summary-row">
                                    <span>SGST</span>
                                    <span>{formatCurrency(totals.sgst)}</span>
                                </div>
                            </>
                        )}
                        {invoiceType === 'gst' && !totals.isIntraState && (
                            <div className="summary-row">
                                <span>IGST</span>
                                <span>{formatCurrency(totals.igst)}</span>
                            </div>
                        )}
                        {totals.roundOff !== 0 && (
                            <div className="summary-row">
                                <span>Round Off</span>
                                <span>{totals.roundOff > 0 ? '+' : ''}{formatCurrency(totals.roundOff)}</span>
                            </div>
                        )}
                        <div className="summary-row total-row">
                            <span>Grand Total</span>
                            <span>{formatCurrency(totals.grandTotal)}</span>
                        </div>
                        <div className="summary-words">
                            {numberToWords(totals.grandTotal)}
                        </div>
                    </div>

                    {/* Bank Details Section */}
                    {fieldVisibility.bankDetails && (
                        <div className="form-section">
                            <h3 className="form-section-title">
                                <Landmark size={16} /> Bank Details
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                                <div className="form-group">
                                    <label className="form-label">Account Name</label>
                                    <input type="text" className="form-input" value={bankDetails.accountName} onChange={e => setBankDetails(p => ({ ...p, accountName: e.target.value }))} placeholder="Account holder name" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Bank Name</label>
                                    <input type="text" className="form-input" value={bankDetails.bankName} onChange={e => setBankDetails(p => ({ ...p, bankName: e.target.value }))} placeholder="e.g. HDFC Bank" />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                                <div className="form-group">
                                    <label className="form-label">Account Number</label>
                                    <input type="text" className="form-input" value={bankDetails.accountNumber} onChange={e => setBankDetails(p => ({ ...p, accountNumber: e.target.value }))} placeholder="1234567890" style={{ fontFamily: 'monospace' }} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">IFSC Code</label>
                                    <input type="text" className="form-input" value={bankDetails.ifsc} onChange={e => setBankDetails(p => ({ ...p, ifsc: e.target.value.toUpperCase() }))} placeholder="HDFC0001234" style={{ fontFamily: 'monospace' }} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                                <div className="form-group">
                                    <label className="form-label">UPI ID</label>
                                    <input type="text" className="form-input" value={bankDetails.upiId} onChange={e => setBankDetails(p => ({ ...p, upiId: e.target.value }))} placeholder="name@upi" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Bank Logo URL</label>
                                    <input type="text" className="form-input" value={bankDetails.bankLogo} onChange={e => setBankDetails(p => ({ ...p, bankLogo: e.target.value }))} placeholder="https://... or paste logo URL" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label"><QrCode size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> Payment QR Code</label>
                                <div className="qr-upload-area">
                                    {bankDetails.qrCode ? (
                                        <div className="qr-preview">
                                            <img src={bankDetails.qrCode} alt="QR" style={{ width: '120px', height: '120px', objectFit: 'contain', borderRadius: '8px' }} />
                                            <button className="btn btn-ghost btn-sm" onClick={() => setBankDetails(p => ({ ...p, qrCode: '' }))}><X size={14} /> Remove</button>
                                        </div>
                                    ) : (
                                        <label className="qr-upload-label">
                                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onload = ev => setBankDetails(p => ({ ...p, qrCode: ev.target.result }));
                                                    reader.readAsDataURL(file);
                                                }
                                            }} />
                                            <QrCode size={24} style={{ color: 'var(--color-text-tertiary)' }} />
                                            <span>Upload QR Code Image</span>
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>

                    )}

                    {/* Payment Proofs & Clearance Section (Only for saved invoices) */}
                    {id && (
                        <div className="form-section">
                            <h3 className="form-section-title">
                                <LinkIcon size={16} /> Payment & Clearance
                            </h3>

                            {/* Link Status */}
                            <div className="pp-link-status card-flat" style={{ marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>Payment Link</div>
                                        {paymentLink?.token ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span className={`badge ${paymentLink.status === 'paid' ? 'badge-success' : 'badge-primary'}`}>
                                                    {paymentLink.status === 'issued' ? 'Active' : paymentLink.status}
                                                </span>
                                                <a
                                                    href={`/pay/${paymentLink.token}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--color-primary)', textDecoration: 'none' }}
                                                >
                                                    View Page <ExternalLink size={12} />
                                                </a>
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: '13px', fontStyle: 'italic', color: '#999' }}>Not issued yet</div>
                                        )}
                                    </div>
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={handleIssueLink}
                                        disabled={paymentLink?.status === 'paid'}
                                    >
                                        <LinkIcon size={14} /> {paymentLink?.token ? 'Regenerate Link' : 'Issue Payment Link'}
                                    </button>
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        style={{ marginLeft: '8px' }}
                                        onClick={() => setShowPaymentModal(true)}
                                    >
                                        <Plus size={14} /> Record Payment
                                    </button>
                                </div>
                            </div>

                            {/* Manual Payment Modal */}
                            {showPaymentModal && (
                                <ManualPaymentModal
                                    invoiceId={id}
                                    grandTotal={totals.grandTotal}
                                    onClose={() => setShowPaymentModal(false)}
                                    onRecorded={() => {
                                        if (paymentLink) setPaymentLink(prev => ({ ...prev, status: 'paid' }));
                                        toast.success('Invoice marked as Paid');
                                        // Trigger reload or update local state logic if needed
                                    }}
                                />
                            )}

                            {/* Payment Proofs List */}
                            <h4 style={{ fontSize: '14px', margin: '0 0 12px 0' }}>Client Payment Proofs</h4>
                            {paymentConfirmations.length === 0 ? (
                                <div className="empty-state-small" style={{ padding: '20px', textAlign: 'center', background: '#f9fafb', borderRadius: '8px', color: '#666', fontSize: '13px' }}>
                                    No payment proofs uploaded by client yet.
                                </div>
                            ) : (
                                <div className="proofs-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {paymentConfirmations.map(proof => (
                                        <div key={proof.id} className="proof-card" style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px', background: '#fff' }}>
                                            <div style={{ display: 'flex', gap: '16px' }}>
                                                {/* Screenshot Thumbnail */}
                                                <div style={{ width: '80px', height: '80px', flexShrink: 0, background: '#f0f0f0', borderRadius: '6px', overflow: 'hidden' }}>
                                                    <img src={proof.screenshot} alt="Proof" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onClick={() => window.open(proof.screenshot, '_blank')} />
                                                </div>

                                                {/* Details */}
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                        <span style={{ fontSize: '12px', color: '#666' }}>Submitted: {new Date(proof.submittedAt).toLocaleString()}</span>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            {proof.businessDecision === 'pending' && (
                                                                <>
                                                                    <button className="btn btn-success btn-xs" onClick={() => handleProofDecision(proof, 'accepted')}><CheckCircle size={12} /> Accept</button>
                                                                    <button className="btn btn-danger btn-xs" onClick={() => handleProofDecision(proof, 'rejected')}><XCircle size={12} /> Reject</button>
                                                                </>
                                                            )}
                                                            {proof.businessDecision !== 'pending' && (
                                                                <span className={`badge ${proof.businessDecision === 'accepted' ? 'badge-success' : 'badge-danger'}`}>
                                                                    {proof.businessDecision.toUpperCase()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* AI Analysis Section */}
                                                    <div className="ai-analysis" style={{ background: '#f8f9fc', padding: '8px', borderRadius: '6px', fontSize: '13px' }}>
                                                        {!proof.aiStatus || proof.aiStatus === 'pending' ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                <span style={{ color: '#666' }}>AI Analysis not run</span>
                                                                <button
                                                                    className="btn btn-ghost btn-xs"
                                                                    onClick={() => handleAnalyzeProof(proof)}
                                                                    disabled={analyzingProofId === proof.id}
                                                                >
                                                                    {analyzingProofId === proof.id ? <span className="spinner spinner-sm" /> : <><RefreshCw size={12} /> Analyze</>}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                                    <strong>AI Verdict:</strong>
                                                                    <span className={`badge ${proof.aiStatus === 'verified' ? 'badge-success' : proof.aiStatus === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                                                                        {proof.aiStatus === 'verified' ? 'High Confidence' : proof.aiStatus === 'failed' ? 'Low Confidence' : 'Manual Review'}
                                                                    </span>
                                                                    <span style={{ fontSize: '11px', color: '#666' }}>({Math.round(proof.aiConfidence || 0)}% score)</span>
                                                                </div>
                                                                {proof.aiDetails && (
                                                                    <div style={{ fontSize: '12px', color: '#555', marginTop: '4px' }}>
                                                                        {proof.aiDetails.foundAmount && <div style={{ color: 'green' }}>✓ Amount match found</div>}
                                                                        {proof.aiDetails.foundDate && <div style={{ color: 'green' }}>✓ Date match found</div>}
                                                                        {proof.aiDetails.extracted?.utr && <div>Target UTR: {proof.aiDetails.extracted.utr}</div>}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Notes Section */}
                    <div className="form-section">
                        {fieldVisibility.notes && (
                            <div className="form-group">
                                <label className="form-label">Notes</label>
                                <textarea className="form-textarea" rows={3} placeholder="Add notes visible to client..." value={notes} onChange={e => setNotes(e.target.value)} />
                            </div>
                        )}
                        {fieldVisibility.terms && (
                            <div className="form-group">
                                <label className="form-label">Terms & Conditions</label>
                                <textarea className="form-textarea" rows={3} placeholder="Payment terms, conditions..." value={termsConditions} onChange={e => setTermsConditions(e.target.value)} />
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: Live Preview */}
                {showPreview && (
                    <div className="invoice-preview-container">
                        <div className="preview-header">
                            <h3>Invoice Preview</h3>
                        </div>
                        <div className="preview-scroll" ref={previewRef}>
                            <InvoicePreview
                                business={{ ...currentBusiness, branding: { ...(currentBusiness?.branding || {}), primaryColor: brandingColor, fontFamily: brandingFont } }}
                                client={selectedClient}
                                invoiceNumber={invoiceNumber}
                                invoiceDate={invoiceDate}
                                dueDate={dueDate}
                                invoiceType={invoiceType}
                                lineItems={totals.lineItems}
                                totals={totals}
                                notes={notes}
                                termsConditions={termsConditions}
                                fieldVisibility={fieldVisibility}
                                bankDetails={bankDetails}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* New Item Modal */}
            {
                showNewItemModal && (
                    <NewItemModal
                        businessId={currentBusiness?.id}
                        onClose={() => setShowNewItemModal(false)}
                        onCreated={async (newItemId) => {
                            const il = await getItemsByBusiness(currentBusiness.id);
                            setItems(il);
                            const created = il.find(i => i.id === newItemId);
                            if (created && activeItemRowForModal !== null) {
                                selectItemForRow(activeItemRowForModal, created);
                            }
                            setShowNewItemModal(false);
                            setActiveItemRowForModal(null);
                        }}
                    />
                )
            }

            {/* New Client Modal */}
            {
                showNewClientModal && (
                    <NewClientModal
                        businessId={currentBusiness?.id}
                        onClose={() => setShowNewClientModal(false)}
                        onCreated={async (newClient) => {
                            const cl = await getClientsByBusiness(currentBusiness.id);
                            setClients(cl);
                            const created = cl.find(c => c.id === newClient);
                            if (created) selectClient(created);
                            setShowNewClientModal(false);
                        }}
                    />
                )
            }
        </div >
    );
}

function NewClientModal({ businessId, onClose, onCreated }) {
    const toast = useToast();
    const [form, setForm] = useState({
        name: '', email: '', phone: '', address: '', state: '',
        gstin: '', pan: '', gstType: 'unregistered',
    });
    const [saving, setSaving] = useState(false);

    const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSave = async () => {
        if (!form.name) { toast.error('Client name is required.'); return; }
        if (form.gstin) {
            const { valid, error } = validateGSTIN(form.gstin);
            if (!valid) { toast.error(error); return; }
        }

        setSaving(true);
        try {
            const id = await createClient({ ...form, businessId });
            toast.success('Client created!');
            onCreated(id);
        } catch (err) {
            toast.error(err.message || 'Failed to create client.');
        }
        setSaving(false);
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                    <h2>Add New Client</h2>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
                </div>
                <div className="modal-body">
                    <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                        <label className="form-label">Client Name <span className="required">*</span></label>
                        <input type="text" className="form-input" value={form.name} onChange={e => update('name', e.target.value)} placeholder="Client or company name" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input type="email" className="form-input" value={form.email} onChange={e => update('email', e.target.value)} placeholder="client@email.com" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Phone</label>
                            <input type="tel" className="form-input" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+91 98765 43210" />
                        </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                        <label className="form-label">Address</label>
                        <input type="text" className="form-input" value={form.address} onChange={e => update('address', e.target.value)} placeholder="Full address" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label">State</label>
                            <select className="form-select" value={form.state} onChange={e => update('state', e.target.value)}>
                                <option value="">Select State</option>
                                {INDIAN_STATES.map(s => <option key={s.code} value={s.name}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">GST Type</label>
                            <select className="form-select" value={form.gstType} onChange={e => update('gstType', e.target.value)}>
                                <option value="registered">Registered</option>
                                <option value="unregistered">Unregistered</option>
                                <option value="composition">Composition</option>
                                <option value="non-gst">Non-GST</option>
                            </select>
                        </div>
                    </div>
                    {form.gstType === 'registered' && (
                        <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                            <label className="form-label">GSTIN</label>
                            <input type="text" className="form-input" value={form.gstin} onChange={e => update('gstin', e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" maxLength={15} />
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? <span className="spinner" /> : 'Add Client'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function NewItemModal({ businessId, onClose, onCreated }) {
    const toast = useToast();
    const [form, setForm] = useState({
        name: '', type: 'service', hsnSac: '', defaultPrice: 0,
        defaultGstRate: 18, description: '', unit: 'nos',
    });
    const [saving, setSaving] = useState(false);

    const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSave = async () => {
        if (!form.name) { toast.error('Item name is required.'); return; }

        setSaving(true);
        try {
            const id = await createItem({ ...form, businessId, isActive: true });
            toast.success('Item created!');
            onCreated(id);
        } catch (err) {
            toast.error(err.message || 'Failed to create item.');
        }
        setSaving(false);
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                <div className="modal-header">
                    <h2><Package size={18} /> Add New Item / Service</h2>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
                </div>
                <div className="modal-body">
                    <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                        <label className="form-label">Item Name <span className="required">*</span></label>
                        <input type="text" className="form-input" value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Website Development" autoFocus />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label">Type</label>
                            <select className="form-select" value={form.type} onChange={e => update('type', e.target.value)}>
                                <option value="service">Service (SAC)</option>
                                <option value="product">Product (HSN)</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">HSN/SAC Code</label>
                            <input type="text" className="form-input" value={form.hsnSac} onChange={e => update('hsnSac', e.target.value)} placeholder={form.type === 'service' ? '9983' : '8471'} list="hsn-list" />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label">Default Price (₹)</label>
                            <input type="number" className="form-input" value={form.defaultPrice} onChange={e => update('defaultPrice', Number(e.target.value))} min="0" step="0.01" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">GST Rate</label>
                            <select className="form-select" value={form.defaultGstRate} onChange={e => update('defaultGstRate', Number(e.target.value))}>
                                {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Unit</label>
                            <select className="form-select" value={form.unit} onChange={e => update('unit', e.target.value)}>
                                <option value="nos">Nos</option>
                                <option value="hrs">Hours</option>
                                <option value="days">Days</option>
                                <option value="months">Months</option>
                                <option value="kg">Kg</option>
                                <option value="pcs">Pieces</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                        <label className="form-label">Description</label>
                        <textarea className="form-textarea" rows={2} value={form.description} onChange={e => update('description', e.target.value)} placeholder="Brief description of the item or service..." />
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? <span className="spinner" /> : <><Plus size={14} /> Add Item</>}
                    </button>
                </div>
            </div>

            {/* HSN Datalist */}
            <datalist id="hsn-list">
                {COMMON_HSN_CODES.map(h => (
                    <option key={h.code} value={h.code}>{h.description}</option>
                ))}
            </datalist>
        </div>
    );
}
