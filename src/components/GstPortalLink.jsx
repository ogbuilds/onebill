import React from 'react';
import { ExternalLink } from 'lucide-react';

/**
 * GstPortalLink Component
 * Provides a direct link to the official GST search page
 * Use color: 'primary' or 'secondary' to match UI context
 */
export default function GstPortalLink({ gstin, className = '' }) {
    if (!gstin || gstin.length < 3) return null;

    // Official Search URL
    // Note: We can't deep link directly to the record, but we can point them to the right tool.
    const url = 'https://services.gst.gov.in/services/searchtp';

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`gst-portal-link ${className}`}
            title="Verify on Official GST Portal (Free)"
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                color: '#6C5CE7',
                textDecoration: 'none',
                fontWeight: '500',
                marginTop: '4px',
                transition: 'opacity 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
        >
            <ExternalLink size={12} />
            Verify on GST Portal (Free)
        </a>
    );
}
