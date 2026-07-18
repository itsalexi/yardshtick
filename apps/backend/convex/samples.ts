import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import {
  imageMetadataValidator,
  sampleSaleValidator,
} from "./lib/validators";
import {
  DISCOVERY_PROMPT_VERSION,
  DISCOVERY_PROVIDER_VERSION,
} from "./lib/versions";

export const createSale = mutation({
  args: {
    fixtureKey: v.string(),
    storageId: v.id("_storage"),
    metadata: imageMetadataValidator,
  },
  returns: v.id("sales"),
  handler: async (ctx, { fixtureKey, storageId, metadata }) => {
    const existing = await ctx.db
      .query("sales")
      .withIndex("by_fixtureKey", (q) => q.eq("fixtureKey", fixtureKey))
      .unique();
    if (existing) return existing._id;

    return ctx.db.insert("sales", {
      slug: fixtureKey,
      title: "Yard Sale",
      fixtureKey,
      imageStorageId: storageId,
      imageMimeType: metadata.mimeType,
      imageWidth: metadata.width,
      imageHeight: metadata.height,
      roboflowImageId: `fixture_${fixtureKey}`,
      status: "draft",
      processingStage: "uploaded",
      progress: 0,
      promptVersion: DISCOVERY_PROMPT_VERSION,
      providerVersion: DISCOVERY_PROVIDER_VERSION,
      createdAt: Date.now(),
    });
  },
});

export const list = query({
  args: {},
  returns: v.array(sampleSaleValidator),
  handler: async (ctx) => {
    const sales = await ctx.db.query("sales").withIndex("by_fixtureKey").collect();
    const fixtures = sales.filter(
      (sale): sale is typeof sale & { fixtureKey: string } => sale.fixtureKey !== undefined,
    );

    return Promise.all(
      fixtures.map(async (sale) => ({
        id: sale._id,
        fixtureKey: sale.fixtureKey,
        imageUrl: (await ctx.storage.getUrl(sale.imageStorageId)) ?? "",
        status: sale.status,
      })),
    );
  },
});
