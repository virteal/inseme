import React, { useEffect, useState } from "react";
import BarmanDashboard from "../../../packages/brique-cyrnea/src/pages/BarmanDashboard";
import ClientMiniApp from "../../../packages/brique-cyrnea/src/pages/ClientMiniApp";

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
