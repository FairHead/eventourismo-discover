-- Ensure a system user exists for ingestion (fix FK venues.created_by)
INSERT INTO public.users (id, email, display_name, role, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'system@ingest.local', 'System Ingestion', 'admin', now(), now())
ON CONFLICT (id) DO NOTHING;