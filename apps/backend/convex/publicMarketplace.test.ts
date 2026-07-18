import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";

import type { Id } from "./_generated/dataModel";
import schema from "./schema";

declare global {
  interface ImportMeta {
    glob(pattern: string): Record<string, () => Promise<unknown>>;
  }
}

const modules = import.meta.glob("./**/*.*s");

type ListingCondition = "like_new" | "good" | "fair" | "for_parts";
type ListingStatus = "available" | "reserved" | "sold";

type SellerListingView = {
  items: Array<{
    id: string;
    selected: boolean;
    title: string;
    condition: ListingCondition;
    finalPricePhp?: number;
    status: ListingStatus;
    reservedByName?: string;
  }>;
};

type StorefrontView = {
  slug: string;
  title: string;
  items: Array<{
    id: string;
    selected: boolean;
    title: string;
    category: string;
    condition: ListingCondition;
    finalPricePhp: number;
    status: ListingStatus;
    reservedByName?: string;
    imageUrl: string;
  }>;
};

const setSelected = makeFunctionReference<
  "mutation",
  { itemId: Id<"items">; selected: boolean },
  null
>("items:setSelected");
const updateListing = makeFunctionReference<
  "mutation",
  {
    itemId: Id<"items">;
    title?: string;
    condition?: ListingCondition;
    finalPricePhp?: number;
  },
  null
>("items:updateListing");
const reserve = makeFunctionReference<
  "mutation",
  { slug: string; itemId: Id<"items">; buyerName: string },
  null
>("items:reserve");
const getSellerView = makeFunctionReference<
  "query",
  { saleId: Id<"sales"> },
  SellerListingView | null
>("sales:getSellerView");
const getLatest = makeFunctionReference<
  "query",
  Record<string, never>,
  Id<"sales"> | null
>("sales:getLatest");
const publish = makeFunctionReference<
  "mutation",
  { saleId: Id<"sales"> },
  string
>("sales:publish");
const getStorefront = makeFunctionReference<
  "query",
  { slug: string },
  StorefrontView | null
>("sales:getStorefront");

async function readySaleFixture(
  t: ReturnType<typeof convexTest>,
  {
    slug = `sale-${crypto.randomUUID()}`,
    saleStatus = "ready" as const,
    createdAt = Date.now(),
  }: {
    slug?: string;
    saleStatus?: "ready" | "draft";
    createdAt?: number;
  } = {},
) {
  return t.run(async (ctx) => {
    const sceneStorageId = await ctx.storage.store(
      new Blob(["scene"], { type: "image/jpeg" }),
    );
    const saleId = await ctx.db.insert("sales", {
      slug,
      imageStorageId: sceneStorageId,
      imageMimeType: "image/jpeg",
      imageWidth: 1200,
      imageHeight: 900,
      roboflowImageId: `scene-${slug}`,
      status: saleStatus,
      processingStage: saleStatus === "ready" ? "complete" : "uploaded",
      progress: saleStatus === "ready" ? 100 : 0,
      promptVersion: "test",
      providerVersion: "test",
      createdAt,
    });

    async function insertCurrentItem(
      tempId: string,
      sortOrder: number,
      options: { selected?: boolean; marketplace?: boolean } = {},
    ) {
      const cropStorageId = await ctx.storage.store(
        new Blob([`crop-${tempId}`], { type: "image/webp" }),
      );
      const marketplaceStorageId = options.marketplace
        ? await ctx.storage.store(
            new Blob([`marketplace-${tempId}`], { type: "image/jpeg" }),
          )
        : undefined;
      const itemId = await ctx.db.insert("items", {
        saleId,
        tempId,
        sortOrder,
        selected: options.selected ?? true,
        source: "ai",
        title: tempId === "speaker" ? "Portable Speaker" : "Desk Lamp",
        category: tempId === "speaker" ? "Audio" : "Home",
        confidence: 0.92,
        roughBox: {
          x1: 100 + sortOrder * 300,
          y1: 100,
          x2: 350 + sortOrder * 300,
          y2: 500,
        },
        refinedBox: {
          x1: 110 + sortOrder * 300,
          y1: 110,
          x2: 340 + sortOrder * 300,
          y2: 490,
        },
        maskSource: "roboflow_sam2",
        segmentationConfidence: 0.9,
        maskRevision: 1,
        cropStorageId,
        cropMimeType: "image/webp",
        cropRevision: 1,
        cropStatus: "ready",
        ...(marketplaceStorageId === undefined
          ? {}
          : {
              marketplaceImageStorageId: marketplaceStorageId,
              marketplaceImageRevision: 1,
              marketplaceImageMimeType: "image/jpeg" as const,
            }),
        marketplaceImageStatus:
          marketplaceStorageId === undefined ? "idle" : "ready",
        createdAt,
        updatedAt: createdAt,
      });
      await ctx.db.insert("itemMasks", {
        itemId,
        revision: 1,
        polygons: [
          [
            [110 + sortOrder * 300, 110],
            [340 + sortOrder * 300, 110],
            [340 + sortOrder * 300, 490],
          ],
        ],
        promptBox: {
          x1: 100 + sortOrder * 300,
          y1: 100,
          x2: 350 + sortOrder * 300,
          y2: 500,
        },
        promptPoints: [],
        provider: "test",
        model: "test",
        createdAt,
      });
      return {
        itemId,
        cropStorageId,
        marketplaceStorageId,
        cropUrl: await ctx.storage.getUrl(cropStorageId),
        marketplaceUrl:
          marketplaceStorageId === undefined
            ? null
            : await ctx.storage.getUrl(marketplaceStorageId),
      };
    }

    const speaker = await insertCurrentItem("speaker", 0, { marketplace: true });
    const lamp = await insertCurrentItem("lamp", 1);
    const hidden = await insertCurrentItem("hidden", 2, { selected: false });
    return { saleId, slug, speaker, lamp, hidden };
  });
}

describe("public marketplace mutations", () => {
  it("edits selection and validated listing fields exposed by the seller view", async () => {
    const t = convexTest(schema, modules);
    const fixture = await readySaleFixture(t);

    await expect(
      t.mutation(setSelected, { itemId: fixture.speaker.itemId, selected: false }),
    ).resolves.toBeNull();
    await expect(
      t.mutation(updateListing, {
        itemId: fixture.speaker.itemId,
        title: "  Vintage Portable Speaker  ",
        condition: "fair",
        finalPricePhp: 1_250,
      }),
    ).resolves.toBeNull();

    const view = await t.query(getSellerView, { saleId: fixture.saleId });
    expect(view?.items.find(({ id }) => id === fixture.speaker.itemId)).toMatchObject({
      selected: false,
      title: "Vintage Portable Speaker",
      condition: "fair",
      finalPricePhp: 1_250,
      status: "available",
    });
  });

  it("rejects blank titles, non-positive prices, and empty listing patches", async () => {
    const t = convexTest(schema, modules);
    const fixture = await readySaleFixture(t);

    await expect(
      t.mutation(updateListing, {
        itemId: fixture.speaker.itemId,
        title: "   ",
      }),
    ).rejects.toThrow(/title/i);
    await expect(
      t.mutation(updateListing, {
        itemId: fixture.speaker.itemId,
        finalPricePhp: 0,
      }),
    ).rejects.toThrow(/positive/i);
    await expect(
      t.mutation(updateListing, { itemId: fixture.speaker.itemId }),
    ).rejects.toThrow(/change/i);
  });

  it("publishes selected current listings and prefers generated images in the storefront", async () => {
    const t = convexTest(schema, modules);
    const fixture = await readySaleFixture(t, { slug: "weekend-yard" });
    await t.mutation(updateListing, {
      itemId: fixture.speaker.itemId,
      condition: "like_new",
      finalPricePhp: 2_500,
    });
    await t.mutation(updateListing, {
      itemId: fixture.lamp.itemId,
      finalPricePhp: 900,
    });

    await expect(t.mutation(publish, { saleId: fixture.saleId })).resolves.toBe(
      "weekend-yard",
    );
    const storefront = await t.query(getStorefront, { slug: fixture.slug });

    expect(storefront).toMatchObject({
      slug: "weekend-yard",
      title: "Yard Sale",
      items: [
        {
          id: fixture.speaker.itemId,
          selected: true,
          condition: "like_new",
          finalPricePhp: 2_500,
          status: "available",
          imageUrl: fixture.speaker.marketplaceUrl,
        },
        {
          id: fixture.lamp.itemId,
          selected: true,
          condition: "good",
          finalPricePhp: 900,
          status: "available",
          imageUrl: fixture.lamp.cropUrl,
        },
      ],
    });
    expect(storefront?.items.some(({ id }) => id === fixture.hidden.itemId)).toBe(
      false,
    );
    await expect(
      t.run((ctx) => ctx.db.get(fixture.saleId)),
    ).resolves.toMatchObject({ status: "published" });
  });

  it("keeps published listings immutable so the storefront stays valid", async () => {
    const t = convexTest(schema, modules);
    const fixture = await readySaleFixture(t);
    await t.mutation(updateListing, {
      itemId: fixture.speaker.itemId,
      finalPricePhp: 2_500,
    });
    await t.mutation(updateListing, {
      itemId: fixture.lamp.itemId,
      finalPricePhp: 900,
    });
    await t.mutation(publish, { saleId: fixture.saleId });

    await expect(
      t.mutation(setSelected, {
        itemId: fixture.hidden.itemId,
        selected: true,
      }),
    ).rejects.toThrow(/published/i);
    await expect(
      t.mutation(updateListing, {
        itemId: fixture.speaker.itemId,
        finalPricePhp: 1,
      }),
    ).rejects.toThrow(/published/i);

    await expect(
      t.query(getStorefront, { slug: fixture.slug }),
    ).resolves.toMatchObject({ items: [{ finalPricePhp: 2_500 }, { finalPricePhp: 900 }] });
  });

  it("falls back to the current crop when a generated image blob is unavailable", async () => {
    const t = convexTest(schema, modules);
    const fixture = await readySaleFixture(t);
    await t.mutation(updateListing, {
      itemId: fixture.speaker.itemId,
      finalPricePhp: 2_500,
    });
    await t.mutation(updateListing, {
      itemId: fixture.lamp.itemId,
      finalPricePhp: 900,
    });
    await t.mutation(publish, { saleId: fixture.saleId });
    await t.run((ctx) =>
      ctx.storage.delete(fixture.speaker.marketplaceStorageId!),
    );

    const storefront = await t.query(getStorefront, { slug: fixture.slug });
    expect(
      storefront?.items.find(({ id }) => id === fixture.speaker.itemId),
    ).toMatchObject({ imageUrl: fixture.speaker.cropUrl });
  });

  it("rejects publication when a selected item lacks a price or current crop", async () => {
    const t = convexTest(schema, modules);
    const fixture = await readySaleFixture(t);
    await t.mutation(updateListing, {
      itemId: fixture.speaker.itemId,
      finalPricePhp: 2_500,
    });

    await expect(t.mutation(publish, { saleId: fixture.saleId })).rejects.toThrow(
      /positive price/i,
    );
    await t.mutation(updateListing, {
      itemId: fixture.lamp.itemId,
      finalPricePhp: 900,
    });
    await t.run((ctx) =>
      ctx.db.patch("items", fixture.lamp.itemId, { cropRevision: 0 }),
    );

    await expect(t.mutation(publish, { saleId: fixture.saleId })).rejects.toThrow(
      /current crop/i,
    );
  });

  it("reserves atomically and rejects a second buyer", async () => {
    const t = convexTest(schema, modules);
    const fixture = await readySaleFixture(t);
    await t.mutation(updateListing, {
      itemId: fixture.speaker.itemId,
      finalPricePhp: 2_500,
    });
    await t.mutation(updateListing, {
      itemId: fixture.lamp.itemId,
      finalPricePhp: 900,
    });
    await t.mutation(publish, { saleId: fixture.saleId });

    const buyers = ["  Mia  ", "Noah"];
    const attempts = await Promise.allSettled(
      buyers.map((buyerName) =>
        t.mutation(reserve, {
          slug: fixture.slug,
          itemId: fixture.speaker.itemId,
          buyerName,
        }),
      ),
    );
    expect(attempts.map(({ status }) => status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    const winnerIndex = attempts.findIndex(({ status }) => status === "fulfilled");
    const winnerName = buyers[winnerIndex]!.trim();

    const storefront = await t.query(getStorefront, { slug: fixture.slug });
    expect(
      storefront?.items.find(({ id }) => id === fixture.speaker.itemId),
    ).toMatchObject({ status: "reserved", reservedByName: winnerName });
  });

  it("validates trimmed buyer names between one and sixty characters", async () => {
    const t = convexTest(schema, modules);
    const fixture = await readySaleFixture(t);
    await t.mutation(updateListing, {
      itemId: fixture.speaker.itemId,
      finalPricePhp: 2_500,
    });
    await t.mutation(updateListing, {
      itemId: fixture.lamp.itemId,
      finalPricePhp: 900,
    });
    await t.mutation(publish, { saleId: fixture.saleId });

    await expect(
      t.mutation(reserve, {
        slug: fixture.slug,
        itemId: fixture.speaker.itemId,
        buyerName: "  ",
      }),
    ).rejects.toThrow(/1 and 60/i);
    await expect(
      t.mutation(reserve, {
        slug: fixture.slug,
        itemId: fixture.speaker.itemId,
        buyerName: "x".repeat(61),
      }),
    ).rejects.toThrow(/1 and 60/i);
  });

  it("rejects reservations for unpublished sales and mismatched items", async () => {
    const t = convexTest(schema, modules);
    const unpublished = await readySaleFixture(t, { slug: "unpublished" });
    const published = await readySaleFixture(t, { slug: "published" });
    await t.mutation(updateListing, {
      itemId: published.speaker.itemId,
      finalPricePhp: 2_500,
    });
    await t.mutation(updateListing, {
      itemId: published.lamp.itemId,
      finalPricePhp: 900,
    });
    await t.mutation(publish, { saleId: published.saleId });

    await expect(
      t.mutation(reserve, {
        slug: unpublished.slug,
        itemId: unpublished.speaker.itemId,
        buyerName: "Mia",
      }),
    ).rejects.toThrow(/published/i);
    await expect(
      t.mutation(reserve, {
        slug: published.slug,
        itemId: unpublished.speaker.itemId,
        buyerName: "Mia",
      }),
    ).rejects.toThrow(/belong/i);
  });
});

describe("sales.getLatest", () => {
  it("returns the newest sale ID and returns null when no sales exist", async () => {
    const empty = convexTest(schema, modules);
    await expect(empty.query(getLatest, {})).resolves.toBeNull();

    const t = convexTest(schema, modules);
    await readySaleFixture(t, { slug: "older", createdAt: 10 });
    const newest = await readySaleFixture(t, { slug: "newest", createdAt: 20 });
    await expect(t.query(getLatest, {})).resolves.toBe(newest.saleId);
  });
});
