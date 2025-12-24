import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getSupabase } from "../lib/supabase";
import { useCurrentUser } from "../lib/useCurrentUser";
import SiteFooter from "../components/layout/SiteFooter";
import CommentThread from "../components/social/CommentThread";
import TaskCommandPanel from "../components/tasks/TaskCommandPanel";
import {
  getTaskDetails,
  getTaskTitleFromPost,
  getTaskBodyFromPost,
  getTaskPriority,
  getTaskStatus,
  getTaskLabels,
  getTaskAssignees,
  getStatusHistory,
  isTaskBlocked,
  transitionTaskStatus,
} from "../lib/taskHelpers";
import {
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_ICONS,
  TASK_STATUS_COLORS,
} from "../lib/taskMetadata";
import { getLatestModifier } from "../lib/socialMetadata";

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function displayDate(date) {
  if (!date) return "—";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function toIsoDate(value) {
  if (!value) return null;
  try {
    return new Date(`${value}T00:00:00Z`).toISOString();
  } catch (error) {
    return null;
  }
}

export default function TaskDetail() {
  const { projectId, taskId } = useParams();
  const { currentUser, loading: userLoading } = useCurrentUser();

  const [project, setProject] = useState(null);
  const [task, setTask] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [linkedMission, setLinkedMission] = useState(null);

  const loadTaskData = useCallback(async () => {
    if (!projectId || !taskId) {
      setError("Paramètres invalides");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [
        { data: projectData, error: projectError },
        { data: taskData, error: taskError },
        { data: memberRows, error: membersError },
      ] = await Promise.all([
        getSupabase().from("groups").select("*").eq("id", projectId).single(),
        getSupabase().from("posts").select("*").eq("id", taskId).single(),
        getSupabase()
          .from("group_members")
          .select("*, users(id, display_name, metadata)")
          .eq("group_id", projectId),
      ]);

      if (projectError) throw projectError;
      if (taskError) throw taskError;
      if (membersError) throw membersError;

      if (projectData?.metadata?.type !== "task_project") {
        throw new Error("Projet invalide pour Kanban.");
      }

      if (taskData?.metadata?.group_id !== projectId) {
        throw new Error("Cette tâche n’appartient plus à ce projet.");
      }

      setProject(projectData);
      setTask(taskData);
      setMembers(memberRows || []);
    } catch (err) {
      console.error("Error loading task detail", err);
      setError(err.message || "Impossible de charger la tâche.");
    } finally {
      setLoading(false);
    }
  }, [projectId, taskId]);

  useEffect(() => {
    loadTaskData();
  }, [loadTaskData]);

  useEffect(() => {
    const missionFromProject = project?.metadata?.linked_mission || null;
    const missionIdFromProject = project?.metadata?.linked_mission_id;

    if (missionFromProject) {
      setLinkedMission(missionFromProject);
      return;
    }

    if (!missionIdFromProject) {
      setLinkedMission(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await getSupabase()
          .from("groups")
          .select("id, name, metadata")
          .eq("id", missionIdFromProject)
          .single();

        if (!cancelled && !error && data) {
          setLinkedMission({
            id: data.id,
            name: data.name,
            location: data.metadata?.mission_details?.location || null,
            status: data.metadata?.mission_details?.status || null,
          });
        }
      } catch (missionError) {
        console.warn("Unable to resolve linked mission", missionError);
        if (!cancelled) {
          setLinkedMission(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [project]);

  const workflowStates = useMemo(
    () =>
      project?.metadata?.project_details?.workflow_states?.length
        ? project.metadata.project_details.workflow_states
        : [],
    [project]
  );

  const isMember = currentUser && members.some((member) => member.user_id === currentUser.id);

  const details = task ? getTaskDetails(task) : {};
  const dueDate = formatDate(details.due_date);
  const labels = getTaskLabels(task || {});
  const assignees = getTaskAssignees(task || {});
  const statusHistory = getStatusHistory(task || {});
  const blocked = task ? isTaskBlocked(task) : false;

  const assigneeInfos = useMemo(() => {
    if (!assignees.length) {
      return [];
    }
    return assignees.map((userId) => {
      const member = members.find((m) => m.user_id === userId);
      return {
        id: userId,
        name: member?.users?.display_name || "Membre",
        role: member?.metadata?.role || null,
      };
    });
  }, [assignees, members]);

  const updateDetails = useCallback(
    async (partialDetails) => {
      if (!task) return;
      if (!currentUser || !isMember) {
        setActionError("Connectez-vous pour modifier la tâche.");
        return;
      }
      setUpdating(true);
      setActionError("");

      try {
        const currentDetails = getTaskDetails(task);
        const updatedMetadata = {
          ...task.metadata,
          task_details: {
            ...currentDetails,
            ...partialDetails,
          },
        };

        const { data: updatedTask, error: updateError } = await getSupabase()
          .from("posts")
          .update({
            metadata: updatedMetadata,
            updated_at: new Date().toISOString(),
          })
          .eq("id", task.id)
          .select()
          .single();

        if (updateError) throw updateError;
        setTask(updatedTask);
      } catch (err) {
        console.error("Error updating task", err);
        setActionError(err.message || "Impossible de mettre à jour la tâche.");
      } finally {
        setUpdating(false);
      }
    },
    [task, currentUser, isMember]
  );

  const handleStatusChange = async (event) => {
    if (!task) return;
    const newStatus = event.target.value;
    if (!newStatus || newStatus === getTaskStatus(task)) {
      return;
    }
    if (!currentUser || !isMember) {
      setActionError("Vous devez être membre du projet pour modifier le statut.");
      return;
    }

    setUpdating(true);
    setActionError("");

    try {
      const result = await transitionTaskStatus(task.id, newStatus, currentUser.id, "Fiche tâche");
      if (!result.success) {
        throw new Error(result.error);
      }
      setTask(result.updatedPost);
    } catch (err) {
      console.error("Status change error", err);
      setActionError(err.message || "Impossible de changer le statut.");
    } finally {
      setUpdating(false);
    }
  };

  const handlePriorityChange = (event) => {
    updateDetails({ priority: event.target.value });
  };

  const handleDueDateChange = (event) => {
    updateDetails({ due_date: toIsoDate(event.target.value) });
  };

  const handleCommandResult = (updatedPost) => {
    if (updatedPost) {
      setTask(updatedPost);
      setActionError("");
    } else {
      loadTaskData();
    }
  };

  if (loading || userLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
        <p className="text-gray-500">Chargement...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-red-50 text-red-700 p-4 border border-red-200  mb-4">{error}</div>
        <Link to={`/tasks/${projectId}`} className="text-primary-600 hover:underline">
          ← Retour au projet
        </Link>
      </div>
    );
  }

  if (!task || !project) {
    return null;
  }

  const title = getTaskTitleFromPost(task);
  const description = getTaskBodyFromPost(task);
  const status = getTaskStatus(task);
  const priority = getTaskPriority(task);
  const statusLabel = TASK_STATUS_LABELS[status] || status;
  const priorityLabel = TASK_PRIORITY_LABELS[priority] || priority;
  const statusColor = TASK_STATUS_COLORS[status] || "bg-gray-100 text-gray-600 border-gray-200";
  const latestModifier = getLatestModifier(task.metadata, task);
  const showModifier = latestModifier && latestModifier.id !== task.author_id;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col gap-2">
        <Link to={`/tasks/${projectId}`} className="text-gray-500 hover:underline">
          ← Retour au projet
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">Projet · {project.name}</p>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              {blocked && <span className="text-red-500 text-xl">🚫</span>}
              {title}
            </h1>
            {linkedMission && (
              <Link
                to={`/missions/${linkedMission.id}`}
                className="inline-flex items-center gap-2 text-sm text-primary-700 font-semibold mt-2"
              >
                <span>Mission associée :</span>
                <span className="px-2 py-0.5 bg-primary-50 rounded-full">{linkedMission.name}</span>
              </Link>
            )}
          </div>
          {isMember && (
            <div className="flex gap-2">
              <Link
                to={`/tasks/${projectId}/task/${taskId}/edit`}
                className="px-4 py-2 text-sm font-semibold border border-gray-300  text-gray-700 hover:bg-gray-50"
              >
                Modifier
              </Link>
            </div>
          )}
        </div>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700  p-3">{actionError}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200  p-6 shadow-sm">
            <div className="flex flex-wrap gap-4 items-center mb-4">
              <div className={`px-3 py-1 rounded-full border text-sm font-semibold ${statusColor}`}>
                {statusLabel}
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <span
                  className={`text-lg ${priority === "urgent" ? "text-red-600" : "text-gray-600"}`}
                >
                  {TASK_PRIORITY_ICONS[priority]}
                </span>
                {priorityLabel}
              </div>
              {dueDate && <div className="text-sm text-gray-500">📅 {displayDate(dueDate)}</div>}
            </div>

            {description ? (
              <ReactMarkdown className="prose prose-sm max-w-none" remarkPlugins={[remarkGfm]}>
                {description}
              </ReactMarkdown>
            ) : (
              <p className="text-gray-500 text-sm">Aucune description pour le moment.</p>
            )}
          </div>

          <div className="bg-white border border-gray-200  p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Discussion</h2>
            <CommentThread postId={task.id} currentUser={currentUser} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-gray-200  p-5 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Informations clés</h2>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Statut
              </label>
              <select
                value={status}
                onChange={handleStatusChange}
                disabled={!isMember || updating}
                className="mt-1 w-full px-3 py-2 border border-gray-300  text-sm focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
              >
                {workflowStates.length === 0 && <option value={status}>{statusLabel}</option>}
                {workflowStates.map((state) => (
                  <option key={state} value={state}>
                    {TASK_STATUS_LABELS[state] || state}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Priorité
              </label>
              <select
                value={priority}
                onChange={handlePriorityChange}
                disabled={!isMember || updating}
                className="mt-1 w-full px-3 py-2 border border-gray-300  text-sm focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
              >
                {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Échéance
              </label>
              <input
                type="date"
                value={dueDate ? dueDate.toISOString().slice(0, 10) : ""}
                onChange={handleDueDateChange}
                disabled={!isMember || updating}
                className="mt-1 w-full px-3 py-2 border border-gray-300  text-sm focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Assignés
              </label>
              {assigneeInfos.length === 0 ? (
                <p className="mt-1 text-sm text-gray-500">Aucun membre assigné.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {assigneeInfos.map((assignee) => (
                    <li
                      key={assignee.id}
                      className="flex items-center justify-between text-sm text-gray-700"
                    >
                      <span>{assignee.name}</span>
                      {assignee.role && (
                        <span className="text-xs text-gray-400">{assignee.role}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Labels
              </label>
              {labels.length === 0 ? (
                <p className="mt-1 text-sm text-gray-500">Aucun label.</p>
              ) : (
                <div className="mt-1 flex flex-wrap gap-2">
                  {labels.map((label) => (
                    <span key={label} className="px-2 py-1 bg-gray-100 text-gray-700  text-xs">
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {showModifier && latestModifier && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Dernière modification
                </label>
                <p className="mt-1 text-sm text-gray-700">
                  Par{" "}
                  <Link
                    to={`/users/${latestModifier.id}`}
                    className="text-primary-600 hover:underline"
                  >
                    {latestModifier.displayName || "Utilisateur"}
                  </Link>
                  {latestModifier.timestampISO && (
                    <span className="text-gray-500 ml-1">
                      le {new Date(latestModifier.timestampISO).toLocaleString("fr-FR")}
                    </span>
                  )}
                </p>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Historique
              </label>
              {statusHistory.length === 0 ? (
                <p className="mt-1 text-sm text-gray-500">Aucun changement enregistré.</p>
              ) : (
                <ul className="mt-2 space-y-3 text-sm text-gray-600">
                  {statusHistory.map((entry, index) => (
                    <li key={`${entry.changed_at}-${index}`}>
                      <div className="font-semibold">
                        {TASK_STATUS_LABELS[entry.from] || entry.from} →{" "}
                        {TASK_STATUS_LABELS[entry.status] || entry.status}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(entry.changed_at).toLocaleString("fr-FR")}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {isMember ? (
            <TaskCommandPanel
              taskId={task.id}
              currentUser={currentUser}
              onCommandExecuted={handleCommandResult}
            />
          ) : (
            <div className="bg-gray-50 border border-gray-200  p-4 text-sm text-gray-500">
              Rejoignez ce projet pour exécuter des commandes rapides.
            </div>
          )}
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
