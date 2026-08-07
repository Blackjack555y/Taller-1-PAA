-- schema.sql
-- Esquema de la base de datos en Supabase (PostgreSQL) para el pipeline
-- de scraping. Ejecutar en el SQL Editor de Supabase.

create extension if not exists "pgcrypto";

create table if not exists scraped_items (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  link        text,
  category    text,
  price       numeric,
  brand       text,
  image_url   text,
  metadata    jsonb default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_scraped_items_created_at
  on scraped_items (created_at desc);

create index if not exists idx_scraped_items_category
  on scraped_items (category);

alter table scraped_items enable row level security;

create policy "Public read access"
  on scraped_items
  for select
  using (true);