-- 1. Remove anonymous direct row access to sensitive tables
DROP POLICY IF EXISTS "public board people" ON public.people;
DROP POLICY IF EXISTS "public board stints" ON public.stints;
DROP POLICY IF EXISTS "public board rsvps" ON public.rsvps;
DROP POLICY IF EXISTS "anon reads claimed flag only" ON public.identities;

REVOKE ALL ON public.people FROM anon;
REVOKE ALL ON public.stints FROM anon;
REVOKE ALL ON public.rsvps FROM anon;
REVOKE ALL ON public.identities FROM anon;

-- 2. Keep the public board working: aggregate view no longer depends on anon RLS
ALTER VIEW public.board_year_counts SET (security_invoker = off);
GRANT SELECT ON public.board_year_counts TO anon, authenticated;

ALTER VIEW public.person_board_placement SET (security_invoker = off);
REVOKE ALL ON public.person_board_placement FROM anon;

-- 3. Pin search_path on the remaining mutable-search_path function
CREATE OR REPLACE FUNCTION public.block_current_season_playing_stint()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  -- Members may never record a current-season playing stint: cuts land the week
  -- before the weekend. Captain-supplied rosters arrive as 'roster_import' and
  -- are the only permitted path. The member-facing path writes 'self'.
  IF NEW.role IN ('player', 'captain')
     AND NEW.year = EXTRACT(year FROM now())::integer
     AND coalesce(NEW.source, '') <> 'roster_import' THEN
    RAISE EXCEPTION 'Current-season playing stints cannot be recorded.';
  END IF;
  RETURN NEW;
END;
$function$;