-- Drop the problematic security definer view
DROP VIEW IF EXISTS public.user_public_profiles;

-- Create a safer function to get public profile data instead
CREATE OR REPLACE FUNCTION public.get_user_public_profile(user_id uuid)
RETURNS TABLE (
  id uuid,
  display_name text,
  avatar_url text,
  bio text,
  city text,
  country text,
  role user_role,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    u.id,
    u.display_name,
    u.avatar_url,
    u.bio,
    u.city,
    u.country,
    u.role,
    u.created_at
  FROM public.users u
  WHERE u.id = user_id
    AND auth.uid() IS NOT NULL;
$$;