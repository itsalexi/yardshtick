import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { SampleSale } from "@yard/contracts";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import { sceneManifest } from "../../../packages/ai/test/fixtures/scenes/manifest";

const listSamples = makeFunctionReference<"query", Record<string, never>, SampleSale[]>(
  "samples:list",
);
const generateUploadUrl = makeFunctionReference<
  "mutation",
  Record<string, never>,
  string
>("files:generateUploadUrl");
const createSampleSale = makeFunctionReference<
  "mutation",
  {
    fixtureKey: string;
    storageId: string;
    metadata: { width: number; height: number; mimeType: "image/jpeg" };
  },
  string
>("samples:createSale");

export function missingFixtureKeys(
  desiredKeys: readonly string[],
  existingKeys: readonly string[],
) {
  const existing = new Set(existingKeys);
  return [...new Set(desiredKeys)].filter((key) => !existing.has(key));
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

async function uploadFixture(client: ConvexHttpClient, fixtureKey: string) {
  const scene = sceneManifest.find((candidate) => candidate.fixtureKey === fixtureKey);
  if (!scene) throw new Error(`Unknown fixture key: ${fixtureKey}`);

  const fixtureUrl = new URL(
    `../../../packages/ai/test/fixtures/scenes/${scene.fileName}`,
    import.meta.url,
  );
  const bytes = await readFile(fixtureUrl);
  const uploadUrl = await client.mutation(generateUploadUrl, {});
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }),
  });
  if (!response.ok) throw new Error(`Fixture upload failed with status ${response.status}`);

  const payload: unknown = await response.json();
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof Reflect.get(payload, "storageId") !== "string"
  ) {
    throw new Error("Fixture upload returned an invalid storage ID");
  }
  const storageId = Reflect.get(payload, "storageId") as string;
  return client.mutation(createSampleSale, {
    fixtureKey: scene.fixtureKey,
    storageId,
    metadata: {
      width: scene.width,
      height: scene.height,
      mimeType: "image/jpeg",
    },
  });
}

export async function seedDataset() {
  const client = new ConvexHttpClient(await loadConvexUrl());
  const existing = await client.query(listSamples, {});
  const missing = missingFixtureKeys(
    sceneManifest.map(({ fixtureKey }) => fixtureKey),
    existing.map(({ fixtureKey }) => fixtureKey),
  );

  for (const scene of sceneManifest) {
    if (!missing.includes(scene.fixtureKey)) {
      const sale = existing.find(({ fixtureKey }) => fixtureKey === scene.fixtureKey);
      console.log(`exists  ${scene.fixtureKey}  ${sale?.id ?? "sale-present"}`);
      continue;
    }
    const saleId = await uploadFixture(client, scene.fixtureKey);
    console.log(`created ${scene.fixtureKey}  ${saleId}`);
  }

  console.log(`Dataset ready: ${sceneManifest.length} scenes.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
if (invokedPath === import.meta.url) {
  seedDataset().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Dataset seed failed.");
    process.exitCode = 1;
  });
}
