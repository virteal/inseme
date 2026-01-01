import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PublicBrowser as UIPublicBrowser } from "@inseme/ui";

/**
 * PublicBrowser: Adaptateur pour le composant PublicBrowser de @inseme/ui
 * Gère la synchronisation avec l'URL de l'application platform.
 */
export default function PublicBrowser() {
  const location = useLocation();
  const navigate = useNavigate();
  const baseRoot = "/public/docs";

  // Extraire le chemin relatif de l'URL
  const currentRelPath = location.pathname.replace(/^\/browser/, "") || "/";

  // Note: Le composant UIPublicBrowser gère son propre état interne pour la navigation.
  // Pour une intégration parfaite avec react-router, on pourrait passer le path en prop
  // si UIPublicBrowser le supportait. Ici on laisse UIPublicBrowser gérer, 
  // mais on pourrait améliorer UIPublicBrowser plus tard pour être "controlled".
  
  return (
    <div className="p-4 md:p-8">
      <UIPublicBrowser 
        apiEndpoint="/api/public_browser"
        basePath={baseRoot}
        title="Explorateur public (public/docs)"
      />
    </div>
  );
}
