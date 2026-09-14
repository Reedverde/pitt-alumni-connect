-- 1. The daily drip job is retired permanently. The row stays for history.
SELECT cron.alter_job(jobid, active := false)
FROM cron.job WHERE jobname = 'drip-daily-2000-et';

-- 2. The five remaining approved campaigns become explicit one-time schedules
--    at 9:00 a.m. America/New_York. No IDs change and no rows are created.
UPDATE public.sequences SET one_time = true, active = true,
       scheduled_at = (timestamp '2026-09-18 09:00' AT TIME ZONE 'America/New_York')
 WHERE key = 't_minus_14' AND dispatched_at IS NULL;

UPDATE public.sequences SET one_time = true, active = true,
       scheduled_at = (timestamp '2026-09-22 09:00' AT TIME ZONE 'America/New_York')
 WHERE key = 'event_rsvp_prompt_t10_2026_09_22' AND dispatched_at IS NULL;

UPDATE public.sequences SET one_time = true, active = true,
       scheduled_at = (timestamp '2026-09-25 09:00' AT TIME ZONE 'America/New_York')
 WHERE key = 't_minus_7' AND dispatched_at IS NULL;

UPDATE public.sequences SET one_time = true, active = true,
       scheduled_at = (timestamp '2026-09-30 09:00' AT TIME ZONE 'America/New_York')
 WHERE key = 'locked_schedule_2026_09_30' AND dispatched_at IS NULL;

UPDATE public.sequences SET one_time = true, active = true,
       scheduled_at = (timestamp '2026-10-05 09:00' AT TIME ZONE 'America/New_York')
 WHERE key = 't_plus_3' AND dispatched_at IS NULL;

-- 3. Everything else is off. Rolling sequences no longer exist as a pathway.
UPDATE public.sequences SET active = false
 WHERE key NOT IN ('t_minus_14','event_rsvp_prompt_t10_2026_09_22','t_minus_7',
                   'locked_schedule_2026_09_30','t_plus_3');

-- 4. Outbound mode is permanently transactional_only.
INSERT INTO public.app_settings (key, value)
VALUES ('outbound_email_mode', 'transactional_only')
ON CONFLICT (key) DO UPDATE SET value = 'transactional_only';

-- 5. Automatic RSVP confirmations are retired: the forward-only cutoff is
--    cleared, so the gate fails closed even if a code path is reached.
UPDATE public.app_settings SET value = '' WHERE key = 'rsvp_confirmation_cutoff';

INSERT INTO public.audit_log (actor_person_id, action, table_name, record_id, before, after)
VALUES (NULL, 'email_program_no_drip_rule', 'sequences', NULL, NULL,
  jsonb_build_object(
    'rule', 'no rolling drip, no catch-up, no past-due reconsideration; only dated one-time campaigns and person-initiated access email',
    'daily_cron', 'drip-daily-2000-et disabled (history kept)',
    'scheduled', jsonb_build_array('t_minus_14 2026-09-18','event_rsvp_prompt_t10_2026_09_22 2026-09-22','t_minus_7 2026-09-25','locked_schedule_2026_09_30 2026-09-30','t_plus_3 2026-10-05'),
    'rsvp_confirmation', 'retired',
    'outbound_email_mode', 'transactional_only (permanent)'
  ));