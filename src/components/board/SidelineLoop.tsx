import { useEffect, useRef, useState } from "react";

/**
 * The one piece of motion the system allows: a muted sideline loop behind the
 * counter bar. It never blocks first paint (no src until after hydration), is
 * skipped on a saving/slow connection and under prefers-reduced-motion, and
 * falls back to a flat Concrete fill when no URL is configured.
 */
export function SidelineLoop() {
  const url = import.meta.env.VITE_SIDELINE_LOOP_URL as string | undefined;
  const [src, setSrc] = useState<string | null>(null);
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!url) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (connection?.saveData) return;
    if (connection?.effectiveType && /2g/.test(connection.effectiveType)) return;

    const idle =
      (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback ??
      ((cb: () => void) => window.setTimeout(cb, 400));
    const handle = idle(() => setSrc(url));
    return () => window.clearTimeout(handle as number);
  }, [url]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ background: "var(--concrete)" }}
    >
      {src && (
        <video
          ref={ref}
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          controls={false}
          disablePictureInPicture
          className="h-full w-full object-cover"
          style={{
            opacity: 0.14,
          }}
        />
      )}
    </div>
  );
}
