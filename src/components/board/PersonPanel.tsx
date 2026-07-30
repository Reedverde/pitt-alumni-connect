import { Link } from "@tanstack/react-router";

import { SlashEyebrow } from "@/components/board/SlashEyebrow";
import type { BoardPerson } from "@/lib/board.functions";

/**
 * Shown when a signed-out visitor taps a chip that is already claimed, going
 * or maybe. Renders only what the board already published: name, division
 * badge, year. Never an email address, and never any signal about whether an
 * address is on file.
 */
export function PersonPanel({
  person,
  onClose,
}: {
  person: BoardPerson;
  onClose: () => void;
}) {
  const name = [person.first_name, person.last_name].filter(Boolean).join(" ");
  const display = person.played_as ? `${name} "${person.played_as}"` : name;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 md:items-center md:p-6"
      style={{ background: "rgba(11,11,12,0.45)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={display}
        className="w-full max-w-[420px] p-6 md:p-8"
        style={{ background: "var(--pure-white)", border: "1px solid var(--chalk)", borderRadius: 7 }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <SlashEyebrow>On the board</SlashEyebrow>
            <h2 className="display-30 mt-2" style={{ color: "var(--sabah-black)" }}>
              {display}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="label-caps" style={{ color: "var(--sterling)" }}>
            Close
          </button>
        </div>

        <p className="label-caps mt-4" style={{ color: "var(--sterling)" }}>
          {[person.team_label, String(person.board_year)].filter(Boolean).join(" · ")}
        </p>

        <p className="mt-6" style={{ fontSize: 14, color: "var(--steel-ink)" }}>
          This name is already claimed.{" "}
          <Link
            to="/auth"
            style={{ color: "var(--pitt-royal)", textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            Is this you? Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
