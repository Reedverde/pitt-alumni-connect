import { Link } from "@tanstack/react-router";

import pittClubUltimateLogo from "@/assets/pitt-club-ultimate-logo.png.asset.json";

/** Shield, the three permanent links, and the endowment. Footer only. */
export function SiteFooter() {
  return (
    <footer style={{ borderTop: "1px solid var(--chalk)", background: "var(--pure-white)" }}>
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <img
            src={pittClubUltimateLogo.url}
            alt="Pitt Club Ultimate"
            width={34}
            height={34}
            loading="lazy"
            className="h-[34px] w-[34px] object-contain"
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
        <nav className="flex flex-wrap items-center gap-5">
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
            href="https://engage.pitt.edu/"
            target="_blank"
            rel="noreferrer noopener"
            className="label-caps"
            style={{ color: "var(--pitt-royal)", textDecoration: "none" }}
          >
            The endowment
          </a>
        </nav>
      </div>
    </footer>
  );
}
