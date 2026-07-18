"use node";

import {
  discoverProducts,
  embedScene,
  ProviderError,
  segmentCandidates,
  toSafeProviderError,
  type DiscoveryResult,
  type SegmentationItem,
  type SegmentationResult,
} from "@yard/ai";
import type { SceneCandidate } from "@yard/contracts";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action } from "./_generated/server";

type PersistCandidatesInput = {
  candidates: SceneCandidate[];
  discoveryMs: number;
  openaiResponseId?: string;
};

type PersistSegmentationInput = {
  results: SegmentationItem[];
  segmentationMs: number;
};

export type RunScanDependencies = {
  discover: () => Promise<DiscoveryResult>;
  embed: () => Promise<unknown>;
  segment: (candidates: SceneCandidate[]) => Promise<SegmentationResult>;
  persistCandidates: (input: PersistCandidatesInput) => Promise<boolean>;
  persistSegmentation: (input: PersistSegmentationInput) => Promise<boolean>;
};

export type RunScanResult = {
  stale: boolean;
  candidateCount: number;
  polygonCount: number;
  fallbackCount: number;
  discoveryMs: number;
  embeddingMs: number;
  segmentationMs: number;
};

function boxFallbacks(candidates: SceneCandidate[]): SegmentationItem[] {
  return candidates.map((candidate) => ({
    tempId: candidate.tempId,
    maskSource: "bbox",
    polygons: [],
    refinedBox: candidate.roughBox,
  }));
}

export async function runScanPipeline(
  dependencies: RunScanDependencies,
): Promise<RunScanResult> {
  const embeddingStartedAt = performance.now();
  const embeddingAttempt = dependencies.embed().then(
    () => ({ durationMs: performance.now() - embeddingStartedAt }),
    () => ({ durationMs: performance.now() - embeddingStartedAt }),
  );
  const discoveryStartedAt = performance.now();
  const discovery = await dependencies.discover();
  const discoveryMs = performance.now() - discoveryStartedAt;

  const candidatesPersisted = await dependencies.persistCandidates({
    candidates: discovery.candidates,
    discoveryMs,
    ...(discovery.responseId === undefined
      ? {}
      : { openaiResponseId: discovery.responseId }),
  });
  if (!candidatesPersisted) {
    const embedding = await embeddingAttempt;
    return {
      stale: true,
      candidateCount: discovery.candidates.length,
      polygonCount: 0,
      fallbackCount: 0,
      discoveryMs,
      embeddingMs: embedding.durationMs,
      segmentationMs: 0,
    };
  }

  const embedding = await embeddingAttempt;
  if (discovery.candidates.length === 0) {
    const persisted = await dependencies.persistSegmentation({
      results: [],
      segmentationMs: 0,
    });
    return {
      stale: !persisted,
      candidateCount: 0,
      polygonCount: 0,
      fallbackCount: 0,
      discoveryMs,
      embeddingMs: embedding.durationMs,
      segmentationMs: 0,
    };
  }

  const segmentationStartedAt = performance.now();
  let segmentation: SegmentationResult;
  try {
    segmentation = await dependencies.segment(discovery.candidates);
  } catch {
    segmentation = {
      items: boxFallbacks(discovery.candidates),
      polygonCount: 0,
      fallbackCount: discovery.candidates.length,
    };
  }
  const segmentationMs = performance.now() - segmentationStartedAt;
  const segmentationPersisted = await dependencies.persistSegmentation({
    results: segmentation.items,
    segmentationMs,
  });

  return {
    stale: !segmentationPersisted,
    candidateCount: discovery.candidates.length,
    polygonCount: segmentation.polygonCount,
    fallbackCount: segmentation.fallbackCount,
    discoveryMs,
    embeddingMs: embedding.durationMs,
    segmentationMs,
  };
}

export const start = action({
  args: { saleId: v.id("sales") },
  returns: v.object({ runId: v.string() }),
  handler: async (ctx, { saleId }): Promise<{ runId: string }> => {
    const startedAt = performance.now();
    const beginResult: { runId: string } = await ctx.runMutation(
      internal.scanModel.beginRun,
      { saleId },
    );
    const runId: string = beginResult.runId;

    try {
      const input = await ctx.runQuery(internal.scanModel.loadScanInput, { saleId, runId });
      if (!input) return { runId };

      const blob = await ctx.storage.get(input.storageId);
      if (!blob) {
        throw new ProviderError("IMAGE_NOT_FOUND", "The uploaded scene is no longer available.");
      }
      const image = new Uint8Array(await blob.arrayBuffer());
      const openAiApiKey = process.env.OPENAI_API_KEY;
      const roboflowApiKey = process.env.ROBOFLOW_API_KEY;
      if (!openAiApiKey || !roboflowApiKey) {
        throw new ProviderError(
          "AI_NOT_CONFIGURED",
          "The image providers are not configured for this deployment.",
        );
      }
      const roboflowBaseUrl =
        process.env.ROBOFLOW_API_URL ?? "https://serverless.roboflow.com";

      const result = await runScanPipeline({
        discover: () =>
          discoverProducts({
            apiKey: openAiApiKey,
            image,
            mimeType: input.mimeType,
            width: input.width,
            height: input.height,
            signal: AbortSignal.timeout(30_000),
          }),
        embed: () =>
          embedScene({
            apiKey: roboflowApiKey,
            baseUrl: roboflowBaseUrl,
            image,
            imageId: input.imageId,
            signal: AbortSignal.timeout(20_000),
          }),
        segment: (candidates) =>
          segmentCandidates({
            apiKey: roboflowApiKey,
            baseUrl: roboflowBaseUrl,
            image,
            imageId: input.imageId,
            width: input.width,
            height: input.height,
            candidates,
            signal: AbortSignal.timeout(25_000),
          }),
        persistCandidates: (payload) =>
          ctx.runMutation(internal.scanModel.persistCandidates, {
            saleId,
            runId,
            ...payload,
          }),
        persistSegmentation: (payload) =>
          ctx.runMutation(internal.scanModel.persistSegmentation, {
            saleId,
            runId,
            ...payload,
          }),
      });

      if (!result.stale) {
        await ctx.runMutation(internal.scanModel.completeRun, {
          saleId,
          runId,
          embeddingMs: result.embeddingMs,
          totalMs: performance.now() - startedAt,
        });
      }
    } catch (error) {
      const safeError = toSafeProviderError(error);
      await ctx.runMutation(internal.scanModel.failRun, {
        saleId,
        runId,
        errorCode: safeError.code,
        errorMessage: safeError.message,
        totalMs: performance.now() - startedAt,
      });
    }

    return { runId };
  },
});
