import type { SampleSale, ScanItem, ScanSellerView } from "@yard/contracts";
import { useAction, useMutation, useQuery } from "convex/react";
import { memo, useState, type ChangeEvent, type KeyboardEvent } from "react";

import { functions } from "./convex";
import { polygonToSvgPoints } from "./geometry";

type BusyState = "uploading" | "running" | null;

export type LabScreenProps = {
  samples: SampleSale[] | undefined;
  sale: ScanSellerView | null | undefined;
  selectedSaleId: string | null;
  selectedItemId: string | null;
  busy: BusyState;
  localError: string | null;
  onSelectSale: (saleId: string) => void;
  onSelectItem: (itemId: string) => void;
  onRunScan: () => void;
  onUpload: (file: File) => void;
  onClear: () => void;
};

const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function formatDuration(value: number | undefined) {
  return value === undefined ? "—" : `${Math.round(value)} ms`;
}

function FixtureList({
  samples,
  selectedSaleId,
  onSelectSale,
}: Pick<LabScreenProps, "samples" | "selectedSaleId" | "onSelectSale">) {
  if (samples === undefined) {
    return (
      <div className="fixture-skeleton" aria-label="Loading fixtures">
        <span />
        <span />
        <span />
      </div>
    );
  }

  if (samples.length === 0) {
    return (
      <p className="muted-copy">
        No fixture sales are seeded. Run <code>pnpm dataset:seed</code> from the repo root.
      </p>
    );
  }

  return (
    <div className="fixture-list">
      {samples.map((sample) => (
        <button
          className="fixture-row"
          data-active={sample.id === selectedSaleId}
          key={sample.id}
          onClick={() => onSelectSale(sample.id)}
          type="button"
        >
          <img alt="" height="48" src={sample.imageUrl} width="64" />
          <span>
            <strong>{sample.fixtureKey}</strong>
            <small>{sample.status}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

function StatusReadout({ sale }: { sale: ScanSellerView }) {
  const run = sale.run;
  return (
    <section className="status-readout" aria-label="Scan status">
      <div className="status-heading">
        <div>
          <span className="eyebrow">Current stage</span>
          <strong>{sale.processingStage}</strong>
        </div>
        <output>{sale.progress}%</output>
      </div>
      <div
        aria-label={`${sale.progress}% complete`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={sale.progress}
        className="progress-track"
        role="progressbar"
      >
        <span style={{ width: `${sale.progress}%` }} />
      </div>
      <dl className="metrics-grid">
        <div>
          <dt>Candidates</dt>
          <dd>{run?.candidateCount ?? 0}</dd>
        </div>
        <div>
          <dt>Polygons</dt>
          <dd>{run?.polygonCount ?? 0}</dd>
        </div>
        <div>
          <dt>Fallbacks</dt>
          <dd>{run?.fallbackCount ?? 0}</dd>
        </div>
        <div>
          <dt>Discovery</dt>
          <dd>{formatDuration(run?.discoveryMs)}</dd>
        </div>
        <div>
          <dt>Embedding</dt>
          <dd>{formatDuration(run?.embeddingMs)}</dd>
        </div>
        <div>
          <dt>Segmentation</dt>
          <dd>{formatDuration(run?.segmentationMs)}</dd>
        </div>
      </dl>
    </section>
  );
}

function ItemDiagnostics({
  items,
  selectedItemId,
  onSelectItem,
}: {
  items: ScanItem[];
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
}) {
  if (items.length === 0) {
    return <p className="muted-copy">No accepted products yet.</p>;
  }

  return (
    <div className="item-list">
      {items.map((item, index) => (
        <button
          className="item-row"
          data-active={selectedItemId === item.id}
          key={item.id}
          onClick={() => onSelectItem(item.id)}
          type="button"
        >
          <span className="item-index">{String(index + 1).padStart(2, "0")}</span>
          <span className="item-copy">
            <strong>{item.title}</strong>
            <small>
              {Math.round(item.confidence * 100)}% · {item.maskSource} · rev {item.maskRevision}
            </small>
          </span>
        </button>
      ))}
    </div>
  );
}

const SceneOverlay = memo(function SceneOverlay({
  sale,
  selectedItemId,
  onSelectItem,
}: {
  sale: ScanSellerView;
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
}) {
  function selectFromKeyboard(event: KeyboardEvent<SVGGElement>, itemId: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectItem(itemId);
    }
  }

  return (
    <div
      className="scene-frame"
      style={{ aspectRatio: `${sale.image.width} / ${sale.image.height}` }}
    >
      <img alt={`Canonical scene for ${sale.slug}`} src={sale.image.url} />
      <svg
        aria-label="Detected product overlay"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`0 0 ${sale.image.width} ${sale.image.height}`}
      >
        {sale.items.map((item, index) => {
          const box = item.roughBox;
          const selected = selectedItemId === item.id;
          return (
            <g
              aria-label={`${item.title}, ${item.maskSource}`}
              className="overlay-item"
              data-selected={selected}
              key={item.id}
              onClick={() => onSelectItem(item.id)}
              onKeyDown={(event) => selectFromKeyboard(event, item.id)}
              role="button"
              tabIndex={0}
            >
              <rect
                className={item.polygons.length > 0 ? "rough-box resolved" : "rough-box"}
                data-testid={`rough-box-${item.id}`}
                height={box.y2 - box.y1}
                vectorEffect="non-scaling-stroke"
                width={box.x2 - box.x1}
                x={box.x1}
                y={box.y1}
              />
              {item.polygons.map((polygon, polygonIndex) => (
                <polygon
                  className="mask-polygon"
                  key={`${item.id}-${polygonIndex}`}
                  points={polygonToSvgPoints(polygon)}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <g className="item-tag" transform={`translate(${box.x1} ${box.y1})`}>
                <rect height="34" rx="4" width="42" x="0" y="-34" />
                <text x="21" y="-11">
                  {index + 1}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
});

function Viewer({
  sale,
  selectedSaleId,
  selectedItemId,
  onSelectItem,
}: Pick<
  LabScreenProps,
  "sale" | "selectedSaleId" | "selectedItemId" | "onSelectItem"
>) {
  if (!selectedSaleId) {
    return (
      <div className="viewer-empty">
        <span className="empty-marker">01</span>
        <h2>Select a fixture or upload a scene.</h2>
        <p>The canonical image, candidate boxes, and SAM polygons will appear here.</p>
      </div>
    );
  }

  if (sale === undefined) {
    return (
      <div className="viewer-loading" aria-label="Loading sale">
        <span />
      </div>
    );
  }

  if (sale === null) {
    return (
      <div className="viewer-empty">
        <span className="empty-marker">404</span>
        <h2>This sale no longer exists.</h2>
      </div>
    );
  }

  return (
    <div className="viewer-content">
      <div className="viewer-meta">
        <div>
          <span className="eyebrow">Canonical scene</span>
          <h2>{sale.slug}</h2>
        </div>
        <code>
          {sale.image.width} × {sale.image.height}
        </code>
      </div>
      <SceneOverlay
        onSelectItem={onSelectItem}
        sale={sale}
        selectedItemId={selectedItemId}
      />
    </div>
  );
}

export function LabScreen(props: LabScreenProps) {
  const { sale } = props;
  const runActive = sale?.status === "processing" || props.busy === "running";

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) props.onUpload(file);
    event.target.value = "";
  }

  return (
    <main className="lab-shell">
      <header className="lab-header">
        <div className="wordmark">
          <span>Y</span>
          <div>
            <strong>Yard</strong>
            <small>Pipeline Lab</small>
          </div>
        </div>
        <div className="deployment-state">
          <span />
          Development deployment
        </div>
      </header>

      <div className="lab-grid">
        <aside className="control-rail">
          <section className="control-section">
            <div className="section-label">
              <span>01</span>
              <h2>Choose a scene</h2>
            </div>
            <FixtureList
              onSelectSale={props.onSelectSale}
              samples={props.samples}
              selectedSaleId={props.selectedSaleId}
            />
            <label className="upload-field" data-disabled={props.busy !== null}>
              <span>{props.busy === "uploading" ? "Uploading scene…" : "Upload custom scene"}</span>
              <small>JPEG, PNG, or WebP</small>
              <input
                accept="image/jpeg,image/png,image/webp"
                disabled={props.busy !== null}
                onChange={handleFileChange}
                type="file"
              />
            </label>
          </section>

          <section className="control-section">
            <div className="section-label">
              <span>02</span>
              <h2>Run pipeline</h2>
            </div>
            <div className="action-row">
              <button
                className="primary-action"
                disabled={!sale || runActive || props.busy === "uploading"}
                onClick={props.onRunScan}
                type="button"
              >
                {runActive ? "Scan running" : "Run scan"}
              </button>
              <button
                className="quiet-action"
                disabled={!props.selectedSaleId}
                onClick={props.onClear}
                type="button"
              >
                Clear
              </button>
            </div>
            {props.localError ? <p className="error-message">{props.localError}</p> : null}
            {sale?.error ? (
              <p className="error-message">
                <strong>{sale.error.code}</strong>
                {sale.error.message}
              </p>
            ) : null}
            {sale ? <StatusReadout sale={sale} /> : <p className="muted-copy">Choose a scene to inspect a run.</p>}
          </section>

          <section className="control-section diagnostics-section">
            <div className="section-label">
              <span>03</span>
              <h2>Item diagnostics</h2>
            </div>
            <ItemDiagnostics
              items={sale?.items ?? []}
              onSelectItem={props.onSelectItem}
              selectedItemId={props.selectedItemId}
            />
          </section>
        </aside>

        <section className="viewer-panel">
          <Viewer
            onSelectItem={props.onSelectItem}
            sale={props.sale}
            selectedItemId={props.selectedItemId}
            selectedSaleId={props.selectedSaleId}
          />
        </section>
      </div>
    </main>
  );
}

async function imageMetadata(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

export function App() {
  const samples = useQuery(functions.listSamples, {});
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyState>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const sale = useQuery(
    functions.getSellerView,
    selectedSaleId ? { saleId: selectedSaleId } : "skip",
  );
  const generateUploadUrl = useMutation(functions.generateUploadUrl);
  const createDraft = useMutation(functions.createDraft);
  const startScan = useAction(functions.startScan);

  function selectSale(saleId: string) {
    setSelectedSaleId(saleId);
    setSelectedItemId(null);
    setLocalError(null);
  }

  async function upload(file: File) {
    if (!supportedImageTypes.has(file.type)) {
      setLocalError("Choose a JPEG, PNG, or WebP image.");
      return;
    }

    setBusy("uploading");
    setLocalError(null);
    try {
      const [{ width, height }, uploadUrl] = await Promise.all([
        imageMetadata(file),
        generateUploadUrl({}),
      ]);
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error(`Upload failed with status ${response.status}.`);
      const payload: unknown = await response.json();
      if (
        !payload ||
        typeof payload !== "object" ||
        typeof Reflect.get(payload, "storageId") !== "string"
      ) {
        throw new Error("Upload did not return a storage ID.");
      }
      const saleId = await createDraft({
        storageId: Reflect.get(payload, "storageId") as string,
        metadata: {
          width,
          height,
          mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
        },
      });
      selectSale(saleId);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Scene upload failed.");
    } finally {
      setBusy(null);
    }
  }

  async function runScan() {
    if (!selectedSaleId) return;
    setBusy("running");
    setLocalError(null);
    try {
      await startScan({ saleId: selectedSaleId });
    } catch {
      setLocalError("The scan action could not be started. Check the backend logs.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <LabScreen
      busy={busy}
      localError={localError}
      onClear={() => {
        setSelectedSaleId(null);
        setSelectedItemId(null);
        setLocalError(null);
      }}
      onRunScan={() => void runScan()}
      onSelectItem={setSelectedItemId}
      onSelectSale={selectSale}
      onUpload={(file) => void upload(file)}
      sale={selectedSaleId ? sale : undefined}
      samples={samples}
      selectedItemId={selectedItemId}
      selectedSaleId={selectedSaleId}
    />
  );
}
