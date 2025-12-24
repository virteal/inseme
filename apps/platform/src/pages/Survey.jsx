import React from "react";
import { Link } from "react-router-dom";
import { LegalMarkdown } from "../components/common/LegalLinks";
import SiteFooter from "../components/layout/SiteFooter";

const SURVEY_DOC_PATH = "/docs/survey.md";

export default function Survey() {
  return (
    <div className="min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="markdown-content space-y-6">
          <LegalMarkdown file={SURVEY_DOC_PATH} />
        </div>
        <div className="mt-8 flex flex-col items-center">
          <Link
            to="/contact"
            className="inline-block px-4 py-2 mb-4 bg-blue-600 text-bauhaus-white hover:bg-blue-700 font-semibold shadow"
          >
            Contactez-nous
          </Link>
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
