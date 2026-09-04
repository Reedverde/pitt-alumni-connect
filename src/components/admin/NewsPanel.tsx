import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  adminPreviewDigest,
  adminPublishDigest,
  adminRunNewsAutomation,
  adminRetryDiscord,
  adminRunWeeklyRoundup,
  adminSaveNewsItem,
  adminSaveNewsSettings,
  adminSavePending,
  adminSetNewsStatus,
  adminTestDiscord,
  getNewsAdmin,
} from "@/lib/news-admin.functions";
import { NEWS_CATEGORIES, type NewsItem as NewsItemRow, type PendingUpdate } from "@/lib/news-types";
import { Empty, Section, inputStyle, mono, primaryButton, secondaryButton } from "./ui";

function DiscordState({ item }: { item: NewsItemRow }) {
  const state = item.discord_delivery_status ?? "not_sent";
  const label = state === "sent" ? "Discord: Sent" : state === "failed" ? "Discord: Failed" : "Discord: Not sent";
  const color =
    state === "sent" ? "var(--pitt-royal)" : state === "failed" ? "#B3261E" : "var(--sterling)";
  return (
    <p style={{ ...mono, color }}>
      {label}
      {state === "failed" && item.discord_delivery_error ? ` · ${item.discord_delivery_error}` : ""}
    </p>
  );
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function NewsPanel() {
  const qc = useQueryClient();
  const load = useServerFn(getNewsAdmin);
  const preview = useServerFn(adminPreviewDigest);
  const publishDigest = useServerFn(adminPublishDigest);
  const roundup = useServerFn(adminRunWeeklyRoundup);
  const savePending = useServerFn(adminSavePending);
  const saveItem = useServerFn(adminSaveNewsItem);
  const setStatus = useServerFn(adminSetNewsStatus);
  const saveSettings = useServerFn(adminSaveNewsSettings);
  const runAutomation = useServerFn(adminRunNewsAutomation);
  const retryDiscord = useServerFn(adminRetryDiscord);
  const testDiscord = useServerFn(adminTestDiscord);

  const { data, isLoading } = useQuery({ queryKey: ["news-admin"], queryFn: () => load({}) });
  const [note, setNote] = useState<string | null>(null);
  const [digestPreview, setDigestPreview] = useState<{ count: number; title: string; body: string } | null>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["news-admin"] });
    void qc.invalidateQueries({ queryKey: ["news"] });
  };

  if (isLoading) return <p style={mono}>Loading…</p>;
  if (!data || !data.isAdmin) return <Empty>Not permitted.</Empty>;

  const pending = data.pending.filter((p) => p.status !== "consumed");
  const waiting = pending.filter((p) => p.status === "pending");

  return (
    <>
      {waiting.length > 0 ? (
        <div
          className="mb-4 flex flex-wrap items-center justify-between gap-3 p-4"
          style={{ border: "2px solid var(--pitt-royal)", background: "var(--pure-white)" }}
        >
          <div>
            <p style={mono}>Unpublished changes</p>
            <p style={{ fontWeight: 700, color: "var(--sabah-black)" }}>
              {waiting.length} public {waiting.length === 1 ? "change is" : "changes are"} waiting to
              be announced.
            </p>
            <p style={{ fontSize: 13, color: "var(--sterling)" }}>
              People looking at the Schedule cannot tell what moved until this goes out.
            </p>
          </div>
          <button
            type="button"
            style={primaryButton}
            onClick={async () => {
              const result = await publishDigest({});
              setNote(result.reason);
              setDigestPreview(null);
              refresh();
            }}
          >
            Publish now
          </button>
        </div>
      ) : null}

      <Section eyebrow="Pending updates" title="Changes waiting to be announced">
        {pending.length === 0 ? (
          <Empty>Nothing pending. No public plans have changed since the last update.</Empty>
        ) : (

          <div className="flex flex-col gap-3">
            {pending.map((p) => (
              <PendingRow
                key={p.id}
                row={p}
                onSave={async (patch) => {
                  await savePending({ data: { id: p.id, ...patch } });
                  refresh();
                }}
              />
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            style={secondaryButton}
            onClick={async () => {
              const result = await preview({});
              setDigestPreview(result ? { count: result.count, title: result.title, body: result.body } : null);
            }}
          >
            Preview daily digest
          </button>
          <button
            type="button"
            style={primaryButton}
            disabled={pending.filter((p) => p.status === "pending").length === 0}
            onClick={async () => {
              const result = await publishDigest({});
              setNote(result.reason);
              setDigestPreview(null);
              refresh();
            }}
          >
            Publish digest now
          </button>
          <button
            type="button"
            style={secondaryButton}
            onClick={async () => {
              const result = await roundup({ data: { dryRun: true } });
              setNote(
                result.names.length === 0
                  ? "Nobody new is going."
                  : `Would list ${result.names.length}: ${result.names.slice(0, 12).join(", ")}`,
              );
            }}
          >
            Preview weekly roundup
          </button>
          <button
            type="button"
            style={secondaryButton}
            onClick={async () => {
              const result = await roundup({ data: { dryRun: false } });
              setNote(result.reason);
              refresh();
            }}
          >
            Publish weekly roundup
          </button>
          <button
            type="button"
            style={secondaryButton}
            onClick={async () => {
              const result = await runAutomation({});
              setNote(
                result
                  ? `Local ${result.localDate} ${result.localTime}. Ran: ${result.ran.join(", ") || "nothing"}. Skipped: ${result.skipped.join("; ") || "nothing"}.`
                  : "Not permitted.",
              );
              refresh();
            }}
          >
            Run automation check
          </button>
        </div>

        {digestPreview ? (
          <div className="mt-4 p-3" style={{ border: "1px solid var(--chalk)", background: "var(--pure-white)" }}>
            <p style={mono}>{digestPreview.count} pending</p>
            <p className="mt-1" style={{ fontWeight: 700, color: "var(--sabah-black)" }}>
              {digestPreview.title}
            </p>
            <p className="mt-1" style={{ fontSize: 13, whiteSpace: "pre-line", color: "var(--steel-ink)" }}>
              {digestPreview.body || "Nothing to publish."}
            </p>
          </div>
        ) : null}

        {note ? (
          <p className="mt-3" style={{ fontSize: 13, color: "var(--steel-ink)" }}>
            {note}
          </p>
        ) : null}
      </Section>

      <NewPostForm
        onSave={async (input) => {
          await saveItem({ data: input });
          refresh();
        }}
      />

      <Section eyebrow="Published news" title="Everything posted">
        <div className="mb-4">
          <button
            type="button"
            style={secondaryButton}
            onClick={async () => {
              const result = await testDiscord({});
              setNote(result.reason);
            }}
          >
            Send test to Discord
          </button>
        </div>
        {data.published.length === 0 ? (
          <Empty>Nothing posted yet.</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {data.published.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3"
                style={{ border: "1px solid var(--chalk)", background: "var(--pure-white)" }}
              >
                <div style={{ minWidth: 240 }}>
                  <p style={mono}>
                    {item.status.toUpperCase()} · {item.post_type} · {item.category}
                  </p>
                  <p style={{ fontWeight: 700, color: "var(--sabah-black)" }}>{item.title}</p>
                  <p style={{ fontSize: 13, color: "var(--sterling)" }}>{item.summary}</p>
                  <DiscordState item={item} />
                </div>
                <div className="flex gap-2">
                  {item.status === "published" ? (
                    <button
                      type="button"
                      style={secondaryButton}
                      onClick={async () => {
                        await setStatus({ data: { id: item.id, status: "draft" } });
                        refresh();
                      }}
                    >
                      Unpublish
                    </button>
                  ) : (
                    <button
                      type="button"
                      style={primaryButton}
                      onClick={async () => {
                        await setStatus({ data: { id: item.id, status: "published" } });
                        refresh();
                      }}
                    >
                      Publish
                    </button>
                  )}
                  <button
                    type="button"
                    style={secondaryButton}
                    onClick={async () => {
                      const title = window.prompt("Title", item.title);
                      if (title === null) return;
                      const summary = window.prompt("Summary", item.summary) ?? item.summary;
                      const body = window.prompt("Body", item.body) ?? item.body;
                      await saveItem({
                        data: {
                          id: item.id,
                          title,
                          summary,
                          body,
                          category: item.category,
                          post_type: item.post_type === "urgent" ? "urgent" : "manual",
                          related_url: item.related_url,
                          author: item.author,
                        },
                      });
                      refresh();
                    }}
                  >
                    Edit
                  </button>
                  {item.status === "published" && item.discord_delivery_status !== "sent" ? (
                    <button
                      type="button"
                      style={secondaryButton}
                      onClick={async () => {
                        const result = await retryDiscord({ data: { id: item.id } });
                        setNote(result.reason);
                        refresh();
                      }}
                    >
                      Retry Discord
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <SettingsForm
        settings={data.settings}
        onSave={async (input) => {
          await saveSettings({ data: input });
          refresh();
        }}
      />
    </>
  );
}

function PendingRow({
  row,
  onSave,
}: {
  row: PendingUpdate;
  onSave: (patch: { title?: string; summary?: string; category?: string; status?: "pending" | "suppressed" }) => Promise<void>;
}) {
  const [title, setTitle] = useState(row.title);
  const [summary, setSummary] = useState(row.summary);
  const [category, setCategory] = useState<string>(row.category);

  return (
    <div className="p-3" style={{ border: "1px solid var(--chalk)", background: "var(--pure-white)" }}>
      <p style={mono}>
        {row.kind} · {row.status}
      </p>
      <input style={{ ...inputStyle, marginTop: 6 }} value={title} onChange={(e) => setTitle(e.target.value)} />
      <input style={{ ...inputStyle, marginTop: 6 }} value={summary} onChange={(e) => setSummary(e.target.value)} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select style={{ ...inputStyle, width: 160 }} value={category} onChange={(e) => setCategory(e.target.value)}>
          {NEWS_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button type="button" style={secondaryButton} onClick={() => void onSave({ title, summary, category })}>
          Save
        </button>
        {row.status === "pending" ? (
          <button type="button" style={secondaryButton} onClick={() => void onSave({ status: "suppressed" })}>
            Suppress
          </button>
        ) : (
          <button type="button" style={secondaryButton} onClick={() => void onSave({ status: "pending" })}>
            Restore
          </button>
        )}
      </div>
    </div>
  );
}

function NewPostForm({
  onSave,
}: {
  onSave: (input: {
    title: string;
    summary: string;
    body: string;
    category: string;
    post_type: string;
    related_url: string | null;
    author: string | null;
    publish: boolean;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>("General");
  const [author, setAuthor] = useState("");
  const [url, setUrl] = useState("");

  const submit = async (publish: boolean, urgent: boolean) => {
    if (!title.trim()) return;
    await onSave({
      title,
      summary,
      body,
      category,
      post_type: urgent ? "urgent" : "manual",
      related_url: url.trim() || null,
      author: author.trim() || null,
      publish,
    });
    setTitle("");
    setSummary("");
    setBody("");
    setUrl("");
  };

  return (
    <Section eyebrow="New update" title="Write a manual post">
      <div className="flex max-w-[640px] flex-col gap-2">
        <input style={inputStyle} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input style={inputStyle} placeholder="One line summary" value={summary} onChange={(e) => setSummary(e.target.value)} />
        <textarea style={{ ...inputStyle, minHeight: 110 }} placeholder="Body" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <select style={{ ...inputStyle, width: 160 }} value={category} onChange={(e) => setCategory(e.target.value)}>
            {NEWS_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input style={{ ...inputStyle, width: 200 }} placeholder="Author (optional)" value={author} onChange={(e) => setAuthor(e.target.value)} />
          <input style={{ ...inputStyle, width: 240 }} placeholder="Related link (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" style={secondaryButton} onClick={() => void submit(false, false)}>
            Save draft
          </button>
          <button type="button" style={primaryButton} onClick={() => void submit(true, false)}>
            Publish
          </button>
          <button type="button" style={secondaryButton} onClick={() => void submit(true, true)}>
            Urgent publish now
          </button>
        </div>
      </div>
    </Section>
  );
}

function SettingsForm({
  settings,
  onSave,
}: {
  settings: { enabled: boolean; timezone: string; daily_digest_time: string; weekly_day: number; weekly_time: string; last_digest_date: string | null; last_weekly_date: string | null } | null;
  onSave: (input: { enabled: boolean; daily_digest_time: string; weekly_day: number; weekly_time: string }) => Promise<void>;
}) {
  const [enabled, setEnabled] = useState(settings?.enabled ?? true);
  const [daily, setDaily] = useState(settings?.daily_digest_time ?? "19:00");
  const [day, setDay] = useState(settings?.weekly_day ?? 1);
  const [weekly, setWeekly] = useState(settings?.weekly_time ?? "09:00");

  return (
    <Section eyebrow="Automation" title="When the bulletin posts itself">
      <div className="flex max-w-[520px] flex-col gap-3">
        <label className="flex items-center gap-2" style={{ fontSize: 14, color: "var(--steel-ink)" }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Automation enabled
        </label>
        <p style={mono}>Timezone: {settings?.timezone ?? "America/New_York"}</p>
        <label style={{ fontSize: 13, color: "var(--sterling)" }}>
          Daily digest time
          <input type="time" style={inputStyle} value={daily} onChange={(e) => setDaily(e.target.value)} />
        </label>
        <label style={{ fontSize: 13, color: "var(--sterling)" }}>
          Weekly roundup day
          <select style={inputStyle} value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 13, color: "var(--sterling)" }}>
          Weekly roundup time
          <input type="time" style={inputStyle} value={weekly} onChange={(e) => setWeekly(e.target.value)} />
        </label>
        <p style={mono}>
          Last digest: {settings?.last_digest_date ?? "never"} · Last roundup: {settings?.last_weekly_date ?? "never"}
        </p>
        <div>
          <button
            type="button"
            style={primaryButton}
            onClick={() => void onSave({ enabled, daily_digest_time: daily, weekly_day: day, weekly_time: weekly })}
          >
            Save settings
          </button>
        </div>
      </div>
    </Section>
  );
}
