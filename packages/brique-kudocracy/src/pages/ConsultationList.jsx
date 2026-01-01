import { useState, useEffect } from "react";
import { getSupabase } from "@inseme/cop-host";
import { Link } from "react-router-dom";

export default function ConsultationList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
       // Consultations are likely posts with type 'consultation'
       const { data } = await getSupabase()
         .from("posts")
         .select("*")
         .ilike("metadata->>type", "consultation%")
         .order("created_at", { ascending: false });
       
       setItems(data || []);
       setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Consultations & Enquêtes</h1>
      {loading ? (
        <div>Chargement...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
           {items.map(item => (
             <div key={item.id} className="border rounded p-4 shadow-sm hover:shadow-md transition">
                <h3 className="text-xl font-bold mb-2">{item.metadata?.title || "Sans titre"}</h3>
                <p className="text-gray-600 line-clamp-3">{item.content}</p>
                <div className="mt-4">
                   <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {item.metadata?.status || "Ouverte"}
                   </span>
                </div>
             </div>
           ))}
           {items.length === 0 && <p>Aucune consultation en cours.</p>}
        </div>
      )}
    </div>
  );
}
