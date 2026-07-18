import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sales: defineTable({
    slug: v.string(),
    title: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("published"),
      v.literal("failed"),
    ),
    processingStage: v.string(),
    progress: v.number(),
  }).index("by_slug", ["slug"]),
  items: defineTable({
    saleId: v.id("sales"),
    title: v.string(),
    category: v.string(),
    selected: v.boolean(),
    finalPricePhp: v.optional(v.number()),
    status: v.union(v.literal("available"), v.literal("reserved"), v.literal("sold")),
  })
    .index("by_saleId", ["saleId"])
    .index("by_saleId_and_status", ["saleId", "status"]),
});
