import { Link } from "@tanstack/react-router";

import pittUltimateShield from "@/assets/pitt-ultimate-shield.png.asset.json";
import { DISCORD_INVITE_URL } from "@/lib/site-url";

/** Shield, the permanent links, and the ways to give. Footer only. */
export function SiteFooter() {
  const footerLink = { color: "var(--steel-ink)", textDecoration: "none" as const };
  const giveLink = { color: "var(--pitt-royal)", textDecoration: "none" as const };

  return (
    <footer style={{ borderTop: "1px solid var(--chalk)", background: "var(--pure-white)" }}>
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <img
            src={pittUltimateShield.url}
            alt="Pitt Club Ultimate"
            width={120}
            loading="lazy"
            className="w-[120px] max-w-[120px] object-contain"
            style={{ height: "auto" }}
          />
          <span
            style={{
              fontFamily: '"Archivo", sans-serif',
              fontWeight: 800,
              fontSize: 16,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              color: "var(--pitt-royal)",
            }}
          >
            Pitt Club Ultimate
          </span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link to="/" className="label-caps" style={footerLink}>
            Home
          </Link>
          <Link to="/schedule" className="label-caps" style={footerLink}>
            Schedule
          </Link>
          <Link to="/alumni" className="label-caps" style={footerLink}>
            Alumni
          </Link>
          <Link to="/donate" hash="endowment" className="label-caps" style={giveLink}>
            Endowment
          </Link>
          <Link to="/donate" hash="paypal" className="label-caps" style={giveLink}>
            PayPal
          </Link>
          <Link to="/donate" hash="venmo" className="label-caps" style={giveLink}>
            Venmo
          </Link>
          <a
            href={DISCORD_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="label-caps"
            style={giveLink}
          >
            Discord
          </a>
          <a
            href="https://everde.co"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
              fontSize: 11,
              fontWeight: 400,
              letterSpacing: "0.04em",
              color: "var(--sterling)",
              textDecoration: "none",
            }}
          >
            Site by everde.co
          </a>
        </nav>
      </div>
    </footer>
  );
}
