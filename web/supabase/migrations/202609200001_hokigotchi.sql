-- Run the whole file in the Supabase SQL editor. Safe to rerun after an earlier attempt.
-- Existing hoki_* rows are preserved; missing objects are created and functions refreshed.
-- Existing tables must have the schema from this Hokigotchi setup.
begin;
create table if not exists public.hoki_players (
  user_id uuid primary key references auth.users(id) on delete cascade,
  game jsonb not null check (jsonb_typeof(game) = 'object'),
  revision bigint not null default 0 check (revision >= 0),
  listed boolean not null default false,
  updated_at timestamptz not null default now()
);
create table if not exists public.hoki_receipts (
  user_id uuid not null references public.hoki_players(user_id) on delete cascade,
  request_id uuid not null,
  fingerprint text not null,
  notice text not null,
  created_at timestamptz not null default now(),
  primary key(user_id, request_id)
);
create index if not exists hoki_receipt_rate on public.hoki_receipts(user_id, created_at);
create table if not exists public.hoki_practice_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  game jsonb not null check (jsonb_typeof(game) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.hoki_players enable row level security;
alter table public.hoki_receipts enable row level security;
alter table public.hoki_practice_backups enable row level security;
-- All access goes through the authenticated Next server. Client roles have no table access.
revoke all on public.hoki_players, public.hoki_receipts, public.hoki_practice_backups from public, anon, authenticated;
grant select, insert, update, delete on public.hoki_players, public.hoki_receipts, public.hoki_practice_backups to service_role;

create or replace function public.hoki_ensure(p_user uuid, p_game jsonb) returns void
language sql security invoker set search_path = '' as $$
  insert into public.hoki_players(user_id, game) values(p_user, p_game) on conflict(user_id) do nothing;
$$;

create or replace function public.hoki_commit(p_user uuid, p_expected bigint, p_request_id uuid,
  p_fingerprint text, p_game jsonb, p_listed boolean, p_notice text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_revision bigint; v_receipt public.hoki_receipts%rowtype;
begin
  -- One lock serializes all writes for this player, including distinct concurrent requests.
  select revision into v_revision from public.hoki_players where user_id = p_user for update;
  if not found then return jsonb_build_object('status','conflict'); end if;
  select * into v_receipt from public.hoki_receipts where user_id = p_user and request_id = p_request_id;
  if found then
    if v_receipt.fingerprint <> p_fingerprint then return jsonb_build_object('status','reuse'); end if;
    return jsonb_build_object('status','duplicate','notice',v_receipt.notice);
  end if;
  if v_revision <> p_expected then return jsonb_build_object('status','conflict'); end if;
  if (select count(*) from public.hoki_receipts where user_id = p_user and created_at > now() - interval '1 minute') >= 60 then
    return jsonb_build_object('status','rate');
  end if;
  update public.hoki_players set game = p_game, listed = p_listed,
    revision = revision + 1, updated_at = now() where user_id = p_user;
  insert into public.hoki_receipts(user_id,request_id,fingerprint,notice) values(p_user,p_request_id,p_fingerprint,p_notice);
  return jsonb_build_object('status','committed','notice',p_notice);
end;
$$;

create or replace function public.hoki_leaderboard(p_user uuid, p_day date, p_metric text default 'score')
returns table ("position" bigint, player_name text, score integer, logging_days integer, checkins integer, is_you boolean)
language sql stable security invoker set search_path = '' as $$
  with totals as (
    select user_id, game->>'name' as player_name,
      case when game->'weekly'->>'start' = to_char(date_trunc('week',p_day::timestamp),'YYYY-MM-DD')
        then (game->'weekly'->>'score')::integer else 0 end as score,
      (select count(*)::integer from jsonb_each(game->'days') d
        where d.key::date between date_trunc('week',p_day::timestamp)::date and p_day and (d.value->>'expenses')::integer > 0) as logging_days,
      (select count(*)::integer from jsonb_each(game->'days') d
        where d.key::date between date_trunc('week',p_day::timestamp)::date and p_day and (d.value->>'checkin')::boolean) as checkins
    from public.hoki_players where listed
  ), ranked as (
    select *, rank() over (order by case p_metric when 'logging' then logging_days when 'checkins' then checkins else score end desc) as "position"
    from totals
  ), limited as (
    select *, row_number() over(order by "position", user_id) as display_order from ranked
  )
  select "position", player_name, score, logging_days, checkins, user_id = p_user
    from limited where display_order <= 50 or user_id = p_user order by display_order;
$$;

revoke all on function public.hoki_ensure(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.hoki_commit(uuid,bigint,uuid,text,jsonb,boolean,text) from public, anon, authenticated;
revoke all on function public.hoki_leaderboard(uuid,date,text) from public, anon, authenticated;
grant execute on function public.hoki_ensure(uuid,jsonb) to service_role;
grant execute on function public.hoki_commit(uuid,bigint,uuid,text,jsonb,boolean,text) to service_role;
grant execute on function public.hoki_leaderboard(uuid,date,text) to service_role;
commit;
