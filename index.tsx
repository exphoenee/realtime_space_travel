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
