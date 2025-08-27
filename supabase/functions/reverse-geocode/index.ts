import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lat, lng } = await req.json();
    
    if (!lat || !lng) {
      return new Response(
        JSON.stringify({ error: 'Latitude and longitude are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN');
    if (!mapboxToken) {
      console.error('MAPBOX_PUBLIC_TOKEN not found in environment');
      return new Response(
        JSON.stringify({ error: 'Mapbox token not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Reverse geocoding for coordinates: ${lat}, ${lng}`);

    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?` +
      `types=place,locality,neighborhood,address&language=de&limit=1&access_token=${mapboxToken}`
    );

    if (!response.ok) {
      console.error('Mapbox API error:', response.status, response.statusText);
      throw new Error(`Geocoding failed: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Mapbox response:', JSON.stringify(data, null, 2));

    if (!data.features || data.features.length === 0) {
      return new Response(
        JSON.stringify({ 
          address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          city: 'Unbekannter Ort'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const feature = data.features[0];
    const context = feature.context || [];
    
    // Extract city/place from context
    let city = '';
    let region = '';
    
    for (const item of context) {
      if (item.id.startsWith('place.')) {
        city = item.text;
      } else if (item.id.startsWith('region.') || item.id.startsWith('province.')) {
        region = item.text;
      }
    }

    // Fallback to feature text if no city found in context
    if (!city && feature.place_type?.includes('place')) {
      city = feature.text;
    }

    const result = {
      address: feature.place_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      city: city || feature.text || 'Unbekannter Ort',
      region: region || '',
      coordinates: `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    };

    console.log('Returning result:', result);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in reverse geocoding:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})