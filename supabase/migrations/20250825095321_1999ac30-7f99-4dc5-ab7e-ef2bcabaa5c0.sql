-- Create bands table
CREATE TABLE public.bands (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  bio text,
  description text,
  city text,
  country text DEFAULT 'Deutschland',
  genres text[] DEFAULT '{}',
  website_url text,
  social_links jsonb DEFAULT '{}',
  avatar_url text,
  cover_image_url text,
  formation_year integer,
  active boolean DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  slug text UNIQUE -- For URL-friendly band profiles
);

-- Create band_members table for band membership
CREATE TABLE public.band_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES public.artist_profiles(user_id) ON DELETE CASCADE,
  role text DEFAULT 'member', -- 'admin', 'member', 'manager'
  instruments text[],
  is_active boolean DEFAULT true,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(band_id, artist_id)
);

-- Create band_invitations table for managing join requests
CREATE TABLE public.band_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL, -- User who sent the invitation
  invitee_id uuid NOT NULL, -- Artist profile user_id being invited
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'cancelled'
  message text,
  invited_role text DEFAULT 'member',
  invited_instruments text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + interval '30 days'),
  UNIQUE(band_id, invitee_id, status) -- Prevent duplicate pending invitations
);

-- Add band_id to events table to associate events with bands
ALTER TABLE public.events ADD COLUMN band_id uuid REFERENCES public.bands(id) ON DELETE SET NULL;

-- Enable RLS on all new tables
ALTER TABLE public.bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bands table
CREATE POLICY "Anyone can view active bands" 
ON public.bands 
FOR SELECT 
USING (active = true);

CREATE POLICY "Band creators and members can manage bands" 
ON public.bands 
FOR ALL 
USING (
  created_by = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.band_members 
    WHERE band_id = id AND artist_id = auth.uid() AND role IN ('admin', 'manager')
  )
);

-- RLS Policies for band_members table
CREATE POLICY "Anyone can view band members" 
ON public.band_members 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Band admins and managers can manage members" 
ON public.band_members 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.bands 
    WHERE id = band_id AND created_by = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.band_members bm 
    WHERE bm.band_id = band_id AND bm.artist_id = auth.uid() AND bm.role IN ('admin', 'manager')
  ) OR
  artist_id = auth.uid() -- Artists can manage their own membership
);

-- RLS Policies for band_invitations table
CREATE POLICY "Users can view their own invitations" 
ON public.band_invitations 
FOR SELECT 
USING (invitee_id = auth.uid() OR inviter_id = auth.uid());

CREATE POLICY "Band members can create invitations" 
ON public.band_invitations 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bands 
    WHERE id = band_id AND created_by = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.band_members 
    WHERE band_id = band_invitations.band_id AND artist_id = auth.uid() AND role IN ('admin', 'manager')
  )
);

CREATE POLICY "Invitation participants can update invitations" 
ON public.band_invitations 
FOR UPDATE 
USING (invitee_id = auth.uid() OR inviter_id = auth.uid());

-- Create updated_at triggers
CREATE TRIGGER update_bands_updated_at
  BEFORE UPDATE ON public.bands
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_band_invitations_updated_at
  BEFORE UPDATE ON public.band_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to generate band slug
CREATE OR REPLACE FUNCTION public.generate_band_slug(band_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  -- Convert to lowercase, replace spaces and special chars with hyphens
  base_slug := lower(regexp_replace(trim(band_name), '[^a-zA-Z0-9\s]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := trim(base_slug, '-');
  
  -- Ensure slug is not empty
  IF base_slug = '' THEN
    base_slug := 'band';
  END IF;
  
  final_slug := base_slug;
  
  -- Check for uniqueness and add counter if needed
  WHILE EXISTS (SELECT 1 FROM public.bands WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$;

-- Create trigger to auto-generate slug on insert
CREATE OR REPLACE FUNCTION public.set_band_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.generate_band_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_band_slug_trigger
  BEFORE INSERT ON public.bands
  FOR EACH ROW
  EXECUTE FUNCTION public.set_band_slug();