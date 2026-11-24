import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { supabase } from "@/integrations/supabase/client";
import brodyPhoto from "@/assets/brody-early-days.png.asset.json";
import diamondHead from "@/assets/kaimana-diamond-head.jpg";

export const Route = createFileRoute("/kaimana")({
  head: () => ({
    meta: [
      { title: "Kaimana 2027 · Pitt Club Ultimate" },
      { name: "description", content: "Thirty years of Pitt Ultimate and Brody's 50th. Oahu, Hawaii, Presidents' Day weekend, Feb 12 to 15, 2027." },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { property: "og:title", content: "Kaimana 2027 · Pitt Club Ultimate" },
      { property: "og:description", content: "Thirty years of Pitt Ultimate and Brody's 50th. Oahu, Hawaii, Presidents' Day weekend, Feb 12 to 15, 2027." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KaimanaPage,
});

type Status = "playing" | "sideline" | "maybe" | "out";
type RosterRow = { id: string; display_name: string; status: Status; note: string | null; auth_user_id: string | null; person_id: string | null };
type Post = { id: string; auth_user_id: string; author_name: string; body: string; created_at: string };

const STATUS_LABEL: Record<Status, string> = {
  playing: "Playing",
  sideline: "Sideline · megaphone · heckler",
  maybe: "Maybe · looking at flights",
  out: "Can't make it",
};
const ORDER: Status[] = ["playing", "sideline", "maybe", "out"];

function KaimanaPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"loading" | "denied" | "ok">("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [coordinator, setCoordinator] = useState(false);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [myName, setMyName] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [personId, setPersonId] = useState<string | null>(null);
  const [canAct, setCanAct] = useState(false);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      const { data: brody } = await supabase.rpc("kaimana_is_brody");
      if (brody) return setPhase("denied");
      setUserId(u.user.id);
      const [{ data: ok }, { data: pid }] = await Promise.all([supabase.rpc("kaimana_can_access"), supabase.rpc("current_person_id")]);
      setCanAct(!!ok);
      setPersonId((pid as string | null) ?? null);
    }
    const [{ data: c }, { data: r }, { data: p }] = await Promise.all([
      u.user ? supabase.rpc("kaimana_is_coordinator") : Promise.resolve({ data: false }),
      supabase.from("kaimana_roster").select("id,display_name,status,note,auth_user_id,person_id").order("display_name"),
      supabase.from("kaimana_posts").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setCoordinator(!!c);
    setRoster((r ?? []) as RosterRow[]);
    setPosts((p ?? []) as Post[]);
    if (!u.user) return setPhase("ok");
    const { data: pid2 } = await supabase.rpc("current_person_id");
    const mine = (r ?? []).find((x) => x.auth_user_id === u.user!.id || (!!pid2 && x.person_id === pid2));
    const meta = u.user.user_metadata as { full_name?: string; name?: string } | undefined;
    setMyName((n) => n || mine?.display_name || meta?.full_name || meta?.name || "");
    setPhase("ok");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const signIn = () => {
    try {
      window.sessionStorage.setItem("pcu.auth.returnTo", "/kaimana");
    } catch {
      /* storage unavailable */
    }
    void navigate({ to: "/auth" });
  };

  const mine = roster.find((r) => r.auth_user_id === userId || (!!personId && r.person_id === personId));

  const setStatus = async (status: Status) => {
    if (!userId || !myName.trim()) return setErr("Add your name first.");
    setBusy(true);
    setErr(null);
    const name = myName.trim().slice(0, 80);
    let res;
    if (mine) {
      res = await supabase.from("kaimana_roster").update({ status, display_name: name, auth_user_id: userId, updated_at: new Date().toISOString() }).eq("id", mine.id);
    } else {
      // Claim an unclaimed listed name when it matches, otherwise add a new row.
      const match = roster.find((r) => !r.auth_user_id && r.display_name.toLowerCase() === name.toLowerCase());
      res = match && coordinator
        ? await supabase.from("kaimana_roster").update({ status, auth_user_id: userId }).eq("id", match.id)
        : await supabase.from("kaimana_roster").insert({ display_name: name, status, auth_user_id: userId });
    }
    if (res.error) setErr("That didn't save. Try again.");
    setBusy(false);
    void load();
  };

  const coordSet = async (id: string, status: Status) => {
    await supabase.from("kaimana_roster").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    void load();
  };

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !userId) return;
    if (!myName.trim()) return setErr("Add your name first.");
    setBusy(true);
    const { error } = await supabase.from("kaimana_posts").insert({ body: body.slice(0, 4000), author_name: myName.trim().slice(0, 80), auth_user_id: userId });
    setBusy(false);
    if (error) return setErr("Your message didn't post. Try again.");
    setDraft("");
    void load();
  };

  const remove = async (id: string) => {
    await supabase.from("kaimana_posts").delete().eq("id", id);
    void load();
  };

  if (phase === "loading") return <PageShell width="column"><p className="text-muted-foreground">Loading…</p></PageShell>;
  if (phase === "denied")
    return (
      <PageShell width="column">
        <h1 className="text-3xl font-black uppercase tracking-tight text-foreground">Page not found</h1>
        <p className="mt-4 text-muted-foreground">There's nothing here.</p>
      </PageShell>
    );

  const counts = ORDER.map((s) => ({ s, rows: roster.filter((r) => r.status === s) }));

  return (
    <PageShell>
      <header className="relative overflow-hidden" style={{ clipPath: "polygon(0 0, calc(100% - 40px) 0, 100% 40px, 100% 100%, 40px 100%, 0 calc(100% - 40px))" }}>
        <img src={diamondHead} alt="Diamond Head rising behind the grass fields of Kapiolani Park in Honolulu" width={1600} height={608} className="h-[300px] w-full object-cover md:h-[520px]" />
        <div className="relative -mt-16 mx-4 max-w-2xl bg-background p-6 md:absolute md:mx-0 md:mt-0 md:inset-x-auto md:bottom-10 md:left-10 md:p-8" style={{ clipPath: "polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))" }}>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Team X · Keep it secret</p>
          <h1 className="mt-3 text-4xl font-black uppercase leading-none tracking-tight text-foreground md:text-6xl">Kaimana 2027</h1>
          <p className="mt-4 text-lg text-foreground">
            Thirty years of Pitt Ultimate and Brody's 50th. Oahu, Hawaii · Presidents' Day weekend, Friday night Feb 12 to Monday Feb 15, 2027.
          </p>
        </div>
      </header>
      <div className="mt-10 grid items-start gap-8 md:grid-cols-2">
        <div className="space-y-3 text-lg text-muted-foreground">
        <p className="font-bold uppercase tracking-wide text-foreground">To the Pitt Family,</p>
        <p>We got a bid to Kaimana 2027: IT'S HAPPENING! This is a once-in-a-lifetime reunion, bringing together brothers, all connected through The Pitt Program. THIS IS A COMPLETE SURPRISE FOR BRODY! So please keep it a secret... even the Kaimana TD is helping us keep it under wraps.</p>
        <p>Whether you are ready to play every point under Diamond Head crater or just want to hold a megaphone and heckle from the sidelines, we want three decades of Pitt Ultimate alumni in Hawaii to celebrate 30 years of the brotherhood as well as Brody's 50th birthday.</p>
        <p>The UCLA alumni team (who Brody used to coach) has also been awarded a bid, and he is currently signed up to play with them. Ideally, we keep him in the dark right up until the tournament itself.</p>
        <p>Our goal is 40+ people out in Hawaii. If money is the barrier keeping you home, reach out to Trent Dillon or Kin-Ling Sham directly. They planned ahead to help people overcome financial hurdles and will problem-solve with you so you can make the trip.</p>
      </div>
        <img src={brodyPhoto.url} alt="Brody Brotman in his early Pitt days, wearing a bandana and smiling over his shoulder" className="order-first mx-auto w-full max-w-[280px] object-cover md:order-none" style={{ clipPath: "polygon(0 0, calc(100% - 24px) 0, 100% 24px, 100% 100%, 24px 100%, 0 calc(100% - 24px))" }} />
      </div>

      <section className="mt-12 max-w-3xl">
        <h2 className="text-xl font-black uppercase tracking-tight text-foreground">The tournament</h2>
        <div className="mt-4 space-y-3 text-muted-foreground">
          <p>Kaimana Klassik is Hawaii's biggest ultimate tournament, run every Presidents' Day weekend by Hawaii Ultimate. Games are at Kapiʻolani Park in Honolulu, under Diamond Head (Lēʻahi), next to Waikīkī and Kaimana Beach.</p>
          <p>Play starts Saturday morning and finals are Monday afternoon. The tournament hosts parties in town Friday, Saturday and Sunday nights, with breakfast each morning and dinner Saturday and Sunday. Players must be 21+ for evening events, and there's no alcohol at the fields.</p>
          <p className="flex flex-wrap gap-4 font-bold">
            <a className="text-primary underline" href="https://hawaii.ultimatecentral.com/kaimana-klassik" target="_blank" rel="noreferrer">Kaimana Klassik site</a>
            <a className="text-primary underline" href="https://ultimatecentral.com/en_us/e/kaimana-klassik-37" target="_blank" rel="noreferrer">Last year's event page</a>
            <a className="text-primary underline" href="https://maps.google.com/?q=Kapiolani+Park+Honolulu" target="_blank" rel="noreferrer">Map: Kapiʻolani Park</a>
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Questions? Reach the organizers</h2>
        {canAct ? (
          <ul className="mt-3 space-y-1 text-foreground">
            <li><strong>Trent Dillon</strong> · <a className="text-primary underline" href="mailto:tmaxdillon@gmail.com">tmaxdillon@gmail.com</a></li>
            <li><strong>Kin-Ling Sham</strong> · <a className="text-primary underline" href="mailto:kinlingsham@gmail.com">kinlingsham@gmail.com</a></li>
          </ul>
        ) : (
          <p className="mt-2 text-muted-foreground">Sign in to see how to reach Trent and Kin-Ling.</p>
        )}
      </section>

      <section className="mt-12 border border-border bg-card p-6">
        <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Your answer</h2>
        {!userId ? (<><p className="mt-2 text-muted-foreground">Sign in to say if you're playing, on the sideline, a maybe, or can't make it.</p><button onClick={signIn} className="mt-4 bg-primary px-6 py-3 font-bold uppercase tracking-wide text-primary-foreground">Sign in</button></>) : !canAct ? (<p className="mt-2 text-muted-foreground">Your account isn't linked to a Pitt alumni record yet. Tell Trent or Kin-Ling.</p>) : (<>
        <label className="mt-4 block text-sm font-bold text-foreground" htmlFor="kname">Your name</label>
        <input id="kname" value={myName} onChange={(e) => setMyName(e.target.value)} maxLength={80} className="mt-1 w-full max-w-sm border border-input bg-background px-3 py-2 text-foreground" />
        <div className="mt-4 flex flex-wrap gap-2">
          {ORDER.map((s) => (
            <button key={s} disabled={busy} onClick={() => void setStatus(s)} aria-pressed={mine?.status === s}
              className={`border px-4 py-2 text-sm font-bold ${mine?.status === s ? (s === "playing" ? "border-pitt-gold bg-pitt-gold text-sabah-black" : "border-primary bg-primary text-primary-foreground") : "border-border bg-background text-foreground"}`}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
        </>)}
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Who's in · {counts[0]!.rows.length} playing</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {counts.map(({ s, rows }) => (
            <div key={s}>
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{STATUS_LABEL[s]} ({rows.length})</h3>
              <ul className="mt-2 space-y-1">
                {rows.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-foreground">
                    <span>{r.display_name}</span>
                    {coordinator && (
                      <select aria-label={`Status for ${r.display_name}`} value={r.status} onChange={(e) => void coordSet(r.id, e.target.value as Status)} className="border border-input bg-background text-xs">
                        {ORDER.map((o) => <option key={o} value={o}>{STATUS_LABEL[o]}</option>)}
                      </select>
                    )}
                  </li>
                ))}
                {rows.length === 0 && <li className="text-sm text-muted-foreground">Nobody yet.</li>}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Message board</h2>
        <p className="mt-1 text-sm text-muted-foreground">Flights, houses, gear, the surprise plan.</p>
        {!userId || !canAct ? (<button onClick={signIn} className="mt-4 border border-border px-5 py-2 font-bold uppercase text-foreground">Sign in to post</button>) : (
        <form onSubmit={post} className="mt-4 max-w-2xl">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={4000} rows={3} aria-label="Write a message" className="w-full border border-input bg-background p-3 text-foreground" />
          <button disabled={busy || !draft.trim()} className="mt-2 bg-primary px-5 py-2 font-bold uppercase text-primary-foreground disabled:opacity-50">Post</button>
        </form>)}
        <ul className="mt-6 max-w-2xl space-y-4">
          {posts.map((p) => (
            <li key={p.id} className="border-l-4 border-primary bg-card p-4">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="font-bold text-foreground">{p.author_name}</span>
                <span>{new Date(p.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-foreground">{p.body}</p>
              {(p.auth_user_id === userId || coordinator) && (
                <button onClick={() => void remove(p.id)} className="mt-2 text-xs underline text-muted-foreground">Delete</button>
              )}
            </li>
          ))}
          {posts.length === 0 && <li className="text-muted-foreground">No messages yet. Start it off.</li>}
        </ul>
      </section>
    </PageShell>
  );
}
