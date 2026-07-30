import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { adminMailStatus, adminTestSend } from "@/lib/admin.functions";
import { Section, hairline, inputStyle, mono, primaryButton } from "./ui";

type TestResult = { ok: boolean; messageId: string | null; provider: string; detail: string };

export function MailPanel() {
  const fetchStatus = useServerFn(adminMailStatus);
  const testSend = useServerFn(adminTestSend);
  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ["admin-mail-status"],
    queryFn: () => fetchStatus({}),
  });

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  async function send() {
    setBusy(true);
    try {
      setResult(await testSend({ data: { email } }));
      void refetch();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section eyebrow="Sending identity" title="Mail configuration">
      {isLoading || !status ? (
        <p style={{ fontSize: 13, color: "var(--sterling)" }}>Checking…</p>
      ) : (
        <p style={{ ...mono, borderTop: hairline, paddingTop: 12, lineHeight: 1.6 }}>
          From {status.fromName ?? "not set"} &lt;{status.fromAddress ?? "not set"}&gt; · reply to{" "}
          {status.replyTo ?? "not set"} · links from {status.siteUrl ?? "PUBLIC_SITE_URL not set"} ·{" "}
          <span
            style={{
              fontWeight: 700,
              color: status.verified ? "var(--steel-ink)" : "var(--pitt-royal)",
            }}
          >
            {status.verified ? "domain verified" : "domain not verified"}
          </span>
          <span style={{ display: "block", fontSize: 12, color: "var(--sterling)" }}>
            {status.detail}
          </span>
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2" style={{ borderTop: hairline, paddingTop: 14 }}>
        <label className="label-caps" style={{ color: "var(--sterling)" }}>
          Test send
        </label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Address for the test send"
          style={{ ...inputStyle, width: 260 }}
        />
        <button
          type="button"
          disabled={busy || email.trim().length < 5}
          onClick={send}
          style={{ ...primaryButton, opacity: busy || email.trim().length < 5 ? 0.4 : 1 }}
        >
          {busy ? "Sending" : "Send the real link"}
        </button>
      </div>

      {result ? (
        <p className="mt-3" style={{ ...mono, fontSize: 12 }}>
          <span style={{ fontWeight: 700, color: result.ok ? "var(--steel-ink)" : "var(--pitt-royal)" }}>
            {result.ok ? "Sent" : "Not sent"}
          </span>{" "}
          via {result.provider} · message id {result.messageId ?? "none"}
          <span style={{ display: "block", color: "var(--sterling)" }}>{result.detail}</span>
        </p>
      ) : null}

      <p className="mt-3" style={{ fontSize: 12, color: "var(--sterling)" }}>
        Ten test sends an hour. Every one is written to the audit log and to the send list below.
      </p>
    </Section>
  );
}