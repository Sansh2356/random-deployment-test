-- ============================================================
-- Full-Text Search Migration for transcripts table
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Add a generated tsvector column that combines searchable fields.
--    'english' config handles stemming, stop words, etc.
ALTER TABLE transcripts
ADD COLUMN IF NOT EXISTS fts tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(speakers::text, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(corrected_text, raw_text, '')), 'C')
) STORED;

-- 2. Create a GIN index on the tsvector column for fast lookups.
CREATE INDEX IF NOT EXISTS idx_transcripts_fts ON transcripts USING GIN (fts);

-- 3. Create the RPC function for full-text search with ranking and snippets.
CREATE OR REPLACE FUNCTION search_transcripts_fts(
  search_query text,
  result_limit int DEFAULT 20,
  result_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  title text,
  speakers text,
  event_date date,
  loc text,
  tags text[],
  categories text[],
  summary text,
  rank real,
  headline_title text,
  headline_content text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  tsquery_val tsquery;
BEGIN
  -- Convert the raw search string into a tsquery.
  -- plainto_tsquery handles multi-word input safely (no special syntax needed).
  tsquery_val := plainto_tsquery('english', search_query);

  -- Guard: if the query produces an empty tsquery, return nothing.
  IF tsquery_val = ''::tsquery THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.speakers,
    t.event_date,
    t.loc,
    t.tags,
    t.categories,
    t.summary,
    ts_rank(t.fts, tsquery_val) AS rank,
    ts_headline(
      'english',
      t.title,
      tsquery_val,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=20, MinWords=5, HighlightAll=true'
    ) AS headline_title,
    ts_headline(
      'english',
      coalesce(t.corrected_text, t.raw_text, ''),
      tsquery_val,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15, MaxFragments=2, FragmentDelimiter= ... '
    ) AS headline_content
  FROM transcripts t
  WHERE t.fts @@ tsquery_val
  ORDER BY rank DESC, t.event_date DESC NULLS LAST
  LIMIT result_limit
  OFFSET result_offset;
END;
$$;

-- 4. Create a companion function to get total count for pagination.
CREATE OR REPLACE FUNCTION search_transcripts_fts_count(
  search_query text
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  tsquery_val tsquery;
  total bigint;
BEGIN
  tsquery_val := plainto_tsquery('english', search_query);

  IF tsquery_val = ''::tsquery THEN
    RETURN 0;
  END IF;

  SELECT count(*) INTO total
  FROM transcripts t
  WHERE t.fts @@ tsquery_val;

  RETURN total;
END;
$$;
