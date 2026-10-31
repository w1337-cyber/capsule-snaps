-- Capsule: database, security rules and the time lock.
-- Snaps can be listed by members (so you see "12 sealed"), but the media files
-- can only be downloaded once the group's unlock time has passed. Enforced by Postgres, not the app.

create extension if not exists pgcrypto;

-- ---------- tables ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 30)
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  emoji text not null default '📸' check (char_length(emoji) <= 8),
  unlock_at timestamptz not null,
  code text not null unique,
  created_by uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.snaps (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  by uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('image', 'video')),
  path text not null,
  caption text not null default '' check (char_length(caption) <= 120),
  created_at timestamptz not null default now()
);
create index if not exists snaps_group_idx on public.snaps (group_id, created_at);

create table if not exists public.msgs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  by uuid not null default auth.uid() references auth.users on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists msgs_group_idx on public.msgs (group_id, created_at);

-- ---------- helpers (security definer so RLS can call them without recursion) ----------
create or replace function public.is_member(g text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members m where m.group_id::text = g and m.user_id = auth.uid());
$$;

create or replace function public.group_open(g text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from groups x where x.id::text = g and x.unlock_at <= now());
$$;

-- people you share a group with (for showing names)
create or replace function public.shares_group(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select u = auth.uid() or exists (
    select 1 from members a join members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = u);
$$;

-- server sets author + time, so nobody can backdate or impersonate
create or replace function public.stamp_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.by := auth.uid();
  new.created_at := now();
  return new;
end $$;

drop trigger if exists snaps_stamp on public.snaps;
create trigger snaps_stamp before insert on public.snaps for each row execute function public.stamp_row();
drop trigger if exists msgs_stamp on public.msgs;
create trigger msgs_stamp before insert on public.msgs for each row execute function public.stamp_row();

-- ---------- RPCs ----------
create or replace function public.create_group(p_name text, p_emoji text, p_unlock timestamptz)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_code text; v_id uuid; v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_unlock <= now() + interval '1 minute' then raise exception 'unlock time must be in the future'; end if;
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    exit when not exists (select 1 from groups where code = v_code);
  end loop;
  insert into groups (name, emoji, unlock_at, code, created_by)
    values (trim(p_name), coalesce(nullif(p_emoji, ''), '📸'), p_unlock, v_code, auth.uid())
    returning id into v_id;
  insert into members (group_id, user_id) values (v_id, auth.uid());
  return json_build_object('id', v_id, 'code', v_code);
end $$;

create or replace function public.join_group(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select id into v_id from groups where code = upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'));
  if v_id is null then raise exception 'not-found'; end if;
  if (select count(*) from members where group_id = v_id) >= 50 then raise exception 'group is full'; end if;
  insert into members (group_id, user_id) values (v_id, auth.uid()) on conflict do nothing;
  return v_id;
end $$;

revoke all on function public.create_group(text, text, timestamptz) from anon;
revoke all on function public.join_group(text) from anon;
grant execute on function public.create_group(text, text, timestamptz) to authenticated;
grant execute on function public.join_group(text) to authenticated;

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.members enable row level security;
alter table public.snaps enable row level security;
alter table public.msgs enable row level security;

drop policy if exists "read names of people you share a group with" on public.profiles;
create policy "read names of people you share a group with" on public.profiles for select to authenticated using (public.shares_group(id));
drop policy if exists "write own profile" on public.profiles;
create policy "write own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "members read group" on public.groups;
create policy "members read group" on public.groups for select to authenticated using (public.is_member(id::text));
-- no insert/update/delete policies: groups are created via create_group(); the unlock date can never change

drop policy if exists "members read members" on public.members;
create policy "members read members" on public.members for select to authenticated using (public.is_member(group_id::text));

drop policy if exists "members read snap list" on public.snaps;
create policy "members read snap list" on public.snaps for select to authenticated using (public.is_member(group_id::text));
drop policy if exists "members add snaps before unlock" on public.snaps;
create policy "members add snaps before unlock" on public.snaps for insert to authenticated
  with check (public.is_member(group_id::text) and not public.group_open(group_id::text)
              and path like group_id::text || '/' || auth.uid()::text || '/%');

drop policy if exists "members read chat" on public.msgs;
create policy "members read chat" on public.msgs for select to authenticated using (public.is_member(group_id::text));
drop policy if exists "members write chat" on public.msgs;
create policy "members write chat" on public.msgs for insert to authenticated with check (public.is_member(group_id::text));

-- ---------- storage: the actual lock ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('snaps', 'snaps', false, 52428800, array['image/*', 'video/*'])
on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = array['image/*', 'video/*'];

drop policy if exists "capsule upload before unlock" on storage.objects;
create policy "capsule upload before unlock" on storage.objects for insert to authenticated
  with check (bucket_id = 'snaps'
              and public.is_member((storage.foldername(name))[1])
              and (storage.foldername(name))[2] = auth.uid()::text
              and not public.group_open((storage.foldername(name))[1]));

drop policy if exists "capsule download after unlock" on storage.objects;
create policy "capsule download after unlock" on storage.objects for select to authenticated
  using (bucket_id = 'snaps'
         and public.is_member((storage.foldername(name))[1])
         and public.group_open((storage.foldername(name))[1]));
-- no update/delete policies: sealed snaps can't be changed or removed

-- ---------- realtime ----------
do $$ begin
  begin alter publication supabase_realtime add table public.snaps; exception when others then null; end;
  begin alter publication supabase_realtime add table public.msgs; exception when others then null; end;
  begin alter publication supabase_realtime add table public.members; exception when others then null; end;
end $$;
