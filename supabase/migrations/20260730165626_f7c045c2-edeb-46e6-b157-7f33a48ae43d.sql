alter table public.sends alter column sequence_id drop not null;
alter table public.sends add column if not exists kind text not null default 'transactional';
alter table public.sends add column if not exists to_email text;
alter table public.sends add column if not exists provider text;
alter table public.sends add column if not exists provider_message_id text;
alter table public.sends add column if not exists status text not null default 'queued';
alter table public.sends add column if not exists error text;
alter table public.sends add column if not exists created_at timestamptz not null default now();

create index if not exists sends_created_at_idx on public.sends (created_at desc);
create index if not exists sends_provider_message_id_idx on public.sends (provider_message_id);
create index if not exists sends_to_email_idx on public.sends (lower(to_email));

grant all on public.sends to service_role;
grant all on public.suppressions to service_role;

insert into public.admins (person_id)
select id from public.people
where seed_id in ('reed-verdesoto','william-brotman','nick-kaczmarek')
on conflict (person_id) do nothing;