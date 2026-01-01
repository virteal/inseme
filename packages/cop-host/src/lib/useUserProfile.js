// packages/cop-host/src/lib/useUserProfile.js
import { useState, useEffect } from "react";
import { getSupabase } from "../client/supabase.js";

/**
 * Hook pour récupérer et gérer le profil utilisateur complet
 * Partagé entre Inseme et la Plateforme.
 * @param {string} userId - ID de l'utilisateur
 * @returns {Object} { profile, loading, error, updateProfile, refetch }
 */
export function useUserProfile(userId) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await getSupabase()
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates) => {
    try {
      setLoading(true);
      const { data, error } = await getSupabase()
        .from("users")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select()
        .single();

      if (error) throw error;
      setProfile(data);
      return { success: true, data };
    } catch (err) {
      console.error("Error updating profile:", err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  return { profile, loading, error, updateProfile, refetch: fetchProfile };
}
