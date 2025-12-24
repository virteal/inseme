import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getSupabase } from "../lib/supabase";
import { useCurrentUser } from "../lib/useCurrentUser";
import { getMetadata } from "../lib/metadata";
import { getTaskTitleFromPost, getTaskStatus } from "../lib/taskHelpers";
import { TASK_STATUS_LABELS } from "../lib/taskMetadata";
import { getDisplayName } from "../lib/userDisplay";
import { getLatestModifier } from "../lib/socialMetadata";
import SiteFooter from "../components/layout/SiteFooter";
import SubscribeButton from "../components/common/SubscribeButton";
import AuthModal from "../components/common/AuthModal";

export default function MissionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();

  const [mission, setMission] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);
  const [linkedProjects, setLinkedProjects] = useState([]);
  const [tasksByProject, setTasksByProject] = useState({});
  const [tasksLoading, setTasksLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    loadMissionDetails();
  }, [id]);

  async function loadMissionDetails() {
    try {
      setLoading(true);

      // Load mission (group)
      const { data: groupData, error: groupError } = await getSupabase()
        .from("groups")
        .select("*, users:created_by(id, display_name)")
        .eq("id", id)
        .single();

      if (groupError) throw groupError;
      setMission(groupData);

      // Load members
      const { data: membersData, error: membersError } = await getSupabase()
        .from("group_members")
        .select("*, users(id, display_name, metadata)")
        .eq("group_id", id);

      if (membersError) throw membersError;
      setMembers(membersData);

      await loadLinkedProjects(groupData);
    } catch (err) {
      console.error("Error loading mission details:", err);
      setError("Impossible de charger la mission");
    } finally {
      setLoading(false);
    }
  }

  async function loadLinkedProjects(currentMission) {
    if (!currentMission) {
      setLinkedProjects([]);
      setTasksByProject({});
      return;
    }

    try {
      setTasksLoading(true);

      const declaredIds = Array.isArray(currentMission.metadata?.linked_task_project_ids)
        ? currentMission.metadata.linked_task_project_ids.filter(Boolean)
        : [];

      const { data: directLinks, error: directLinksError } = await getSupabase()
        .from("groups")
        .select("*")
        .eq("metadata->>type", "task_project")
        .eq("metadata->>linked_mission_id", currentMission.id);

      if (directLinksError) throw directLinksError;

      const combined = [...(directLinks || [])];
      const missingIds = declaredIds.filter(
        (projectId) => !combined.some((project) => project.id === projectId)
      );

      if (missingIds.length > 0) {
        const { data: fallbackProjects, error: fallbackError } = await getSupabase()
          .from("groups")
          .select("*")
          .in("id", missingIds);

        if (fallbackError) throw fallbackError;

        fallbackProjects?.forEach((project) => {
          if (!combined.some((existing) => existing.id === project.id)) {
            combined.push(project);
          }
        });
      }

      setLinkedProjects(combined);

      const taskMap = {};
      await Promise.all(
        combined.map(async (project) => {
          const { data: projectTasks, error: tasksError } = await getSupabase()
            .from("posts")
            .select("*")
            .eq("metadata->>group_id", project.id)
            .order("created_at", { ascending: false })
            .limit(5);

          if (tasksError) {
            console.warn("Unable to load tasks for project", project.id, tasksError);
            return;
          }

          taskMap[project.id] = (projectTasks || []).filter(
            (post) => getMetadata(post, "type") === "task"
          );
        })
      );

      setTasksByProject(taskMap);
    } catch (err) {
      console.error("Error loading mission-task links:", err);
      setLinkedProjects([]);
      setTasksByProject({});
    } finally {
      setTasksLoading(false);
    }
  }

  async function handleJoin() {
    if (!currentUser) return;

    try {
      setJoining(true);

      const { error } = await supabase.from("group_members").insert({
        group_id: id,
        user_id: currentUser.id,
        metadata: {
          role: "volunteer",
          status: "applied",
          joined_at: new Date().toISOString(),
        },
      });

      if (error) throw error;

      // Reload members
      loadMissionDetails();
      alert("Vous avez rejoint la mission !");
    } catch (err) {
      console.error("Error joining mission:", err);
      alert("Erreur lors de l'inscription");
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave() {
    if (!currentUser) return;

    if (!confirm("Êtes-vous sûr de vouloir quitter cette mission ?")) return;

    try {
      setJoining(true);

      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", id)
        .eq("user_id", currentUser.id);

      if (error) throw error;

      loadMissionDetails();
    } catch (err) {
      console.error("Error leaving mission:", err);
      alert("Erreur lors de la désinscription");
    } finally {
      setJoining(false);
    }
  }

  if (loading) return <div className="p-8 text-center">Chargement...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!mission) return <div className="p-8 text-center">Mission introuvable</div>;

  const missionDetails = getMetadata(mission, "mission_details", {});
  const tags = getMetadata(mission, "tags", []);
  const location = getMetadata(mission, "location");

  const startDate = missionDetails.start_date ? new Date(missionDetails.start_date) : null;
  const endDate = missionDetails.end_date ? new Date(missionDetails.end_date) : null;

  const isMember = currentUser && members.some((m) => m.user_id === currentUser.id);
  const isOrganizer = currentUser && mission.created_by === currentUser.id;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to="/missions" className="text-gray-500 hover:underline mb-4 block">
        ← Retour aux missions
      </Link>

      <div className="bg-white shadow-lg  overflow-hidden border border-gray-200">
        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-primary-100 text-primary-800 px-2 py-1 rounded text-xs font-bold uppercase tracking-wide">
                  Mission Bénévole
                </span>
                {missionDetails.status && (
                  <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold uppercase tracking-wide border border-gray-200">
                    {missionDetails.status}
                  </span>
                )}
              </div>
              <h1 className="text-3xl font-bold text-gray-900 font-bauhaus uppercase mb-2">
                {mission.name}
              </h1>
              <p className="text-gray-500 text-sm">
                Organisé par <span className="font-semibold">{getDisplayName(mission.users)}</span>
                {(() => {
                  const latestModifier = getLatestModifier(mission.metadata, mission);
                  if (latestModifier && latestModifier.id !== mission.created_by) {
                    return (
                      <span className="ml-2">
                        • Dernière modification par{" "}
                        <Link
                          to={`/users/${latestModifier.id}`}
                          className="font-semibold hover:underline"
                        >
                          {latestModifier.displayName || "Utilisateur inconnu"}
                        </Link>
                      </span>
                    );
                  }
                  return null;
                })()}
              </p>
            </div>

            {isOrganizer && (
              <Link
                to={`/missions/${id}/edit`}
                className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded border border-gray-300"
              >
                Modifier
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div className="md:col-span-2 space-y-6">
              <div>
                <h3 className="text-lg font-bold mb-2">À propos de cette mission</h3>
                <div className="prose max-w-none text-gray-700 whitespace-pre-wrap">
                  {mission.description || "Aucune description fournie."}
                </div>
              </div>

              {tags.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-500 mb-2 uppercase">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-gray-50 p-4  border border-gray-200">
                <h3 className="font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                  Détails pratiques
                </h3>

                <div className="space-y-3 text-sm">
                  {startDate && (
                    <div>
                      <span className="block text-gray-500 text-xs uppercase">Début</span>
                      <span className="font-medium">
                        {startDate.toLocaleString("fr-FR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  )}

                  {endDate && (
                    <div>
                      <span className="block text-gray-500 text-xs uppercase">Fin</span>
                      <span className="font-medium">
                        {endDate.toLocaleString("fr-FR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  )}

                  {location && (
                    <div>
                      <span className="block text-gray-500 text-xs uppercase">Lieu</span>
                      <span className="font-medium">{location}</span>
                    </div>
                  )}

                  {missionDetails.max_volunteers && (
                    <div>
                      <span className="block text-gray-500 text-xs uppercase">Places</span>
                      <span className="font-medium">
                        {members.length} / {missionDetails.max_volunteers} bénévoles
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {currentUser ? (
                isMember ? (
                  <div className="text-center space-y-3">
                    <div className="bg-green-50 text-green-800 p-3 rounded font-medium border border-green-200">
                      ✅ Vous participez
                    </div>
                    <button
                      onClick={handleLeave}
                      disabled={joining}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Se désinscrire
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleJoin}
                    disabled={joining}
                    className="w-full bg-primary-600 text-white py-3 rounded font-bold hover:bg-primary-700 shadow-md transition-transform hover:scale-[1.02]"
                  >
                    {joining ? "Inscription..." : "Je participe ! 👋"}
                  </button>
                )
              ) : (
                <div className="text-center p-4 bg-gray-50 rounded border border-gray-200">
                  <p className="text-sm text-gray-600 mb-2">Connectez-vous pour participer</p>
                  <button
                    type="button"
                    onClick={() => setShowAuthModal(true)}
                    className="text-primary-600 font-bold hover:underline"
                  >
                    Se connecter
                  </button>
                </div>
              )}

              {/* Subscribe Button */}
              <div className="mt-4">
                <SubscribeButton
                  contentType="mission"
                  contentId={id}
                  currentUser={currentUser}
                  className="w-full justify-center"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-8 mt-8">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h3 className="text-xl font-bold">Organisation des tâches</h3>
              <Link
                to={`/tasks/new?missionId=${id}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white  font-semibold hover:bg-primary-700"
              >
                <span className="text-lg">＋</span>
                Créer un projet de tâches
              </Link>
            </div>

            {tasksLoading ? (
              <div className="p-6 text-gray-500">Chargement des tâches…</div>
            ) : linkedProjects.length === 0 ? (
              <div className="p-6 bg-gray-50 border border-gray-200  text-gray-600">
                Aucune planification n'est encore associée à cette mission.
              </div>
            ) : (
              <div className="space-y-6">
                {linkedProjects.map((project) => {
                  const tasks = tasksByProject[project.id] || [];
                  return (
                    <div
                      key={project.id}
                      className="border border-gray-200  p-5 bg-white shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-500">Projet de tâches</p>
                          <h4 className="text-lg font-semibold text-gray-900">{project.name}</h4>
                          {project.description && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {project.description}
                            </p>
                          )}
                        </div>
                        <Link
                          to={`/tasks/${project.id}`}
                          className="px-4 py-2 border border-gray-300  text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Ouvrir le Kanban
                        </Link>
                      </div>

                      {tasks.length === 0 ? (
                        <p className="text-sm text-gray-500">Aucune tâche récente.</p>
                      ) : (
                        <ul className="space-y-3">
                          {tasks.map((task) => {
                            const status = getTaskStatus(task);
                            const statusLabel = TASK_STATUS_LABELS[status] || status;
                            return (
                              <li
                                key={task.id}
                                className="flex flex-wrap items-center justify-between gap-3 border border-gray-100 rounded-md px-3 py-2"
                              >
                                <Link
                                  to={`/tasks/${project.id}/task/${task.id}`}
                                  className="font-semibold text-gray-800 hover:text-primary-700"
                                >
                                  {getTaskTitleFromPost(task)}
                                </Link>
                                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                                  {statusLabel}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Volunteers List */}
          <div className="border-t border-gray-200 pt-8">
            <h3 className="text-xl font-bold mb-4">Bénévoles ({members.length})</h3>
            {members.length === 0 ? (
              <p className="text-gray-500 italic">Aucun bénévole pour le moment.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {members.map((member) => (
                  <Link
                    key={member.user_id}
                    to={`/users/${member.user_id}`}
                    className="flex items-center gap-3 p-3 rounded hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
                  >
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600">
                      {member.users?.display_name?.charAt(0) || "?"}
                    </div>
                    <div className="overflow-hidden">
                      <div className="font-medium truncate">{getDisplayName(member.users)}</div>
                      <div className="text-xs text-gray-500 capitalize">
                        {member.metadata?.role || "Bénévole"}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <SiteFooter />
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}
