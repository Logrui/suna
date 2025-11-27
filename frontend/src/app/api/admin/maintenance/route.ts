import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

async function checkAdmin(supabase: any, userId: string) {
    const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .in('role', ['admin', 'super_admin'])
        .maybeSingle();

    if (error || !data) {
        return false;
    }
    return true;
}

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const isAdmin = await checkAdmin(supabase, user.id);
        if (!isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { data, error } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'maintenance_mode')
            .single();

        if (error) {
            // If not found, assume disabled
            return NextResponse.json({ enabled: false });
        }

        return NextResponse.json(data.value);
    } catch (error) {
        console.error('Error fetching maintenance status:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const isAdmin = await checkAdmin(supabase, user.id);
        if (!isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { enabled } = body;

        if (typeof enabled !== 'boolean') {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const value = {
            enabled,
            updated_by: user.id,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('system_settings')
            .upsert({
                key: 'maintenance_mode',
                value: value,
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error('Error updating maintenance status:', error);
            return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
        }

        return NextResponse.json({ success: true, value });
    } catch (error) {
        console.error('Error updating maintenance status:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
