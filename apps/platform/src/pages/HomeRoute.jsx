/**
 * Instance-aware home: personal Twin (JHN) vs civic/default landing.
 */
import { getConfig } from "../common/config/instanceConfig.client.js";
import JhnLandingPage from "./JhnLandingPage";
import ConsultationsHome from "./consultations";

export default function HomeRoute() {
  const deploymentKind = String(getConfig("deployment_kind") || "").toLowerCase();
  const appProfile = String(getConfig("application_profile") || "").toLowerCase();
  const subdomain = String(getConfig("subdomain") || "").toLowerCase();
  const host = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";

  const isPersonalTwin =
    deploymentKind === "personal" ||
    appProfile === "personal-twin" ||
    subdomain === "jhn" ||
    host.startsWith("jhn.") ||
    host.includes("jhn-baronsmariani");

  if (isPersonalTwin) {
    return <JhnLandingPage />;
  }
  return <ConsultationsHome />;
}
