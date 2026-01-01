import React, { useEffect, useState } from "react";
import BarmanDashboard from "@inseme/brique-cyrnea/src/pages/BarmanDashboard.jsx";
import ClientMiniApp from "@inseme/brique-cyrnea/src/pages/ClientMiniApp.jsx";

/**
 * App Cyrnea - Orchestrateur
 * Route vers le Dashboard Barman ou la Mini-App Client.
 */
function App() {
  const [route, setRoute] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setRoute(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Routage simple pour une expérience légère
  if (route.startsWith("/bar")) {
    return <BarmanDashboard />;
  }

  // Par défaut (ou /q), la Mini-App Client
  return <ClientMiniApp />;
}

export default App;
