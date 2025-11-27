import { createClient } from '@/lib/supabase/client';

export type IMaintenanceNotice =
  | {
    enabled: true;
    startTime: string; // Date
    endTime: string; // Date
  }
  | {
    enabled: false;
    startTime?: undefined;
    endTime?: undefined;
  };

export const maintenanceNoticeFlag = async (): Promise<IMaintenanceNotice> => {
  try {
    const supabase = createClient();

    // Fetch maintenance settings from Supabase
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'maintenance_mode')
      .single();

    if (error || !data?.value) {
      // If table doesn't exist or no setting found, default to disabled
      return { enabled: false } as const;
    }

    const settings = data.value as any;
    const enabled = settings.enabled === true;

    if (!enabled) {
      return { enabled: false } as const;
    }

    // Optional: Support scheduled maintenance windows if present in JSON
    const startTimeRaw = settings.start_time;
    const endTimeRaw = settings.end_time;

    if (startTimeRaw && endTimeRaw) {
      const startTime = new Date(startTimeRaw);
      const endTime = new Date(endTimeRaw);

      if (!isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
        return {
          enabled: true,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        } as const;
      }
    }

    // If enabled but no specific time window, treat as active now
    return {
      enabled: true,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Default 24h
    } as const;

  } catch (cause) {
    console.error(
      new Error('Failed to get maintenance notice setting', { cause }),
    );
    return { enabled: false } as const;
  }
};