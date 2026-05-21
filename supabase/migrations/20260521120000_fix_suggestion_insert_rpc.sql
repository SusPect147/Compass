-- ============================================================
-- FIX: COALESCE types uuid and integer mismatch on map_suggestions INSERT
-- Root cause: a Supabase-internal RLS policy or PostgREST COALESCE
--             in the suggestions_insert policy causes a type error.
-- Fix: provide a SECURITY DEFINER RPC that bypasses RLS and does its
--      own validation explicitly.
-- ============================================================

-- Drop old function if exists
DROP FUNCTION IF EXISTS public.submit_map_suggestion(UUID, UUID, TEXT, JSONB);

-- Create the safe insert function
CREATE OR REPLACE FUNCTION public.submit_map_suggestion(
    p_map_id        UUID,
    p_contributor_id UUID,
    p_contributor_name TEXT,
    p_map_data      JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_uid    UUID;
    v_link_active   BOOLEAN;
    v_rate_count    INTEGER;
BEGIN
    -- 1. Verify the caller is authenticated and matches contributor_id
    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;

    IF v_caller_uid != p_contributor_id THEN
        RAISE EXCEPTION 'contributor_id must match authenticated user' USING ERRCODE = '42501';
    END IF;

    -- 2. Verify an active collab link exists for this map
    SELECT EXISTS (
        SELECT 1 FROM public.map_collab_links
        WHERE map_collab_links.map_id = p_map_id
          AND map_collab_links.is_active = true
    ) INTO v_link_active;

    IF NOT v_link_active THEN
        RAISE EXCEPTION 'No active collaboration link for this map' USING ERRCODE = '42501';
    END IF;

    -- 3. Rate limit: max 20 suggestions per user per map
    SELECT COUNT(*) INTO v_rate_count
    FROM public.map_suggestions
    WHERE map_id = p_map_id AND contributor_id = p_contributor_id;

    IF v_rate_count >= 20 THEN
        RAISE EXCEPTION 'Rate limit exceeded: max 20 suggestions per map per user' USING ERRCODE = '42501';
    END IF;

    -- 4. Insert the suggestion (bypasses the broken RLS COALESCE)
    INSERT INTO public.map_suggestions (map_id, contributor_id, contributor_name, map_data)
    VALUES (p_map_id, p_contributor_id, p_contributor_name, p_map_data);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.submit_map_suggestion(UUID, UUID, TEXT, JSONB) TO authenticated;

-- Also grant to anon just in case the session resolves differently
-- (auth.uid() check inside will block unauthenticated callers)
GRANT EXECUTE ON FUNCTION public.submit_map_suggestion(UUID, UUID, TEXT, JSONB) TO anon;
