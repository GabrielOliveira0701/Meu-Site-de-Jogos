create table if not exists public.game_reviews (
  id uuid primary key default gen_random_uuid(),
  game_id integer not null check (game_id > 0),
  rating smallint not null check (rating between 1 and 5),
  author_name text not null default 'Visitante'
    check (char_length(author_name) between 1 and 30),
  comment text not null default ''
    check (char_length(comment) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists game_reviews_game_created_idx
  on public.game_reviews (game_id, created_at desc);

alter table public.game_reviews enable row level security;

revoke all on public.game_reviews from anon, authenticated;
grant select, insert on public.game_reviews to anon;

drop policy if exists "Anyone can read game reviews" on public.game_reviews;
create policy "Anyone can read game reviews"
  on public.game_reviews
  for select
  to anon
  using (true);

drop policy if exists "Anyone can submit game reviews" on public.game_reviews;
create policy "Anyone can submit game reviews"
  on public.game_reviews
  for insert
  to anon
  with check (true);
