ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS board_year int;
CREATE INDEX IF NOT EXISTS photos_board_year_idx ON public.photos (board_year);