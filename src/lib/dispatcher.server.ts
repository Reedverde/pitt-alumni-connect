import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { loadCurrentEdition } from "./editions.server";
import { editionDateRange, todayInNewYork } from "./edition-format";
import { partySizeLink } from "./party-token.server";
import {
  DISCORD_INVITE_SUBJECT,
  T_MINUS_10_SUBJECT,
  T_MINUS_14_SUBJECT,
  T_MINUS_2_SUBJECT,
  T_MINUS_45_SUBJECT,
  T_PLUS_3_SUBJECT,
  buildDiscordInviteBody,
  buildTMinus10Body,
  buildTMinus14Body,
  buildTMinus28Body,
  buildTMinus2Body,
  buildTMinus45Body,
  buildTPlus3Body,
  loadCohortGoing,
  loadScheduleLines,
  outboundEmailMode,
  outboundEmailModeSentence,
  sendPlainEmail,
  tMinus28Subject,
} from "./mail.server";

/** The one derivation of a person's state for the current edition. rsvps.status
 *  wins; a verified identity with no answer is "claimed"; nothing at all is
 *  "unclaimed". Deceased always reads as "memorial" and is never an audience. */
export type AudienceState =
  | "unclaimed"
  | "claimed"
  | "going"
  | "maybe"
  | "not_this_year"
  | "memorial";

export function audienceStateFor(opts: {
  deceased: boolean;
  status: string | null | undefined;
  verified: boolean;
}): AudienceState {
  if (opts.deceased) return "memorial";
  if (opts.status === "going") return "going";
  if (opts.status === "maybe") return "maybe";
  if (opts.status === "not_this_year") return "not_this_year";
  if (opts.verified) return "claimed";
  return "unclaimed";
}

/** Sequence keys with copy in mail.server.ts. Anything else is reported as
 *  "no copy" and skipped rather than failing the run. */
const KEYS_WITH_COPY = new Set([
  "t_minus_45",
  "t_minus_28",
  "t_minus_14",
  "t_minus_10_headcount",
  "t_minus_2",
  "t_plus_3",
  "discord_invite",
]);

/** A sequence is due from its date until two days after it, and never again. */
const WINDOW_DAYS = 2;
const RECENT_SEND_DAYS = 10;
const SEND_INTERVAL_MS = 500; // 2 per second
const MAX_CONSECUTIVE_FAILURES = 5;

export type {
  DripRecipient,
  DripRunReport,
  DripSequenceReport,
  ExclusionCounts,
} from "./drip-types";
import type { DripRecipient, DripRunReport, DripSequenceReport, ExclusionCounts } from "./drip-types";

type SequenceRow = {
  id: string;
  key: string;
  offset_days: number;
  audience_states: string[] | null;
  anchors_only: boolean;
  active: boolean;
};

function addDays(iso: string, days: number) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

function displayName(first: string, last: string | null) {
  return [first, last].filter(Boolean).join(" ");
}

function emptyCounts(): ExclusionCounts {
  return {
    deceased_archived: 0,
    no_email: 0,
    suppressed: 0,
    already_sent: 0,
    recent_send: 0,
    null_body: 0,
  };
}

type Built = { subject: string; text: string; html: string } | null;

/** Per recipient body. Returning null means "skip this person silently". */
async function buildFor(
  key: string,
  person: { id: string; name: string },
  shared: { schedule: string[]; dates: string; editionYear: number },
): Promise<Built> {
  const name = person.name;
  switch (key) {
    case "t_minus_45":
      return { subject: T_MINUS_45_SUBJECT, ...buildTMinus45Body({ name }) };
    case "discord_invite":
      return {
        subject: DISCORD_INVITE_SUBJECT,
        ...buildDiscordInviteBody({ name, dates: shared.dates }),
      };
    case "t_minus_28": {
      const cohort = await loadCohortGoing(person.id);
      const body = buildTMinus28Body({ name, cohort });
      if (!body) return null;
      return { subject: tMinus28Subject(cohort.year ?? shared.editionYear), ...body };
    }
    case "t_minus_14":
      return { subject: T_MINUS_14_SUBJECT, ...buildTMinus14Body({ name, schedule: shared.schedule }) };
    case "t_minus_2":
      return { subject: T_MINUS_2_SUBJECT, ...buildTMinus2Body({ name, schedule: shared.schedule }) };
    case "t_minus_10_headcount": {
      const oneClickLink = await partySizeLink(person.id);
      const body = buildTMinus10Body({ name, oneClickLink });
      if (!body) return null;
      return { subject: T_MINUS_10_SUBJECT, ...body };
    }
    case "t_plus_3":
      return { subject: T_PLUS_3_SUBJECT, ...buildTPlus3Body({ name }) };
    default:
      return null;
  }
}

/** Runs every check for every active sequence. Sends nothing unless dryRun is
 *  explicitly false. Nothing here schedules itself: an admin presses a button. */
export async function runDrip(opts: { dryRun: boolean }): Promise<DripRunReport> {
  const dryRun = opts.dryRun !== false;
  const edition = await loadCurrentEdition();
  const today = todayInNewYork();
  const mode = await outboundEmailMode();

  const [seqRes, peopleRes, identRes, rsvpRes, supRes, sendRes] = await Promise.all([
    supabaseAdmin
      .from("sequences")
      .select("id, key, offset_days, audience_states, anchors_only, active")
      .eq("active", true)
      .order("offset_days", { ascending: true }),
    supabaseAdmin
      .from("people")
      .select("id, first_name, last_name, deceased, archived, is_anchor"),
    supabaseAdmin.from("identities").select("person_id, email, is_primary, verified_at"),
    supabaseAdmin
      .from("rsvps")
      .select("person_id, status")
      .eq("event_year", edition.event_year),
    supabaseAdmin.from("suppressions").select("email"),
    supabaseAdmin.from("sends").select("person_id, sequence_id, outcome, created_at"),
  ]);

  const sequences = ((seqRes.data ?? []) as SequenceRow[]).filter((s) => s.active);

  const verified = new Set<string>();
  const addresses = new Map<string, { email: string; primary: boolean; verified: boolean }[]>();
  for (const row of identRes.data ?? []) {
    const pid = row.person_id as string;
    if (row.verified_at) verified.add(pid);
    if (typeof row.email !== "string" || !row.email.trim()) continue;
    const list = addresses.get(pid) ?? [];
    list.push({
      email: row.email.trim().toLowerCase(),
      primary: Boolean(row.is_primary),
      verified: Boolean(row.verified_at),
    });
    addresses.set(pid, list);
  }

  const rsvpStatus = new Map<string, string>();
  for (const row of rsvpRes.data ?? []) rsvpStatus.set(row.person_id as string, row.status as string);

  const suppressed = new Set<string>();
  for (const row of supRes.data ?? [])
    suppressed.add(String(row.email ?? "").trim().toLowerCase());

  const sentBySequence = new Map<string, Set<string>>();
  const recentlySent = new Set<string>();
  const recentCutoff = Date.now() - RECENT_SEND_DAYS * 86400000;
  for (const row of sendRes.data ?? []) {
    const pid = row.person_id as string | null;
    if (!pid) continue;
    const seqId = row.sequence_id as string | null;
    if (seqId) {
      const set = sentBySequence.get(seqId) ?? new Set<string>();
      set.add(pid);
      sentBySequence.set(seqId, set);
    }
    if (row.outcome === "sent") {
      const at = Date.parse(String(row.created_at ?? ""));
      if (Number.isFinite(at) && at >= recentCutoff) recentlySent.add(pid);
    }
  }

  const people = (peopleRes.data ?? []) as {
    id: string;
    first_name: string;
    last_name: string | null;
    deceased: boolean;
    archived: boolean;
    is_anchor: boolean;
  }[];

  const needsSchedule = sequences.some((s) => s.key === "t_minus_14" || s.key === "t_minus_2");
  const shared = {
    schedule: needsSchedule ? await loadScheduleLines() : [],
    dates: editionDateRange(edition),
    editionYear: edition.event_year,
  };

  const reports: DripSequenceReport[] = [];
  let stoppedReason: string | null = null;
  let totalSent = 0;

  for (const seq of sequences) {
    const dueDate = addDays(edition.starts_on, seq.offset_days);
    const due = today >= dueDate && today <= addDays(dueDate, WINDOW_DAYS);
    const hasCopy = KEYS_WITH_COPY.has(seq.key);
    const states = seq.audience_states ?? [];
    const excluded = emptyCounts();
    const sample: DripRecipient[] = [];
    let eligible = 0;
    let sent = 0;
    let failed = 0;

    const note = !hasCopy
      ? "no copy"
      : today < dueDate
        ? "not due yet"
        : !due
          ? "window closed"
          : "due";

    if (!hasCopy || !due) {
      reports.push({
        id: seq.id,
        key: seq.key,
        offsetDays: seq.offset_days,
        dueDate,
        due,
        hasCopy,
        note,
        audienceStates: states,
        anchorsOnly: seq.anchors_only,
        eligible: 0,
        excluded,
        sample: [],
        sent: 0,
        failed: 0,
      });
      continue;
    }

    const alreadySent = sentBySequence.get(seq.id) ?? new Set<string>();
    let consecutiveFailures = 0;

    for (const person of people) {
      const state = audienceStateFor({
        deceased: person.deceased,
        status: rsvpStatus.get(person.id),
        verified: verified.has(person.id),
      });
      if (seq.anchors_only && !person.is_anchor) continue;

      if (person.deceased || person.archived) {
        // Only counted when they would otherwise have been in the audience.
        if (states.includes(audienceStateFor({
          deceased: false,
          status: rsvpStatus.get(person.id),
          verified: verified.has(person.id),
        })))
          excluded.deceased_archived++;
        continue;
      }
      if (!states.includes(state)) continue;

      const own = addresses.get(person.id) ?? [];
      if (own.length === 0) {
        excluded.no_email++;
        continue;
      }
      // Deliverable means any address of theirs that is not suppressed.
      const email = pickDeliverable(own, suppressed);
      if (!email) {
        excluded.suppressed++;
        continue;
      }
      if (alreadySent.has(person.id)) {
        excluded.already_sent++;
        continue;
      }
      if (recentlySent.has(person.id)) {
        excluded.recent_send++;
        continue;
      }

      const name = displayName(person.first_name, person.last_name);
      const built = await buildFor(seq.key, { id: person.id, name }, shared);
      if (!built) {
        excluded.null_body++;
        continue;
      }

      eligible++;
      if (sample.length < 10) sample.push({ personId: person.id, name, email });

      if (dryRun) continue;

      const result = await sendPlainEmail({
        to: email,
        personId: person.id,
        kind: `drip:${seq.key}`,
        subject: built.subject,
        text: built.text,
        html: built.html,
        sequenceId: seq.id,
      });

      if (result.sent) {
        sent++;
        totalSent++;
        consecutiveFailures = 0;
      } else {
        failed++;
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          stoppedReason = `Stopped after ${MAX_CONSECUTIVE_FAILURES} failures in a row on ${seq.key}: ${result.reason ?? "unknown"}`;
          break;
        }
      }

      await new Promise((r) => setTimeout(r, SEND_INTERVAL_MS));
    }

    // One campaign level bulletin item, not one per recipient, and only when
    // mail actually went out.
    if (!dryRun && sent > 0) {
      const { addPendingUpdate } = await import("./news.server");
      await addPendingUpdate({
        kind: "campaign_sent",
        title: "An Alumni Weekend email went out",
        summary: `${sent} alumni were emailed. Check your inbox if you are on the list.`,
        category: "Weekend",
        dedupeKey: `campaign:${seq.id}:${edition.event_year}`,
      });
    }

    reports.push({
      id: seq.id,
      key: seq.key,
      offsetDays: seq.offset_days,
      dueDate,
      due,
      hasCopy,
      note,
      audienceStates: states,
      anchorsOnly: seq.anchors_only,
      eligible,
      excluded,
      sample,
      sent,
      failed,
    });

    if (stoppedReason) break;
  }

  return {
    dryRun,
    today,
    anchorDate: edition.starts_on,
    outboundMode: mode,
    outboundSentence: outboundEmailModeSentence(mode),
    outboundPaused: mode !== "all",
    totalEligible: reports.reduce((n, r) => n + r.eligible, 0),
    totalSent,
    stoppedReason,
    sequences: reports,
  };
}