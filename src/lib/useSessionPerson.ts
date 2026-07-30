import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { getNavIdentity } from "./account.functions";

/**
 * Who is signed in, for the nav slot and for "is this chip me". Never carries
 * an email address: only a first name and the person id already owned by the
 * viewer.
 */
export function useSessionPerson() {
  const [hasSession, setHasSession] = useState(false);
  const [ready, setReady] = useState(false);
  const load = useServerFn(getNavIdentity);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setHasSession(Boolean(data.session));
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(Boolean(session));
      setReady(true);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const query = useQuery({
    queryKey: ["nav-identity", hasSession],
    queryFn: () => load({}),
    enabled: ready && hasSession,
    staleTime: 60_000,
  });

  return {
    signedIn: hasSession,
    personId: query.data?.personId ?? null,
    firstName: query.data?.firstName ?? null,
  };
}
