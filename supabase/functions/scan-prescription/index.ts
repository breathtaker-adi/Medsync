// @ts-nocheck
// supabase/functions/scan-prescription/index.ts
// This Edge Function proxies the OpenAI Vision call so the API key
// never leaves the server. Deploy with: supabase functions deploy scan-prescription
//
// Set the secret on your Supabase project:
//   supabase secrets set OPENAI_API_KEY=sk-proj-xxxxxxxxxxxx

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { base64Image } = await req.json();

    if (!base64Image) {
      return new Response(JSON.stringify({ error: 'No image provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
              'You are an expert pharmacist AI. Read the prescription image. Extract the Medicine Name, Dosage Instructions, and Duration. Respond ONLY in JSON format like: {"medicine_name": "...", "dosage": "...", "duration": "..."}',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Read this prescription and extract the data.' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'OpenAI API error', details: data }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiSummary = JSON.parse(data.choices[0].message.content);

    return new Response(
      JSON.stringify({
        medicine_name: aiSummary.medicine_name || 'Unknown Medicine',
        dosage: aiSummary.dosage || 'See prescription',
        duration: aiSummary.duration || 'Not specified',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
