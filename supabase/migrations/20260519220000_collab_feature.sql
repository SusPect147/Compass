-- ============================================================
-- COLLAB FEATURE MIGRATION: "Work on Map with a Friend"
-- ============================================================

-- 1. Table for collab share links (one per map)
CREATE TABLE IF NOT EXISTS map_collab_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_map_collab UNIQUE(map_id)
);

CREATE INDEX IF NOT EXISTS idx_collab_links_map ON map_collab_links(map_id);
CREATE INDEX IF NOT EXISTS idx_collab_links_owner ON map_collab_links(owner_id);

-- 2. Table for friend suggestions (map versions submitted by collaborators)
CREATE TABLE IF NOT EXISTS map_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  contributor_id UUID NOT NULL,
  contributor_name TEXT NOT NULL DEFAULT 'Anonymous',
  map_data JSONB NOT NULL,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suggestions_map ON map_suggestions(map_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_contributor ON map_suggestions(contributor_id);

-- 3. RLS for map_collab_links
ALTER TABLE map_collab_links ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to prevent duplicate object errors
DROP POLICY IF EXISTS "collab_owner_all" ON map_collab_links;
DROP POLICY IF EXISTS "collab_anyone_read_active" ON map_collab_links;

-- SECURITY FIXED: Owner can manage collab links ONLY if they are the actual owner of the map.
CREATE POLICY "collab_owner_all" ON map_collab_links
  FOR ALL USING (
    auth.uid() = owner_id 
    AND auth.uid() = (SELECT user_id FROM maps WHERE id = map_id LIMIT 1)
  ) WITH CHECK (
    auth.uid() = owner_id 
    AND auth.uid() = (SELECT user_id FROM maps WHERE id = map_id LIMIT 1)
  );

-- Anyone (authenticated or not) can read active links to validate collab access
CREATE POLICY "collab_anyone_read_active" ON map_collab_links
  FOR SELECT USING (is_active = true);

-- 4. RLS for map_suggestions
ALTER TABLE map_suggestions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to prevent duplicate object errors
DROP POLICY IF EXISTS "suggestions_insert" ON map_suggestions;
DROP POLICY IF EXISTS "suggestions_read" ON map_suggestions;
DROP POLICY IF EXISTS "suggestions_delete" ON map_suggestions;

-- SECURITY FIXED: A contributor can only insert suggestions if they are authenticated, matching their contributor_id,
-- AND there exists an ACTIVE collaboration link for that map.
CREATE POLICY "suggestions_insert" ON map_suggestions
  FOR INSERT WITH CHECK (
    auth.uid() = contributor_id 
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM map_collab_links 
      WHERE map_collab_links.map_id = map_suggestions.map_id 
      AND map_collab_links.is_active = true
    )
  );

-- Contributor can read own suggestions; map owner can read all suggestions for their map
CREATE POLICY "suggestions_read" ON map_suggestions
  FOR SELECT USING (
    auth.uid() = contributor_id OR
    auth.uid() = (SELECT user_id FROM maps WHERE id = map_id LIMIT 1)
  );

-- Only the map owner can delete suggestions
CREATE POLICY "suggestions_delete" ON map_suggestions
  FOR DELETE USING (
    auth.uid() = (SELECT user_id FROM maps WHERE id = map_id LIMIT 1)
  );

-- 5. Rate-limit trigger: max 20 suggestions per user per map (anti-spam)
CREATE OR REPLACE FUNCTION check_suggestion_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM map_suggestions
    WHERE map_id = NEW.map_id AND contributor_id = NEW.contributor_id
  ) >= 20 THEN
    RAISE EXCEPTION 'Rate limit exceeded: max 20 suggestions per map per user';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS suggestion_rate_limit ON map_suggestions;
CREATE TRIGGER suggestion_rate_limit
  BEFORE INSERT ON map_suggestions
  FOR EACH ROW EXECUTE FUNCTION check_suggestion_rate_limit();

