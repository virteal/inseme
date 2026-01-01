import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { InsemeProvider } from "@inseme/core";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <InsemeProvider>
      <App />
    </InsemeProvider>
  </React.StrictMode>,
);
