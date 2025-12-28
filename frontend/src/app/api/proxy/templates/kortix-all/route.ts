import { NextRequest, NextResponse } from 'next/server';

// Production API for public templates
const PRODUCTION_API_URL = 'https://api.kortix.com/v1';

/**
 * Proxy route for fetching Kortix official templates from production API
 * This bypasses CORS issues when running locally
 */
export async function GET(request: NextRequest) {
    const url = `${PRODUCTION_API_URL}/templates/kortix-all`;

    try {
        // Forward the authorization header if present
        const authHeader = request.headers.get('Authorization');
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        if (authHeader) {
            headers['Authorization'] = authHeader;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers,
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
            return NextResponse.json(
                { error: errorData.message || `HTTP ${response.status}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Proxy error for kortix-all templates:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch Kortix templates' },
            { status: 500 }
        );
    }
}
