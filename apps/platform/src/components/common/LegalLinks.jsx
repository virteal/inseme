// src/components/common/LegalLinks.jsx

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMarkdownDoc } from "../../hooks/useMarkdownDoc";

/**
 * Composant pour afficher un fichier Markdown depuis /docs/
 * @param {string} file - Chemin du fichier (ex: "/docs/privacy-policy.md" ou "privacy-policy.md")
 */
export function LegalMarkdown({ file }) {
  // Normaliser le chemin : enlever /docs/ si présent
  const docPath = file?.replace(/^\/docs\//, "") || "";

  const { content, loading, error } = useMarkdownDoc(docPath);

  if (loading) {
    return (
      <div className="flex justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    // apply site markdown typography (Tailwind Typography / prose) while keeping legacy "markdown-content"
    <div className="markdown-content prose max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

// Utilisation dans une page ou un footer :
export default function LegalLinks() {
  return (
    <footer className="prose max-w-none mx-auto p-4 border-t mt-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Conditions d'utilisation</h2>
        <LegalPage type="terms" />
      </div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Politique de confidentialité</h2>
        <LegalPage type="privacy" />
      </div>
      <div className="mt-8 text-center">
        <a
          href="/contact"
          className="inline-block px-4 py-2 bg-blue-600 text-bauhaus-white hover:bg-blue-700 font-semibold shadow"
        >
          Contactez-nous
        </a>
      </div>
    </footer>
  );
}

// Ou pour affichage intégré Markdown :
export function LegalPage({ type }) {
  const file = type === "privacy" ? "privacy-policy.md" : "terms-of-use.md";
  return (
    <>
      <LegalMarkdown file={file} />
      <div className="mt-8 text-center">
        <a
          href="/contact"
          className="inline-block px-4 py-2 bg-blue-600 text-bauhaus-white hover:bg-blue-700 font-semibold shadow"
        >
          Contactez-nous
        </a>
      </div>
    </>
  );
}
