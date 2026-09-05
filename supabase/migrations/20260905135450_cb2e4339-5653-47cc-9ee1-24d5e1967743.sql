
create or replace function public.people_guard_member_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Organizers and server-side (service role) writes are unrestricted.
  if public.is_admin() or current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  -- A member editing their own row may only touch these columns.
  if (new.id, new.member_no, new.seed_id, new.grad_year, new.seed_division,
      new.seed_division_alt, new.deceased, new.deceased_note, new.deceased_confirmed_by,
      new.deceased_confirmed_at, new.needs_review, new.is_anchor, new.archived,
      new.merged_into_person_id, new.merged_at, new.created_at)
     is distinct from
     (old.id, old.member_no, old.seed_id, old.grad_year, old.seed_division,
      old.seed_division_alt, old.deceased, old.deceased_note, old.deceased_confirmed_by,
      old.deceased_confirmed_at, old.needs_review, old.is_anchor, old.archived,
      old.merged_into_person_id, old.merged_at, old.created_at) then
    raise exception 'Only organizers can change that part of a profile.';
  end if;

  return new;
end;
$$;

drop trigger if exists people_guard_member_columns on public.people;
create trigger people_guard_member_columns
before update on public.people
for each row execute function public.people_guard_member_columns();

create or replace function public.stints_guard_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.confirmed_by is not null or new.confirmed_at is not null then
      raise exception 'Only organizers can mark a season as confirmed.';
    end if;
  else
    if new.confirmed_by is distinct from old.confirmed_by
       or new.confirmed_at is distinct from old.confirmed_at then
      raise exception 'Only organizers can mark a season as confirmed.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists stints_guard_confirmation on public.stints;
create trigger stints_guard_confirmation
before insert or update on public.stints
for each row execute function public.stints_guard_confirmation();
