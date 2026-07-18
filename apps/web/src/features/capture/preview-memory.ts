const previews = new Map<string, string>();

export function rememberCapturePreview(saleId: string, url: string) {
  previews.set(saleId, url);
}

export function getCapturePreview(saleId: string): string | null {
  return previews.get(saleId) ?? null;
}

export function releaseCapturePreview(saleId: string) {
  const url = previews.get(saleId);
  if (!url) return;
  previews.delete(saleId);
  URL.revokeObjectURL(url);
}
