import React from "react";
import ReactDOM from "react-dom/client";
import { OptionsApp } from "../../src/options/OptionsApp";
import { initThemeFromCache } from "../../src/shared/theme";
import "../../src/styles/app.css";

initThemeFromCache();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>
);
