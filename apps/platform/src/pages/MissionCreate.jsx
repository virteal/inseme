import { useCurrentUser } from "../lib/useCurrentUser";
import MissionForm from "../components/missions/MissionForm";
import AuthModal from "../components/common/AuthModal";
import { useState } from "react";
import SiteFooter from "../components/layout/SiteFooter";

export default function MissionCreate() {
  const { currentUser, loading } = useCurrentUser();
  const [showAuthModal, setShowAuthModal] = useState(false);

  if (loading) {
    return <div className="p-8 text-center">Chargement...</div>;
  }

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto mt-12 p-6 bg-white  shadow-md text-center">
        <h2 className="text-xl font-bold mb-4">Connexion requise</h2>
        <p className="text-gray-600 mb-6">
          Vous devez être connecté pour créer une mission bénévole.
        </p>
        <button
          onClick={() => setShowAuthModal(true)}
          className="bg-primary-600 text-white px-6 py-2 rounded font-bold hover:bg-primary-700"
        >
          Se connecter
        </button>
        {showAuthModal && (
          <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
        )}
      </div>
    );
  }

  return (
    <>
      <MissionForm currentUser={currentUser} />
      <SiteFooter />
    </>
  );
}
