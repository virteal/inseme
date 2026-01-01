/**
 * @inseme/cop-host
 * Centralisation de la logique d'hébergement et d'infrastructure pour les applications Inseme.
 */

// Core & Common
export * from "./config/instanceConfig.client.js";
export * from "./config/instanceConfig.core.js";
export * from "./constants.js";

// Client-side helpers (exportés via des chemins spécifiques ou ici)
// Note: Certains de ces modules dépendent de browser APIs (window, etc.)
// Ils ne devraient être importés que dans le frontend.
export {
  getSupabase,
  initializeSupabase,
  initSupabase,
  initSupabaseWithInstance,
  isSupabaseReady,
  resetSupabase,
  getConfig,
  getAllConfigKeys,
  getInstance,
} from "./client/supabase.js";
export { resolveInstance, getSubdomain } from "./client/instanceResolver.js";

// Common libs
export * from "./lib/formatDate.js";
export * from "./lib/userDisplay.js";
export * from "./lib/permissions.js";
export * from "./lib/socialMetadata.js";
export * from "./lib/useStatusOperations.js";
export * from "./lib/useCurrentUser.js";
export * from "./hooks/useVoiceRecorder.js";
export * from "./lib/useUserProfile.js";
export * from "./lib/metadata.js";
export * from "./lib/template.js";
export * from "./lib/userTransform.js";
export * from "./lib/storage.js";
export * from "./lib/useGroup.js";

// Contexts
export * from "./contexts/CurrentUserContext.jsx";

// Components
export { default as CommentSection } from "./components/CommentSection.jsx";
export { default as FacebookShareButton } from "./components/FacebookShareButton.jsx";
export { default as ShareMenu } from "./components/ShareMenu.jsx";
export { default as Icon } from "./components/Icon.jsx";
export { default as CommentForm } from "./components/CommentForm.jsx";
export { default as ReactionPicker } from "./components/ReactionPicker.jsx";
