import { INDIAN_STATES, getStateFromGSTIN } from '@logic/gstEngine';

const API_BASE_URL = 'https://appyflow.in/api/verifyGST';
// Note: This is a placeholder URL structure based on common patterns. 
// Real integration would need the exact endpoint from Appyflow docs or similar.
// For now we will implement a robust structure that takes the key and makes the request.

/**
 * Fetch business details from GSTIN using Appyflow (via serverless proxy)
 * @param {string} gstin - The GSTIN to verify
 * @returns {Promise<{legalName: string, tradeName: string, address: string, state: string, pincode: string}>}
 */
export async function fetchGSTDetails(gstin) {
    if (!gstin) {
        throw new Error('GSTIN is required');
    }

    // Basic format validation
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstRegex.test(gstin)) {
        throw new Error('Invalid GSTIN format');
    }

    try {
        // Points to our Vercel Serverless Function which holds the API Key securely
        const response = await fetch(`/api/verify-gst?gstNo=${gstin}`);

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `API Error: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.message || 'Failed to fetch GST details');
        }

        // Map the response to our internal format
        // Supports various structures from different API versions/providers
        const taxpayer = data.taxpayerInfo || data.taxpayer || (data.data && data.data.taxpayer) || data;

        // Try to find the address object in various common locations
        const addrObj = taxpayer.pradr?.addr || taxpayer.address_details || taxpayer.address || {};

        // Helper to construct address
        const buildAddress = (obj) => {
            if (!obj) return '';
            const parts = [
                obj.bno, obj.bnm, // Building no/name
                obj.st, obj.loc, // Street, Locality
                obj.city, obj.dst, // City, District
            ];
            return parts.filter(p => p).join(', ');
        };

        // Normalize State: API might return "PUNJAB" or "03"
        let stateName = '';
        const rawState = addrObj.stcd || '';

        // Try mapping by name first (case insensitive)
        const stateFromName = INDIAN_STATES.find(s => s.name.toLowerCase() === rawState.toLowerCase());
        if (stateFromName) {
            stateName = stateFromName.name;
        } else {
            // Try mapping by code
            const stateFromCode = INDIAN_STATES.find(s => s.code === rawState);
            if (stateFromCode) stateName = stateFromCode.name;
        }

        // SANITY CHECK: The GSTIN first 2 digits are the absolute truth
        const stateFromGstin = getStateFromGSTIN(gstin);
        if (stateFromGstin && stateName !== stateFromGstin.name) {
            console.warn(`GST API returned state ${stateName} but GSTIN indicates ${stateFromGstin.name}. Prioritizing GSTIN.`);
            stateName = stateFromGstin.name;
        }

        return {
            legalName: taxpayer.lgnm || taxpayer.tradeName || '',
            tradeName: taxpayer.tradeNam || '',
            address: buildAddress(addrObj),
            state: stateName || stateFromGstin?.name || '',
            pincode: addrObj.pncd || ''
        };

    } catch (error) {
        console.error('GST Fetch Error:', error);
        throw error;
    }
}

/**
 * Fetch bank details from IFSC code
 * Uses Razorpay IFSC API (CORS enabled)
 */
export async function fetchBankDetails(ifsc) {
    if (!ifsc) return null;
    try {
        // Call our serverless proxy
        const response = await fetch(`/api/verify-ifsc?ifsc=${ifsc}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data; // { BANK, BRANCH, CITY, STATE, ... }
    } catch (error) {
        console.error('IFSC Fetch Error:', error);
        return null;
    }
}

/**
 * Fetch city/state from Pincode
 * Uses public API (postalpincode.in)
 */
export async function fetchPincodeDetails(pincode) {
    if (!pincode || pincode.length < 6) return null;
    try {
        const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
        if (!response.ok) return null;
        const data = await response.json();
        if (data && data[0] && data[0].Status === 'Success') {
            const details = data[0].PostOffice[0];
            return {
                city: details.District,
                state: details.State,
                country: 'India'
            };
        }
        return null;
    } catch (e) {
        console.error("Pincode Fetch Error", e);
        return null;
    }
}
