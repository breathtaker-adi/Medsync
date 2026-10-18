import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Max payload size ~3MB image (~4.2MB base64)
const MAX_BASE64_LENGTH = 4.2 * 1024 * 1024;
const MAX_DAILY_SCANS = 10;

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Verify caller authentication via JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or expired session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Parse and validate request payload
    const { base64Image } = await req.json();

    if (!base64Image || typeof base64Image !== 'string') {
      return new Response(JSON.stringify({ error: 'No valid image provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check payload size
    if (base64Image.length > MAX_BASE64_LENGTH) {
      return new Response(
        JSON.stringify({ error: 'Payload too large: image exceeds 3MB limit. Please compress before uploading.' }),
        {
          status: 413,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Enforce per-user daily scan quota to protect against OpenAI billing abuse
    const todayKolkata = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const { count: dailyScanCount, error: countError } = await supabase
      .from('pending_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('patient_id', user.id)
      .gte('created_at', `${todayKolkata}T00:00:00+05:30`);

    if (!countError && dailyScanCount !== null && dailyScanCount >= MAX_DAILY_SCANS) {
      return new Response(
        JSON.stringify({
          error: `Daily prescription scan quota reached (${MAX_DAILY_SCANS} scans per day). Please try again tomorrow or contact support.`,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      console.error('Server configuration error: OPENAI_API_KEY missing');
      return new Response(JSON.stringify({ error: 'AI service unavailable. Please configure server keys.' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Request OpenAI Vision extraction
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert clinical pharmacist AI. Carefully inspect the uploaded image. Determine if it is an authentic medical prescription, doctor order, hospital slip, or medication packaging. If the image is NOT a medical prescription (e.g. a selfie, person, animal, car, landscape, scenery, receipt, random object, blank paper, or illegible clutter), respond with: {"is_valid_prescription": false, "medicine_name": "⚠️ Unrecognized / Non-prescription", "dosage": "Please inspect uploaded image", "duration": "N/A", "confidence": "low"}. If it IS a medical prescription or medication slip, extract the details: {"is_valid_prescription": true, "medicine_name": "...", "dosage": "...", "duration": "...", "confidence": "high"}. Respond ONLY in valid JSON format.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this image and extract prescription medication details if valid.' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errDetails = await response.text();
      console.error('OpenAI API upstream error:', response.status, errDetails);
      return new Response(JSON.stringify({ error: 'AI OCR failed to process prescription.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) {
      throw new Error('Empty response from AI service');
    }

    let aiSummary: {
      is_valid_prescription?: boolean;
      medicine_name?: string;
      dosage?: string;
      duration?: string;
      confidence?: string;
    } = {};
    try {
      aiSummary = JSON.parse(rawContent);
    } catch {
      console.warn('Failed to parse AI JSON:', rawContent);
    }

    const isValid = aiSummary.is_valid_prescription !== false;

    return new Response(
      JSON.stringify({
        is_valid_prescription: isValid,
        medicine_name: typeof aiSummary.medicine_name === 'string'
          ? aiSummary.medicine_name.trim()
          : (isValid ? 'Unknown Medicine' : '⚠️ Unrecognized / Non-prescription'),
        dosage: typeof aiSummary.dosage === 'string'
          ? aiSummary.dosage.trim()
          : (isValid ? 'See prescription' : 'Please inspect uploaded image'),
        duration: typeof aiSummary.duration === 'string'
          ? aiSummary.duration.trim()
          : (isValid ? 'Not specified' : 'N/A'),
        confidence: aiSummary.confidence || (isValid ? 'medium' : 'low'),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('scan-prescription internal error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error processing prescription' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
