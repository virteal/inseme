// Use dotenv to load .env if available
try {
  const dotenv = await import("dotenv");
  dotenv.default.config();
} catch (e) {
  // dotenv not available or failed to load
}

export * from "../../../../../packages/cop-host/src/config/instanceConfig.backend.js";

