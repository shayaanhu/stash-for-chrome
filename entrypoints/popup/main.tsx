import React from "react";
import ReactDOM from "react-dom/client";
import { PopupApp } from "../../src/popup/PopupApp";
import { initThemeFromCache } from "../../src/shared/theme";
import "../../src/styles/app.css";

// Set the palette before the first paint so the popup never flashes light.
initThemeFromCache();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>
);
