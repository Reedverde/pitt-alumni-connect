INSERT INTO public.app_settings (key, value)
VALUES ('rsvp_confirmation_cutoff', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
ON CONFLICT (key) DO NOTHING;