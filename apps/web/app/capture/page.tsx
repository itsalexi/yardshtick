"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Logo } from "@/src/components/logo";
import { getYardService } from "@/src/services/yard-service";

export default function CapturePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function capture(file: File | undefined) {
    if (busy || !file) return;
    setBusy(true);
    setError(null);
    try {
      const bitmap = await createImageBitmap(file);
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      const service = getYardService();
      const sale = await service.createDraft({ file, ...dimensions });
      router.push(`/scan/${sale.id}`);
      void service.startScan(sale.id).catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not upload this photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen">
      <div className="topbar" style={{ background: "#141416", borderBottom: "none" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Logo size={26} leaves="cream" />
          <span className="wordmark" style={{ color: "#fff" }}>
            Yard
          </span>
        </span>
        <span className="label" style={{ color: "rgba(255,255,255,.5)" }}>
          Sell everything you see
        </span>
      </div>

      <div className="viewfinder" style={{ paddingBottom: 148 }}>
        <span className="corner tl" />
        <span className="corner tr" />
        <span className="corner bl" />
        <span className="corner br" />

        <p style={{ color: "rgba(255,255,255,.75)", textAlign: "center", maxWidth: 240 }}>
          {error ?? (busy ? "Uploading your scene…" : "Point at a room, table, closet, or pile.")}
        </p>

        <button
          type="button"
          className="shutter"
          onClick={() => fileInputRef.current?.click()}
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
          onChange={(event) => {
            void capture(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
    </main>
  );
}
