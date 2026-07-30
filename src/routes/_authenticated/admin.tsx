import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getAdminDashboard } from "@/lib/admin.functions";
import { MergeTool } from "@/components/admin/MergeTool";
import { PeopleTable } from "@/components/admin/PeopleTable";
import { ReviewQueue } from "@/components/admin/ReviewQueue";
import { RosterImport } from "@/components/admin/RosterImport";
import {
  ConfidencePanel,
  DivisionsPanel,
  DigestPanel,
  DripPanel,
  ExportPanel,
  GapsPanel,
  HeadcountPanel,
} from "@/components/admin/Panels";
import { EditionsPanel } from "@/components/admin/EditionsPanel";
import { PhotosPanel } from "@/components/admin/PhotosPanel";
import { SendsPanel } from "@/components/admin/SendsPanel";
import { MailPanel } from "@/components/admin/MailPanel";
import { AuthAttemptsPanel } from "@/components/admin/AuthAttemptsPanel";
import { Section } from "@/components/admin/ui";

export const Route = createFileRoute("/_authenticated/admin")({
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

function NotFound() {
  return (
    <main className="mx-auto max-w-[560px] px-5 py-24">
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

function AdminPage() {
  const queryClient = useQueryClient();
  const fetchDashboard = useServerFn(getAdminDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => fetchDashboard({}),
  });

  const refresh = () => queryClient.invalidateQueries();

  if (isLoading)
    return (
      <main className="mx-auto max-w-[1180px] px-5 py-16">
        <p style={{ fontSize: 13, color: "var(--sterling)" }}>Loading…</p>
      </main>
    );

  if (!data || data.isAdmin !== true) return <NotFound />;

  return (
    <main className="mx-auto max-w-[1180px] px-5 py-12">
      <header className="mb-14">
        <h1 className="display-48" style={{ color: "var(--sabah-black)" }}>
          Organizer tools
        </h1>
        <p className="mt-2" style={{ fontSize: 13, color: "var(--sterling)" }}>
          Three people share this page. Every write is logged with your name.{" "}
          <Link to="/" style={{ color: "var(--pitt-royal)" }}>
            Back to the board
          </Link>
        </p>
      </header>

      <EditionsPanel rows={data.editions} onSaved={refresh} />
      <ReviewQueue queue={data.queue} onRefresh={refresh} />
      <PeopleTable />
      <RosterImport seasonYear={data.seasonYear} onDone={refresh} />
      <MergeTool pairs={data.duplicates} onDone={refresh} />
      <PhotosPanel />
      <ExportPanel />
      <MailPanel />
      <AuthAttemptsPanel />
      <HeadcountPanel headcount={data.headcount} />
      <SendsPanel rows={data.sends} totals={data.sendTotals} />

      <Section eyebrow="Data confidence" title="What we actually know">
        <DivisionsPanel rows={data.divisions} onSaved={refresh} />
        <ConfidencePanel rows={data.teamNames} onSaved={refresh} />
        <GapsPanel gaps={data.gaps} />
      </Section>

      <DigestPanel cohorts={data.digest} />
      <DripPanel drip={data.drip} />
    </main>
  );
}
