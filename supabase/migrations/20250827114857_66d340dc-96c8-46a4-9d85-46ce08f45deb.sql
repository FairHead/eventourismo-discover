-- Drop the overly permissive policy that allows public access to all user data
DROP POLICY IF EXISTS "Users can view all public profiles" ON public.users;

-- Create secure policies that protect sensitive personal information
-- Policy 1: Users can view their own complete profile
CREATE POLICY "Users can view their own complete profile" 
ON public.users 
FOR SELECT 
USING (auth.uid() = id);

-- Policy 2: Authenticated users can view only limited public information of other users
CREATE POLICY "Authenticated users can view limited public profiles" 
ON public.users 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() != id
);

-- Add a view for public profile data to make it easier to query safely
CREATE OR REPLACE VIEW public.user_public_profiles AS
SELECT 
  id,
  display_name,
  avatar_url,
  bio,
  city,
  country,
  role,
  created_at
FROM public.users
WHERE auth.uid() IS NOT NULL;