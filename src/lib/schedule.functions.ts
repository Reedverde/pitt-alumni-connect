import { createServerFn } from "@tanstack/react-start";

export type ScheduleEvent = {
  id: string;
  title: string;
  day_number: number | null;
  starts_at: string | null;
  ends_at: string | null;
  time_tbd: boolean;
  location: string | null;
  notes: string | null;
  division: string | null;
  sort_order: number;
};

/** Public read. A time change is a database update, never a deploy. */
export const getSchedule = createServerFn({ method: "GET" }).handler(
  async (): Promise<ScheduleEvent[]> => {
    const { loadEvents } = await import("@/lib/ics.server");
    return loadEvents(2026);
  },
);
