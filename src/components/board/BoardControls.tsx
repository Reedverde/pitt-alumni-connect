import { useId } from "react";

import type { Era } from "@/lib/board-status";

/**
 * One control bar for the board. Search is the dominant action; everything
 * else is a labelled dropdown so the page never becomes a wall of chips at any
 * width. Native controls on purpose: keyboard, focus and touch targets come
 * from the platform rather than from a bespoke widget.
 */

const fieldStyle: React.CSSProperties = {
  border: "1px solid var(--chalk)",
  background: "var(--pure-white)",
  color: "var(--sabah-black)",
  fontFamily: '"Space Grotesk", sans-serif',
  fontSize: 15,
  borderRadius: 9,
  minHeight: 44,
  width: "100%",
  padding: "10px 12px",
};

function Field({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="label-caps mb-1.5 block" style={{ color: "var(--sterling)" }}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="board-field cursor-pointer"
        style={fieldStyle}
      >
        {children}
      </select>
    </div>
  );
}

export type BoardControlsProps = {
  search: string;
  onSearch: (v: string) => void;
  onClearSearch: () => void;
  programs: { code: string; label: string }[];
  program: string | null;
  onProgram: (code: string | null) => void;
  status: string | null;
  onStatus: (code: string | null) => void;
  eras: Era[];
  era: string | null;
  onEra: (key: string | null) => void;
  newestFirst: boolean;
  onSort: (newestFirst: boolean) => void;
  resultLabel: string;
  onReset: () => void;
  anyFilter: boolean;
};

export function BoardControls({
  search,
  onSearch,
  onClearSearch,
  programs,
  program,
  onProgram,
  status,
  onStatus,
  eras,
  era,
  onEra,
  newestFirst,
  onSort,
  resultLabel,
  onReset,
  anyFilter,
}: BoardControlsProps) {
  return (
    <section aria-label="Find a name" className="pt-6">
      <div className="relative w-full max-w-[720px]">
        <label htmlFor="board-search" className="sr-only">
          Search for your name
        </label>
        <input
          id="board-search"
          type="search"
          value={search}
          autoComplete="off"
          placeholder="Search for your name"
          onChange={(e) => onSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClearSearch();
          }}
          className="board-field w-full outline-none"
          style={{
            border: "1.5px solid var(--steel-ink)",
            background: "var(--pure-white)",
            color: "var(--sabah-black)",
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 19,
            borderRadius: 11,
            padding: "16px 44px 16px 16px",
          }}
        />
        {search !== "" && (
          <button
            type="button"
            onClick={onClearSearch}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center"
            style={{ width: 36, height: 36, color: "var(--steel-ink)", fontSize: 20, lineHeight: 1 }}
          >
            ×
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:max-w-[980px]">
        <Field
          label="Program"
          value={program ?? ""}
          onChange={(v) => onProgram(v === "" ? null : v)}
        >
          <option value="">Every program</option>
          {programs.map((p) => (
            <option key={p.code} value={p.code}>
              {p.label}
            </option>
          ))}
        </Field>

        <Field label="Status" value={status ?? ""} onChange={(v) => onStatus(v === "" ? null : v)}>
          <option value="">Everyone</option>
          <optgroup label="This year">
            <option value="going">Coming</option>
            <option value="maybe">Maybe</option>
          </optgroup>
          <optgroup label="Profile">
            <option value="claimed">Claimed their name</option>
            <option value="unclaimed">Not claimed yet</option>
            <option value="no_contact">No way to reach them</option>
            <option value="memorial">In memoriam</option>
          </optgroup>
        </Field>

        <Field label="Era" value={era ?? ""} onChange={(v) => onEra(v === "" ? null : v)}>
          <option value="">All years</option>
          {eras.map((e) => (
            <option key={e.key} value={e.key}>
              {e.label}
            </option>
          ))}
        </Field>

        <Field
          label="Sort"
          value={newestFirst ? "newest" : "oldest"}
          onChange={(v) => onSort(v === "newest")}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <p
          aria-live="polite"
          style={{ fontFamily: '"Space Mono", monospace', fontSize: 12, color: "var(--sterling)" }}
        >
          {resultLabel}
        </p>
        {anyFilter && (
          <button
            type="button"
            onClick={onReset}
            className="label-caps"
            style={{
              minHeight: 36,
              padding: "0 10px",
              borderRadius: 7,
              border: "1px solid var(--chalk)",
              background: "var(--pure-white)",
              color: "var(--pitt-royal)",
            }}
          >
            Clear filters
          </button>
        )}
      </div>
    </section>
  );
}
