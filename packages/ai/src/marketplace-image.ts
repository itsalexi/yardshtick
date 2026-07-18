import {
  ProviderError,
  providerHttpError,
  type ProviderFetcher,
} from "./provider-error";

export type MarketplaceImageInput = {
  apiKey: string;
  image: Uint8Array;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  fetcher?: ProviderFetcher;
  signal?: AbortSignal;
};

const marketplaceImagePrompt = `Create a clean, centered marketplace product photo of the exact item in the
input image on a seamless soft-white background with neutral studio lighting and a subtle contact shadow.
Preserve its product type, color, proportions, visible branding and text, included accessories, and existing
wear. Do not add props or accessories, repair damage, reveal hidden features, or otherwise change the product.`;

function fileNameFor(mimeType: MarketplaceImageInput["mimeType"]) {
  if (mimeType === "image/png") return "item.png";
  if (mimeType === "image/webp") return "item.webp";
  return "item.jpg";
}

function toBlobPart(image: Uint8Array) {
  const copy = new Uint8Array(image.byteLength);
  copy.set(image);
  return copy.buffer;
}

function decodeBase64(value: string) {
  if (!value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error("Invalid base64 image");
  }
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new Error("Invalid JPEG image");
  }
  return bytes;
}

export async function generateMarketplaceImage(
  input: MarketplaceImageInput,
): Promise<Uint8Array> {
  const form = new FormData();
  form.set("model", "gpt-image-2");
  form.append(
    "image[]",
    new Blob([toBlobPart(input.image)], { type: input.mimeType }),
    fileNameFor(input.mimeType),
  );
  form.set("prompt", marketplaceImagePrompt);
  form.set("n", "1");
  form.set("size", "1024x1024");
  form.set("quality", "low");
  form.set("background", "opaque");
  form.set("output_format", "jpeg");

  let response: Response;
  try {
    response = await (input.fetcher ?? fetch)("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${input.apiKey}` },
      body: form,
      signal: input.signal,
    });
  } catch (error) {
    throw new ProviderError(
      "OPENAI_REQUEST_FAILED",
      "OpenAI could not be reached. Try again.",
      { cause: error, retryable: true },
    );
  }

  if (!response.ok) throw providerHttpError("OPENAI", response.status);

  try {
    const payload: unknown = await response.json();
    const data =
      payload && typeof payload === "object" ? Reflect.get(payload, "data") : undefined;
    const first = Array.isArray(data) ? data[0] : undefined;
    const encoded =
      first && typeof first === "object" ? Reflect.get(first, "b64_json") : undefined;

    if (typeof encoded !== "string") throw new Error("Missing marketplace image");
    return decodeBase64(encoded);
  } catch {
    throw new ProviderError(
      "OPENAI_INVALID_RESPONSE",
      "OpenAI returned an invalid marketplace image. Try again.",
    );
  }
}
