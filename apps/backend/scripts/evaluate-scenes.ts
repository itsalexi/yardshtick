import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { SampleSale, ScanSellerView } from "@yard/contracts";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import {
  sceneManifest,
  type SceneExpectation,
} from "../../../packages/ai/test/fixtures/scenes/manifest";

const listSamples = makeFunctionReference<
  "query",
  Record<string, never>,
  SampleSale[]
>("samples:list");
const startScan = makeFunctionReference<
  "action",
  { saleId: string },
  { runId: string }
>("scan:start");
const getSellerView = makeFunctionReference<
  "query",
  { saleId: string },
  ScanSellerView | null
>("sales:getSellerView");

type EvaluationExpectation = Pick<
  SceneExpectation,
  | "fixtureKey"
  | "expectedCandidateRange"
  | "required"
  | "optional"
  | "excluded"
>;

type EvaluationView = {
  status: "draft" | "processing" | "ready" | "failed";
  error: { code: string } | null;
  run: {
    candidateCount: number;
    polygonCount: number;
    fallbackCount: number;
    discoveryMs?: number;
    embeddingMs?: number;
    segmentationMs?: number;
    totalMs?: number;
  } | null;
  items: Array<{
    title: string;
    maskSource?: "pending" | "roboflow_sam2" | "bbox";
    polygons?: unknown[];
  }>;
};

export type SceneEvaluation = {
  fixtureKey: string;
  terminalStatus: "ready" | "failed" | "timeout" | "evaluator_failed";
  candidateCount: number;
  expectedCandidateRange: readonly [number, number];
  candidateRangeOk: boolean;
  polygonCount: number;
  fallbackCount: number;
  maskCoverageOk: boolean;
  requiredFound: number;
  requiredTotal: number;
  requiredRecall: number;
  optionalFound: number;
  unexpectedCount: number;
  errorCode: string | null;
  timingsMs: {
    discovery: number | null;
    embedding: number | null;
    segmentation: number | null;
    total: number | null;
  };
};

type EvaluationReport = {
  generatedAt: string;
  totals: {
    scenes: number;
    ready: number;
    failed: number;
    requiredFound: number;
    requiredTotal: number;
    requiredRecall: number;
    integrityFailures: number;
  };
  scenes: SceneEvaluation[];
};

const STOP_WORDS = new Set(["a", "an", "and", "bundle", "of", "set", "the", "with"]);

function normalizedTokens(value: string) {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("en-US")
    .replace(/[&+]/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token));
}

export function matchesRequiredLabel(title: string, aliases: readonly string[]) {
  const titleTokens = normalizedTokens(title);
  const compactTitle = titleTokens.join("");

  return aliases.some((alias) => {
    const aliasTokens = normalizedTokens(alias);
    if (aliasTokens.length === 0) return false;
    const compactAlias = aliasTokens.join("");
    if (compactTitle.includes(compactAlias) || compactAlias.includes(compactTitle)) {
      return true;
    }
    return aliasTokens.every((aliasToken) =>
      titleTokens.some(
        (titleToken) =>
          titleToken.includes(aliasToken) || aliasToken.includes(titleToken),
      ),
    );
  });
}

function consumeMatches(
  items: EvaluationView["items"],
  expectations: ReadonlyArray<{ aliases: readonly string[] }>,
  alreadyUsed: Set<number>,
) {
  let found = 0;
  for (const expectation of expectations) {
    const matchIndex = items.findIndex(
      (item, index) =>
        !alreadyUsed.has(index) &&
        matchesRequiredLabel(item.title, expectation.aliases),
    );
    if (matchIndex >= 0) {
      alreadyUsed.add(matchIndex);
      found += 1;
    }
  }
  return found;
}

function terminalStatus(view: EvaluationView): SceneEvaluation["terminalStatus"] {
  return view.status === "ready" ? "ready" : "failed";
}

export function summarizeSceneEvaluation(
  expectation: EvaluationExpectation,
  view: EvaluationView,
): SceneEvaluation {
  const usedItems = new Set<number>();
  const requiredFound = consumeMatches(view.items, expectation.required, usedItems);
  const optionalFound = consumeMatches(view.items, expectation.optional, usedItems);
  const candidateCount = view.run?.candidateCount ?? view.items.length;
  const [minimumCandidates, maximumCandidates] = expectation.expectedCandidateRange;
  const isReady = view.status === "ready";
  const maskCoverageOk =
    !isReady ||
    (view.items.length === candidateCount &&
      view.items.every(
        (item) =>
          item.maskSource === undefined ||
          item.maskSource === "bbox" ||
          (item.maskSource === "roboflow_sam2" && (item.polygons?.length ?? 0) > 0),
      ));

  return {
    fixtureKey: expectation.fixtureKey,
    terminalStatus: terminalStatus(view),
    candidateCount,
    expectedCandidateRange: expectation.expectedCandidateRange,
    candidateRangeOk:
      candidateCount >= minimumCandidates && candidateCount <= maximumCandidates,
    polygonCount: view.run?.polygonCount ?? 0,
    fallbackCount: view.run?.fallbackCount ?? 0,
    maskCoverageOk,
    requiredFound,
    requiredTotal: expectation.required.length,
    requiredRecall:
      expectation.required.length === 0
        ? 1
        : requiredFound / expectation.required.length,
    optionalFound,
    unexpectedCount: Math.max(0, view.items.length - usedItems.size),
    errorCode: view.error?.code ?? null,
    timingsMs: {
      discovery: view.run?.discoveryMs ?? null,
      embedding: view.run?.embeddingMs ?? null,
      segmentation: view.run?.segmentationMs ?? null,
      total: view.run?.totalMs ?? null,
    },
  };
}

function failedEvaluation(
  expectation: EvaluationExpectation,
  terminal: "timeout" | "evaluator_failed",
  errorCode: string,
): SceneEvaluation {
  return {
    fixtureKey: expectation.fixtureKey,
    terminalStatus: terminal,
    candidateCount: 0,
    expectedCandidateRange: expectation.expectedCandidateRange,
    candidateRangeOk: false,
    polygonCount: 0,
    fallbackCount: 0,
    maskCoverageOk: false,
    requiredFound: 0,
    requiredTotal: expectation.required.length,
    requiredRecall: expectation.required.length === 0 ? 1 : 0,
    optionalFound: 0,
    unexpectedCount: 0,
    errorCode,
    timingsMs: {
      discovery: null,
      embedding: null,
      segmentation: null,
      total: null,
    },
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
  if (!url) throw new Error("CONVEX_URL is missing from apps/backend/.env.local");
  return url;
}

function delay(milliseconds: number) {
  return new Promise<void>((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function runAndWaitForTerminal(
  client: ConvexHttpClient,
  saleId: string,
  previousRunId: string | null,
  timeoutMs: number,
) {
  let actionError: unknown;
  let actionRunId: string | undefined;
  const actionPromise = client.action(startScan, { saleId }).then(
    ({ runId }) => {
      actionRunId = runId;
    },
    (error: unknown) => {
      actionError = error;
    },
  );
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (actionError !== undefined) {
      throw new Error("The Convex scan action failed before reaching a terminal state.");
    }
    const view = await client.query(getSellerView, { saleId });
    const isNewRun =
      view?.activeRunId !== null &&
      view?.activeRunId !== undefined &&
      view.activeRunId !== previousRunId;
    const isExpectedRun =
      actionRunId === undefined || view?.activeRunId === actionRunId;
    if (
      view &&
      isNewRun &&
      isExpectedRun &&
      (view.status === "ready" || view.status === "failed")
    ) {
      await actionPromise;
      return view;
    }
    await delay(750);
  }

  throw new Error("The scan did not reach a terminal state before the timeout.");
}

function buildReport(scenes: SceneEvaluation[]): EvaluationReport {
  const requiredFound = scenes.reduce((sum, scene) => sum + scene.requiredFound, 0);
  const requiredTotal = scenes.reduce((sum, scene) => sum + scene.requiredTotal, 0);
  return {
    generatedAt: new Date().toISOString(),
    totals: {
      scenes: scenes.length,
      ready: scenes.filter(({ terminalStatus: status }) => status === "ready").length,
      failed: scenes.filter(({ terminalStatus: status }) => status !== "ready").length,
      requiredFound,
      requiredTotal,
      requiredRecall: requiredTotal === 0 ? 1 : requiredFound / requiredTotal,
      integrityFailures: scenes.filter(({ maskCoverageOk }) => !maskCoverageOk).length,
    },
    scenes,
  };
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function reportMarkdown(report: EvaluationReport) {
  const lines = [
    "# Live scene evaluation",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Ready: ${report.totals.ready}/${report.totals.scenes} · Required recall: ${formatPercent(report.totals.requiredRecall)} · Integrity failures: ${report.totals.integrityFailures}`,
    "",
    "| Fixture | Status | Candidates | Expected | Polygons | Fallbacks | Recall | Unexpected | Error |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...report.scenes.map(
      (scene) =>
        `| ${scene.fixtureKey} | ${scene.terminalStatus} | ${scene.candidateCount} | ${scene.expectedCandidateRange[0]}–${scene.expectedCandidateRange[1]} | ${scene.polygonCount} | ${scene.fallbackCount} | ${formatPercent(scene.requiredRecall)} | ${scene.unexpectedCount} | ${scene.errorCode ?? "—"} |`,
    ),
    "",
  ];
  return lines.join("\n");
}

async function writeReport(report: EvaluationReport) {
  const outputDirectory = fileURLToPath(
    new URL("../../../artifacts/evaluations/", import.meta.url),
  );
  await mkdir(outputDirectory, { recursive: true });
  const timestamp = report.generatedAt.replace(/[:.]/g, "-");
  const baseName = `scene-evaluation-${timestamp}`;
  const jsonPath = resolve(outputDirectory, `${baseName}.json`);
  const markdownPath = resolve(outputDirectory, `${baseName}.md`);
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(markdownPath, reportMarkdown(report), "utf8"),
  ]);
  return { jsonPath, markdownPath };
}

export async function evaluateScenes(timeoutMs = 90_000) {
  const client = new ConvexHttpClient(await loadConvexUrl());
  const samples = await client.query(listSamples, {});
  const samplesByFixture = new Map(samples.map((sample) => [sample.fixtureKey, sample]));
  const scenes: SceneEvaluation[] = [];

  for (const expectation of sceneManifest) {
    const sample = samplesByFixture.get(expectation.fixtureKey);
    if (!sample) {
      console.log(`missing ${expectation.fixtureKey}`);
      scenes.push(
        failedEvaluation(expectation, "evaluator_failed", "SAMPLE_NOT_SEEDED"),
      );
      continue;
    }

    console.log(`scan    ${expectation.fixtureKey}`);
    try {
      const previous = await client.query(getSellerView, { saleId: sample.id });
      const view = await runAndWaitForTerminal(
        client,
        sample.id,
        previous?.activeRunId ?? null,
        timeoutMs,
      );
      const summary = summarizeSceneEvaluation(expectation, view);
      scenes.push(summary);
      console.log(
        `done    ${expectation.fixtureKey}  ${summary.terminalStatus}  ${summary.candidateCount} candidates`,
      );
    } catch (error) {
      const timedOut =
        error instanceof Error && error.message.toLocaleLowerCase("en-US").includes("timeout");
      scenes.push(
        failedEvaluation(
          expectation,
          timedOut ? "timeout" : "evaluator_failed",
          timedOut ? "EVALUATION_TIMEOUT" : "EVALUATION_FAILED",
        ),
      );
      console.log(`failed  ${expectation.fixtureKey}`);
    }
  }

  const report = buildReport(scenes);
  const paths = await writeReport(report);
  console.log(
    `Evaluation complete: ${report.totals.ready}/${report.totals.scenes} ready, ${formatPercent(report.totals.requiredRecall)} required recall.`,
  );
  console.log(`JSON: ${paths.jsonPath}`);
  console.log(`Markdown: ${paths.markdownPath}`);

  if (report.totals.failed > 0 || report.totals.integrityFailures > 0) {
    process.exitCode = 1;
  }
  return report;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : undefined;
if (invokedPath === import.meta.url) {
  evaluateScenes().catch(() => {
    console.error("Scene evaluation could not start.");
    process.exitCode = 1;
  });
}
