import React from "react";
import { MarkdownViewer } from "./MarkdownViewer.jsx";

/**
 * Composant générique pour les pages légales.
 * @param {Object} props
 * @param {string} props.title - Titre de la page.
 * @param {string} props.content - Contenu Markdown.
 */
export function LegalPage({ title, content }) {
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 md:p-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-8 border-b pb-4">
            {title}
          </h1>
          <MarkdownViewer content={content} className="prose prose-slate max-w-none" />
        </div>
      </div>
    </div>
  );
}

export default LegalPage;
