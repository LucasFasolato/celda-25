-- Bucket público para multimedia del juego (video/audio de etapas).
-- Los paths no se listan públicamente y no contienen información sensible.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  104857600, -- 100 MB
  array['video/mp4','video/webm','audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/mp4','audio/x-m4a','audio/aac']
)
on conflict (id) do nothing;
