import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const mapboxTokenRaw = Deno.env.get('MAPBOX_PUBLIC_TOKEN');
    const mapboxToken = mapboxTokenRaw ? mapboxTokenRaw.trim() : '';

    // Basic logging for debugging (does not expose the token)
    console.log('[get-mapbox-token] invoked. Token present:', Boolean(mapboxToken));
    
    if (!mapboxToken) {
      return new Response(
        JSON.stringify({ error: 'Mapbox token not configured or empty' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ token: mapboxToken }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('[get-mapbox-token] unexpected error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})