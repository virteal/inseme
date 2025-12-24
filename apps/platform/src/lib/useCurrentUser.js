/* src/lib/useCurrentUser.js */
/* This file provides hooks to access the current user context and fetch user profiles */

import { useContext } from "react";
import { CurrentUserContext } from "../contexts/CurrentUserContext";

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}

/**
 * Hook pour récupérer le profil d'un utilisateur spécifique (pas forcément l'utilisateur connecté)
 * @param {string} userId - ID de l'utilisateur
 * @returns {Object} { profile, loading, error, refetch }
 */
export function useUserProfileById(userId) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadProfile = useDataLoader();

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    const { profile: fetchedProfile, error: fetchError } = await fetchUserProfileById(
      userId,
      loadProfile
    );
    setProfile(fetchedProfile);
    setError(fetchError);
    setLoading(false);
  }, [userId, loadProfile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, refetch: fetchProfile };
}
