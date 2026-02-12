export default async function handler(request, response) {
    const { gstNo } = request.query;
    const apiKey = process.env.GST_API_KEY;

    if (!apiKey) {
        return response.status(500).json({ error: true, message: 'Server misconfigured: Missing API Key' });
    }

    if (!gstNo) {
        return response.status(400).json({ error: true, message: 'GSTIN is required' });
    }

    try {
        // Using Appyflow as the provider
        const url = `https://appyflow.in/api/verifyGST?gstNo=${gstNo}&key_secret=${apiKey}`;

        const apiRes = await fetch(url);
        const data = await apiRes.json();

        if (data.error) {
            return response.status(400).json(data);
        }

        return response.status(200).json(data);
    } catch (error) {
        return response.status(500).json({ error: true, message: 'Internal Server Error', details: error.message });
    }
}
