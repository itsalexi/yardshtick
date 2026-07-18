"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { getYardService } from "@/src/services/yard-service";

export default function CapturePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function capture() {
    if (busy) return;
    setBusy(true);
    const sale = await getYardService().createDraft({
      file: new Blob(),
      width: 2048,
      height: 1536,
    });
    await getYardService().startScan(sale.id);
    router.push(`/scan/${sale.id}`);
  }

  return (
    <main className="screen">
      <div className="topbar" style={{ background: "#141416", borderBottom: "none" }}>
        <span className="wordmark" style={{ color: "#fff" }}>
          Yard
        </span>
        <span className="label" style={{ color: "rgba(255,255,255,.5)" }}>
          Sell everything you see
        </span>
      </div>

      <div className="viewfinder">
        <span className="corner tl" />
        <span className="corner tr" />
        <span className="corner bl" />
        <span className="corner br" />

        <p style={{ color: "rgba(255,255,255,.75)", textAlign: "center", maxWidth: 240 }}>
          Point at a room, table, closet, or pile.
        </p>

        <button
          type="button"
          className="shutter"
          onClick={capture}
          disabled={busy}
          aria-label="Take photo"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,.6)",
            fontSize: 13,
            textDecoration: "underline",
            cursor: "pointer",
            minHeight: 44,
          }}
        >
          or upload a photo
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={capture}
        />
      </div>
    </main>
  );
}
