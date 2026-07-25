/** Set the <base href> dynamically based on the deployment path. */
const setBaseHref = () => {
  const path = window.location.pathname;
  // GitHub Pages serves under /realtime_space_travel/, Firebase serves from root /
  const base = path.startsWith("/realtime_space_travel/")
    ? "/realtime_space_travel/"
    : "/";
  const el = document.querySelector("base");
  if (el && el.getAttribute("href") !== base) {
    el.setAttribute("href", base);
  }
};
setBaseHref();

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./src/App";
import ErrorBoundary from "./src/components/ui/ErrorBoundary";
import ScreenCheck from "./src/components/ui/ScreenCheck";
import "./src/i18n";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ScreenCheck>
        <App />
      </ScreenCheck>
    </ErrorBoundary>
  </React.StrictMode>,
);
