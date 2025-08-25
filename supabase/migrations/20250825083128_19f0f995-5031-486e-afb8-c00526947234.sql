-- Add additional user profile fields to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS street_address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Deutschland',
ADD COLUMN IF NOT EXISTS bio TEXT;

-- Create index for username lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);

-- Create index for city searches
CREATE INDEX IF NOT EXISTS idx_users_city ON public.users(city);

-- Update the handle_new_user function to handle new fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.users (
    id, 
    email, 
    display_name,
    first_name,
    last_name,
    username,
    phone_number,
    date_of_birth,
    street_address,
    city,
    postal_code,
    country,
    bio,
    role
  )
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email),
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.raw_user_meta_data ->> 'username',
    NEW.raw_user_meta_data ->> 'phone_number',
    CASE 
      WHEN NEW.raw_user_meta_data ->> 'date_of_birth' IS NOT NULL 
      THEN (NEW.raw_user_meta_data ->> 'date_of_birth')::DATE 
      ELSE NULL 
    END,
    NEW.raw_user_meta_data ->> 'street_address',
    NEW.raw_user_meta_data ->> 'city',
    NEW.raw_user_meta_data ->> 'postal_code',
    COALESCE(NEW.raw_user_meta_data ->> 'country', 'Deutschland'),
    NEW.raw_user_meta_data ->> 'bio',
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'user'::user_role)
  );
  RETURN NEW;
END;
$function$;