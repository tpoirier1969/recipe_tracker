-- Recipe Tracker Supabase migration.
-- Run in the Supabase SQL Editor immediately before deploying the matching app build.
-- This project shares its Supabase instance, so every new database and storage
-- object is namespaced with recipe_tracker_*.

begin;

create extension if not exists pgcrypto;

-- Preserve production data by renaming the legacy table in place. Refuse to
-- guess if both names exist; that situation needs a deliberate reconciliation.
do $$
begin
  if to_regclass('public.recipe_tracker_recipes') is null then
    if to_regclass('public.foodie_recipes') is not null then
      execute 'alter table public.foodie_recipes rename to recipe_tracker_recipes';
    else
      execute $create_table$
        create table public.recipe_tracker_recipes (
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
          recipe_type text,
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
        )
      $create_table$;
    end if;
  elsif to_regclass('public.foodie_recipes') is not null then
    raise exception
      'Both public.recipe_tracker_recipes and public.foodie_recipes exist. Stop and reconcile them before running this migration.';
  end if;
end
$$;

-- Table renames do not rename their constraints. Rename every legacy
-- Recipe Tracker constraint instead of leaving generic foodie_* debris in the
-- shared schema.
do $$
declare
  legacy_constraint record;
  canonical_name text;
begin
  for legacy_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.recipe_tracker_recipes'::regclass
      and left(conname, 7) = 'foodie_'
  loop
    canonical_name := regexp_replace(legacy_constraint.conname, '^foodie_', 'recipe_tracker_');
    if exists (
      select 1
      from pg_constraint
      where conname = canonical_name
        and conrelid = 'public.recipe_tracker_recipes'::regclass
    ) then
      raise exception
        'Cannot rename constraint % because % already exists on public.recipe_tracker_recipes.',
        legacy_constraint.conname,
        canonical_name;
    end if;

    execute format(
      'alter table public.recipe_tracker_recipes rename constraint %I to %I',
      legacy_constraint.conname,
      canonical_name
    );
  end loop;
end
$$;

alter table public.recipe_tracker_recipes add column if not exists collection text;
alter table public.recipe_tracker_recipes add column if not exists rating smallint;
alter table public.recipe_tracker_recipes add column if not exists is_favorite boolean not null default false;
alter table public.recipe_tracker_recipes add column if not exists recipe_type text;
-- Legacy compatibility only. New application writes use recipe_type.
alter table public.recipe_tracker_recipes add column if not exists category text;
alter table public.recipe_tracker_recipes add column if not exists cuisine text;
alter table public.recipe_tracker_recipes add column if not exists recipe_yield text;
alter table public.recipe_tracker_recipes add column if not exists dietary text[] not null default '{}';
alter table public.recipe_tracker_recipes add column if not exists featured_image_url text;
alter table public.recipe_tracker_recipes add column if not exists source_image_urls text[] not null default '{}';

update public.recipe_tracker_recipes
set featured_image_url = coalesce(featured_image_url, image_url)
where featured_image_url is null and image_url is not null;

update public.recipe_tracker_recipes
set recipe_type = category
where recipe_type is null and category is not null;

grant select, insert, update, delete
on table public.recipe_tracker_recipes
to anon, authenticated;

-- Remove legacy index names left behind by the in-place table rename, then
-- recreate them with the Recipe Tracker namespace.
drop index if exists public.foodie_recipes_updated_at_idx;
drop index if exists public.foodie_recipes_title_idx;
drop index if exists public.foodie_recipes_tags_idx;
drop index if exists public.foodie_recipes_dietary_idx;
drop index if exists public.foodie_recipes_source_images_idx;
drop index if exists public.foodie_recipes_search_idx;

create index if not exists recipe_tracker_recipes_updated_at_idx
on public.recipe_tracker_recipes (updated_at desc);

create index if not exists recipe_tracker_recipes_title_idx
on public.recipe_tracker_recipes using gin (to_tsvector('english', coalesce(title, '')));

create index if not exists recipe_tracker_recipes_tags_idx
on public.recipe_tracker_recipes using gin (tags);

create index if not exists recipe_tracker_recipes_dietary_idx
on public.recipe_tracker_recipes using gin (dietary);

create index if not exists recipe_tracker_recipes_source_images_idx
on public.recipe_tracker_recipes using gin (source_image_urls);

drop index if exists public.recipe_tracker_recipes_search_idx;
create index recipe_tracker_recipes_search_idx
on public.recipe_tracker_recipes using gin (
  to_tsvector(
    'english',
    coalesce(title, '') || ' ' ||
    coalesce(source_label, '') || ' ' ||
    coalesce(collection, '') || ' ' ||
    coalesce(recipe_type, category, '') || ' ' ||
    coalesce(cuisine, '') || ' ' ||
    coalesce(array_to_string(tags, ' '), '') || ' ' ||
    coalesce(array_to_string(dietary, ' '), '') || ' ' ||
    coalesce(ingredients, '') || ' ' ||
    coalesce(instructions, '') || ' ' ||
    coalesce(notes, '') || ' ' ||
    coalesce(ocr_text, '')
  )
);

drop trigger if exists trg_foodie_recipes_updated_at on public.recipe_tracker_recipes;
drop trigger if exists recipe_tracker_recipes_set_updated_at on public.recipe_tracker_recipes;
drop function if exists public.set_foodie_recipes_updated_at();

create or replace function public.recipe_tracker_set_recipes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger recipe_tracker_recipes_set_updated_at
before update on public.recipe_tracker_recipes
for each row
execute function public.recipe_tracker_set_recipes_updated_at();

alter table public.recipe_tracker_recipes enable row level security;

drop policy if exists "foodie_recipes_select" on public.recipe_tracker_recipes;
drop policy if exists "foodie_recipes_insert" on public.recipe_tracker_recipes;
drop policy if exists "foodie_recipes_update" on public.recipe_tracker_recipes;
drop policy if exists "foodie_recipes_delete" on public.recipe_tracker_recipes;
drop policy if exists "recipe_tracker_recipes_select" on public.recipe_tracker_recipes;
drop policy if exists "recipe_tracker_recipes_insert" on public.recipe_tracker_recipes;
drop policy if exists "recipe_tracker_recipes_update" on public.recipe_tracker_recipes;
drop policy if exists "recipe_tracker_recipes_delete" on public.recipe_tracker_recipes;

create policy "recipe_tracker_recipes_select"
on public.recipe_tracker_recipes
for select
to anon, authenticated
using (true);

create policy "recipe_tracker_recipes_insert"
on public.recipe_tracker_recipes
for insert
to anon, authenticated
with check (true);

create policy "recipe_tracker_recipes_update"
on public.recipe_tracker_recipes
for update
to anon, authenticated
using (true)
with check (true);

create policy "recipe_tracker_recipes_delete"
on public.recipe_tracker_recipes
for delete
to anon, authenticated
using (true);

-- Do not rename the legacy bucket in SQL. Its existing public URLs contain the
-- old bucket id. New uploads go to the canonical bucket; legacy objects remain
-- readable until a separate Storage API copy-and-rewrite migration is desired.
insert into storage.buckets (id, name, public)
values ('recipe_tracker_assets', 'recipe_tracker_assets', true)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

update storage.buckets
set public = true
where id = 'foodie_recipe_assets';

drop policy if exists "foodie_storage_public_select" on storage.objects;
drop policy if exists "foodie_storage_public_insert" on storage.objects;
drop policy if exists "foodie_storage_public_update" on storage.objects;
drop policy if exists "foodie_storage_public_delete" on storage.objects;
drop policy if exists "recipe_tracker_assets_select" on storage.objects;
drop policy if exists "recipe_tracker_assets_insert" on storage.objects;
drop policy if exists "recipe_tracker_assets_update" on storage.objects;
drop policy if exists "recipe_tracker_assets_delete" on storage.objects;

create policy "recipe_tracker_assets_select"
on storage.objects
for select
to anon, authenticated
using (bucket_id in ('recipe_tracker_assets', 'foodie_recipe_assets'));

create policy "recipe_tracker_assets_insert"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'recipe_tracker_assets');

create policy "recipe_tracker_assets_update"
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'recipe_tracker_assets')
with check (bucket_id = 'recipe_tracker_assets');

create policy "recipe_tracker_assets_delete"
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'recipe_tracker_assets');

commit;
