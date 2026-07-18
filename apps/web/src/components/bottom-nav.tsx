"use client";

import { Camera01Icon, Home01Icon, QrCodeIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { demoSale } from "@yard/mock-data";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/src/components/logo";
import { QrCode } from "@/src/components/qr-code";

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!shareOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShareOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shareOpen]);

  // Scan flow owns the bottom edge; storefront is the buyer's view.
  if (pathname.startsWith("/scan") || pathname.startsWith("/s/")) return null;

  const link = `yard.sh/${demoSale.slug}`;

  return (
    <>
      {pathname !== "/capture" && <div style={{ height: 76 }} aria-hidden />}

      <nav className="bottom-nav" aria-label="Main">
        <button
          type="button"
          className="nav-item"
          data-on={pathname === "/"}
          onClick={() => router.push("/")}
        >
          <HugeiconsIcon icon={Home01Icon} strokeWidth={2} />
          Listings
        </button>

        <button
          type="button"
          className="nav-camera"
          data-on={pathname === "/capture"}
          onClick={() => router.push("/capture")}
          aria-label="New scan"
        >
          <span className="cam">
            <HugeiconsIcon icon={Camera01Icon} strokeWidth={2} />
          </span>
        </button>

        <button
          type="button"
          className="nav-item"
          data-on={shareOpen}
          onClick={() => setShareOpen(true)}
        >
          <HugeiconsIcon icon={QrCodeIcon} strokeWidth={2} />
          Share
        </button>
      </nav>

      {shareOpen && (
        <div
          className="share-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Share your yard"
          onClick={() => setShareOpen(false)}
        >
          <button
            type="button"
            className="share-close"
            aria-label="Close"
            onClick={() => setShareOpen(false)}
          >
            ✕
          </button>

          <div className="share-card" onClick={(event) => event.stopPropagation()}>
            <Logo size={44} leaves="ink" />
            <div>
              <div className="screen-title" style={{ fontSize: 20 }}>
                Share your yard
              </div>
              <p className="muted" style={{ marginTop: 4 }}>
                Buyers scan the code or open your link.
                <br />
                No app, no sign-in.
              </p>
            </div>

            <div className="qr-frame">
              <QrCode seed={demoSale.slug} />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                justifyContent: "space-between",
                background: "var(--accent-soft)",
                borderRadius: 14,
                padding: "8px 8px 8px 14px",
              }}
            >
              <span
                className="display"
                style={{ fontWeight: 600, color: "var(--accent-ink)" }}
              >
                {link}
              </span>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => {
                  navigator.clipboard?.writeText(`https://${link}`);
                  setToast("Link copied");
                }}
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
