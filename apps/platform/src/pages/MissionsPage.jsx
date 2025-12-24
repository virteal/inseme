import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getSupabase } from "../lib/supabase";
import { useCurrentUser } from "../lib/useCurrentUser";
import MissionCard from "../components/missions/MissionCard";
import { getMetadata } from "../lib/metadata";
import SiteFooter from "../components/layout/SiteFooter";

export default function MissionsPage() {
  const { currentUser } = useCurrentUser();
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all"); // all, open, my-missions

  useEffect(() => {
    loadMissions();
  }, []);

  async function loadMissions() {
    try {
      setLoading(true);

      // Fetch groups with metadata->>type = 'mission'
      // Note: Supabase filtering on JSONB can be tricky, so we might filter client-side if needed
      // But let's try to filter in query first if possible, or fetch all groups and filter

      const { data, error } = await getSupabase()
        .from("groups")
        .select("*, group_members(count)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filter for missions client-side for simplicity and flexibility
      const missionGroups = data.filter((group) => {
        const type = getMetadata(group, "type");
        // Also support legacy or alternative ways if needed, but for now strict check
        return type === "mission";
      });

      setMissions(missionGroups);
    } catch (err) {
      console.error("Error loading missions:", err);
      setError("Impossible de charger les missions");
    } finally {
      setLoading(false);
    }
  }

  const filteredMissions = missions.filter((mission) => {
    if (filter === "all") return true;

    const missionDetails = getMetadata(mission, "mission_details", {});

    if (filter === "open") {
      return missionDetails.status === "open";
    }

    // For "my-missions", we would need to check if user is member
    // This requires fetching user memberships or checking against a list
    // For now, let's keep it simple

    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold font-bauhaus text-gray-900">Missions Bénévoles</h1>
          <p className="text-gray-600 mt-2">
            Participez à des actions collectives pour la communauté
          </p>
        </div>

        {currentUser && (
          <Link
            to="/missions/new"
            className="bg-primary-600 text-white px-4 py-2 rounded font-bold hover:bg-primary-700 transition-colors shadow-sm"
          >
            + Créer une mission
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${
            filter === "all"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Toutes les missions
        </button>
        <button
          onClick={() => setFilter("open")}
          className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${
            filter === "open"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Missions ouvertes
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Chargement des missions...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 p-4 rounded border border-red-200 text-center">
          {error}
        </div>
      ) : filteredMissions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50  border border-gray-200 border-dashed">
          <p className="text-gray-500 mb-4">Aucune mission trouvée</p>
          {currentUser && (
            <Link to="/missions/new" className="text-primary-600 font-bold hover:underline">
              Soyez le premier à proposer une mission !
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMissions.map((mission) => (
            <MissionCard key={mission.id} mission={mission} />
          ))}
        </div>
      )}
      <SiteFooter />
    </div>
  );
}
