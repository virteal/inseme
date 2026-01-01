import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSupabase } from "@inseme/cop-host";

export default function BlogEditor() {
  const { slug } = useParams(); // If present, editing existing post (ID)
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  const [formData, setFormData] = useState({
     title: "",
     subtitle: "",
     content: "",
     gazette: "",
  });

  useEffect(() => {
    async function init() {
       const supabase = getSupabase();
       
       // 1. Auth check
       const { data: { user } } = await supabase.auth.getUser();
       if (!user) {
         setLoading(false);
         return; 
       }
       setCurrentUser(user);

       // 2. Load data if editing
       if (slug) {
         const { data: post, error } = await supabase
           .from("posts")
           .select("*")
           .eq("id", slug)
           .single();
           
         if (post && !error) {
           setFormData({
             title: post.metadata?.title || "",
             subtitle: post.metadata?.subtitle || "",
             content: post.content || "",
             gazette: post.metadata?.gazette || "",
           });
         }
       }
       setLoading(false);
    }
    init();
  }, [slug]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true);
    
    const supabase = getSupabase();
    
    const metadata = {
      postType: "blog",
      title: formData.title,
      subtitle: formData.subtitle,
      gazette: formData.gazette || null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (slug) {
         // Update
         const { error } = await supabase.from("posts").update({
           content: formData.content,
           metadata: {
             ...metadata, // Merge logic might be needed in real app, but simplified here
           }
         }).eq("id", slug);
         if (error) throw error;
      } else {
         // Create
         const { data, error } = await supabase.from("posts").insert({
           author_id: currentUser.id,
           content: formData.content,
           metadata: metadata
         }).select().single();
         
         if (error) throw error;
         if (data) navigate(`/blog/${data.id}`);
         return;
      }
      navigate(`/blog/${slug}`);
    } catch (err) {
      console.error("Save error:", err);
      alert("Erreur lors de l'enregistrement: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8">Chargement...</div>;
  if (!currentUser) return <div className="p-8 text-center text-red-500">Vous devez être connecté pour publier.</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{slug ? "Modifier l'article" : "Nouvel article de blog"}</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
           <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Titre</label>
           <input 
             name="title" 
             value={formData.title} 
             onChange={handleChange} 
             required 
             className="w-full px-3 py-2 border rounded shadow-sm focus:ring-2 focus:ring-indigo-500"
             placeholder="Titre accrocheur"
           />
        </div>

        <div>
           <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sous-titre (optionnel)</label>
           <input 
             name="subtitle" 
             value={formData.subtitle} 
             onChange={handleChange} 
             className="w-full px-3 py-2 border rounded shadow-sm focus:ring-2 focus:ring-indigo-500"
             placeholder="Chapeau ou résumé"
           />
        </div>

        <div>
           <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contenu (Markdown)</label>
           <textarea 
             name="content" 
             value={formData.content} 
             onChange={handleChange} 
             required 
             rows={12}
             className="w-full px-3 py-2 border rounded shadow-sm font-mono text-sm focus:ring-2 focus:ring-indigo-500"
             placeholder="# Introduction..."
           />
        </div>
        
        <div>
           <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Publication (Gazette)</label>
           <input 
             name="gazette" 
             value={formData.gazette} 
             onChange={handleChange} 
             className="w-full px-3 py-2 border rounded shadow-sm focus:ring-2 focus:ring-indigo-500"
             placeholder="Ex: global (laisser vide pour blog personnel)"
           />
        </div>

        <div className="flex gap-4 pt-4">
           <button 
             type="submit" 
             disabled={saving}
             className="px-6 py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700 disabled:opacity-50"
           >
             {saving ? "Enregistrement..." : "Publier"}
           </button>
           <button 
             type="button" 
             onClick={() => navigate(-1)}
             className="px-6 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
           >
             Annuler
           </button>
        </div>
      </form>
    </div>
  );
}
