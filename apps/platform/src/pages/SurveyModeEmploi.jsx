import React from "react";
import { Link } from "react-router-dom";
import { LegalMarkdown } from "../components/common/LegalLinks";
import SiteFooter from "../components/layout/SiteFooter";

const MODE_EMPLOI_DOC_PATH = "/docs/survey-mode-emploi.md";

export default function SurveyModeEmploi() {
  return (
    <div className="min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8 text-center">
          <p className="text-sm uppercase tracking-widest text-primary-400">Guide utilisateur</p>
          <h1 className="text-3xl md:text-4xl font-bold text-bauhaus-white mt-2 mb-3">
            Mode d'emploi Kudocracy.Survey
          </h1>
          <p className="text-gray-400">
            Toutes les étapes pour créer un profil, participer au Café, publier dans la Gazette et
            contribuer aux consultations.
          </p>
        </div>
        <div className="markdown-content space-y-6">
          <LegalMarkdown file={MODE_EMPLOI_DOC_PATH} />
        </div>
        <div className="mt-10 flex flex-col items-center gap-3">
          <Link
            to="/survey"
            className="inline-block px-4 py-2 bg-bauhaus-blue text-bauhaus-white font-semibold shadow hover:bg-blue-700"
          >
            ← Retour à la présentation
          </Link>
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
