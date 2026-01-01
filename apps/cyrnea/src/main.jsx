import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { InsemeProvider } from "../../../packages/inseme-core/index";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <InsemeProvider>
      <App />
    </InsemeProvider>
  </React.StrictMode>
);
