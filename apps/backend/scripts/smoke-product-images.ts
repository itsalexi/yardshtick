import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type {
  PixelBox,
  SampleSale,
  ScanItem,
  ScanSellerView,
} from "@yard/contracts";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import sharp from "sharp";

import { sceneManifest } from "../../../packages/ai/test/fixtures/scenes/manifest";

const listSamples = makeFunctionReference<
  "query",
  Record<string, never>,
  SampleSale[]
>("samples:list");
const getSellerView = makeFunctionReference<
  "query",
  { saleId: string },
  ScanSellerView | null
>("sales:getSellerView");
const generateCropUploadUrl = makeFunctionReference<
  "mutation",
  { itemId: string },
  string
>("files:generateCropUploadUrl");
const attachCrop = makeFunctionReference<
  "mutation",
  {
    itemId: string;
    storageId: string;
    mimeType: "image/jpeg";
    maskRevision: number;
  },
  { jobId: string; cropRevision: number }
>("items:attachCrop");

type ImageDimensions = { width: number; height: number };

type ExtractRegion = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type CropArtifact = {
  bytes: Uint8Array;
  dimensions: ImageDimensions;
};

export type MarketplacePollOutcome = {
  status: "ready" | "failed" | "timeout";
  durationMs: number;
  errorCode: string | null;
  marketplaceImageUrl: string | null;
};

export type ProductImageSmokeReport = {
  fixtureKey: string;
  itemLabel: string;
  status: MarketplacePollOutcome["status"];
  durationMs: number;
  revision: number;
  dimensions: {
    crop: ImageDimensions;
    marketplace: ImageDimensions | null;
  };
  errorCode: string | null;
};

export type ReadyTarget = {
  fixtureKey: string;
  saleId: string;
  item: ScanItem;
  view: ScanSellerView;
};

class SmokeError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function isPositiveFinite(value: number) {
  return Number.isFinite(value) && value > 0;
}

export function getPaddedCropRegion(
  box: PixelBox,
  image: ImageDimensions,
  paddingRatio = 0.06,
): ExtractRegion {
  if (
    !isPositiveFinite(image.width) ||
    !isPositiveFinite(image.height) ||
    !Number.isFinite(box.x1) ||
    !Number.isFinite(box.y1) ||
    !Number.isFinite(box.x2) ||
    !Number.isFinite(box.y2) ||
    box.x2 <= box.x1 ||
    box.y2 <= box.y1
  ) {
    throw new SmokeError("INVALID_CROP_GEOMETRY");
  }

  const paddingX = (box.x2 - box.x1) * paddingRatio;
  const paddingY = (box.y2 - box.y1) * paddingRatio;
  const left = Math.floor(clamp(box.x1 - paddingX, 0, image.width - 1));
  const top = Math.floor(clamp(box.y1 - paddingY, 0, image.height - 1));
  const right = Math.ceil(clamp(box.x2 + paddingX, left + 1, image.width));
  const bottom = Math.ceil(clamp(box.y2 + paddingY, top + 1, image.height));

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

export async function createPaddedJpegCrop(
  input: string | Uint8Array,
  box: PixelBox,
  image: ImageDimensions,
): Promise<CropArtifact> {
  const region = getPaddedCropRegion(box, image);
  const { data, info } = await sharp(input)
    .extract(region)
    .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer({ resolveWithObject: true });

  return {
    bytes: new Uint8Array(data),
    dimensions: { width: info.width, height: info.height },
  };
}

export async function selectReadyTarget(
  samples: SampleSale[],
  querySellerView: (saleId: string) => Promise<ScanSellerView | null>,
): Promise<ReadyTarget> {
  for (const fixture of sceneManifest) {
    const sample = samples.find(
      (candidate) =>
        candidate.fixtureKey === fixture.fixtureKey && candidate.status === "ready",
    );
    if (!sample) continue;

    const view = await querySellerView(sample.id);
    if (!view || view.status !== "ready") continue;

    const completedItems = [...view.items]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .filter(
        (candidate) =>
          candidate.maskRevision > 0 &&
          candidate.maskSource !== "pending",
      );
    const item =
      completedItems.find((candidate) => candidate.selected) ?? completedItems[0];
    if (!item) continue;

    return {
      fixtureKey: fixture.fixtureKey,
      saleId: sample.id,
      item,
      view,
    };
  }

  throw new SmokeError("READY_SAMPLE_ITEM_NOT_FOUND");
}

export function buildCropAttachment(item: ScanItem, storageId: string) {
  return {
    itemId: item.id,
    storageId,
    mimeType: "image/jpeg" as const,
    maskRevision: item.maskRevision,
  };
}

function defaultWait(milliseconds: number) {
  return new Promise<void>((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function safeErrorCode(value: string | null | undefined, fallback: string) {
  return value && /^[A-Z0-9_]+$/.test(value) ? value : fallback;
}

export async function pollMarketplaceImage({
  saleId,
  itemId,
  maskRevision,
  timeoutMs,
  pollIntervalMs = 750,
  querySellerView,
  now = Date.now,
  wait = defaultWait,
}: {
  saleId: string;
  itemId: string;
  maskRevision: number;
  timeoutMs: number;
  pollIntervalMs?: number;
  querySellerView: (saleId: string) => Promise<ScanSellerView | null>;
  now?: () => number;
  wait?: (milliseconds: number) => Promise<void>;
}): Promise<MarketplacePollOutcome> {
  const startedAt = now();

  while (now() - startedAt < timeoutMs) {
    const view = await querySellerView(saleId);
    const item = view?.items.find((candidate) => candidate.id === itemId);

    if (view && !item) {
      return {
        status: "failed",
        durationMs: now() - startedAt,
        errorCode: "SMOKE_ITEM_NOT_FOUND",
        marketplaceImageUrl: null,
      };
    }

    if (item) {
      const cropIsCurrent =
        item.crop.status === "ready" &&
        item.crop.revision === maskRevision &&
        item.crop.url !== null &&
        item.crop.mimeType !== null;
      if (!cropIsCurrent) {
        return {
          status: "failed",
          durationMs: now() - startedAt,
          errorCode: "CROP_FALLBACK_MISSING",
          marketplaceImageUrl: null,
        };
      }

      if (item.marketplaceImage.status === "failed") {
        return {
          status: "failed",
          durationMs: item.marketplaceImage.durationMs ?? now() - startedAt,
          errorCode: safeErrorCode(
            item.marketplaceImage.error?.code,
            "MARKETPLACE_IMAGE_FAILED",
          ),
          marketplaceImageUrl: null,
        };
      }

      if (item.marketplaceImage.status === "ready") {
        const generatedImageIsCurrent =
          item.marketplaceImage.revision === maskRevision &&
          item.marketplaceImage.url !== null &&
          item.marketplaceImage.mimeType === "image/jpeg";
        if (!generatedImageIsCurrent) {
          return {
            status: "failed",
            durationMs: item.marketplaceImage.durationMs ?? now() - startedAt,
            errorCode: "MARKETPLACE_IMAGE_INVALID",
            marketplaceImageUrl: null,
          };
        }

        return {
          status: "ready",
          durationMs: item.marketplaceImage.durationMs ?? now() - startedAt,
          errorCode: null,
          marketplaceImageUrl: item.marketplaceImage.url,
        };
      }
    }

    const remainingMs = timeoutMs - (now() - startedAt);
    if (remainingMs <= 0) break;
    await wait(Math.min(pollIntervalMs, remainingMs));
  }

  return {
    status: "timeout",
    durationMs: now() - startedAt,
    errorCode: "MARKETPLACE_IMAGE_TIMEOUT",
    marketplaceImageUrl: null,
  };
}

export function buildSafeReport(
  report: ProductImageSmokeReport,
): ProductImageSmokeReport {
  return {
    fixtureKey: report.fixtureKey,
    itemLabel: report.itemLabel,
    status: report.status,
    durationMs: report.durationMs,
    revision: report.revision,
    dimensions: {
      crop: {
        width: report.dimensions.crop.width,
        height: report.dimensions.crop.height,
      },
      marketplace: report.dimensions.marketplace
        ? {
            width: report.dimensions.marketplace.width,
            height: report.dimensions.marketplace.height,
          }
        : null,
    },
    errorCode:
      report.errorCode === null
        ? null
        : safeErrorCode(report.errorCode, "PRODUCT_IMAGE_SMOKE_FAILED"),
  };
}

function parseEnvValue(contents: string, key: string) {
  const line = contents
    .split(/\r?\n/)
    .find((candidate) => candidate.trimStart().startsWith(`${key}=`));
  if (!line) return undefined;
  const value = line.slice(line.indexOf("=") + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

async function loadConvexUrl() {
  if (process.env.CONVEX_URL) return process.env.CONVEX_URL;
  const envPath = fileURLToPath(new URL("../.env.local", import.meta.url));
  const contents = await readFile(envPath, "utf8");
  const url = parseEnvValue(contents, "CONVEX_URL");
  if (!url) throw new SmokeError("CONVEX_URL_MISSING");
  return url;
}

async function createCrop(target: ReadyTarget): Promise<CropArtifact> {
  const fixture = sceneManifest.find(
    (candidate) => candidate.fixtureKey === target.fixtureKey,
  );
  if (!fixture) throw new SmokeError("FIXTURE_NOT_FOUND");

  const fixturePath = fileURLToPath(
    new URL(
      `../../../packages/ai/test/fixtures/scenes/${fixture.fileName}`,
      import.meta.url,
    ),
  );
  const source = sharp(fixturePath);
  const metadata = await source.metadata();
  if (
    metadata.width !== target.view.image.width ||
    metadata.height !== target.view.image.height
  ) {
    throw new SmokeError("FIXTURE_DIMENSIONS_MISMATCH");
  }

  const box = target.item.refinedBox ?? target.item.roughBox;
  return createPaddedJpegCrop(fixturePath, box, target.view.image);
}

async function uploadCrop(
  client: ConvexHttpClient,
  itemId: string,
  bytes: Uint8Array,
) {
  const uploadUrl = await client.mutation(generateCropUploadUrl, { itemId });
  const bytesCopy = new Uint8Array(bytes);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: new Blob([bytesCopy.buffer], { type: "image/jpeg" }),
  });
  if (!response.ok) throw new SmokeError("CROP_UPLOAD_FAILED");

  const payload: unknown = await response.json();
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof Reflect.get(payload, "storageId") !== "string"
  ) {
    throw new SmokeError("CROP_UPLOAD_RESPONSE_INVALID");
  }
  return Reflect.get(payload, "storageId") as string;
}

async function inspectStoredImage(imageUrl: string): Promise<ImageDimensions> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new SmokeError("MARKETPLACE_IMAGE_INVALID");
  const metadata = await sharp(new Uint8Array(await response.arrayBuffer())).metadata();
  if (
    metadata.format !== "jpeg" ||
    metadata.width === undefined ||
    metadata.height === undefined
  ) {
    throw new SmokeError("MARKETPLACE_IMAGE_INVALID");
  }
  return { width: metadata.width, height: metadata.height };
}

async function writeReport(report: ProductImageSmokeReport) {
  const outputDirectory = fileURLToPath(
    new URL("../../../artifacts/product-images/", import.meta.url),
  );
  await mkdir(outputDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = resolve(
    outputDirectory,
    `product-image-smoke-${timestamp}.json`,
  );
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

function errorCodeFromUnknown(error: unknown) {
  return error instanceof SmokeError
    ? safeErrorCode(error.code, "PRODUCT_IMAGE_SMOKE_FAILED")
    : "PRODUCT_IMAGE_SMOKE_FAILED";
}

export async function smokeProductImages(timeoutMs = 180_000) {
  const client = new ConvexHttpClient(await loadConvexUrl());
  const samples = await client.query(listSamples, {});
  const target = await selectReadyTarget(samples, (saleId) =>
    client.query(getSellerView, { saleId }),
  );
  const crop = await createCrop(target);
  const startedAt = Date.now();
  let outcome: MarketplacePollOutcome;
  let marketplaceDimensions: ImageDimensions | null = null;

  try {
    const storageId = await uploadCrop(client, target.item.id, crop.bytes);
    await client.mutation(
      attachCrop,
      buildCropAttachment(target.item, storageId),
    );
    outcome = await pollMarketplaceImage({
      saleId: target.saleId,
      itemId: target.item.id,
      maskRevision: target.item.maskRevision,
      timeoutMs,
      querySellerView: (saleId) => client.query(getSellerView, { saleId }),
    });

    if (outcome.status === "ready" && outcome.marketplaceImageUrl) {
      marketplaceDimensions = await inspectStoredImage(
        outcome.marketplaceImageUrl,
      );
    }
  } catch (error) {
    outcome = {
      status: "failed",
      durationMs: Date.now() - startedAt,
      errorCode: errorCodeFromUnknown(error),
      marketplaceImageUrl: null,
    };
  }

  const report = buildSafeReport({
    fixtureKey: target.fixtureKey,
    itemLabel: target.item.title,
    status: outcome.status,
    durationMs: outcome.durationMs,
    revision: target.item.maskRevision,
    dimensions: {
      crop: crop.dimensions,
      marketplace: marketplaceDimensions,
    },
    errorCode: outcome.errorCode,
  });
  const reportPath = await writeReport(report);

  console.log(
    `Product image smoke: ${report.fixtureKey} / ${report.itemLabel} -> ${report.status}`,
  );
  console.log(`Report: ${reportPath}`);

  if (report.status !== "ready" || report.dimensions.marketplace === null) {
    throw new SmokeError(report.errorCode ?? "PRODUCT_IMAGE_SMOKE_FAILED");
  }

  return report;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : undefined;
if (invokedPath === import.meta.url) {
  smokeProductImages().catch(() => {
    console.error("Product image smoke failed. Inspect the safe report for details.");
    process.exitCode = 1;
  });
}
