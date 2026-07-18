"use node";

import {
  generateMarketplaceImage,
  ProviderError,
  toSafeProviderError,
} from "@yard/ai";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

export const generate = internalAction({
  args: { jobId: v.id("marketplaceImageJobs") },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    const startedAt = performance.now();
    let generatedStorageId: Awaited<ReturnType<typeof ctx.storage.store>> | undefined;

    try {
      const input = await ctx.runQuery(internal.marketplaceModel.loadJobInput, {
        jobId,
      });
      if (!input) {
        await ctx.runMutation(internal.marketplaceModel.failJob, {
          jobId,
          errorCode: "MARKETPLACE_JOB_STALE",
          errorMessage: "This marketplace-image job is no longer current.",
        });
        return null;
      }

      const crop = await ctx.storage.get(input.cropStorageId);
      if (!crop) {
        throw new ProviderError(
          "CROP_NOT_FOUND",
          "The real item crop is no longer available.",
        );
      }
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new ProviderError(
          "AI_NOT_CONFIGURED",
          "Marketplace image generation is not configured.",
        );
      }

      const generated = await generateMarketplaceImage({
        apiKey,
        image: new Uint8Array(await crop.arrayBuffer()),
        mimeType: input.mimeType,
        signal: AbortSignal.timeout(120_000),
      });
      const generatedCopy = new Uint8Array(generated.byteLength);
      generatedCopy.set(generated);
      generatedStorageId = await ctx.storage.store(
        new Blob([generatedCopy.buffer], { type: "image/jpeg" }),
      );
      const attached = await ctx.runMutation(
        internal.marketplaceModel.completeJob,
        {
          jobId,
          generatedStorageId,
          durationMs: performance.now() - startedAt,
          mimeType: "image/jpeg",
        },
      );
      if (!attached) await ctx.storage.delete(generatedStorageId);
    } catch (error) {
      if (generatedStorageId) await ctx.storage.delete(generatedStorageId);
      const safeError = toSafeProviderError(error);
      await ctx.runMutation(internal.marketplaceModel.failJob, {
        jobId,
        errorCode: safeError.code,
        errorMessage: safeError.message,
        durationMs: performance.now() - startedAt,
      });
    }

    return null;
  },
});
