import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getAdminDashboard } from "@/lib/admin.functions";
import { MergeTool } from "@/components/admin/MergeTool";
import { PRESET_LABELS, PeopleTable } from "@/components/admin/PeopleTable";
import { OverviewPanel } from "@/components/admin/OverviewPanel";
import type { OverviewTile, PeopleFilterKey } from "@/lib/admin.server";
import { ReviewQueue } from "@/components/admin/ReviewQueue";
import { RosterImport } from "@/components/admin/RosterImport";
import {
  ConfidencePanel,
  DivisionsPanel,
  DigestPanel,
  DonateQrPanel,
  DripPanel,
  ExportPanel,
  GapsPanel,
  HeadcountPanel,
} from "@/components/admin/Panels";

import { EditionsPanel } from "@/components/admin/EditionsPanel";
import { PhotosPanel } from "@/components/admin/PhotosPanel";
import { RsvpBreakdownPanel, SendsPanel, SourcesPanel } from "@/components/admin/SendsPanel";
import { MailPanel } from "@/components/admin/MailPanel";
import { DripDispatchPanel } from "@/components/admin/DripDispatchPanel";
import { ScheduledCampaignPanel } from "@/components/admin/ScheduledCampaignPanel";
import { AuthAttemptsPanel } from "@/components/admin/AuthAttemptsPanel";
import { NewsPanel } from "@/components/admin/NewsPanel";
import { Section } from "@/components/admin/ui";
import { PageShell } from "@/components/layout/PageShell";

export const Route = createFileRoute("/_authenticated/admin")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
    view: typeof search.view === "string" ? search.view : undefined,
    event: typeof search.event === "string" ? search.event : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Organizer tools — Pitt Club Ultimate Alumni" },
      { name: "description", content: "Internal organizer tools for the Pitt Club Ultimate alumni board." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Organizer tools — Pitt Club Ultimate Alumni" },
      { property: "og:description", content: "Internal organizer tools for the Pitt Club Ultimate alumni board." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "review", label: "Review queue" },
  { key: "people", label: "People" },
  { key: "duplicates", label: "Duplicates" },
  { key: "roster", label: "Roster import" },
  { key: "editions", label: "Editions" },
  { key: "schedule", label: "Schedule" },
  { key: "photos", label: "Photos" },
  { key: "mail", label: "Mail" },
  { key: "news", label: "News" },
  { key: "sends", label: "Sends" },
  { key: "auth", label: "Auth attempts" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-[560px] px-5 py-24">
      <h1 className="display-30" style={{ color: "var(--sabah-black)" }}>
        Page not found
      </h1>
      <p className="mt-3" style={{ fontSize: 14, color: "var(--sterling)" }}>
        Nothing lives at this address.{" "}
        <Link to="/" style={{ color: "var(--pitt-royal)" }}>
          Back to the board
        </Link>
        .
      </p>
    </main>
  );
}

/** Organizer tools stay dense and table first, but they wear the same chrome
 *  as the rest of the site so moving in and out of them is not jarring. */
function AdminPage() {
  return (
    <PageShell bare>
      <AdminInner />
    </PageShell>
  );
}

function AdminInner() {
  const queryClient = useQueryClient();
  const fetchDashboard = useServerFn(getAdminDashboard);
  const navigate = useNavigate({ from: "/admin" });
  const search = Route.useSearch();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => fetchDashboard({}),
  });

  const refresh = () => queryClient.invalidateQueries();
  const active: TabKey = (TABS.find((t) => t.key === search.tab)?.key ?? "overview") as TabKey;
  const preset =
    search.view && search.view in PRESET_LABELS ? (search.view as PeopleFilterKey) : null;
  const go = (tab: TabKey, view?: string, event?: string) =>
    navigate({ search: { tab, view: view ?? undefined, event: event ?? undefined }, replace: true });
  /** A tile is the number and the list at once: opening one lands on exactly
   *  the people it counted. */
  const openTile = (tile: OverviewTile) =>
    go(tile.tab as TabKey, tile.filter ?? undefined);

  if (isLoading)
    return (
      <main id="main" className="mx-auto max-w-[1180px] px-5 py-16">
        <p style={{ fontSize: 13, color: "var(--sterling)" }}>Pulling the latest numbers…</p>
      </main>
    );

  if (!data || data.isAdmin !== true) return <NotFound />;

  const badges: Partial<Record<TabKey, number>> = {
    review: data.queue.length,
    duplicates: data.duplicates.length,
  };

  return (
    <main id="main" className="mx-auto max-w-[1180px] px-5 py-12">
      <header className="mb-8">
        <h1 className="display-48" style={{ color: "var(--sabah-black)" }}>
          Organizer tools
        </h1>
        <p className="mt-2" style={{ fontSize: 13, color: "var(--sterling)" }}>
          Seven people share this page. Every write is logged with your name.{" "}
          <Link to="/" style={{ color: "var(--pitt-royal)" }}>
            Back to the board
          </Link>
        </p>
      </header>

      <nav
        className="mb-10 flex flex-wrap gap-1"
        style={{ borderBottom: "1px solid var(--chalk)", paddingBottom: 8 }}
      >
        {TABS.map((tab) => {
          const on = tab.key === active;
          const count = badges[tab.key] ?? 0;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => go(tab.key)}
              className="label-caps"
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                cursor: "pointer",
                background: on ? "var(--concrete)" : "transparent",
                color: on ? "var(--pitt-royal)" : "var(--sterling)",
              }}
            >
              {tab.label}
              {count > 0 ? (
                <span
                  style={{
                    marginLeft: 7,
                    fontFamily: '"Space Mono", monospace',
                    fontSize: 11,
                    borderRadius: 999,
                    padding: "1px 7px",
                    background: "var(--pitt-royal)",
                    color: "var(--pure-white)",
                  }}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {active === "overview" ? (
        <OverviewPanel
          overview={data.overview}
          events={data.eventHeadcounts}
          onOpen={openTile}
          onOpenEvent={(target) => go("people", target.filter, target.eventId)}
        />
      ) : null}
      {active === "review" ? <ReviewQueue queue={data.queue} onRefresh={refresh} /> : null}
      {active === "people" ? (
        <PeopleTable
          preset={preset}
          promptEventCount={data.eventHeadcounts.length}
          eventId={search.event ?? null}
          eventLabel={
            data.eventHeadcounts.find((e) => e.eventId === search.event)?.title ?? null
          }
          onClearPreset={() => go("people")}
        />
      ) : null}
      {active === "duplicates" ? (
        <MergeTool pairs={data.duplicates} archived={data.archived} onDone={refresh} />
      ) : null}
      {active === "roster" ? <RosterImport seasonYear={data.seasonYear} onDone={refresh} /> : null}
      {active === "editions" ? <EditionsPanel rows={data.editions} onSaved={refresh} /> : null}
      {active === "schedule" ? (
        <>
          <HeadcountPanel headcount={data.headcount} />
          <DonateQrPanel />
          <Section eyebrow="Data confidence" title="What we actually know">
            <DivisionsPanel rows={data.divisions} onSaved={refresh} />
            <ConfidencePanel rows={data.teamNames} onSaved={refresh} />
            <GapsPanel gaps={data.gaps} />
          </Section>
          <DigestPanel cohorts={data.digest} />
          <DripPanel drip={data.drip} />
          <ExportPanel />
        </>
      ) : null}
      {active === "photos" ? <PhotosPanel /> : null}
      {active === "mail" ? (
        <>
          <MailPanel />
          <ScheduledCampaignPanel />
          <DripDispatchPanel />
        </>
      ) : null}
      {active === "sends" ? (
        <>
          <RsvpBreakdownPanel data={data.rsvpBreakdown} />
          <SendsPanel rows={data.sends} totals={data.sendTotals} />
          <SourcesPanel sources={data.rsvpSources} />
        </>
      ) : null}
      {active === "auth" ? <AuthAttemptsPanel /> : null}
      {active === "news" ? <NewsPanel /> : null}
    </main>
  );
}
