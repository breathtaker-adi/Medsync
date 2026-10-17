import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseServiceKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY missing');
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 0. Security Verification: Ensure caller provided the service-role key
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token || token !== supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Service role key required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Mark overdue pending doses as missed using India IST (Asia/Kolkata) timezone
    const nowInKolkata = new Date();
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(nowInKolkata);

    const currentTimeStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(nowInKolkata);

    // Update pending logs from past dates or earlier today
    await adminClient
      .from('medication_logs')
      .update({ status: 'missed' })
      .eq('status', 'pending')
      .or(`log_date.lt.${today},and(log_date.eq.${today},scheduled_time.lt.${currentTimeStr})`);

    // 2. Fetch all missed logs from the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(sevenDaysAgo);

    const { data: missedLogs, error: missedError } = await adminClient
      .from('medication_logs')
      .select('patient_id, medication_id, log_date, scheduled_time')
      .eq('status', 'missed')
      .gte('log_date', sevenDaysAgoStr);

    if (missedError) {
      console.error('Error fetching missed logs:', missedError);
      throw missedError;
    }

    // Group by patient
    const missesByPatient: Record<string, number> = {};
    (missedLogs || []).forEach((log: any) => {
      missesByPatient[log.patient_id] = (missesByPatient[log.patient_id] || 0) + 1;
    });

    const flaggedPatients = Object.entries(missesByPatient).filter(([_, count]) => count >= 2);
    const notificationsSent: any[] = [];

    // 3. For each flagged patient, find active caregivers and send push notifications
    for (const [patientId, count] of flaggedPatients) {
      // Get patient name
      const { data: patientProfile } = await adminClient
        .from('profiles')
        .select('full_name')
        .eq('id', patientId)
        .maybeSingle();

      const patientName = patientProfile?.full_name || 'Patient';

      // Get active caregivers with alerts enabled
      const { data: links } = await adminClient
        .from('patient_caregivers')
        .select('caregiver_id, override_alerts')
        .eq('patient_id', patientId)
        .eq('status', 'active');

      if (!links || links.length === 0) continue;

      for (const link of links) {
        // If caregiver muted alerts for this patient, skip
        if (link.override_alerts) continue;

        // Fetch caregiver profile & owner-only push token
        const { data: caregiver } = await adminClient
          .from('profiles')
          .select('id, push_token, alerts_enabled')
          .eq('id', link.caregiver_id)
          .maybeSingle();

        const { data: tokenRecord } = await adminClient
          .from('user_push_tokens')
          .select('push_token')
          .eq('user_id', link.caregiver_id)
          .maybeSingle();

        const pushToken = tokenRecord?.push_token || caregiver?.push_token;

        if (caregiver?.alerts_enabled !== false && pushToken) {
          // Send Expo Push Notification
          try {
            const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                to: pushToken,
                sound: 'default',
                title: '⚠️ MedSync Missed Dose Alert',
                body: `${patientName} has missed ${count} medication doses. Tap to view adherence.`,
                data: { patientId, count, screen: 'caregiver-dashboard' },
              }),
            });

            const pushJson = await pushRes.json();
            notificationsSent.push({
              caregiver_id: caregiver?.id || link.caregiver_id,
              patient_id: patientId,
              status: pushRes.ok ? 'sent' : 'failed',
              result: pushJson,
            });
          } catch (pushErr) {
            console.error('Error sending push to caregiver:', link.caregiver_id, pushErr);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        flagged_patients_count: flaggedPatients.length,
        notifications_sent_count: notificationsSent.length,
        details: notificationsSent,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('check-missed-doses error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
