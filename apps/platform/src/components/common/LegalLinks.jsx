// src/components/common/LegalLinks.jsx

import { LegalPage as UILegalPage, MarkdownViewer } from "@inseme/ui";
import { LEGAL_CONTENT } from "@inseme/kudocracy";

/**
 * Composant pour afficher un fichier Markdown depuis /docs/
 * @param {string} file - Chemin du fichier (ex: "/docs/privacy-policy.md" ou "privacy-policy.md")
 */
export function LegalMarkdown({ file }) {
  // Normaliser le chemin : enlever /docs/ si présent
  const docPath = file?.replace(/^\/docs\//, "") || "";

  // Utiliser les contenus statiques si disponibles
  let content = "";
  if (docPath === "privacy-policy.md") content = LEGAL_CONTENT.PRIVACY_POLICY;
  else if (docPath === "terms-of-use.md") content = LEGAL_CONTENT.TERMS_OF_USE;

  return (
    <div className="markdown-content prose max-w-none">
      <MarkdownViewer content={content} />
    </div>
  );
}

// Utilisation dans une page ou un footer :
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

// Ou pour affichage intégré Markdown :
export function LegalPage({ type }) {
  const isPrivacy = type === "privacy";
  const title = isPrivacy ? "Politique de confidentialité" : "Conditions d'utilisation";
  const content = isPrivacy ? LEGAL_CONTENT.PRIVACY_POLICY : LEGAL_CONTENT.TERMS_OF_USE;

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <UILegalPage title={title} content={content} />
      <div className="mt-8 text-center pb-12">
        <a
          href="/contact"
          className="inline-block px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 font-semibold rounded-lg shadow-sm transition-colors"
        >
          Contactez-nous
        </a>
      </div>
    </div>
  );
}
