import Tesseract from 'tesseract.js';

/**
 * Analyzes a payment screenshot to verify details against an invoice.
 * @param {string} imageBase64 - The base64 string of the uploaded image.
 * @param {object} invoice - The invoice object to compare against.
 * @returns {Promise<object>} - Analysis result { confidence, status, extracted, matchDetails }
 */
export async function analyzePaymentScreenshot(imageBase64, invoice) {
    try {
        console.log('Starting OCR analysis...');
        const result = await Tesseract.recognize(
            imageBase64,
            'eng',
            { logger: m => console.log(m) }
        );

        const text = result.data.text.toLowerCase();
        console.log('OCR Text:', text);

        // Extraction Heuristics
        const analysis = {
            foundAmount: false,
            foundDate: false,
            foundUpiRef: false,
            foundPayee: false,
            confidence: result.data.confidence,
            extracted: {
                amount: null,
                date: null,
                utr: null
            }
        };

        // 1. Amount Extraction & Matching
        // Look for numbers that match the invoice total/subtotal
        // Regex for currency: ₹? ?[0-9,]+(\.[0-9]{2})?
        // We clean the text and look for the specific amount string
        const amountStr = invoice.grandTotal.toFixed(2);
        const amountParts = amountStr.split('.');
        // Check for exact match or formatted match
        if (text.includes(amountStr) || text.includes(`₹${amountStr}`) || text.includes(amountStr.replace('.', ''))) {
            analysis.foundAmount = true;
            analysis.extracted.amount = invoice.grandTotal;
        }

        // 2. Date Extraction
        // Look for the payment date (today or recent)
        // Simple check for today's date formats
        const today = new Date();
        const dateFormats = [
            today.toLocaleDateString('en-IN'), // dd/mm/yyyy
            today.toISOString().split('T')[0], // yyyy-mm-dd
            today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase(), // Dec 12
        ];

        if (dateFormats.some(fmt => text.includes(fmt))) {
            analysis.foundDate = true;
            analysis.extracted.date = today.toISOString();
        }

        // 3. UTR / Ref Number Extraction
        // Look for 12 digit numbers common in UPI
        const utrRegex = /\b\d{12}\b/g;
        const utrMatches = text.match(utrRegex);
        if (utrMatches && utrMatches.length > 0) {
            analysis.foundUpiRef = true;
            analysis.extracted.utr = utrMatches[0];
        }

        // 4. Success Keywords
        const successKeywords = ['successful', 'paid', 'success', 'completed', 'payment done'];
        const foundSuccess = successKeywords.some(kw => text.includes(kw));

        // Scoring
        let score = 0;
        if (analysis.foundAmount) score += 40;
        if (foundSuccess) score += 20;
        if (analysis.foundUpiRef) score += 20;
        if (analysis.foundDate) score += 10;
        if (analysis.confidence > 70) score += 10;

        // Verdict
        let verdict = 'manual_review';
        if (score >= 80) verdict = 'verified';
        else if (score < 40) verdict = 'failed';

        return {
            status: verdict,
            score,
            ...analysis
        };

    } catch (error) {
        console.error('OCR Error:', error);
        return {
            status: 'error',
            error: error.message,
            score: 0
        };
    }
}
