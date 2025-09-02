import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'
import { normalizeName, mergeSources, mergeArrays, getBetterName, retryWithBackoff } from '../_shared/dedupe.ts'

// Overpass API endpoints for load balancing
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter", 
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter"
];

// Germany bounding box
const GERMANY_BOUNDS = {
  south: 47.2,
  north: 55.1,
  west: 5.8,
  east: 15.1
};

const GRID_STEP = 0.5; // degrees
const REQUEST_DELAY = 200; // ms between requests
const TIMEOUT = 60000; // 60 seconds

interface OSMElement {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OSMResponse {
  elements: OSMElement[];
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Ensure a system user exists in auth and public.users, return its id
async function ensureSystemUserId(supabase: any): Promise<string> {
  const email = Deno.env.get('SYSTEM_INGEST_EMAIL') || 'system@ingest.local';

  // Try to find existing public user first
  const { data: existing, error: selectErr } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  // Create auth user via Admin API
  const password = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { system: true }
  });

  if (createErr) {
    // If already exists, try to list users and find by email
    const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) throw createErr;
    const found = list.users.find((u: any) => (u.email || '').toLowerCase() === email);
    if (!found) throw createErr;
    // Ensure public.users row
    const { error: insertErr } = await supabase.from('users').insert({
      id: found.id,
      email,
      display_name: 'System Ingestion',
      role: 'admin'
    });
    if (insertErr && insertErr.code !== '23505') throw insertErr;
    return found.id as string;
  }

  const newId = created?.user?.id as string;
  if (!newId) throw new Error('Failed to create system user');
  const { error: insertErr } = await supabase.from('users').insert({
    id: newId,
    email,
    display_name: 'System Ingestion',
    role: 'admin'
  });
  if (insertErr && insertErr.code !== '23505') throw insertErr;
  return newId;
}

// Will be set at runtime in the handler
let SYSTEM_USER_ID: string = '';

async function fetchOverpassData(bbox: string, endpointIndex = 0): Promise<OSMResponse> {
  const query = `[out:json][timeout:60];
  (
    node(${bbox})[amenity~"music_venue|theatre|arts_centre|nightclub"];
    way(${bbox})[amenity~"music_venue|theatre|arts_centre|nightclub"];
    node(${bbox})[amenity=bar][live_music=yes];
    way(${bbox})[amenity=bar][live_music=yes];
    node(${bbox})[leisure=stadium];
    way(${bbox})[leisure=stadium];
  );
  out center tags;`;

  const endpoint = OVERPASS_ENDPOINTS[endpointIndex % OVERPASS_ENDPOINTS.length];
  
  console.log(`Fetching from ${endpoint} with bbox: ${bbox}`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function osmElementToVenue(element: OSMElement) {
  const tags = element.tags || {};
  
  if (!tags.name) {
    return null; // Skip venues without names
  }
  
  const lat = element.lat || element.center?.lat;
  const lon = element.lon || element.center?.lon;
  
  if (!lat || !lon) {
    return null; // Skip venues without coordinates
  }
  
  // Build address from OSM tags
  const addressParts: any = {};
  if (tags['addr:street']) addressParts.street = tags['addr:street'];
  if (tags['addr:housenumber']) addressParts.housenumber = tags['addr:housenumber'];
  if (tags['addr:postcode']) addressParts.postcode = tags['addr:postcode'];
  
  // Categories from OSM tags
  const categories = [];
  if (tags.amenity) categories.push(tags.amenity);
  if (tags.leisure) categories.push(tags.leisure);
  if (tags.live_music === 'yes') categories.push('live_music');
  
  return {
    name: tags.name,
    lat: Number(lat),
    lng: Number(lon),
    city: tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || null,
    country: 'DE',
    address: Object.keys(addressParts).length > 0 ? JSON.stringify(addressParts) : '',
    website: tags.website || tags.url || null,
    categories: categories.length > 0 ? categories : null,
    sources: [{ src: 'osm', id: `${element.type}/${element.id}` }],
    created_by: SYSTEM_USER_ID
  };
}

async function upsertVenue(supabase: any, venue: any): Promise<'inserted' | 'merged'> {
  // Find candidates for deduplication
  const { data: candidates, error: candidatesError } = await supabase
    .rpc('venues_find_candidates', {
      v_name: venue.name,
      v_lat: venue.lat,
      v_lon: venue.lng,
      v_radius_m: 80
    });
    
  if (candidatesError) {
    console.error('Error finding candidates:', candidatesError);
    throw candidatesError;
  }
  
  if (candidates && candidates.length > 0) {
    // Merge with existing venue
    const existing = candidates[0];
    const mergedData: any = {
      name: getBetterName(existing.name, venue.name),
      sources: mergeSources(existing.sources || [], venue.sources),
    };
    
    // Update fields that are missing or could be improved
    if (!existing.website && venue.website) mergedData.website = venue.website;
    if (!existing.city && venue.city) mergedData.city = venue.city;
    if (!existing.country && venue.country) mergedData.country = venue.country;
    if (!existing.address && venue.address) mergedData.address = venue.address;
    if (venue.categories) {
      mergedData.categories = mergeArrays(existing.categories || [], venue.categories);
    }
    
    const { error: updateError } = await supabase
      .from('venues')
      .update(mergedData)
      .eq('id', existing.id);
      
    if (updateError) {
      console.error('Error updating venue:', updateError);
      throw updateError;
    }
    
    console.log(`Merged venue: ${venue.name} -> ${existing.name}`);
    return 'merged';
  } else {
    // Insert new venue
    const { error: insertError } = await supabase
      .from('venues')
      .insert(venue);
      
    if (insertError) {
      console.error('Error inserting venue:', insertError);
      throw insertError;
    }
    
    console.log(`Inserted new venue: ${venue.name}`);
    return 'inserted';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting OSM ingestion...');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    // Ensure system user id for created_by FK
    SYSTEM_USER_ID = await ensureSystemUserId(supabase);
    
    let totalSeen = 0;
    let totalInserted = 0;
    let totalMerged = 0;
    let endpointIndex = 0;
    
    // Generate grid of bounding boxes across Germany
    for (let lat = GERMANY_BOUNDS.south; lat < GERMANY_BOUNDS.north; lat += GRID_STEP) {
      for (let lng = GERMANY_BOUNDS.west; lng < GERMANY_BOUNDS.east; lng += GRID_STEP) {
        const bbox = `${lat},${lng},${lat + GRID_STEP},${lng + GRID_STEP}`;
        
        try {
          const data = await retryWithBackoff(
            () => fetchOverpassData(bbox, endpointIndex++),
            4, // max retries
            1000 // initial delay
          );
          
          console.log(`Processing ${data.elements.length} elements from bbox ${bbox}`);
          
          for (const element of data.elements) {
            const venue = osmElementToVenue(element);
            if (!venue) continue;
            
            totalSeen++;
            
            try {
              const result = await upsertVenue(supabase, venue);
              if (result === 'inserted') totalInserted++;
              else totalMerged++;
            } catch (error) {
              console.error(`Error upserting venue ${venue.name}:`, error);
            }
          }
          
          // Rate limiting: pause between requests
          await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
          
        } catch (error) {
          console.error(`Error processing bbox ${bbox}:`, error);
          // Continue with next bbox on error
        }
      }
    }
    
    const result = {
      ok: true,
      seen: totalSeen,
      inserted: totalInserted,
      merged: totalMerged,
      timestamp: new Date().toISOString()
    };
    
    console.log('OSM ingestion completed:', result);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('OSM ingestion error:', error);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});