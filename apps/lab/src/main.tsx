import { ConvexProvider, ConvexReactClient } from "convex/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./styles.css";

const deploymentUrl = import.meta.env.VITE_CONVEX_URL;
const root = createRoot(document.getElementById("root")!);

if (!deploymentUrl) {
  root.render(
    <StrictMode>
      <main className="configuration-error">
        <span>Configuration required</span>
        <h1>Add VITE_CONVEX_URL to apps/lab/.env.local.</h1>
        <p>Use the URL printed by the configured Convex development deployment.</p>
      </main>
    </StrictMode>,
  );
} else {
  const convex = new ConvexReactClient(deploymentUrl);
  root.render(
    <StrictMode>
      <ConvexProvider client={convex}>
        <App />
      </ConvexProvider>
    </StrictMode>,
  );
}
