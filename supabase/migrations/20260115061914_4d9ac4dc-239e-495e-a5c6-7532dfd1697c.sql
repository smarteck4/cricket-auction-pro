-- Create storage bucket for player profile images
INSERT INTO storage.buckets (id, name, public)
VALUES ('player-images', 'player-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view player images (public bucket)
CREATE POLICY "Player images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'player-images');

-- Allow admins to upload player images
CREATE POLICY "Admins can upload player images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'player-images' AND public.has_role(auth.uid(), 'admin'));

-- Allow admins to update player images
CREATE POLICY "Admins can update player images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'player-images' AND public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete player images
CREATE POLICY "Admins can delete player images"
ON storage.objects FOR DELETE
USING (bucket_id = 'player-images' AND public.has_role(auth.uid(), 'admin'));