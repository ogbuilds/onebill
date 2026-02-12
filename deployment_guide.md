# Deployment Guide: OneBill on Vercel

OneBill is designed to be deployed on Vercel to leverage Serverless Functions for secure GSTIN/IFSC lookups.

## 1. Prerequisites
- A Vercel account.
- `GST_API_KEY` from Appyflow (or your chosen provider).

## 2. Deployment Steps
1. **Push to GitHub**: Ensure your latest changes are pushed to your repository.
2. **Import to Vercel**: Connect your repository to Vercel.
3. **Configure Environment Variables**:
   - Go to your Project Settings > Environment Variables.
   - Add `GST_API_KEY` with your Appyflow secret.
4. **Deploy**: Vercel will automatically detect `vercel.json` and the `api/` directory.

## 3. Configuration Details
- **SPA Routing**: Handled by `vercel.json` rewrites.
- **Serverless Functions**:
  - `/api/verify-gst`: Proxies GSTIN lookups.
  - `/api/verify-ifsc`: Proxies IFSC lookups via Razorpay.

## 4. Local Development
To test serverless functions locally:
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel dev` instead of `npm run dev`.
3. Create a `.env.local` file with your `GST_API_KEY`.
