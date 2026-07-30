/** Segmented index pills: 01 / 02 / 03, active one filled Pitt Royal. */
export function IndexPills({ count, active = 1 }: { count: number; active?: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => {
        const on = n === active;
        return (
          <span
            key={n}
            className="inline-flex items-center justify-center rounded-full"
            style={{
              width: 26,
              height: 26,
              fontFamily: '"Space Mono", monospace',
              fontSize: 11,
              border: "1px solid var(--chalk)",
              background: on ? "var(--pitt-royal)" : "transparent",
              color: on ? "var(--pure-white)" : "var(--sterling)",
            }}
          >
            {String(n).padStart(2, "0")}
          </span>
        );
      })}
    </div>
  );
}