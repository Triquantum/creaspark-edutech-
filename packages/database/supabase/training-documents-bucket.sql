-- Not a Prisma migration: Supabase Storage buckets/policies live in the
-- `storage` schema, which Prisma doesn't manage. Run this once, manually,
-- in the Supabase SQL editor (same place as the Prisma migrations).

insert into storage.buckets (id, name, public)
values ('training-documents', 'training-documents', true)
on conflict (id) do nothing;

drop policy if exists "Public read training documents" on storage.objects;
create policy "Public read training documents"
on storage.objects for select
using (bucket_id = 'training-documents');

drop policy if exists "Authenticated users can upload training documents" on storage.objects;
create policy "Authenticated users can upload training documents"
on storage.objects for insert
to authenticated
with check (bucket_id = 'training-documents');

drop policy if exists "Authenticated users can update training documents" on storage.objects;
create policy "Authenticated users can update training documents"
on storage.objects for update
to authenticated
using (bucket_id = 'training-documents');
