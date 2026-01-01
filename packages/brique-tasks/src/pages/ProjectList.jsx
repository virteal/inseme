import React, { useState, useEffect } from "react";
import { getSupabase } from "@inseme/cop-host";
import { Link } from "react-router-dom";
import TaskProjectCard from "../components/tasks/TaskProjectCard";

export default function ProjectList() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
       const { data } = await getSupabase()
         .from("missions") // Assuming missions table or tasks with type 'project'
         .select("*")
         .order("created_at", { ascending: false });
       
       setProjects(data || []);
       setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
         <h1 className="text-2xl font-bold">Projets & Actions</h1>
         <Link to="/propositions/new" className="hidden px-4 py-2 bg-black text-white rounded">
            + Nouveau Projet
         </Link>
      </div>
      {loading ? (
        <div>Chargement...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
           {projects.map(proj => (
             <div key={proj.id}>
                {/* Fallback to simple card or reuse TaskProjectCard if compatible */}
                <div className="border rounded p-4 shadow-sm hover:shadow-md transition bg-white">
                    <h3 className="text-xl font-bold mb-2">{proj.title}</h3>
                    <p className="text-gray-600 line-clamp-2">{proj.description}</p>
                    <div className="mt-4 flex justify-between items-center">
                        <Link to={`/projects/kanban/${proj.id}`} className="text-blue-600 hover:underline">
                            Voir le Kanban
                        </Link>
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">{proj.status}</span>
                    </div>
                </div>
             </div>
           ))}
           {projects.length === 0 && <p>Aucun projet actif.</p>}
        </div>
      )}
    </div>
  );
}
