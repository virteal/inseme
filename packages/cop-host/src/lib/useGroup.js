// packages/cop-host/src/lib/useGroup.js
import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "../client/supabase.js";

/**
 * Hook pour récupérer les données d'un groupe et l'appartenance d'un utilisateur
 * @param {string} groupId - ID du groupe
 * @param {string} userId - ID de l'utilisateur (optionnel)
 */
export function useGroup(groupId, userId = null) {
  const [group, setGroup] = useState(null);
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchGroupData = useCallback(async () => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const supabase = getSupabase();

      // Charger les infos du groupe
      const { data: groupData, error: groupError } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId)
        .maybeSingle();

      if (groupError) throw groupError;
      setGroup(groupData);

      // Charger l'appartenance si userId est fourni
      if (userId) {
        const { data: memberData, error: memberError } = await supabase
          .from("group_members")
          .select("*")
          .eq("group_id", groupId)
          .eq("user_id", userId)
          .maybeSingle();

        if (memberError) throw memberError;
        setMembership(memberData);
      } else {
        setMembership(null);
      }
    } catch (err) {
      console.error("[useGroup] Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [groupId, userId]);

  useEffect(() => {
    fetchGroupData();
  }, [fetchGroupData]);

  const isMember = !!membership;
  const isAdmin = membership?.metadata?.role === 'admin' || group?.created_by === userId;

  return {
    group,
    membership,
    isMember,
    isAdmin,
    loading,
    error,
    refetch: fetchGroupData
  };
}

/**
 * Hook pour récupérer tous les membres d'un groupe
 * @param {string} groupId - ID du groupe
 */
export function useGroupMembers(groupId) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMembers = useCallback(async () => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await getSupabase()
        .from("group_members")
        .select("*, users(id, display_name, metadata)")
        .eq("group_id", groupId);

      if (fetchError) throw fetchError;
      setMembers(data || []);
    } catch (err) {
      console.error("[useGroupMembers] Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return { members, loading, error, refetch: fetchMembers };
}
