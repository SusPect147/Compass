-- ============================================================
-- COLLABORATOR UPDATE POLICY
-- Allows guests with active collab links to update map data
-- ============================================================

DROP POLICY IF EXISTS "Collab partners can update maps" ON public.maps;
CREATE POLICY "Collab partners can update maps"
ON public.maps FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.map_collab_links 
        WHERE map_collab_links.map_id = public.maps.id 
        AND map_collab_links.is_active = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.map_collab_links 
        WHERE map_collab_links.map_id = public.maps.id 
        AND map_collab_links.is_active = true
    )
);
