-- Create a cron job to update venues every day at 2 AM
SELECT cron.schedule(
  'update-venues-daily',
  '0 2 * * *', -- Every day at 2 AM
  $$
  SELECT
    net.http_post(
        url:='https://bzadclztipjxmhrtckwf.supabase.co/functions/v1/osm_ingest',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6YWRjbHp0aXBqeG1ocnRja3dmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxMDU4NDEsImV4cCI6MjA3MTY4MTg0MX0.0rH5FhMJr7bNFjN0KLpRjt7Qfuhe-EnZbRzW4C1ZG6Y"}'::jsonb,
        body:='{"bbox": {"south": 47.2, "west": 5.8, "north": 55.1, "east": 15.0}}'::jsonb
    ) as osm_request_id,
    net.http_post(
        url:='https://bzadclztipjxmhrtckwf.supabase.co/functions/v1/tm_ingest',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6YWRjbHp0aXBqeG1ocnRja3dmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxMDU4NDEsImV4cCI6MjA3MTY4MTg0MX0.0rH5FhMJr7bNFjN0KLpRjt7Qfuhe-EnZbRzW4C1ZG6Y"}'::jsonb,
        body:='{"bbox": {"south": 47.2, "west": 5.8, "north": 55.1, "east": 15.0}}'::jsonb
    ) as tm_request_id;
  $$
);

-- Enable required extensions for cron jobs and HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;