import React, { useState, useEffect } from "react";
import { getSupabase } from "../../lib/supabase";

export default function GovernanceSettings({ user }) {
  const [federationDelegate, setFederationDelegate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");

  useEffect(() => {
    loadSettings();
    loadUsers();
  }, [user]);

  const loadSettings = async () => {
    // Check if user has delegated 'sys:federation'
    const { data: tagData } = await getSupabase()
      .from("tags")
      .select("id")
      .eq("name", "sys:federation")
      .single();

    if (tagData) {
      const { data: delegation } = await getSupabase()
        .from("delegations")
        .select("id, delegate:users!delegations_delegate_id_fkey(display_name, id)")
        .eq("delegator_id", user.id)
        .eq("tag_id", tagData.id)
        .maybeSingle();

      if (delegation) {
        setFederationDelegate(delegation.delegate);
      } else {
        setFederationDelegate(null);
      }
    }
  };

  const loadUsers = async () => {
    const { data } = await getSupabase()
      .from("users")
      .select("id, display_name")
      .neq("id", user.id)
      .order("display_name");

    if (data) setUsers(data);
  };

  const handleEnableFederation = async () => {
    if (!selectedUser) return;
    setLoading(true);
    try {
      // Get tag ID
      const { data: tagData } = await getSupabase()
        .from("tags")
        .select("id")
        .eq("name", "sys:federation")
        .single();

      if (!tagData) throw new Error("Tag system non trouvé");

      // Create delegation
      await getSupabase().from("delegations").insert({
        delegator_id: user.id,
        delegate_id: selectedUser,
        tag_id: tagData.id,
      });

      await loadSettings();
      setSelectedUser("");
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'activation");
    } finally {
      setLoading(false);
    }
  };

  const handleDisableFederation = async () => {
    if (!confirm("Arrêter la fédération automatique ?")) return;
    setLoading(true);
    try {
      const { data: tagData } = await getSupabase()
        .from("tags")
        .select("id")
        .eq("name", "sys:federation")
        .single();

      if (tagData) {
        await getSupabase()
          .from("delegations")
          .delete()
          .eq("delegator_id", user.id)
          .eq("tag_id", tagData.id);

        setFederationDelegate(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
      <h2 className="text-xl font-bold mb-4 font-display text-gray-900 dark:text-white">
        Paramètres de Souveraineté
      </h2>

      {/* Auto-Federation Card */}
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 flex items-center gap-2">
              🌍 Auto-Fédération
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              Déléguerez-vous la décision de publier vos contenus sur le réseau fédéré ? (Ascending
              Subsidiarity)
            </p>
          </div>
          <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold uppercase">
            {federationDelegate ? "Activé" : "Manuel"}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          {federationDelegate ? (
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-200">
                Géré par : <strong>{federationDelegate.display_name}</strong>
              </span>
              <button
                onClick={handleDisableFederation}
                disabled={loading}
                className="text-red-600 hover:text-red-800 text-sm font-semibold"
              >
                Désactiver
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                className="flex-1 px-3 py-2 border border-gray-300 rounded"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
              >
                <option value="">-- Choisir un tiers de confiance --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.display_name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleEnableFederation}
                disabled={!selectedUser || loading}
                className="px-4 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Activer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
