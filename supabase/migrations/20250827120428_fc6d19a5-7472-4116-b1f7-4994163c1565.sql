-- Remove the overly permissive policy that exposes all user data to authenticated users
DROP POLICY IF EXISTS "Authenticated users can view limited public profiles" ON public.users;

-- The users table will now only allow:
-- 1. Users to view/edit their own complete profile
-- 2. Insert their own profile (via auth trigger)
-- This eliminates the field-level exposure vulnerability

-- For legitimate public profile access needs, create a secure function
-- that returns only truly public, non-sensitive information
CREATE OR REPLACE FUNCTION public.get_public_user_info(target_user_id uuid)
RETURNS TABLE (
  id uuid,
  display_name text,
  avatar_url text,
  role user_role
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
    u.role
  FROM public.users u
  WHERE u.id = target_user_id
    AND auth.uid() IS NOT NULL;
$$;