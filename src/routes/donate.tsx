import { createFileRoute } from "@tanstack/react-router";

import { PageShell } from "@/components/layout/PageShell";
import { SlashEyebrow } from "@/components/board/SlashEyebrow";
import {
  FOUNDATION_DONATE_URL,
  PAYPAL_DONATE_URL,
  VENMO_DONATE_URL,
} from "@/lib/donate";

export const Route = createFileRoute("/donate")({
  head: () => ({
    meta: [
      { title: "Donate | Pitt Club Ultimate Alumni" },
      {
        name: "description",
        content:
          "Three ways to support Pitt Club Ultimate: the Pittsburgh Foundation endowment fund, PayPal, or Venmo.",
      },
      { property: "og:title", content: "Donate | Pitt Club Ultimate Alumni" },
      {
        property: "og:description",
        content:
          "Three ways to support Pitt Club Ultimate: the Pittsburgh Foundation endowment fund, PayPal, or Venmo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DonatePage,
});

const cardStyle = {
  flex: "1 1 280px",
  border: "1px solid var(--chalk)",
  background: "var(--pure-white)",
  padding: 24,
} as const;

const giveButton = {
  display: "inline-flex",
  alignItems: "center",
  background: "var(--pitt-royal)",
  color: "var(--pure-white)",
  fontFamily: '"Space Grotesk", sans-serif',
  fontSize: 13,
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  borderRadius: 7,
  padding: "10px 16px",
  textDecoration: "none",
};

function DonateCard({
  id,
  name,
  body,
  note,
  href,
  cta,
}: {
  id: string;
  name: string;
  body: string;
  note?: string;
  href: string;
  cta: string;
}) {
  return (
    <div id={id} className="flex min-w-0 flex-col" style={cardStyle}>
      <h2
        style={{
          fontFamily: '"Archivo", sans-serif',
          fontWeight: 800,
          fontSize: 22,
          letterSpacing: "-0.025em",
          color: "var(--sabah-black)",
        }}
      >
        {name}
      </h2>
      <p className="mt-2" style={{ fontSize: 16, color: "var(--steel-ink)" }}>
        {body}
      </p>
      {note && (
        <p className="mt-2" style={{ fontSize: 14, color: "var(--sterling)" }}>
          {note}
        </p>
      )}
      <div className="mt-4 flex-auto" />
      <div>
        <a href={href} target="_blank" rel="noopener noreferrer" style={giveButton}>
          {cta}
        </a>
      </div>
    </div>
  );
}

/** Three ways to give, presented as equals. No ranking, no gold. Gold means
 *  attending and this page is not about attending. */
function DonatePage() {
  return (
    <PageShell>
      <SlashEyebrow>Support the program</SlashEyebrow>
      <h1 className="display-48 mt-3" style={{ color: "var(--sabah-black)" }}>
        DONATE
      </h1>
      <p className="mt-4 max-w-[640px]" style={{ fontSize: 16, color: "var(--steel-ink)" }}>
        Three ways to give, all equal. Pick whichever is easiest for you.
      </p>

      <div className="mt-8 flex flex-col gap-6 md:flex-row">
        <DonateCard
          id="endowment"
          name="Pittsburgh Foundation endowment fund"
          body="The official Endowment for Pitt Ultimate, held at the Pittsburgh Foundation. Gifts support the program for the long haul."
          note="A gift to the fund is handled by the Foundation and is generally tax deductible. The Foundation page handles the receipt."
          href={FOUNDATION_DONATE_URL}
          cta="Give to the fund"
        />
        <DonateCard
          id="paypal"
          name="PayPal"
          body="A direct gift through PayPal."
          note="This goes to Brody Brotman personally, not to a program or organization account. It is not tax deductible and it is not handled by the club."
          href={PAYPAL_DONATE_URL}
          cta="Give with PayPal"
        />
        <DonateCard
          id="venmo"
          name="Venmo"
          body="A direct gift through Venmo."
          note="This goes to Brody Brotman personally, not to a program or organization account. It is not tax deductible and it is not handled by the club."
          href={VENMO_DONATE_URL}
          cta="Give with Venmo"
        />
      </div>
    </PageShell>
  );
}
