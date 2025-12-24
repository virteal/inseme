import { useState, useEffect } from "react";

/**
 * Hook pour charger un document Markdown depuis /docs/
 *
 * @param {string} docPath - Chemin du fichier .md dans public/docs
 * @param {Object} replacements - Dictionnaire de remplacements {{KEY}} → valeur
 * @returns {{ content: string, loading: boolean, error: string|null }}
 */
export function useMarkdownDoc(docPath, replacements = {}) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadContent() {
      try {
        const res = await fetch(`/docs/${docPath}`);
        if (!res.ok) {
          throw new Error(`Document non trouvé (${res.status})`);
        }
        let text = await res.text();

        // Appliquer les remplacements de variables {{KEY}}
        Object.entries(replacements).forEach(([key, value]) => {
          if (value) {
            text = text.split(`{{${key}}}`).join(value);
          }
        });

        setContent(text);
        setError(null);
      } catch (err) {
        console.error("Erreur chargement document:", err);
        setError(err.message);
        setContent("");
      } finally {
        setLoading(false);
      }
    }
    loadContent();
  }, [docPath, JSON.stringify(replacements)]);

  return { content, loading, error };
}

export default useMarkdownDoc;
