"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Logo } from "@/src/components/logo";
import { rememberCapturePreview } from "@/src/features/capture/preview-memory";
import { getYardService } from "@/src/services/yard-service";

export default function CapturePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function upload(file: File | null, localPreviewUrl = previewUrl) {
    if (busy || !file) return;
    setBusy(true);
    setError(null);
    try {
      const bitmap = await createImageBitmap(file);
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      const service = getYardService();
      const sale = await service.createDraft({ file, ...dimensions });
      if (localPreviewUrl) rememberCapturePreview(sale.id, localPreviewUrl);
      router.push(`/scan/${sale.id}`);
      void service.startScan(sale.id).catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not upload this photo.");
    } finally {
      setBusy(false);
    }
  }

  function choose(file: File | undefined) {
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    const nextPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(nextPreviewUrl);
    void upload(file, nextPreviewUrl);
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

      <div className={`viewfinder${previewUrl ? " has-preview" : ""}`}>
        {previewUrl ? (
          <img
            className="capture-preview"
            src={previewUrl}
            alt="Selected scene preview"
          />
        ) : null}
        {!previewUrl ? (
          <>
            <span className="corner tl" />
            <span className="corner tr" />
            <span className="corner bl" />
            <span className="corner br" />

            <p className="capture-guidance">
              Point at a room, table, closet, or pile.
            </p>

            <button
              type="button"
              className="shutter"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Take photo"
            />

            <button
              type="button"
              className="capture-upload-link"
              onClick={() => fileInputRef.current?.click()}
            >
              or upload a photo
            </button>
          </>
        ) : (
          <section className="capture-status-card" aria-live="polite">
            <span className="label">{error ? "Upload paused" : "Photo selected"}</span>
            <h1>{error ? "We kept your photo" : "Uploading your photo"}</h1>
            <p>{error ?? "Getting the scene ready for Yard vision."}</p>
            {busy ? <span className="capture-upload-progress" aria-hidden="true" /> : null}
            {error ? (
              <div className="capture-recovery-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => void upload(selectedFile, previewUrl)}
                >
                  Retry upload
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose another
                </button>
              </div>
            ) : null}
          </section>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(event) => {
            choose(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
    </main>
  );
}
