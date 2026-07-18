"use client";

import QRCode from "react-qr-code";

export function QrCode({ seed }: { seed: string }) {
  return (
    <div
      role="img"
      aria-label="Storefront QR code"
      style={{
        width: 148,
        height: 148,
        display: "grid",
        placeItems: "center",
        background: "#fff",
        borderRadius: 12,
        padding: 8,
      }}
    >
      <QRCode value={seed} size={132} level="M" bgColor="#ffffff" fgColor="#141416" />
    </div>
  );
}
