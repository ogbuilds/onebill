import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getInvoiceByPaymentToken, getBusinessById, createPaymentConfirmation } from '@db/operations';
import { formatCurrency } from '@logic/gstEngine';
import { Download, Upload, CheckCircle, AlertCircle, Copy, CreditCard } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import './ClientPayment.css';

export default function ClientPayment() {
    const { token } = useParams();
    const [invoice, setInvoice] = useState(null);
    const [business, setBusiness] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [proofFile, setProofFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                const inv = await getInvoiceByPaymentToken(token);
                if (!inv) {
                    setError('Invalid or expired payment link.');
                    setLoading(false);
                    return;
                }
                const bus = await getBusinessById(inv.businessId);
                setInvoice(inv);
                setBusiness(bus);
            } catch (err) {
                console.error(err);
                setError('Failed to load invoice details.');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [token]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setProofFile(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        }
    };

    const handleSubmitProof = async () => {
        if (!proofFile) return;
        setUploading(true);
        try {
            // Convert file to base64 for storage (Dexie handles blobs/strings well enough for small scale)
            // ideally we'd use a more robust storage, but for local-first/indexedDB:
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64String = reader.result;
                await createPaymentConfirmation({
                    invoiceId: invoice.id,
                    businessId: business.id,
                    screenshot: base64String, // Storing image data directly
                    aiStatus: 'pending',
                    businessDecision: 'pending'
                });
                setSuccess(true);
                setUploading(false);
            };
            reader.readAsDataURL(proofFile);
        } catch (err) {
            alert('Failed to submit proof. Please try again.');
            setUploading(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('Copied to clipboard!');
    };

    const upiUrl = business?.bankDetails?.upiId
        ? `upi://pay?pa=${business.bankDetails.upiId}&pn=${encodeURIComponent(business.businessName)}&am=${invoice?.grandTotal}&tn=Invoice ${invoice?.invoiceNumber}`
        : null;

    const qrCodeUrl = upiUrl
        ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUrl)}`
        : null;

    if (loading) return <div className="cp-center"><div className="spinner spinner-lg"></div></div>;
    if (error) return <div className="cp-center"><div className="cp-error"><AlertCircle /> {error}</div></div>;
    if (success) return (
        <div className="cp-center">
            <div className="cp-success-card">
                <CheckCircle size={48} color="var(--color-success)" />
                <h2>Payment Submitted!</h2>
                <p>Thank you. Your payment proof has been received and is under review.</p>
            </div>
        </div>
    );

    return (
        <div className="cp-page">
            <div className="cp-container">
                <header className="cp-header">
                    <div className="cp-brand">
                        <h1>{business.businessName}</h1>
                        <p>Invoice Payment</p>
                    </div>
                    <div className="cp-amount">
                        <span>Amount Due</span>
                        <strong>{formatCurrency(invoice.grandTotal)}</strong>
                    </div>
                </header>

                <div className="cp-details">
                    <div className="cp-row">
                        <span>Invoice Number</span>
                        <strong>{invoice.invoiceNumber}</strong>
                    </div>
                    <div className="cp-row">
                        <span>Date</span>
                        <strong>{new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</strong>
                    </div>
                    <div className="cp-row">
                        <span>Due Date</span>
                        <strong>{new Date(invoice.dueDate).toLocaleDateString('en-IN')}</strong>
                    </div>
                </div>

                <div className="cp-payment-methods">
                    {business.bankDetails?.upiId && (
                        <div className="cp-method-card">
                            <h3>Pay via UPI</h3>
                            <div className="cp-qr-container">
                                <img src={qrCodeUrl} alt="UPI QR Code" className="cp-qr" />
                            </div>
                            <div className="cp-upi-id" onClick={() => copyToClipboard(business.bankDetails.upiId)}>
                                {business.bankDetails.upiId} <Copy size={14} />
                            </div>
                            <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '12px', color: '#666' }}>
                                Scan with GPay, PhonePe, Paytm
                            </div>
                        </div>
                    )}

                    <div className="cp-method-card">
                        <h3>Bank Transfer</h3>
                        <div className="cp-bank-details">
                            <div className="cp-field">
                                <label>Account Name</label>
                                <div onClick={() => copyToClipboard(business.bankDetails?.accountName)}>
                                    {business.bankDetails?.accountName || '-'} <Copy size={12} />
                                </div>
                            </div>
                            <div className="cp-field">
                                <label>Account Number</label>
                                <div onClick={() => copyToClipboard(business.bankDetails?.accountNumber)}>
                                    {business.bankDetails?.accountNumber || '-'} <Copy size={12} />
                                </div>
                            </div>
                            <div className="cp-field">
                                <label>IFSC Code</label>
                                <div onClick={() => copyToClipboard(business.bankDetails?.ifsc)}>
                                    {business.bankDetails?.ifsc || '-'} <Copy size={12} />
                                </div>
                            </div>
                            <div className="cp-field">
                                <label>Bank Name</label>
                                <div>{business.bankDetails?.bankName || '-'}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="cp-upload-section">
                    <h3>Already Paid?</h3>
                    <p>Upload a screenshot of your payment confirmation to verify immediately.</p>

                    {!previewUrl ? (
                        <label className="cp-file-upload">
                            <input type="file" accept="image/*" onChange={handleFileChange} hidden />
                            <Upload size={24} />
                            <span>Upload Payment Screenshot</span>
                        </label>
                    ) : (
                        <div className="cp-preview">
                            <img src={previewUrl} alt="Preview" />
                            <button className="btn btn-primary btn-full" onClick={handleSubmitProof} disabled={uploading}>
                                {uploading ? <span className="spinner"></span> : 'Submit Payment Proof'}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => { setPreviewUrl(null); setProofFile(null); }}>
                                Change Image
                            </button>
                        </div>
                    )}
                </div>

                <footer className="cp-footer">
                    Powered by OneBill
                </footer>
            </div>
        </div>
    );
}
