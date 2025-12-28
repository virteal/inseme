import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import {
  initializeInstance,
  loadInstanceConfig,
} from "@inseme/cop-host/config/instanceConfig.client";
import { ErrorBoundary } from "@inseme/ui";

// Initialisation asynchrone de la configuration (Vault)
const init = async () => {
  try {
    // Initialise le vault (tente de charger depuis Supabase)
    await initializeInstance();
    await loadInstanceConfig();
  } catch (e) {
    console.warn("Vault initialization failed, using env vars only:", e);
  }

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
};

init();
