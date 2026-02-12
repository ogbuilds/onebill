import React from 'react';
import { formatCurrency, numberToWords } from '@logic/gstEngine';
import './InvoicePreview.css';

export default function InvoicePreview({
    business, client, invoiceNumber, invoiceDate, dueDate,
    invoiceType, lineItems = [], totals, notes, termsConditions,
    fieldVisibility = {}, bankDetails = {}
}) {
    const branding = business?.branding || {};
    const primaryColor = branding.primaryColor || '#6C5CE7';
    const textColor = branding.textColor || '#1A1D2E';

    // Merge bank details: props take priority, fallback to business
    const bank = {
        accountName: bankDetails.accountName || business?.bankDetails?.accountName || '',
        accountNumber: bankDetails.accountNumber || business?.bankDetails?.accountNumber || '',
        ifsc: bankDetails.ifsc || business?.bankDetails?.ifsc || '',
        bankName: bankDetails.bankName || business?.bankDetails?.bankName || '',
        upiId: bankDetails.upiId || business?.bankDetails?.upiId || '',
        bankLogo: bankDetails.bankLogo || business?.bankDetails?.bankLogo || '',
        qrCode: bankDetails.qrCode || business?.bankDetails?.qrCode || '',
    };
    const hasBankDetails = bank.accountNumber || bank.upiId;

    return (
        <div className="inv-preview" style={{ '--inv-primary': primaryColor, '--inv-text': textColor, fontFamily: branding.fontFamily || 'Inter, sans-serif' }}>
            {/* Header */}
            <div className="inv-header">
                <div className="inv-company">
                    {branding.logo ? (
                        <img src={branding.logo} alt="Logo" className="inv-logo" />
                    ) : (
                        <div className="inv-logo-placeholder" style={{ background: primaryColor }}>
                            {business?.businessName?.[0] || 'O'}
                        </div>
                    )}
                    <div>
                        <h2 className="inv-company-name">{business?.businessName || 'Your Business'}</h2>
                        {business?.address && <p className="inv-small">{business.address}</p>}
                        {business?.email && <p className="inv-small">{business.email}</p>}
                        {business?.phone && <p className="inv-small">{business.phone}</p>}
                        {fieldVisibility.gstin && business?.gstin && (
                            <p className="inv-small inv-gstin">GSTIN: {business.gstin}</p>
                        )}
                    </div>
                </div>
                <div className="inv-title-block">
                    <h1 className="inv-title" style={{ color: primaryColor }}>
                        {invoiceType === 'gst' ? 'TAX INVOICE' : 'INVOICE'}
                    </h1>
                    <div className="inv-meta">
                        <div className="inv-meta-row">
                            <span>Invoice #</span>
                            <strong>{invoiceNumber || '---'}</strong>
                        </div>
                        <div className="inv-meta-row">
                            <span>Date</span>
                            <strong>{invoiceDate ? new Date(invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '---'}</strong>
                        </div>
                        <div className="inv-meta-row">
                            <span>Due Date</span>
                            <strong>{dueDate ? new Date(dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '---'}</strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bill To */}
            <div className="inv-parties">
                <div className="inv-party">
                    <div className="inv-party-label">Bill To</div>
                    {client ? (
                        <>
                            <div className="inv-party-name">{client.name}</div>
                            {client.address && <p className="inv-small">{client.address}</p>}
                            {client.state && <p className="inv-small">{client.state}</p>}
                            {client.email && <p className="inv-small">{client.email}</p>}
                            {fieldVisibility.gstin && client.gstin && (
                                <p className="inv-small inv-gstin">GSTIN: {client.gstin}</p>
                            )}
                        </>
                    ) : (
                        <p className="inv-small" style={{ opacity: 0.5 }}>Select a client</p>
                    )}
                </div>
                {invoiceType === 'gst' && (
                    <div className="inv-party">
                        <div className="inv-party-label">Place of Supply</div>
                        <div className="inv-party-name">
                            {totals?.placeOfSupply || client?.state || business?.state || '--'}
                        </div>
                        {totals?.placeOfSupplyCode && (
                            <div className="inv-small">State Code: {totals.placeOfSupplyCode}</div>
                        )}
                    </div>
                )}
            </div>

            {/* Items Table */}
            <div className="inv-items">
                <table className="inv-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Item / Description</th>
                            {fieldVisibility.hsn && <th>HSN/SAC</th>}
                            <th className="right">Qty</th>
                            <th className="right">Rate</th>
                            {fieldVisibility.discount && <th className="right">Disc</th>}
                            {invoiceType === 'gst' && <th className="right">Tax</th>}
                            <th className="right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lineItems.map((item, idx) => (
                            <tr key={idx} className={idx % 2 === 1 ? 'inv-row-alt' : ''}>
                                <td>{idx + 1}</td>
                                <td>
                                    <div>{item.name || '-'}</div>
                                    {item.description && <div className="inv-item-desc">{item.description}</div>}
                                </td>
                                {fieldVisibility.hsn && <td>{item.hsnSac || '-'}</td>}
                                <td className="right">{item.quantity}</td>
                                <td className="right">{formatCurrency(item.unitPrice)}</td>
                                {fieldVisibility.discount && (
                                    <td className="right">{item.discount ? `${item.discount}%` : '-'}</td>
                                )}
                                {invoiceType === 'gst' && (
                                    <td className="right">{item.gstRate}%</td>
                                )}
                                <td className="right">{formatCurrency(item.lineTotal || item.taxableAmount || 0)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Totals + Bank Details */}
            <div className="inv-totals">
                <div className="inv-totals-left">
                    {fieldVisibility.bankDetails && hasBankDetails && (
                        <div className="inv-bank">
                            <div className="inv-bank-header">
                                {bank.bankLogo && (
                                    <img src={bank.bankLogo} alt="Bank" className="inv-bank-logo" />
                                )}
                                <div className="inv-party-label">Bank Details</div>
                            </div>
                            {bank.accountName && <p className="inv-small">Account: {bank.accountName}</p>}
                            {bank.accountNumber && <p className="inv-small">A/C No: {bank.accountNumber}</p>}
                            {bank.ifsc && <p className="inv-small">IFSC: {bank.ifsc}</p>}
                            {bank.bankName && <p className="inv-small">Bank: {bank.bankName}</p>}
                            {bank.upiId && <p className="inv-small inv-gstin">UPI: {bank.upiId}</p>}
                        </div>
                    )}
                    {bank.qrCode && fieldVisibility.bankDetails && (
                        <div className="inv-qr">
                            <img src={bank.qrCode} alt="Payment QR" className="inv-qr-img" />
                            <div className="inv-small" style={{ textAlign: 'center', marginTop: '2px' }}>Scan to Pay</div>
                        </div>
                    )}
                </div>
                <div className="inv-totals-right">
                    <div className="inv-total-row">
                        <span>Subtotal</span>
                        <span>{formatCurrency(totals?.subtotal || 0)}</span>
                    </div>
                    {invoiceType === 'gst' && totals?.isIntraState && (
                        <>
                            <div className="inv-total-row">
                                <span>CGST</span>
                                <span>{formatCurrency(totals?.cgst || 0)}</span>
                            </div>
                            <div className="inv-total-row">
                                <span>SGST</span>
                                <span>{formatCurrency(totals?.sgst || 0)}</span>
                            </div>
                        </>
                    )}
                    {invoiceType === 'gst' && !totals?.isIntraState && (
                        <div className="inv-total-row">
                            <span>IGST</span>
                            <span>{formatCurrency(totals?.igst || 0)}</span>
                        </div>
                    )}
                    {totals?.roundOff !== 0 && (
                        <div className="inv-total-row">
                            <span>Round Off</span>
                            <span>{(totals?.roundOff || 0) > 0 ? '+' : ''}{formatCurrency(totals?.roundOff || 0)}</span>
                        </div>
                    )}
                    <div className="inv-total-row grand-total" style={{ borderColor: primaryColor }}>
                        <span>Total</span>
                        <span style={{ color: primaryColor }}>{formatCurrency(totals?.grandTotal || 0)}</span>
                    </div>
                </div>
            </div>

            {/* Amount in Words */}
            <div className="inv-words">
                <strong>Amount in words:</strong> {numberToWords(totals?.grandTotal || 0)}
            </div>

            {/* Notes & Terms */}
            {fieldVisibility.notes && notes && (
                <div className="inv-notes-section">
                    <div className="inv-party-label">Notes</div>
                    <p className="inv-small">{notes}</p>
                </div>
            )}
            {fieldVisibility.terms && termsConditions && (
                <div className="inv-notes-section">
                    <div className="inv-party-label">Terms & Conditions</div>
                    <p className="inv-small">{termsConditions}</p>
                </div>
            )}

            {/* Footer - Signatures */}
            {fieldVisibility.signature && (
                <div className="inv-footer">
                    <div className="inv-signature">
                        {client?.signatureData && (
                            <>
                                <img src={client.signatureData} alt="Client Signature" className="inv-sig-img" />
                                <div className="inv-sig-label">Client Signature</div>
                            </>
                        )}
                    </div>
                    <div className="inv-signature" style={{ textAlign: 'right' }}>
                        {branding.signature && (
                            <img src={branding.signature} alt="Authorized Signature" className="inv-sig-img" />
                        )}
                        {fieldVisibility.stamp && branding.stamp && (
                            <img src={branding.stamp} alt="Company Stamp" className="inv-stamp-img" />
                        )}
                        <div className="inv-sig-label">Authorized Signatory</div>
                        <div className="inv-small">{business?.businessName}</div>
                    </div>
                </div>
            )}
        </div>
    );
}
