-- Create the user_role enum type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'artist', 'promoter', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create event_type enum if missing
DO $$ BEGIN
    CREATE TYPE event_type AS ENUM ('concert', 'festival', 'club_night', 'theater', 'exhibition', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create event_status enum if missing  
DO $$ BEGIN
    CREATE TYPE event_status AS ENUM ('draft', 'published', 'cancelled', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create favorite_target_type enum if missing
DO $$ BEGIN
    CREATE TYPE favorite_target_type AS ENUM ('event', 'venue', 'artist');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create rating_target_type enum if missing
DO $$ BEGIN
    CREATE TYPE rating_target_type AS ENUM ('event', 'venue', 'artist');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create report_target_type enum if missing
DO $$ BEGIN
    CREATE TYPE report_target_type AS ENUM ('event', 'venue', 'artist', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;