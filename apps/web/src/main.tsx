import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import { AppErrorBoundary } from "./app/error-boundary.js";
import { createAppRouter } from "./app/router.js";
import "@releasearc/ui/styles.css";
import "./app/styles.css";
import "./features/presence/presence.css";

const rootElement = document.querySelector<HTMLDivElement>("#root");

if (!rootElement) {
  throw new Error("ReleaseArc could not find the application root element.");
}

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <RouterProvider router={createAppRouter()} />
    </AppErrorBoundary>
  </StrictMode>,
);
