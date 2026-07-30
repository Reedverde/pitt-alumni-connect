import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pitt Ultimate Alumni" },
      { name: "description", content: "Home of the Pitt Ultimate alumni community." },
      { property: "og:title", content: "Pitt Ultimate Alumni" },
      { property: "og:description", content: "Home of the Pitt Ultimate alumni community." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl">
          Pitt Ultimate Alumni
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Coming soon — a place for alumni, current players, and friends of Pitt Ultimate to stay connected.
        </p>
      </div>
    </div>
  );
}
