import {
  ProviderError,
  providerHttpError,
  type ProviderFetcher,
} from "./provider-error";

export type MarketplaceImageInput = {
  apiKey: string;
  image: Uint8Array;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  contextImage: Uint8Array;
  contextMimeType: "image/jpeg" | "image/png" | "image/webp";
  fetcher?: ProviderFetcher;
  signal?: AbortSignal;
};

const marketplaceImagePrompt = [
  "Create a polished marketplace product photo of the exact item shown in the first input image.",
  "The first input image is the isolated item crop; the second input image is the original sale scene for structural reference only.",
  "Use the scene to recover product structure lost by cropping or segmentation, but do not copy any other scene objects.",
  "Show the entire item fully inside the frame with comfortable margin, balanced scale, and a clear, natural viewing angle.",
  "Gently correct awkward perspective when helpful.",
  "Use a seamless soft-white background, neutral studio lighting, and a subtle contact shadow.",
  "Preserve the product type, materials, color, proportions, visible branding and text, included accessories, and existing wear.",
  "Complete all structurally necessary parts that are visible in the scene or unambiguously implied by the same item's geometry so the product never looks cut off by the mask.",
  "Do not add props or optional accessories, invent distinctive unseen details, repair damage, or erase wear.",
].join(" ");

function fileNameFor(
  mimeType: MarketplaceImageInput["mimeType"],
  stem: "item" | "scene",
) {
  if (mimeType === "image/png") return `${stem}.png`;
  if (mimeType === "image/webp") return `${stem}.webp`;
  return `${stem}.jpg`;
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
    fileNameFor(input.mimeType, "item"),
  );
  form.append(
    "image[]",
    new Blob([toBlobPart(input.contextImage)], { type: input.contextMimeType }),
    fileNameFor(input.contextMimeType, "scene"),
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
