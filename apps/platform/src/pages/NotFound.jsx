import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="max-w-3xl mx-auto p-8 text-center">
      <h1 className="page-title">404 — Page non trouvée</h1>
      <p className="mt-4">
        La page demandée est introuvable. Elle a peut‑être été supprimée ou l'URL est incorrecte.
      </p>
      <div className="mt-6 flex items-center justify-center gap-4">
        <Link to="/" className="btn btn-primary">
          Retour à l'accueil
        </Link>
        <Link to="/contact" className="btn btn-tertiary">
          Nous contacter
        </Link>
      </div>
    </div>
  );
}
