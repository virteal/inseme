// src/components/kudocracy/PropositionList.jsx

import React, { useState, useEffect, useMemo } from "react";
import PropositionCard from "./PropositionCard";
import { useCurrentUser } from "../../lib/useCurrentUser";
import { getSupabase } from "../../lib/supabase";

export default function PropositionList() {
  const { currentUser } = useCurrentUser();
  const [propositions, setPropositions] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    console.log("PropositionList: Component mounted, initializing...");
    if (!getSupabase()) {
      console.log("PropositionList: Supabase client not yet available, waiting...");
      return undefined;
    }
    console.log("PropositionList: Supabase client available, loading data...");
    loadTags();
    loadPropositions(true);
    console.log("PropositionList: Setting up real-time subscription...");
    const subscription = getSupabase()
      .channel("propositions_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "propositions" },
        (payload) => {
          console.log("PropositionList: Real-time update received:", payload);
          loadPropositions();
        }
      )
      .subscribe((status) => {
        console.log("PropositionList: Subscription status:", status);
      });
    return () => {
      console.log("PropositionList: Component unmounting, cleaning up subscription...");
      subscription.unsubscribe();
    };
  }, [retryCount]);

  const loadTags = async () => {
    if (!getSupabase()) return;
    const { data, error } = await getSupabase().from("tags").select("*").order("name");
    if (!error && data) {
      setTags(data);
    }
  };

  const loadPropositions = async (showSpinner = false) => {
    console.log("PropositionList: loadPropositions called, supabase available:", !!getSupabase());
    if (!getSupabase()) {
      console.warn("PropositionList: Supabase client not available");
      setError("Connexion à la base de données non disponible");
      setLoading(false);
      return;
    }
    if (showSpinner) {
      setLoading(true);
      setError(null);
    }
    try {
      console.log("PropositionList: Loading propositions...");
      const startTime = Date.now();
      // First try a simple query without joins
      console.log("PropositionList: Trying simple query first...");
      const { data: simpleData, error: simpleError } = await getSupabase()
        .from("propositions")
        .select("id, title, status, created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(5);
      console.log("PropositionList: Simple query result:", {
        data: simpleData,
        error: simpleError,
      });
      const { data, error } = await getSupabase()
        .from("propositions")
        .select(
          `
          *,
          author:users(display_name),
          proposition_tags(tag:tags(*))
        `
        )
        .eq("status", "active")
        .order("created_at", { ascending: false });
      const endTime = Date.now();
      console.log("PropositionList: Query took", endTime - startTime, "ms");
      if (error) {
        console.error("PropositionList: Error loading propositions:", error);
        console.error("PropositionList: Error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        setError(`Erreur de chargement: ${error.message}`);
        setLoading(false);
        return;
      }
      console.log("PropositionList: Loaded", data?.length ?? 0, "propositions");
      console.log("PropositionList: Raw data sample:", data?.slice(0, 2));
      // Check if propositions exist but don't have status = 'active'
      if (data && data.length === 0) {
        console.log("PropositionList: No active propositions found, checking all propositions...");
        const { data: allProps, error: allError } = await getSupabase()
          .from("propositions")
          .select("id, title, status, created_at")
          .order("created_at", { ascending: false })
          .limit(5);
        if (!allError && allProps) {
          console.log("PropositionList: All propositions (sample):", allProps);
        } else {
          console.error("PropositionList: Error checking all propositions:", allError);
        }
      }
      setPropositions(data || []);
      setError(null);
    } catch (err) {
      console.error("PropositionList: Exception loading propositions:", err);
      setError(`Erreur de connexion: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const retryLoad = () => {
    setRetryCount((prev) => prev + 1);
  };

  const filteredPropositions = useMemo(() => {
    let filtered = [...propositions];

    if (selectedTags.length > 0) {
      console.log("PropositionList: applying tag filter", selectedTags);
      filtered = filtered.filter((prop) =>
        (prop.proposition_tags || []).some((pt) => selectedTags.includes(pt.tag.id))
      );
    }

    if (searchQuery.trim()) {
      const normalizedQuery = searchQuery.toLowerCase();
      console.log("PropositionList: applying search filter", normalizedQuery);
      filtered = filtered.filter(
        (prop) =>
          (prop.title || "").toLowerCase().includes(normalizedQuery) ||
          (prop.description || "").toLowerCase().includes(normalizedQuery)
      );
    }

    console.log("PropositionList: filtered rows", filtered.length);
    return filtered;
  }, [propositions, selectedTags, searchQuery]);

  const toggleTag = (tagId) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  return (
    <div>
      <div className="theme-card p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-800">Rechercher et filtrer</h3>
        </div>

        <input
          type="text"
          placeholder="Rechercher une proposition..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="wiki-search-input mb-4"
        />

        {tags.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">Filtrer par tags :</p>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`filter-chip ${selectedTags.includes(tag.id) ? "active" : ""}`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-gray-400">Chargement des propositions...</p>
        </div>
      ) : error ? (
        <div className="theme-card p-12 text-center">
          <div className="text-accent mb-4">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Erreur de chargement</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <button onClick={retryLoad} className="btn btn-primary">
            Réessayer
          </button>
        </div>
      ) : filteredPropositions.length === 0 ? (
        <div className="theme-card p-12 text-center">
          <p className="text-gray-600">Aucune proposition trouvée</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredPropositions.map((proposition) => (
            <PropositionCard key={proposition.id} proposition={proposition} user={currentUser} />
          ))}
        </div>
      )}
    </div>
  );
}
