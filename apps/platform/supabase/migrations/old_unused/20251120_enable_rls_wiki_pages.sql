-- Enable Row Level Security on wiki_pages
ALTER TABLE wiki_pages ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read wiki pages
CREATE POLICY "wiki_pages_select_policy" ON wiki_pages
  FOR SELECT
  USING (true);

-- Policy: Authenticated users can insert wiki pages
CREATE POLICY "wiki_pages_insert_policy" ON wiki_pages
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Authors can update their own pages
CREATE POLICY "wiki_pages_update_policy" ON wiki_pages
  FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- Policy: Authors can delete their own pages
CREATE POLICY "wiki_pages_delete_policy" ON wiki_pages
  FOR DELETE
  USING (auth.uid() = author_id);
