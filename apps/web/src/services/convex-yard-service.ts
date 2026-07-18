import {
  saleViewSchema,
  scanSellerViewSchema,
  storefrontSchema,
  type DraftImage,
  type ImageMimeType,
  type SaleView,
  type ScanSellerView,
  type Storefront,
  type YardItem,
  type YardService,
} from "@yard/contracts";
import { ConvexHttpClient } from "convex/browser";

import { convexFunctions } from "./convex-functions";
import { generateItemCrop } from "./crop";

const ACTIVE_SALE_KEY = "yard:active-sale-id";
const supportedImageTypes = new Set<ImageMimeType>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function imageMimeType(blob: Blob): ImageMimeType {
  if (!supportedImageTypes.has(blob.type as ImageMimeType)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }
  return blob.type as ImageMimeType;
}

async function upload(uploadUrl: string, blob: Blob): Promise<string> {
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": blob.type },
    body: blob,
  });
  if (!response.ok) throw new Error(`Image upload failed (${response.status}).`);
  const payload: unknown = await response.json();
  const storageId =
    payload && typeof payload === "object" ? Reflect.get(payload, "storageId") : null;
  if (typeof storageId !== "string") throw new Error("Image upload returned no file ID.");
  return storageId;
}

function rememberSale(saleId: string) {
  try {
    globalThis.localStorage?.setItem(ACTIVE_SALE_KEY, saleId);
  } catch {
    // Storage is only a convenience for returning to the seller dashboard.
  }
}

function rememberedSale(): string | null {
  try {
    return globalThis.localStorage?.getItem(ACTIVE_SALE_KEY) ?? null;
  } catch {
    return null;
  }
}

function toSaleView(raw: ScanSellerView): SaleView {
  const view = scanSellerViewSchema.parse(raw);
  return saleViewSchema.parse({
    id: view.id,
    slug: view.slug,
    title: "My Yard Sale",
    status: view.status,
    processingStage: view.processingStage,
    progress: view.progress,
    image: view.image,
    error: view.error,
    items: view.items.map((item) => ({
      id: item.id,
      selected: item.selected,
      title: item.title,
      category: item.category,
      confidence: item.confidence,
      condition: item.condition,
      roughBox: item.roughBox,
      refinedBox: item.refinedBox,
      maskSource: item.maskSource,
      maskRevision: item.maskRevision,
      polygons: item.polygons,
      crop: item.crop,
      marketplaceImage: item.marketplaceImage,
      imageUrl: item.marketplaceImage.url ?? item.crop.url,
      finalPricePhp: item.finalPricePhp,
      status: item.status,
      ...(item.reservedByName ? { reservedByName: item.reservedByName } : {}),
    })),
  });
}

export class ConvexYardService implements YardService {
  private readonly client: ConvexHttpClient;
  private readonly preparing = new Map<string, Promise<void>>();

  constructor(deploymentUrl: string) {
    this.client = new ConvexHttpClient(deploymentUrl);
  }

  async createDraft(image: DraftImage): Promise<SaleView> {
    const mimeType = imageMimeType(image.file);
    const uploadUrl = await this.client.mutation(convexFunctions.generateUploadUrl, {});
    const storageId = await upload(uploadUrl, image.file);
    const saleId = await this.client.mutation(convexFunctions.createDraft, {
      storageId,
      metadata: { width: image.width, height: image.height, mimeType },
    });
    rememberSale(saleId);
    return this.getSale(saleId);
  }

  async startScan(saleId: string): Promise<void> {
    await this.client.action(convexFunctions.startScan, { saleId });
  }

  async getSale(saleId: string): Promise<SaleView> {
    const sale = await this.client.query(convexFunctions.getSellerView, { saleId });
    if (!sale) throw new Error("Sale not found.");
    return toSaleView(sale);
  }

  async getLatestSale(): Promise<SaleView | null> {
    const saleId = rememberedSale();
    if (!saleId) return null;
    try {
      return await this.getSale(saleId);
    } catch {
      return null;
    }
  }

  async setItemSelected(itemId: string, selected: boolean): Promise<void> {
    await this.client.mutation(convexFunctions.setSelected, { itemId, selected });
  }

  async updateItem(
    itemId: string,
    patch: Partial<Pick<YardItem, "title" | "condition" | "finalPricePhp">>,
  ): Promise<void> {
    await this.client.mutation(convexFunctions.updateListing, {
      itemId,
      ...(patch.title === undefined ? {} : { title: patch.title }),
      ...(patch.condition === undefined ? {} : { condition: patch.condition }),
      ...(patch.finalPricePhp === undefined ? {} : { finalPricePhp: patch.finalPricePhp }),
    });
  }

  async prepareItemPhoto(saleId: string, itemId: string): Promise<void> {
    const active = this.preparing.get(itemId);
    if (active) return active;

    const task = this.prepareItemPhotoOnce(saleId, itemId).finally(() => {
      this.preparing.delete(itemId);
    });
    this.preparing.set(itemId, task);
    return task;
  }

  private async prepareItemPhotoOnce(saleId: string, itemId: string) {
    const raw = await this.client.query(convexFunctions.getSellerView, { saleId });
    const sale = raw ? scanSellerViewSchema.parse(raw) : null;
    const item = sale?.items.find((candidate) => candidate.id === itemId);
    if (!sale || !item) throw new Error("Item not found.");
    if (["pending", "generating", "ready"].includes(item.marketplaceImage.status)) return;
    if (item.maskRevision <= 0 || item.maskSource === "pending") return;

    const [crop, uploadUrl] = await Promise.all([
      generateItemCrop({
        imageUrl: sale.image.url,
        imageSize: sale.image,
        item,
      }),
      this.client.mutation(convexFunctions.generateCropUploadUrl, { itemId }),
    ]);
    const storageId = await upload(uploadUrl, crop.blob);
    await this.client.mutation(convexFunctions.attachCrop, {
      itemId,
      storageId,
      mimeType: crop.mimeType,
      maskRevision: crop.maskRevision,
    });
  }

  async retryItemPhoto(itemId: string): Promise<void> {
    await this.client.mutation(convexFunctions.retryMarketplaceImage, { itemId });
  }

  async publishSale(saleId: string): Promise<Storefront> {
    const slug = await this.client.mutation(convexFunctions.publish, { saleId });
    rememberSale(saleId);
    return this.getStorefront(slug);
  }

  async getStorefront(slug: string): Promise<Storefront> {
    const storefront = await this.client.query(convexFunctions.getStorefront, { slug });
    if (!storefront) throw new Error("Storefront not found.");
    return storefrontSchema.parse(storefront);
  }

  async reserveItem(slug: string, itemId: string, buyerName: string): Promise<void> {
    await this.client.mutation(convexFunctions.reserve, { slug, itemId, buyerName });
  }
}
