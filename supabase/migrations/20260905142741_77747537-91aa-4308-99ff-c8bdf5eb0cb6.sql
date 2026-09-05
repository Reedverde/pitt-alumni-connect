create or replace view public.board_coaches as
select
  p.id,
  p.first_name,
  p.last_name,
  p.played_as,
  p.deceased,
  case
    when p.deceased then 'memorial'::text
    when r.status = 'going'::text then 'going'::text
    when r.status = 'maybe'::text then 'maybe'::text
    when exists (select 1 from identities i where i.person_id = p.id and i.verified_at is not null) then 'claimed'::text
    else 'unclaimed'::text
  end as state,
  case
    when exists (select 1 from stints s where s.person_id = p.id and s.role = 'coach'::text) then 'coach'::text
    else 'manager'::text
  end as role_label,
  coalesce(pr.has_deliverable_email, false) as has_contact
from people p
left join person_reachability pr on pr.person_id = p.id
left join rsvps r on r.person_id = p.id and r.event_year = (select e.event_year from editions e where e.is_current limit 1)
where p.archived = false
  and p.show_on_board = true
  and exists (select 1 from stints s where s.person_id = p.id and s.role in ('coach'::text, 'manager'::text));