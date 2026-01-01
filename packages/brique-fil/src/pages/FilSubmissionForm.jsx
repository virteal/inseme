import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSupabase } from "@inseme/cop-host";

export default function FilSubmissionForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    external_url: "",
  });

  useEffect(() => {
     getSupabase().auth.getUser().then(({ data }) => setCurrentUser(data.user));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return alert("Veuillez vous connecter.");
    
    // Validate
    if (!formData.title.trim() && !formData.external_url.trim()) {
      return alert("Veuillez fournir un titre ou une URL.");
    }

    setLoading(true);
    try {
      const { data: { session } } = await getSupabase().auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch("/api/fil/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: formData.title,
          content: formData.content,
          external_url: formData.external_url,
          type: "fil_link",
        }),
      });

      if (!response.ok) throw new Error("Erreur lors de la publication");
      
      navigate("/fil");
    } catch (err) {
      console.error(err);
      alert("Erreur: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) return <div className="p-8 text-center text-red-500">Connexion requise pour publier.</div>;

  return (
    <div className="max-w-xl mx-auto p-6 bg-white dark:bg-gray-900 border rounded-lg shadow-sm mt-8">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Ajouter au Fil</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Lien (URL)</label>
          <input
            type="url"
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-black dark:bg-gray-800 dark:border-gray-700"
            value={formData.external_url}
            onChange={(e) => setFormData({ ...formData, external_url: e.target.value })}
            placeholder="https://..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Titre (Optionnel)</label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-black dark:bg-gray-800 dark:border-gray-700"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Si vide, l'URL sera utilisée"
          />
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-black text-white font-bold rounded hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading ? "Publication..." : "Publier"}
        </button>
      </form>
    </div>
  );
}
