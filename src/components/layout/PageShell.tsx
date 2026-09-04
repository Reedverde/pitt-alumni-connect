import type { ReactNode } from "react";

import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

/**
 * The one page shell.
 *
 * Owns the three things every page of the site was disagreeing about: the
 * header, the footer, and the horizontal measure plus vertical rhythm of the
 * content between them. Routes supply only their content.
 *
 * width
 *   "wide"   the editorial measure the homepage uses. Default.
 *   "column" a short centred column, for single decision pages like sign in.
 *
 * Pages that are deliberately chrome free (the printable poster, the one tap
 * answer that arrives from an email) do not use this shell.
 */
export function PageShell({
  children,
  width = "wide",
  bare = false,
  className = "",
}: {
  children: ReactNode;
  width?: "wide" | "column";
  /** Content supplies its own <main>, so the shell wraps chrome only. */
  bare?: boolean;
  className?: string;
}) {
  const measure = width === "column" ? "max-w-[560px]" : "max-w-[1320px]";

  return (
    <div style={{ background: "var(--field-white)" }} className="flex min-h-screen flex-col">
      <SiteNav />
      {bare ? (
        children
      ) : (
        <main
          className={`mx-auto w-full flex-1 px-5 py-12 md:px-10 md:py-16 ${measure} ${className}`}
        >
          {children}
        </main>
      )}
      <SiteFooter />
    </div>
  );
}
