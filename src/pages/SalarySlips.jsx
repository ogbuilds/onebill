import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useBusiness } from '@contexts/BusinessContext';
import { useToast } from '@contexts/ToastContext';
import {
    getEmployeesByBusiness, createEmployee, updateEmployee, deleteEmployee,
    getSalarySlipsByBusiness, createSalarySlip, updateSalarySlip, deleteSalarySlip, getEmployeeById
} from '@db/operations';
import { formatCurrency } from '@logic/gstEngine';
import {
    Plus, Trash2, X, Save, Download, Search, User, Calendar, FileText, Wallet, Eye, Edit2
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import './SalarySlips.css';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const EMPTY_EARNINGS = { basicSalary: 0, hra: 0, conveyance: 0, specialAllowance: 0, medicalAllowance: 0, otherEarnings: 0 };
const EMPTY_DEDUCTIONS = { pf: 0, esi: 0, professionalTax: 0, tds: 0, otherDeductions: 0 };

function calcTDS(annualIncome) {
    // FY2025-26 new regime (simplified)
    if (annualIncome <= 300000) return 0;
    if (annualIncome <= 700000) return Math.round((annualIncome - 300000) * 0.05 / 12);
    if (annualIncome <= 1000000) return Math.round(((annualIncome - 700000) * 0.10 + 400000 * 0.05) / 12);
    if (annualIncome <= 1200000) return Math.round(((annualIncome - 1000000) * 0.15 + 300000 * 0.10 + 400000 * 0.05) / 12);
    if (annualIncome <= 1500000) return Math.round(((annualIncome - 1200000) * 0.20 + 200000 * 0.15 + 300000 * 0.10 + 400000 * 0.05) / 12);
    return Math.round(((annualIncome - 1500000) * 0.30 + 300000 * 0.20 + 200000 * 0.15 + 300000 * 0.10 + 400000 * 0.05) / 12);
}

export default function SalarySlips() {
    const { currentBusiness } = useBusiness();
    const toast = useToast();
    const [employees, setEmployees] = useState([]);
    const [slips, setSlips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [showEmployeeModal, setShowEmployeeModal] = useState(false);
    const [selectedSlip, setSelectedSlip] = useState(null);
    const previewRef = useRef(null);

    // Form state
    const [empId, setEmpId] = useState('');
    const [month, setMonth] = useState(new Date().getMonth());
    const [year, setYear] = useState(new Date().getFullYear());
    const [earnings, setEarnings] = useState({ ...EMPTY_EARNINGS });
    const [deductions, setDeductions] = useState({ ...EMPTY_DEDUCTIONS });
    const [autoTDS, setAutoTDS] = useState(true);

    useEffect(() => {
        if (!currentBusiness?.id) return;
        const load = async () => {
            const [emps, sl] = await Promise.all([
                getEmployeesByBusiness(currentBusiness.id),
                getSalarySlipsByBusiness(currentBusiness.id),
            ]);
            setEmployees(emps);
            setSlips(sl);
            setLoading(false);
        };
        load();
    }, [currentBusiness?.id]);

    const totalEarnings = useMemo(() => Object.values(earnings).reduce((s, v) => s + (Number(v) || 0), 0), [earnings]);
    const totalDeductions = useMemo(() => Object.values(deductions).reduce((s, v) => s + (Number(v) || 0), 0), [deductions]);
    const netPay = totalEarnings - totalDeductions;

    useEffect(() => {
        if (autoTDS && totalEarnings > 0) {
            const annual = totalEarnings * 12;
            setDeductions(d => ({ ...d, tds: calcTDS(annual) }));
        }
    }, [totalEarnings, autoTDS]);

    const selectedEmployee = employees.find(e => e.id === Number(empId));

    const handleSave = async () => {
        if (!empId) { toast.error('Select an employee'); return; }
        try {
            const data = {
                businessId: currentBusiness.id,
                employeeId: Number(empId),
                month, year,
                earnings, deductions,
                totalEarnings, totalDeductions, netPay,
                status: 'final',
            };
            if (selectedSlip?.id) {
                await updateSalarySlip(selectedSlip.id, data);
                toast.success('Salary slip updated!');
            } else {
                await createSalarySlip(data);
                toast.success('Salary slip created!');
            }
            const sl = await getSalarySlipsByBusiness(currentBusiness.id);
            setSlips(sl);
            resetForm();
        } catch (err) {
            toast.error(err.message || 'Failed to save.');
        }
    };

    const resetForm = () => {
        setShowForm(false);
        setSelectedSlip(null);
        setEmpId('');
        setEarnings({ ...EMPTY_EARNINGS });
        setDeductions({ ...EMPTY_DEDUCTIONS });
    };

    const editSlip = (slip) => {
        setSelectedSlip(slip);
        setEmpId(String(slip.employeeId));
        setMonth(slip.month);
        setYear(slip.year);
        setEarnings(slip.earnings || { ...EMPTY_EARNINGS });
        setDeductions(slip.deductions || { ...EMPTY_DEDUCTIONS });
        setShowForm(true);
    };

    const handleDeleteSlip = async (id) => {
        await deleteSalarySlip(id);
        setSlips(slips.filter(s => s.id !== id));
        toast.success('Deleted');
    };

    const downloadPDF = async () => {
        const el = previewRef.current;
        if (!el) return;
        try {
            const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#fff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const w = pdf.internal.pageSize.getWidth();
            const h = (canvas.height * w) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, w, h);
            pdf.save(`Salary_${MONTHS[month]}_${year}_${selectedEmployee?.name || 'slip'}.pdf`);
            toast.success('PDF downloaded!');
        } catch (err) {
            toast.error('Failed to generate PDF.');
        }
    };

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '100px' }}><div className="spinner spinner-lg" /></div>;
    }

    return (
        <div className="salary-slips-page">
            <div className="page-header">
                <div>
                    <h1><Wallet size={24} /> Salary Slips</h1>
                    <p className="subtitle">Generate legally compliant salary slips for employees</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button className="btn btn-secondary" onClick={() => setShowEmployeeModal(true)}>
                        <User size={14} /> Manage Employees
                    </button>
                    <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
                        <Plus size={14} /> New Salary Slip
                    </button>
                </div>
            </div>

            {/* List */}
            {!showForm && (
                <div className="card" style={{ padding: 'var(--space-4)' }}>
                    {slips.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-tertiary)' }}>
                            <Wallet size={40} style={{ opacity: 0.3, marginBottom: 'var(--space-3)' }} />
                            <p>No salary slips yet. Create your first one!</p>
                        </div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th>Period</th>
                                    <th className="right">Net Pay</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {slips.map(slip => {
                                    const emp = employees.find(e => e.id === slip.employeeId);
                                    return (
                                        <tr key={slip.id}>
                                            <td><strong>{emp?.name || 'Unknown'}</strong><br /><span className="text-secondary">{emp?.designation}</span></td>
                                            <td>{MONTHS[slip.month]} {slip.year}</td>
                                            <td className="right"><strong>{formatCurrency(slip.netPay || 0)}</strong></td>
                                            <td><span className={`status-badge status-${slip.status}`}>{slip.status}</span></td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => editSlip(slip)}><Edit2 size={14} /></button>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteSlip(slip.id)}><Trash2 size={14} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Form */}
            {showForm && (
                <div className="salary-form-layout">
                    <div className="salary-form-container">
                        <div className="form-section">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                                <h3 className="form-section-title" style={{ marginBottom: 0 }}>
                                    <FileText size={16} /> {selectedSlip ? 'Edit' : 'New'} Salary Slip
                                </h3>
                                <button className="btn btn-ghost btn-sm" onClick={resetForm}><X size={14} /> Cancel</button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                                <div className="form-group">
                                    <label className="form-label">Employee <span className="required">*</span></label>
                                    <select className="form-select" value={empId} onChange={e => setEmpId(e.target.value)}>
                                        <option value="">Select Employee</option>
                                        {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.designation}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Month</label>
                                    <select className="form-select" value={month} onChange={e => setMonth(Number(e.target.value))}>
                                        {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Year</label>
                                    <input type="number" className="form-input" value={year} onChange={e => setYear(Number(e.target.value))} min={2020} max={2030} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
                                {/* Earnings */}
                                <div>
                                    <h4 style={{ color: 'var(--color-success)', marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>💰 Earnings</h4>
                                    {Object.entries(earnings).map(([key, val]) => (
                                        <div key={key} className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
                                            <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>
                                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                                            </label>
                                            <input type="number" className="form-input" value={val} onChange={e => setEarnings(p => ({ ...p, [key]: Number(e.target.value) }))} min="0" />
                                        </div>
                                    ))}
                                    <div style={{ borderTop: '2px solid var(--color-success)', marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                                        <span>Total Earnings</span>
                                        <span style={{ color: 'var(--color-success)' }}>{formatCurrency(totalEarnings)}</span>
                                    </div>
                                </div>

                                {/* Deductions */}
                                <div>
                                    <h4 style={{ color: 'var(--color-danger)', marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>📉 Deductions</h4>
                                    {Object.entries(deductions).map(([key, val]) => (
                                        <div key={key} className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
                                            <label className="form-label" style={{ fontSize: 'var(--font-size-xs)', display: 'flex', justifyContent: 'space-between' }}>
                                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                                                {key === 'tds' && (
                                                    <label style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                                        <input type="checkbox" checked={autoTDS} onChange={e => setAutoTDS(e.target.checked)} /> Auto
                                                    </label>
                                                )}
                                            </label>
                                            <input type="number" className="form-input" value={val} onChange={e => setDeductions(p => ({ ...p, [key]: Number(e.target.value) }))} min="0" disabled={key === 'tds' && autoTDS} />
                                        </div>
                                    ))}
                                    <div style={{ borderTop: '2px solid var(--color-danger)', marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                                        <span>Total Deductions</span>
                                        <span style={{ color: 'var(--color-danger)' }}>{formatCurrency(totalDeductions)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Net Pay */}
                            <div style={{ background: 'var(--color-primary-bg)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', marginTop: 'var(--space-5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)' }}>Net Pay</span>
                                <span style={{ fontWeight: 800, fontSize: 'var(--font-size-xl)', color: 'var(--color-primary)' }}>{formatCurrency(netPay)}</span>
                            </div>

                            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
                                <button className="btn btn-secondary" onClick={resetForm}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleSave}>
                                    <Save size={14} /> {selectedSlip ? 'Update' : 'Create'} Salary Slip
                                </button>
                                {selectedEmployee && (
                                    <button className="btn btn-ghost" onClick={downloadPDF}>
                                        <Download size={14} /> Download PDF
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Preview */}
                    {selectedEmployee && (
                        <div className="salary-preview-container">
                            <h3 style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--space-3)' }}>Preview</h3>
                            <div className="salary-preview-scroll" ref={previewRef}>
                                <div className="ss-preview">
                                    <div className="ss-header">
                                        <h2>{currentBusiness?.businessName || 'Company'}</h2>
                                        {currentBusiness?.address && <p className="ss-small">{currentBusiness.address}</p>}
                                        <div className="ss-title">SALARY SLIP</div>
                                        <div className="ss-period">{MONTHS[month]} {year}</div>
                                    </div>
                                    <div className="ss-emp-details">
                                        <div className="ss-emp-row"><span>Employee Name</span><strong>{selectedEmployee.name}</strong></div>
                                        <div className="ss-emp-row"><span>Designation</span><strong>{selectedEmployee.designation || '-'}</strong></div>
                                        {selectedEmployee.employeeId && <div className="ss-emp-row"><span>Employee ID</span><strong>{selectedEmployee.employeeId}</strong></div>}
                                        {selectedEmployee.pan && <div className="ss-emp-row"><span>PAN</span><strong style={{ fontFamily: 'monospace' }}>{selectedEmployee.pan}</strong></div>}
                                    </div>
                                    <div className="ss-breakdown">
                                        <div className="ss-column">
                                            <div className="ss-col-header" style={{ color: '#10B981' }}>Earnings</div>
                                            {Object.entries(earnings).map(([k, v]) => v > 0 && (
                                                <div key={k} className="ss-line"><span>{k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span><span>{formatCurrency(v)}</span></div>
                                            ))}
                                            <div className="ss-line ss-line-total"><span>Total</span><span>{formatCurrency(totalEarnings)}</span></div>
                                        </div>
                                        <div className="ss-column">
                                            <div className="ss-col-header" style={{ color: '#EF4444' }}>Deductions</div>
                                            {Object.entries(deductions).map(([k, v]) => v > 0 && (
                                                <div key={k} className="ss-line"><span>{k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span><span>{formatCurrency(v)}</span></div>
                                            ))}
                                            <div className="ss-line ss-line-total"><span>Total</span><span>{formatCurrency(totalDeductions)}</span></div>
                                        </div>
                                    </div>
                                    <div className="ss-net-pay">
                                        <span>Net Pay</span>
                                        <strong>{formatCurrency(netPay)}</strong>
                                    </div>
                                    <div className="ss-footer">
                                        <div>This is a computer-generated document and does not require a signature.</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Employee Modal */}
            {showEmployeeModal && (
                <EmployeeModal
                    businessId={currentBusiness?.id}
                    employees={employees}
                    onClose={() => setShowEmployeeModal(false)}
                    onRefresh={async () => {
                        const emps = await getEmployeesByBusiness(currentBusiness.id);
                        setEmployees(emps);
                    }}
                />
            )}
        </div>
    );
}

function EmployeeModal({ businessId, employees, onClose, onRefresh }) {
    const toast = useToast();
    const [form, setForm] = useState({ name: '', email: '', designation: '', pan: '', employeeId: '' });
    const [saving, setSaving] = useState(false);
    const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleAdd = async () => {
        if (!form.name) { toast.error('Name is required'); return; }
        setSaving(true);
        try {
            await createEmployee({ ...form, businessId });
            toast.success('Employee added!');
            setForm({ name: '', email: '', designation: '', pan: '', employeeId: '' });
            onRefresh();
        } catch (err) { toast.error(err.message); }
        setSaving(false);
    };

    const handleDelete = async (id) => {
        await deleteEmployee(id);
        toast.success('Employee removed');
        onRefresh();
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
                <div className="modal-header">
                    <h2><User size={18} /> Manage Employees</h2>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
                </div>
                <div className="modal-body">
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                        <h4 style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)' }}>Add Employee</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                            <input className="form-input" value={form.name} onChange={e => update('name', e.target.value)} placeholder="Full Name *" />
                            <input className="form-input" value={form.designation} onChange={e => update('designation', e.target.value)} placeholder="Designation" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                            <input className="form-input" value={form.email} onChange={e => update('email', e.target.value)} placeholder="Email" />
                            <input className="form-input" value={form.pan} onChange={e => update('pan', e.target.value.toUpperCase())} placeholder="PAN" maxLength={10} style={{ fontFamily: 'monospace' }} />
                            <input className="form-input" value={form.employeeId} onChange={e => update('employeeId', e.target.value)} placeholder="Employee ID" />
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={saving}>{saving ? '...' : <><Plus size={14} /> Add</>}</button>
                    </div>

                    {employees.length > 0 && (
                        <div>
                            <h4 style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>Current Employees</h4>
                            {employees.map(e => (
                                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border-light)' }}>
                                    <div>
                                        <strong>{e.name}</strong> <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>{e.designation} {e.pan && `• PAN: ${e.pan}`}</span>
                                    </div>
                                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(e.id)}><Trash2 size={14} /></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Done</button>
                </div>
            </div>
        </div>
    );
}
