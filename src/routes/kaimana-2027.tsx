import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/kaimana-2027")({
  beforeLoad: () => {
    throw redirect({ to: "/kaimana", statusCode: 301 });
  },
});
