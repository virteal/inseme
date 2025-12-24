import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getSupabase } from "../lib/supabase";
import { useCurrentUser } from "../lib/useCurrentUser";
import { DEFAULT_WORKFLOW_STATES } from "../lib/taskMetadata";
import SiteFooter from "../components/layout/SiteFooter";

/**
 * Task Project Create Page
 *
 * Form to create a new task management project
 */
export default function TaskProjectCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser } = useCurrentUser();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#4F46E5");
  const [icon, setIcon] = useState("📋");
  const [missions, setMissions] = useState([]);
  const [missionsLoading, setMissionsLoading] = useState(false);
  const [linkedMissionId, setLinkedMissionId] = useState(searchParams.get("missionId") || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Predefined color options
  const colorOptions = [
    { value: "#4F46E5", label: "Indigo" },
    { value: "#059669", label: "Emerald" },
    { value: "#DC2626", label: "Rouge" },
    { value: "#D97706", label: "Orange" },
    { value: "#7C3AED", label: "Violet" },
    { value: "#DB2777", label: "Rose" },
    { value: "#0891B2", label: "Cyan" },
    { value: "#65A30D", label: "Lime" },
  ];

  // Predefined icon options
  const iconOptions = ["📋", "✅", "🎯", "🚀", "📊", "🔧", "💡", "🌟", "📝", "🎨"];

  useEffect(() => {
    async function loadMissions() {
      try {
        setMissionsLoading(true);
        const { data, error } = await getSupabase()
          .from("groups")
          .select("id, name, metadata")
          .eq("metadata->>type", "mission")
          .order("name", { ascending: true });

        if (error) throw error;
        setMissions(data || []);
      } catch (err) {
        console.error("Error loading missions", err);
      } finally {
        setMissionsLoading(false);
      }
    }

    loadMissions();
  }, []);

  const selectedMission = missions.find((mission) => mission.id === linkedMissionId) || null;

  async function handleSubmit(e) {
    e.preventDefault();

    if (!currentUser) {
      setError("Vous devez être connecté pour créer un projet");
      return;
    }

    if (!name.trim()) {
      setError("Le nom du projet est requis");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Create group with task_project type
      const { data: project, error: createError } = await getSupabase()
        .from("groups")
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          created_by: currentUser.id,
          metadata: {
            schemaVersion: 1,
            type: "task_project",
            project_details: {
              workflow_states: DEFAULT_WORKFLOW_STATES,
              default_view: "kanban",
              color: color,
              icon: icon,
            },
            task_stats: {
              todo: 0,
              in_progress: 0,
              review: 0,
              done: 0,
              blocked: 0,
            },
            linked_mission_id: linkedMissionId || null,
            linked_mission:
              linkedMissionId && selectedMission
                ? {
                    id: selectedMission.id,
                    name: selectedMission.name,
                    location: selectedMission.metadata?.mission_details?.location || null,
                    status: selectedMission.metadata?.mission_details?.status || null,
                  }
                : null,
          },
        })
        .select()
        .single();

      if (createError) throw createError;

      // Add creator as member
      const { error: memberError } = await getSupabase()
        .from("group_members")
        .insert({
          group_id: project.id,
          user_id: currentUser.id,
          metadata: {
            role: "admin",
            joined_at: new Date().toISOString(),
          },
        });

      if (memberError) {
        console.error("Error adding creator as member:", memberError);
        // Non-blocking error
      }

      if (linkedMissionId && selectedMission) {
        const missionMetadata = selectedMission.metadata || {};
        const existingProjectIds = Array.isArray(missionMetadata.linked_task_project_ids)
          ? missionMetadata.linked_task_project_ids.filter(Boolean)
          : [];
        const updatedMissionMetadata = {
          ...missionMetadata,
          linked_task_project_ids: Array.from(new Set([...existingProjectIds, project.id])),
        };

        const { error: missionUpdateError } = await getSupabase()
          .from("groups")
          .update({ metadata: updatedMissionMetadata })
          .eq("id", linkedMissionId);

        if (missionUpdateError) {
          console.error("Error updating mission linkage", missionUpdateError);
        }
      }

      // Navigate to project detail page
      navigate(`/tasks/${project.id}`);
    } catch (err) {
      console.error("Error creating task project:", err);
      setError("Erreur lors de la création du projet");
    } finally {
      setSubmitting(false);
    }
  }

  if (!currentUser) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded border border-yellow-200 text-center">
          Vous devez être connecté pour créer un projet de tâches.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <button onClick={() => navigate("/tasks")} className="text-gray-500 hover:underline mb-4">
          ← Retour aux projets
        </button>
        <h1 className="text-3xl font-bold font-bauhaus text-gray-900">Créer un Projet de Tâches</h1>
        <p className="text-gray-600 mt-2">Organisez votre travail avec un tableau Kanban</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded border border-red-200 mb-6">{error}</div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-lg  border border-gray-200 p-6 space-y-6"
      >
        {/* Project Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-bold text-gray-700 mb-2">
            Nom du projet *
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300  focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Ex: Aménagement du parc municipal"
            required
          />
        </div>

        {/* Project Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-bold text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300  focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Décrivez les objectifs du projet..."
          />
        </div>

        {/* Mission Linking */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Mission associée (optionnel)
          </label>
          <select
            value={linkedMissionId}
            onChange={(e) => setLinkedMissionId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300  focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={missionsLoading}
          >
            <option value="">Aucune mission</option>
            {missions.map((mission) => (
              <option key={mission.id} value={mission.id}>
                {mission.name}
              </option>
            ))}
          </select>
          {selectedMission && (
            <p className="text-xs text-gray-500 mt-2">
              Ce projet apparaîtra dans la mission « {selectedMission.name} ».
            </p>
          )}
        </div>

        {/* Color Selection */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Couleur du projet</label>
          <div className="grid grid-cols-4 gap-2">
            {colorOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setColor(option.value)}
                className={`p-3  border-2 transition-all ${
                  color === option.value
                    ? "border-gray-900 scale-105"
                    : "border-gray-200 hover:border-gray-400"
                }`}
                style={{ backgroundColor: option.value }}
                title={option.label}
              >
                <span className="text-white text-xs font-bold">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Icon Selection */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Icône du projet</label>
          <div className="grid grid-cols-5 gap-2">
            {iconOptions.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setIcon(emoji)}
                className={`p-3  border-2 text-2xl transition-all ${
                  icon === emoji
                    ? "border-gray-900 scale-110"
                    : "border-gray-200 hover:border-gray-400"
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Aperçu</label>
          <div className="p-4  border-2" style={{ borderColor: color }}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{icon}</span>
              <div>
                <h3 className="font-bold text-gray-900">{name || "Nom du projet"}</h3>
                <p className="text-sm text-gray-600">{description || "Description du projet"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-4 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate("/tasks")}
            className="flex-1 px-6 py-3 border border-gray-300  font-bold text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="flex-1 px-6 py-3 bg-primary-600 text-white  font-bold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Création..." : "Créer le projet"}
          </button>
        </div>
      </form>

      <SiteFooter />
    </div>
  );
}
