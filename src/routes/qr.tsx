import { createFileRoute } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";

const QR_TARGET = "https://alumni.pittultimate.org/?src=qr";
const HUMAN_URL = "alumni.pittultimate.org";

export const Route = createFileRoute("/qr")({
  head: () => ({
    meta: [
      { title: "Scan to claim your name | Pitt Club Ultimate Alumni" },
      {
        name: "description",
        content:
          "Printable QR poster for Alumni Weekend. Scan to claim your name and tell us if you are coming.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Scan to claim your name" },
      {
        property: "og:description",
        content: "Printable QR poster for Pitt Club Ultimate Alumni Weekend.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QrPoster,
});

function QrPoster() {
  return (
    <main className="qr-poster">
      <div className="qr-poster-inner">
        <p className="qr-eyebrow">// Alumni Weekend, October 2 to 4, 2026</p>
        <h1 className="qr-heading">Scan to claim your name</h1>

        <div className="qr-frame">
          <QRCodeSVG
            value={QR_TARGET}
            level="H"
            marginSize={4}
            bgColor="#FFFFFF"
            fgColor="#0B0B0C"
            title="Scan to open alumni.pittultimate.org"
            className="qr-svg"
          />
        </div>

        <p className="qr-url">{HUMAN_URL}</p>
        <p className="qr-body">Claim your name and tell us if you are coming.</p>
      </div>
    </main>
  );
}
