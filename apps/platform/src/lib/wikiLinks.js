// Utilitaires pour l’auto-liage façon Ward Wiki (CamelCase)
// - CamelCase → lien Markdown vers slug normalisé
// - Ignore les blocs de code ```...``` et le code inline `...`

export function normalizeSlug(str) {
  if (!str) return "";
  return String(str)
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}
