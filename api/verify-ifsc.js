export default async function handler(request, response) {
    const { ifsc } = request.query;

    if (!ifsc) {
        return response.status(400).json({ error: true, message: 'IFSC is required' });
    }

    try {
        const url = `https://ifsc.razorpay.com/${ifsc}`;

        const apiRes = await fetch(url);

        if (!apiRes.ok) {
            return response.status(404).json({ error: true, message: 'Invalid IFSC Code' });
        }

        const data = await apiRes.json();
        return response.status(200).json(data);
    } catch (error) {
        return response.status(500).json({ error: true, message: 'Internal Server Error', details: error.message });
    }
}
