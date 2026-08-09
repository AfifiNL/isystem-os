-- /src/features/content-engine/schema.sql

-- Enable pgvector (usually enabled in Supabase, but good to include)
CREATE EXTENSION IF NOT EXISTS vector;

-- Table to store content items
CREATE TABLE IF NOT EXISTS public.content_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT UNIQUE,
    type TEXT CHECK (type = ANY (ARRAY['video'::text, 'blog'::text])),
    status TEXT DEFAULT 'draft' CHECK (status = ANY (ARRAY['draft'::text, 'published'::text])),
    content_markdown TEXT,
    video_url TEXT,
    video_duration INTEGER,
    video_resolution TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies for content_items
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all content items
CREATE POLICY "Public can view all content items" 
ON public.content_items FOR SELECT 
USING (true);

-- Allow authenticated users to insert their own content items
CREATE POLICY "Users can insert their own content items" 
ON public.content_items FOR INSERT 
WITH CHECK (auth.uid() = author_id);

-- Allow authenticated users to update their own content items
CREATE POLICY "Users can update their own content items" 
ON public.content_items FOR UPDATE 
USING (auth.uid() = author_id);

-- Allow authenticated users to delete their own content items
CREATE POLICY "Users can delete their own content items" 
ON public.content_items FOR DELETE 
USING (auth.uid() = author_id);

-- Function to automatically update the 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the update function before an update on content_items
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.content_items
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Supabase Storage Buckets
-- Create 'public-media' bucket (publicly accessible)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('public-media', 'public-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for 'public-media'
CREATE POLICY "Public Access for public-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'public-media');

CREATE POLICY "Authenticated users can upload to public-media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'public-media' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'public-media' AND auth.uid() = owner);

CREATE POLICY "Users can delete their own media"
ON storage.objects FOR DELETE
USING (bucket_id = 'public-media' AND auth.uid() = owner);

-- Create 'protected-videos' bucket (not publicly accessible directly)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('protected-videos', 'protected-videos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for 'protected-videos'
-- Only authenticated users can read (we might refine this later based on subscription)
CREATE POLICY "Authenticated Read Access for protected-videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'protected-videos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload to protected-videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'protected-videos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own videos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'protected-videos' AND auth.uid() = owner);

CREATE POLICY "Users can delete their own videos"
ON storage.objects FOR DELETE
USING (bucket_id = 'protected-videos' AND auth.uid() = owner);
