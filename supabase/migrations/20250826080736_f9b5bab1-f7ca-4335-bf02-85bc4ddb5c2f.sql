-- Fix the infinite recursion issue in bands table RLS policy
DROP POLICY IF EXISTS "Band creators and members can manage bands" ON public.bands;

CREATE POLICY "Band creators and members can manage bands" 
ON public.bands 
FOR ALL 
USING (
  (created_by = auth.uid()) OR 
  (EXISTS (
    SELECT 1 
    FROM band_members 
    WHERE band_members.band_id = bands.id 
    AND band_members.artist_id = auth.uid() 
    AND band_members.role IN ('admin', 'manager')
  ))
);