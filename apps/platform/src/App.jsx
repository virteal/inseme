// src/App.jsx

import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Methodologie from "./pages/Methodologie";
import GlobalStatusIndicator from "./components/common/GlobalStatusIndicator";
import Audit from "./pages/Audit";
import Kudocracy from "./pages/Kudocracy";
import Wiki from "./pages/Wiki";
import WikiPage from "./pages/WikiPage";
import WikiCreate from "./pages/WikiCreate";
import WikiEdit from "./pages/WikiEdit";
import Bob from "./pages/Bob";
import Proposition from "./pages/Proposition";
import Transparence from "./pages/Transparence";
import Survey from "./pages/Survey";
import { LegalPage } from "./components/common/LegalLinks";
import PublicBrowser from "./components/features/PublicBrowser";
import Social from "./pages/Social";
import GroupPage from "./pages/GroupPage";
import GroupCreate from "./pages/GroupCreate";
import GroupEdit from "./pages/GroupEdit";
import PostPage from "./pages/PostPage";
import PostCreate from "./pages/PostCreate";
import PostEdit from "./pages/PostEdit";
import PostLocationPicker from "./pages/PostLocationPicker";
import UserProfile from "./pages/UserProfile";
import UserPage from "./pages/UserPage";
import VotingDashboard from "./pages/VotingDashboard";
import UserDashboard from "./pages/UserDashboard";
import HomeDashboard from "./pages/HomeDashboard";
import GlobalDashboard from "./pages/GlobalDashboard";
import WikiDashboard from "./pages/WikiDashboard";
import SocialDashboard from "./pages/SocialDashboard";
import SubscriptionFeed from "./pages/SubscriptionFeed";
import Contact from "./pages/Contact";
import FacebookDeletionInstructions from "./pages/FacebookDeletionInstructions";
import OAuthCallback from "./pages/OAuthCallback";
import FacebookDeletionStatus from "./pages/FacebookDeletionStatus";
import OAuthConsent from "./pages/OAuthConsent";
import DataCollector from "./pages/DataCollector";
// Lazy-loaded admin components (separate chunk - only loads when visiting /admin/*)
const Admin = lazy(() => import("./pages/Admin"));
const DataReview = lazy(() => import("./pages/admin/DataReview"));
const Entities = lazy(() => import("./pages/admin/Entities"));
// JHR, un swagger is React 19 compatible, was: const AdminAPI = lazy(() => import("./pages/admin/AdminAPI"));
const CopAdmin = lazy(() => import("./pages/admin/CopAdmin"));
const SaasAdmin = lazy(() => import("./pages/admin/SaasAdmin"));
const LeadsAdmin = lazy(() => import("./pages/admin/LeadsAdmin"));
const VaultConfig = lazy(() => import("./pages/admin/VaultConfig"));

import TransparenceLanding from "./pages/TransparenceLanding";
import TransparenceVitrine from "./pages/TransparenceVitrine";
import Gazette from "./pages/Gazette";
import Agenda from "./pages/Agenda";
import Incidents from "./pages/Incidents";
import IncidentEditor from "./pages/IncidentEditor";
import IncidentPage from "./pages/IncidentPage";
import SurveyModeEmploi from "./pages/SurveyModeEmploi";
import MarkdownViewer from "./pages/MarkdownViewer";
import PublicFileHandler from "./components/common/PublicFileHandler";
import NotFound from "./pages/NotFound";
import MissionsPage from "./pages/MissionsPage";
import MissionCreate from "./pages/MissionCreate";
import MissionDetail from "./pages/MissionDetail";
import TaskProjectsPage from "./pages/TaskProjectsPage";
import TaskProjectCreate from "./pages/TaskProjectCreate";
import TaskProjectDetail from "./pages/TaskProjectDetail";
import TaskCreate from "./pages/TaskCreate";
import TaskEdit from "./pages/TaskEdit";
import TaskDetail from "./pages/TaskDetail";
import FilFeed from "./components/fil/FilFeed";
import FilSubmissionForm from "./components/fil/FilSubmissionForm";
import FilGuidelines from "./components/fil/FilGuidelines";
import FilFAQ from "./components/fil/FilFAQ";
import CopCoreLandingPage from "./pages/CopCoreLandingPage";
import OpheliaLandingPage from "./pages/OpheliaLandingPage";

// Consultation active (module séparé)
import ConsultationsHome, {
  ConsultationQuasquara,
  ConsultationDemocratieLocale,
} from "./pages/consultations";

// Civic Acts System - Contrôle citoyen des actes municipaux
import ActesHome from "./pages/actes/ActesHome";
import ActesDashboard from "./pages/actes/ActesDashboard";
import ActesList from "./pages/actes/ActesList";
import ActeDetail from "./pages/actes/ActeDetail";
import ActeForm from "./pages/actes/ActeForm";
import DemandesList from "./pages/actes/DemandesList";
import DemandeDetail from "./pages/actes/DemandeDetail";
import DemandeForm from "./pages/actes/DemandeForm";
import ProofUpload from "./pages/actes/ProofUpload";
import GuideActes from "./pages/actes/GuideActes";
// Phase 3 - Human-in-the-Loop Components
import OutgoingActionsQueue from "./pages/actes/OutgoingActionsQueue";
import VerificationQueue from "./pages/actes/VerificationQueue";
import PublicationModeration from "./pages/actes/PublicationModeration";
import ResponsibilityLog from "./pages/actes/ResponsibilityLog";
// Phase 7 - Exports et indicateurs
import ExportPDF from "./pages/actes/ExportPDF";
import ExportCSV from "./pages/actes/ExportCSV";
import ActeTimeline from "./pages/actes/ActeTimeline";
import StatsDashboard from "./pages/actes/StatsDashboard";
import FractalFeedPage from "./pages/FractalFeedPage";
import CafeSessionPage from "./pages/CafeSessionPage";

// Suspense wrapper for lazy-loaded routes
const LazyRoute = ({ children }) => (
  <Suspense fallback={<div className="p-8 text-center text-gray-500">Chargement...</div>}>
    {children}
  </Suspense>
);

export function App() {
  return (
    <>
      <GlobalStatusIndicator />
      <Routes>
        <Route path="/" element={<ConsultationsHome />} />
        <Route path="/ophelia-land" element={<OpheliaLandingPage />} />
        <Route path="/cop-core" element={<CopCoreLandingPage />} />
        <Route path="/consultations" element={<ConsultationsHome />} />
        <Route path="/consultation" element={<ConsultationQuasquara />} />
        <Route path="/consultation/quasquara" element={<ConsultationQuasquara />} />
        <Route path="/consultation/democratie-locale" element={<ConsultationDemocratieLocale />} />
        <Route path="/transparence" element={<Transparence />} />
        <Route path="/transparence/engagement" element={<TransparenceLanding />} />
        <Route path="/transparence/communes" element={<TransparenceVitrine />} />
        <Route path="/engagement" element={<TransparenceLanding />} />
        <Route path="/methodologie" element={<Methodologie />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/kudocracy" element={<Kudocracy />} />
        <Route path="/propositions/:id" element={<Proposition />} />
        <Route path="/proposition/:id" element={<Proposition />} />
        <Route path="/bob" element={<Bob />} />
        <Route path="/ophelia" element={<Bob />} />
        <Route path="/wiki" element={<Wiki />} />
        <Route path="/wiki/new" element={<WikiCreate />} />
        <Route path="/wiki/new/:slug" element={<WikiCreate />} />
        <Route path="/wiki/:slug" element={<WikiPage />} />
        <Route path="/wiki/:slug/edit" element={<WikiEdit />} />
        <Route path="/legal/terms" element={<LegalPage type="terms" />} />
        <Route path="/legal/privacy" element={<LegalPage type="privacy" />} />
        <Route path="/privacy" element={<LegalPage type="privacy" />} />
        <Route path="/terms" element={<LegalPage type="terms" />} />
        <Route path="/survey" element={<Survey />} />
        <Route path="/markdown-viewer" element={<MarkdownViewer />} />
        <Route path="/docs/*" element={<PublicFileHandler />} />
        <Route path="/survey-mode-emploi" element={<SurveyModeEmploi />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/browser/*" element={<PublicBrowser />} />
        <Route path="/gazette" element={<Gazette />} />
        <Route path="/gazette/:name" element={<Gazette />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/incidents/new" element={<IncidentEditor />} />
        <Route path="/incidents/:id" element={<IncidentPage />} />
        <Route path="/incidents/:id/edit" element={<IncidentEditor />} />
        <Route path="/social" element={<Social />} />
        <Route path="/users/:id" element={<UserPage />} />
        <Route path="/dashboard" element={<HomeDashboard />} />
        <Route path="/user-dashboard" element={<UserDashboard />} />
        <Route path="/global-dashboard" element={<GlobalDashboard />} />
        <Route path="/wiki-dashboard" element={<WikiDashboard />} />
        <Route path="/social-dashboard" element={<SocialDashboard />} />
        <Route path="/voting-dashboard" element={<VotingDashboard />} />
        <Route path="/data-collector" element={<DataCollector />} />
        <Route path="/user-profile" element={<UserProfile />} />
        <Route path="/profile" element={<UserProfile />} />
        <Route
          path="/admin/data-review"
          element={
            <LazyRoute>
              <DataReview />
            </LazyRoute>
          }
        />
        <Route
          path="/admin/cop"
          element={
            <LazyRoute>
              <CopAdmin />
            </LazyRoute>
          }
        />
        <Route
          path="/admin/saas"
          element={
            <LazyRoute>
              <SaasAdmin />
            </LazyRoute>
          }
        />
        <Route
          path="/admin/leads"
          element={
            <LazyRoute>
              <LeadsAdmin />
            </LazyRoute>
          }
        />
        <Route
          path="/admin/vault"
          element={
            <LazyRoute>
              <VaultConfig />
            </LazyRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <LazyRoute>
              <Admin />
            </LazyRoute>
          }
        />
        <Route
          path="/admin/entities"
          element={
            <LazyRoute>
              <Entities />
            </LazyRoute>
          }
        />
        <Route path="/subscriptions" element={<SubscriptionFeed />} />
        <Route path="/groups/new" element={<GroupCreate />} />
        <Route path="/groups/:id" element={<GroupPage />} />
        <Route path="/groups/:id/edit" element={<GroupEdit />} />
        <Route path="/posts/new" element={<PostCreate />} />
        <Route path="/posts/:id" element={<PostPage />} />
        <Route path="/posts/:id/edit" element={<PostEdit />} />
        <Route path="/posts/location-picker" element={<PostLocationPicker />} />
        <Route
          path="/oauth/facebook/deletion-instructions"
          element={<FacebookDeletionInstructions />}
        />
        <Route path="/oauth/facebook/deletion-status" element={<FacebookDeletionStatus />} />
        <Route path="/oauth/:provider/callback" element={<OAuthCallback />} />
        <Route path="/oauth/consent" element={<OAuthConsent />} />
        <Route path="/missions" element={<MissionsPage />} />
        <Route path="/missions/new" element={<MissionCreate />} />
        <Route path="/missions/:id" element={<MissionDetail />} />
        <Route path="/missions/:id/edit" element={<MissionCreate />} />
        <Route path="/tasks" element={<TaskProjectsPage />} />
        <Route path="/tasks/new" element={<TaskProjectCreate />} />
        <Route path="/tasks/:id" element={<TaskProjectDetail />} />
        <Route path="/tasks/:projectId/task/new" element={<TaskCreate />} />
        <Route path="/tasks/:projectId/task/:taskId" element={<TaskDetail />} />
        <Route path="/tasks/:projectId/task/:taskId/edit" element={<TaskEdit />} />
        <Route path="/tasks/:projectId/task/:taskId/edit" element={<TaskEdit />} />
        <Route path="/fil" element={<FilFeed />} />
        <Route path="/fil/new" element={<FilSubmissionForm />} />
        <Route path="/fil/guidelines" element={<FilGuidelines />} />
        <Route path="/fil/faq" element={<FilFAQ />} />

        {/* Système citoyen de contrôle des actes municipaux */}
        <Route path="/actes/accueil" element={<ActesHome />} />
        <Route path="/actes" element={<ActesDashboard />} />
        <Route path="/actes/liste" element={<ActesList />} />
        <Route path="/actes/nouveau" element={<ActeForm />} />
        <Route path="/actes/:id" element={<ActeDetail />} />
        <Route path="/actes/:id/modifier" element={<ActeForm />} />
        <Route path="/demandes" element={<DemandesList />} />
        <Route path="/demandes/nouvelle" element={<DemandeForm />} />
        <Route path="/demandes/:id" element={<DemandeDetail />} />
        <Route path="/demandes/:id/modifier" element={<DemandeForm />} />
        <Route path="/preuves/ajouter" element={<ProofUpload />} />
        <Route path="/docs/guide-citoyen" element={<GuideActes />} />

        {/* Phase 3: Human-in-the-Loop - Modération et validation */}
        <Route path="/moderation/actions" element={<OutgoingActionsQueue />} />
        <Route path="/moderation/preuves" element={<VerificationQueue />} />
        <Route path="/moderation/publications" element={<PublicationModeration />} />
        <Route path="/moderation/responsabilites" element={<ResponsibilityLog />} />

        {/* Phase 7: Exports et indicateurs */}
        <Route path="/exports/pdf" element={<ExportPDF />} />
        <Route path="/exports/csv" element={<ExportCSV />} />
        <Route path="/actes/chronologie" element={<ActeTimeline />} />
        <Route path="/actes/:id/chronologie" element={<ActeTimeline />} />
        <Route path="/actes/stats" element={<StatsDashboard />} />

        {/* Fractal Governance */}
        <Route path="/fractal-feed" element={<FractalFeedPage />} />

        {/* Cafe Ophelia Vocal */}
        <Route path="/cafe/:id" element={<CafeSessionPage />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
