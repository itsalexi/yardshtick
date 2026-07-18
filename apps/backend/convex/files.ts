import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

export const generateCropUploadUrl = mutation({
  args: { itemId: v.id("items") },
  returns: v.string(),
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get(itemId);
    if (!item || item.maskRevision <= 0 || item.maskSource === "pending") {
      throw new Error("A completed item mask is required before creating a crop.");
    }
    return ctx.storage.generateUploadUrl();
  },
});
