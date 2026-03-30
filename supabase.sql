-- Recipe Repository / version 0.4.0
-- Run in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.foodie_recipes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  source_type text,
  source_label text,
  recipe_url text,
  collection text,
  tags text[] not null default '{}',
  rating smallint,
  is_favorite boolean not null default false,
  prep_time text,
  cook_time text,
  servings text,
  category text,
  cuisine text,
  recipe_yield text,
  image_url text,
  featured_image_url text,
  source_image_urls text[] not null default '{}',
  ocr_text text,
  ingredients text,
  instructions text,
  notes text,
  dietary text[] not null default '{}'
);

alter table public.foodie_recipes add column if not exists collection text;
alter table public.foodie_recipes add column if not exists rating smallint;
alter table public.foodie_recipes add column if not exists is_favorite boolean not null default false;
alter table public.foodie_recipes add column if not exists category text;
alter table public.foodie_recipes add column if not exists cuisine text;
alter table public.foodie_recipes add column if not exists recipe_yield text;
alter table public.foodie_recipes add column if not exists dietary text[] not null default '{}';
alter table public.foodie_recipes add column if not exists featured_image_url text;
alter table public.foodie_recipes add column if not exists source_image_urls text[] not null default '{}';

update public.foodie_recipes
set featured_image_url = coalesce(featured_image_url, image_url)
where featured_image_url is null and image_url is not null;

create index if not exists foodie_recipes_updated_at_idx on public.foodie_recipes (updated_at desc);
create index if not exists foodie_recipes_title_idx on public.foodie_recipes using gin (to_tsvector('english', coalesce(title, '')));
create index if not exists foodie_recipes_tags_idx on public.foodie_recipes using gin (tags);
create index if not exists foodie_recipes_dietary_idx on public.foodie_recipes using gin (dietary);
create index if not exists foodie_recipes_source_images_idx on public.foodie_recipes using gin (source_image_urls);
create index if not exists foodie_recipes_search_idx on public.foodie_recipes using gin (
  to_tsvector(
    'english',
    coalesce(title, '') || ' ' ||
    coalesce(source_label, '') || ' ' ||
    coalesce(collection, '') || ' ' ||
    coalesce(category, '') || ' ' ||
    coalesce(cuisine, '') || ' ' ||
    coalesce(array_to_string(tags, ' '), '') || ' ' ||
    coalesce(array_to_string(dietary, ' '), '') || ' ' ||
    coalesce(ingredients, '') || ' ' ||
    coalesce(instructions, '') || ' ' ||
    coalesce(notes, '') || ' ' ||
    coalesce(ocr_text, '')
  )
);

create or replace function public.set_foodie_recipes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_foodie_recipes_updated_at on public.foodie_recipes;
create trigger trg_foodie_recipes_updated_at
before update on public.foodie_recipes
for each row
execute function public.set_foodie_recipes_updated_at();

alter table public.foodie_recipes enable row level security;

drop policy if exists "foodie_recipes_select" on public.foodie_recipes;
create policy "foodie_recipes_select"
on public.foodie_recipes
for select
to anon, authenticated
using (true);

drop policy if exists "foodie_recipes_insert" on public.foodie_recipes;
create policy "foodie_recipes_insert"
on public.foodie_recipes
for insert
to anon, authenticated
with check (true);

drop policy if exists "foodie_recipes_update" on public.foodie_recipes;
create policy "foodie_recipes_update"
on public.foodie_recipes
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "foodie_recipes_delete" on public.foodie_recipes;
create policy "foodie_recipes_delete"
on public.foodie_recipes
for delete
to anon, authenticated
using (true);

insert into storage.buckets (id, name, public)
values ('foodie_recipe_assets', 'foodie_recipe_assets', true)
on conflict (id) do nothing;

drop policy if exists "foodie_storage_public_select" on storage.objects;
create policy "foodie_storage_public_select"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'foodie_recipe_assets');

drop policy if exists "foodie_storage_public_insert" on storage.objects;
create policy "foodie_storage_public_insert"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'foodie_recipe_assets');

drop policy if exists "foodie_storage_public_update" on storage.objects;
create policy "foodie_storage_public_update"
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'foodie_recipe_assets')
with check (bucket_id = 'foodie_recipe_assets');

drop policy if exists "foodie_storage_public_delete" on storage.objects;
create policy "foodie_storage_public_delete"
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'foodie_recipe_assets');
