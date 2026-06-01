import React from "react";
import ReactDOM from "react-dom/client";
import { OnboardingApp } from "../../src/onboarding/OnboardingApp";
import "../../src/styles/app.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OnboardingApp />
  </React.StrictMode>
);
