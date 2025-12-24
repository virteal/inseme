import React, { useState, useEffect } from "react";
import { getSupabase } from "../../lib/supabase";

export default function DelegationManager({ user }) {
  const [delegations, setDelegations] = useState([]);
  const [tags, setTags] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedDelegate, setSelectedDelegate] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDelegations();
    loadTags();
    loadUsers();
  }, [user]);

  const loadDelegations = async () => {
    const { data, error } = await getSupabase()
      .from("delegations")
      .select(
        `
        *,
        delegate:users!delegations_delegate_id_fkey(display_name),
        tag:tags(name)
      `
      )
      .eq("delegator_id", user.id);

    if (!error && data) {
      setDelegations(data);
    }
  };

  const loadTags = async () => {
    const { data, error } = await getSupabase().from("tags").select("*").order("name");

    if (!error && data) {
      setTags(data);
    }
  };

  const loadUsers = async () => {
    const { data, error } = await getSupabase()
      .from("users")
      .select("id, display_name")
      .neq("id", user.id)
      .order("display_name");

    if (!error && data) {
      setUsers(data);
    }
  };

  const handleCreateDelegation = async () => {
    if (!selectedTag || !selectedDelegate) {
      alert("Veuillez sélectionner un tag et un délégué");
      return;
    }

    const existing = delegations.find((d) => d.tag_id === selectedTag);
    if (existing) {
      alert("Vous avez déjà une délégation pour ce tag");
      return;
    }

    setLoading(true);

    try {
      const { error } = await getSupabase().from("delegations").insert({
        delegator_id: user.id,
        delegate_id: selectedDelegate,
        tag_id: selectedTag,
      });

      if (error) throw error;

      await loadDelegations();
      setSelectedTag("");
      setSelectedDelegate("");
    } catch (error) {
      console.error("Erreur lors de la création:", error);
      alert("Erreur lors de la création de la délégation");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDelegation = async (delegationId) => {
    if (!confirm("Supprimer cette délégation ?")) return;

    try {
      const { error } = await getSupabase().from("delegations").delete().eq("id", delegationId);

      if (error) throw error;

      await loadDelegations();
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      alert("Erreur lors de la suppression de la délégation");
    }
  };

  const availableTags = tags.filter((tag) => !delegations.some((d) => d.tag_id === tag.id));

  return (
    <div className="space-y-6">
      <div className="   shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-50 mb-4">Vos délégations</h2>

        <div className="bg-blue-50 border border-blue-200 p-4 mb-6">
          <p className="text-sm text-blue-800">
            Déléguez votre pouvoir de vote sur des sujets spécifiques à des personnes en qui vous
            avez confiance. Votre vote direct sur une proposition remplace toujours la délégation.
          </p>
        </div>

        {delegations.length > 0 ? (
          <div className="space-y-3 mb-6">
            {delegations.map((delegation) => (
              <div
                key={delegation.id}
                className="flex justify-between items-center p-4 border border-gray-200"
              >
                <div>
                  <p className="font-semibold text-gray-50">{delegation.tag.name}</p>
                  <p className="text-sm text-gray-300">
                    Délégué à : {delegation.delegate.display_name}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteDelegation(delegation.id)}
                  className="px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 font-semibold text-sm"
                >
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">Aucune délégation active</div>
        )}
      </div>

      <div className="   shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-50 mb-4">Créer une nouvelle délégation</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-gray-200 font-semibold mb-2">Sujet (tag)</label>
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 "
            >
              <option value="">-- Sélectionnez un tag --</option>
              {availableTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-200 font-semibold mb-2">Délégué</label>
            <select
              value={selectedDelegate}
              onChange={(e) => setSelectedDelegate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 "
            >
              <option value="">-- Sélectionnez un utilisateur --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.display_name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleCreateDelegation}
            disabled={loading}
            className="w-full py-3 bg-blue-900 text-bauhaus-white font-bold hover:bg-blue-800 disabled:opacity-50"
          >
            {loading ? "Création..." : "Créer la délégation"}
          </button>
        </div>
      </div>
    </div>
  );
}
