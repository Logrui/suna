import { NextRequest, NextResponse } from 'next/server';

// Production API for public templates
const PRODUCTION_API_URL = 'https://api.kortix.com/v1';

interface RouteParams {
    params: Promise<{
        templateId: string;
    }>;
}

/**
 * Proxy route for fetching individual public templates from production API
 * This bypasses CORS issues when running locally
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { templateId } = await params;

    if (!templateId) {
        return NextResponse.json(
            { error: 'Template ID is required' },
            { status: 400 }
        );
    }

    const url = `${PRODUCTION_API_URL}/templates/public/${templateId}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
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
        console.error('Proxy error for public template:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch template' },
            { status: 500 }
        );
    }
}
