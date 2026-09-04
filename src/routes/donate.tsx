import { createFileRoute } from "@tanstack/react-router";

import { SITE_ORIGIN } from "@/lib/site-url";
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
          "Two ways to support Pitt Club Ultimate: the Pittsburgh Foundation endowment fund, or a direct gift by PayPal or Venmo.",
      },
      { property: "og:title", content: "Donate | Pitt Club Ultimate Alumni" },
      {
        property: "og:description",
        content:
          "Two ways to support Pitt Club Ultimate: the Pittsburgh Foundation endowment fund, or a direct gift by PayPal or Venmo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: `${SITE_ORIGIN}/donate` },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/donate` }],
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
  links,
}: {
  id: string;
  name: string;
  body: string;
  note?: string;
  /** One card can carry more than one way to send the same kind of gift. */
  links: { href: string; cta: string }[];
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
      <div className="flex flex-wrap gap-3">
        {links.map((link) => (
          <a
            key={link.cta}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            style={giveButton}
          >
            {link.cta}
          </a>
        ))}
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
        Two ways to give. Pick whichever is easiest for you, and read the note under each one so
        you know exactly where the money lands.
      </p>

      <div className="mt-8 flex flex-col gap-6 md:flex-row">
        <DonateCard
          id="endowment"
          name="Pittsburgh Foundation endowment fund"
          body="The official Endowment for Pitt Ultimate, held at the Pittsburgh Foundation. Gifts support the program for the long haul."
          note="A gift to the fund is handled by the Foundation and is generally tax deductible. The Foundation page handles the receipt."
          links={[{ href: FOUNDATION_DONATE_URL, cta: "Give to the fund" }]}
        />
        {/* PayPal and Venmo are the same kind of gift with the same handling, so
            they share one card and one note instead of repeating it twice. */}
        <DonateCard
          id="direct"
          name="Direct gift by PayPal or Venmo"
          body="A direct gift, whichever app you already use."
          note="This goes to Brody Brotman personally, not to a program or organization account. It is not tax deductible and it is not handled by the club."
          links={[
            { href: PAYPAL_DONATE_URL, cta: "Give with PayPal" },
            { href: VENMO_DONATE_URL, cta: "Give with Venmo" },
          ]}
        />
      </div>
    </PageShell>
  );
}
