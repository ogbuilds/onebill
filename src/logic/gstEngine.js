/**
 * OneBill GST Calculation Engine
 * Handles Indian GST logic: CGST/SGST (intra-state) and IGST (inter-state)
 */

// Standard GST rates in India
export const GST_RATES = [0, 5, 12, 18, 28];

// Indian states and union territories with their codes
export const INDIAN_STATES = [
    { code: '01', name: 'Jammu & Kashmir' },
    { code: '02', name: 'Himachal Pradesh' },
    { code: '03', name: 'Punjab' },
    { code: '04', name: 'Chandigarh' },
    { code: '05', name: 'Uttarakhand' },
    { code: '06', name: 'Haryana' },
    { code: '07', name: 'Delhi' },
    { code: '08', name: 'Rajasthan' },
    { code: '09', name: 'Uttar Pradesh' },
    { code: '10', name: 'Bihar' },
    { code: '11', name: 'Sikkim' },
    { code: '12', name: 'Arunachal Pradesh' },
    { code: '13', name: 'Nagaland' },
    { code: '14', name: 'Manipur' },
    { code: '15', name: 'Mizoram' },
    { code: '16', name: 'Tripura' },
    { code: '17', name: 'Meghalaya' },
    { code: '18', name: 'Assam' },
    { code: '19', name: 'West Bengal' },
    { code: '20', name: 'Jharkhand' },
    { code: '21', name: 'Odisha' },
    { code: '22', name: 'Chhattisgarh' },
    { code: '23', name: 'Madhya Pradesh' },
    { code: '24', name: 'Gujarat' },
    { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' },
    { code: '27', name: 'Maharashtra' },
    { code: '28', name: 'Andhra Pradesh (Old)' },
    { code: '29', name: 'Karnataka' },
    { code: '30', name: 'Goa' },
    { code: '31', name: 'Lakshadweep' },
    { code: '32', name: 'Kerala' },
    { code: '33', name: 'Tamil Nadu' },
    { code: '34', name: 'Puducherry' },
    { code: '35', name: 'Andaman & Nicobar Islands' },
    { code: '36', name: 'Telangana' },
    { code: '37', name: 'Andhra Pradesh' },
    { code: '38', name: 'Ladakh' },
    { code: '97', name: 'Other Territory' },
];

/**
 * Get state code from GSTIN (first 2 digits)
 */
export function getStateCodeFromGSTIN(gstin) {
    if (!gstin || gstin.length < 2) return null;
    return gstin.substring(0, 2);
}

/**
 * Determine Place of Supply
 * Uses GSTIN state code if available, otherwise falls back to state name match
 */
export function getPlaceOfSupply({ businessGstin, clientGstin, businessState, clientState }) {
    // 1. Try to get states from GSTINs
    const businessStateCode = getStateCodeFromGSTIN(businessGstin);
    const clientStateCode = getStateCodeFromGSTIN(clientGstin);

    if (businessStateCode && clientStateCode) {
        const bState = INDIAN_STATES.find(s => s.code === businessStateCode);
        const cState = INDIAN_STATES.find(s => s.code === clientStateCode);
        return {
            isIntraState: businessStateCode === clientStateCode,
            placeOfSupply: cState ? cState.name : (clientState || 'Unknown'),
            placeOfSupplyCode: clientStateCode,
            businessStateName: bState ? bState.name : (businessState || 'Unknown'),
            clientStateName: cState ? cState.name : (clientState || 'Unknown')
        };
    }

    // 2. Fallback to name-based comparison
    const isIntra = isIntraState(businessState, clientState);
    return {
        isIntraState: isIntra,
        placeOfSupply: clientState || 'Unknown',
        placeOfSupplyCode: null,
        businessStateName: businessState,
        clientStateName: clientState
    };
}

/**
 * Determine if a transaction is intra-state or inter-state
 * @deprecated Use getPlaceOfSupply where possible
 */
export function isIntraState(businessState, clientState) {
    if (!businessState || !clientState) return true; // default to intra-state
    return businessState.toLowerCase() === clientState.toLowerCase();
}

/**
 * Calculate GST for a single line item
 * @param {Object} params
 * @param {boolean} params.isIntraState - Pre-calculated intra-state flag
 * @param {number} params.taxableAmount - Amount before tax
 * @param {number} params.gstRate - GST rate percentage (e.g., 18)
 * @returns {Object} { cgst, sgst, igst, totalTax, totalWithTax }
 */
export function calculateLineItemGST({ isIntraState, taxableAmount, gstRate }) {
    const amount = Number(taxableAmount) || 0;
    const rate = Number(gstRate) || 0;

    if (rate === 0 || amount === 0) {
        return { cgst: 0, sgst: 0, igst: 0, totalTax: 0, totalWithTax: amount };
    }

    if (isIntraState) {
        const halfRate = rate / 2;
        const cgst = roundToTwo(amount * halfRate / 100);
        const sgst = roundToTwo(amount * halfRate / 100);
        return {
            cgst,
            sgst,
            igst: 0,
            totalTax: cgst + sgst,
            totalWithTax: amount + cgst + sgst,
        };
    } else {
        const igst = roundToTwo(amount * rate / 100);
        return {
            cgst: 0,
            sgst: 0,
            igst,
            totalTax: igst,
            totalWithTax: amount + igst,
        };
    }
}

/**
 * Calculate complete invoice totals from line items
 * @param {Object} params
 * @param {string} params.businessGstin - (Optional) Business GSTIN
 * @param {string} params.clientGstin - (Optional) Client GSTIN
 * @param {string} params.businessState - Business state name fallback
 * @param {string} params.clientState - Client state name fallback
 * @param {Array} params.lineItems - Array of { taxableAmount, gstRate, quantity, unitPrice, discount }
 * @param {boolean} params.isGST - Whether GST applies
 * @param {boolean} params.roundOff - Whether to round off the total
 * @returns {Object} Complete invoice calculations
 */
export function calculateInvoiceTotals({
    businessGstin, clientGstin, businessState, clientState,
    lineItems, isGST = true, roundOff = true
}) {
    let subtotal = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;

    // Determine GST Type (Intra vs Inter)
    const { isIntraState: isIntra, placeOfSupply, placeOfSupplyCode } = getPlaceOfSupply({
        businessGstin, clientGstin, businessState, clientState
    });

    const calculatedItems = lineItems.map(item => {
        const qty = Number(item.quantity) || 0;
        const unitPrice = Number(item.unitPrice) || 0;
        const discount = Number(item.discount) || 0;
        const lineSubtotal = roundToTwo(qty * unitPrice);
        const discountAmount = roundToTwo(lineSubtotal * discount / 100);
        const taxableAmount = roundToTwo(lineSubtotal - discountAmount);

        subtotal += taxableAmount;

        let gstResult = { cgst: 0, sgst: 0, igst: 0, totalTax: 0, totalWithTax: taxableAmount };

        if (isGST) {
            gstResult = calculateLineItemGST({
                isIntraState: isIntra,
                taxableAmount,
                gstRate: item.gstRate || 0,
            });
            totalCGST += gstResult.cgst;
            totalSGST += gstResult.sgst;
            totalIGST += gstResult.igst;
        }

        return {
            ...item,
            lineSubtotal,
            discountAmount,
            taxableAmount,
            ...gstResult,
            lineTotal: gstResult.totalWithTax,
        };
    });

    subtotal = roundToTwo(subtotal);
    totalCGST = roundToTwo(totalCGST);
    totalSGST = roundToTwo(totalSGST);
    totalIGST = roundToTwo(totalIGST);

    const totalTax = roundToTwo(totalCGST + totalSGST + totalIGST);
    const totalBeforeRound = roundToTwo(subtotal + totalTax);

    let roundOffAmount = 0;
    let grandTotal = totalBeforeRound;

    if (roundOff) {
        grandTotal = Math.round(totalBeforeRound);
        roundOffAmount = roundToTwo(grandTotal - totalBeforeRound);
    }

    return {
        lineItems: calculatedItems,
        subtotal,
        cgst: totalCGST,
        sgst: totalSGST,
        igst: totalIGST,
        totalTax,
        roundOff: roundOffAmount,
        grandTotal,
        isIntraState: isIntra,
        placeOfSupply,
        placeOfSupplyCode
    };
}

/**
 * Validate GSTIN format (15-character alphanumeric)
 * Format: 2-digit state code + 10-digit PAN + entity number + Z + checksum
 */
export function validateGSTIN(gstin) {
    if (!gstin) return { valid: false, error: 'GSTIN is required' };

    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(gstin.toUpperCase())) {
        return { valid: false, error: 'Invalid GSTIN format. Expected: 22AAAAA0000A1Z5' };
    }

    const stateCode = gstin.substring(0, 2);
    const validState = INDIAN_STATES.find(s => s.code === stateCode);
    if (!validState) {
        return { valid: false, error: `Invalid state code: ${stateCode}` };
    }

    return { valid: true, stateCode, stateName: validState.name };
}

/**
 * Extract state from GSTIN
 */
export function getStateFromGSTIN(gstin) {
    if (!gstin || gstin.length < 2) return null;
    const stateCode = gstin.substring(0, 2);
    return INDIAN_STATES.find(s => s.code === stateCode) || null;
}

/**
 * Common HSN/SAC codes for quick lookup
 */
export const COMMON_HSN_SAC = [
    { code: '998311', description: 'Management consulting', type: 'service', defaultRate: 18 },
    { code: '998312', description: 'Business consulting', type: 'service', defaultRate: 18 },
    { code: '998313', description: 'IT consulting', type: 'service', defaultRate: 18 },
    { code: '998314', description: 'IT design & development', type: 'service', defaultRate: 18 },
    { code: '998315', description: 'Hosting & IT infrastructure', type: 'service', defaultRate: 18 },
    { code: '998316', description: 'IT support services', type: 'service', defaultRate: 18 },
    { code: '998361', description: 'Graphic design services', type: 'service', defaultRate: 18 },
    { code: '998362', description: 'Photography services', type: 'service', defaultRate: 18 },
    { code: '998363', description: 'Video production', type: 'service', defaultRate: 18 },
    { code: '998364', description: 'Content writing', type: 'service', defaultRate: 18 },
    { code: '998365', description: 'Translation services', type: 'service', defaultRate: 18 },
    { code: '998371', description: 'Advertising services', type: 'service', defaultRate: 18 },
    { code: '998391', description: 'Accounting & audit', type: 'service', defaultRate: 18 },
    { code: '998392', description: 'Tax preparation', type: 'service', defaultRate: 18 },
    { code: '998393', description: 'Legal services', type: 'service', defaultRate: 18 },
    { code: '997212', description: 'Renting of residential', type: 'service', defaultRate: 0 },
    { code: '997213', description: 'Renting of commercial', type: 'service', defaultRate: 18 },
    { code: '4901', description: 'Printed books', type: 'goods', defaultRate: 0 },
    { code: '8471', description: 'Computers', type: 'goods', defaultRate: 18 },
    { code: '8517', description: 'Mobile phones', type: 'goods', defaultRate: 12 },
    { code: '9403', description: 'Furniture', type: 'goods', defaultRate: 18 },
    { code: '6109', description: 'T-shirts', type: 'goods', defaultRate: 5 },
];

/**
 * Round to 2 decimal places
 */
function roundToTwo(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Format currency (INR by default)
 */
export function formatCurrency(amount, currency = 'INR') {
    const num = Number(amount) || 0;
    if (currency === 'INR') {
        return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num);
}

/**
 * Convert number to Indian words (for amount in words on invoice)
 */
export function numberToWords(num) {
    if (num === 0) return 'Zero';

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const wholePart = Math.floor(num);
    const paise = Math.round((num - wholePart) * 100);

    function convertToWords(n) {
        if (n === 0) return '';
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
        if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convertToWords(n % 100) : '');
        if (n < 100000) return convertToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convertToWords(n % 1000) : '');
        if (n < 10000000) return convertToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convertToWords(n % 100000) : '');
        return convertToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convertToWords(n % 10000000) : '');
    }

    let result = convertToWords(wholePart) + ' Rupees';
    if (paise > 0) {
        result += ' and ' + convertToWords(paise) + ' Paise';
    }
    result += ' Only';
    return result;
}

/**
 * Determine performance label based on growth comparison
 */
export function getPerformanceLabel(currentValue, previousValue) {
    if (previousValue === 0 && currentValue > 0) {
        return { label: 'High Growth Potential', type: 'positive' };
    }
    if (previousValue === 0 && currentValue === 0) {
        return { label: 'Can Be Improved', type: 'neutral' };
    }

    const growth = ((currentValue - previousValue) / previousValue) * 100;

    if (growth >= 20) return { label: 'Better', type: 'positive' };
    if (growth >= 0) return { label: 'Can Be Improved', type: 'neutral' };
    if (growth >= -20) return { label: 'Worse', type: 'negative' };
    return { label: 'High Growth Potential', type: 'neutral' };
}
