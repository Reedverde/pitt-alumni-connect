import { Link } from "@tanstack/react-router";

import pittUltimateShield from "@/assets/pitt-ultimate-shield.png.asset.json";

/** Shield, the three permanent links, and the endowment. Footer only. */
export function SiteFooter() {
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
          <Link to="/" className="label-caps" style={{ color: "var(--steel-ink)", textDecoration: "none" }}>
            Board
          </Link>
          <Link to="/weekend" className="label-caps" style={{ color: "var(--steel-ink)", textDecoration: "none" }}>
            Weekend
          </Link>
          <Link to="/alumni" className="label-caps" style={{ color: "var(--steel-ink)", textDecoration: "none" }}>
            Alumni
          </Link>
          <a
            href="https://www.esnultimate.org/endowment/"
            target="_blank"
            rel="noopener noreferrer"
            className="label-caps"
            style={{ color: "var(--pitt-royal)", textDecoration: "none" }}
          >
            Endowment
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
