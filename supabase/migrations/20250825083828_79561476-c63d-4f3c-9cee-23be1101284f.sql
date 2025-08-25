-- Harden functions and fix signup insertion

-- 1) Update get_current_user_role with fixed search_path
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- 2) Update timestamp function with fixed search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 3) Robust upsert on signup + fixed search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    CASE WHEN NEW.raw_user_meta_data ->> 'date_of_birth' IS NOT NULL 
      THEN (NEW.raw_user_meta_data ->> 'date_of_birth')::DATE 
      ELSE NULL 
    END,
    NEW.raw_user_meta_data ->> 'street_address',
    NEW.raw_user_meta_data ->> 'city',
    NEW.raw_user_meta_data ->> 'postal_code',
    COALESCE(NEW.raw_user_meta_data ->> 'country', 'Deutschland'),
    NEW.raw_user_meta_data ->> 'bio',
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'user'::user_role)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    username = COALESCE(EXCLUDED.username, public.users.username),
    phone_number = EXCLUDED.phone_number,
    date_of_birth = EXCLUDED.date_of_birth,
    street_address = EXCLUDED.street_address,
    city = EXCLUDED.city,
    postal_code = EXCLUDED.postal_code,
    country = EXCLUDED.country,
    bio = EXCLUDED.bio,
    role = EXCLUDED.role,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 4) Ensure trigger exists
DO $$ BEGIN
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_new_user();
EXCEPTION WHEN duplicate_object THEN
  -- If it exists, ensure it points to latest function by recreating it
  BEGIN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE PROCEDURE public.handle_new_user();
  END;
END $$;