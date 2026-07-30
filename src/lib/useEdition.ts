import { useQuery } from "@tanstack/react-query";

import { getEditionContext } from "./editions.functions";
import { editionEyebrow } from "./edition-format";

export function useEditionContext() {
  return useQuery({
    queryKey: ["edition-context"],
    queryFn: () => getEditionContext(),
    staleTime: 5 * 60 * 1000,
  });
}

/** "Alumni Weekend · Oct 2–4, 2026" for the edition that is current right now. */
export function useEditionEyebrow(): string {
  const { data } = useEditionContext();
  return data ? editionEyebrow(data.current) : "Alumni Weekend";
}
