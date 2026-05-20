-- ============================================================
-- COLLAB UPDATES & BAN STATUS FUNCTION SECURITY
-- ============================================================

-- 1. Add mode column to map_collab_links if it doesn't exist
ALTER TABLE public.map_collab_links ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'suggestion';

-- 2. Add tile_authors column to maps if it doesn't exist
ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS tile_authors JSONB DEFAULT '{}';

-- 3. Ensure check_ban_status RPC exists and is accessible to anon/authenticated
CREATE TABLE IF NOT EXISTS public.blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target TEXT UNIQUE NOT NULL,
    reason TEXT DEFAULT 'No reason provided.',
    created_at TIMESTAMPTZ DEFAULT now()
);

DROP FUNCTION IF EXISTS public.check_ban_status(TEXT);

CREATE OR REPLACE FUNCTION public.check_ban_status(check_target TEXT)
RETURNS TABLE (target TEXT, reason TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT b.target, b.reason
    FROM public.blacklist b
    WHERE b.target = check_target;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permission to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.check_ban_status(TEXT) TO anon, authenticated;

-- 4. Update public.maps SELECT policy to allow guests with active collab links to load the map details!
DROP POLICY IF EXISTS "Public maps are viewable by everyone" ON public.maps;
CREATE POLICY "Public maps are viewable by everyone"
ON public.maps FOR SELECT
USING (
    is_public = true
    OR auth.uid() = user_id
    OR EXISTS (
        SELECT 1 FROM public.map_collab_links 
        WHERE map_collab_links.map_id = public.maps.id 
        AND map_collab_links.is_active = true
    )
);

-- 5. Fix infinite RLS recursion on public.map_collab_links
DROP POLICY IF EXISTS "collab_owner_all" ON public.map_collab_links;
CREATE POLICY "collab_owner_all" ON public.map_collab_links
  FOR ALL USING (
    auth.uid() = owner_id
  ) WITH CHECK (
    auth.uid() = owner_id
  );

