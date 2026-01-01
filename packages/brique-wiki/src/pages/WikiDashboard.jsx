import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getSupabase, useCurrentUser } from "@inseme/cop-host";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function WikiDashboard() {
  const { currentUser } = useCurrentUser();
  const [stats, setStats] = useState(null);
  const [recentEdits, setRecentEdits] = useState([]);
  const [createdPages, setCreatedPages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      loadWikiStats();
    }
  }, [currentUser]);

  const loadWikiStats = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);

      // Get pages created by user
      const { data: userCreatedPages, error: createdError } =
        await getSupabase()
          .from("wiki_pages")
          .select("*")
          .eq("author_id", currentUser.id)
          .order("created_at", { ascending: false });

      if (createdError) throw createdError;

      // Get revisions by user
      const { data: userRevisions, error: revisionsError } = await getSupabase()
        .from("wiki_revisions")
        .select(
          `
          *,
          wiki_pages!inner(title, slug)
        `
        )
        .eq("author_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (revisionsError) throw revisionsError;

      // Calculate statistics
      const totalEdits = userRevisions?.length || 0;
      const totalPagesCreated = userCreatedPages?.length || 0;

      // Get unique pages edited
      const uniquePagesEdited = new Set(userRevisions?.map((r) => r.page_id))
        .size;

      // Recent edits (last 10)
      const recentEditsData = userRevisions?.slice(0, 10) || [];

      // Activity by month (last 6 months)
      const activityData = [];
      const now = new Date();

      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

        const monthEdits =
          userRevisions?.filter((r) => {
            const editDate = new Date(r.created_at);
            return editDate >= monthStart && editDate <= monthEnd;
          }).length || 0;

        const monthName = monthStart.toLocaleDateString("fr-FR", {
          month: "short",
          year: "2-digit",
        });

        activityData.push({
          month: monthName,
          edits: monthEdits,
        });
      }

      // Get most edited pages by user
      const pageEditCounts = {};
      userRevisions?.forEach((revision) => {
        const pageTitle = revision.wiki_pages?.title || "Page inconnue";
        pageEditCounts[pageTitle] = (pageEditCounts[pageTitle] || 0) + 1;
      });

      const mostEditedPages = Object.entries(pageEditCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([title, count]) => ({ title, count }));

      setStats({
        totalEdits,
        totalPagesCreated,
        uniquePagesEdited,
        activityData,
        mostEditedPages,
      });

      setRecentEdits(recentEditsData);
      setCreatedPages(userCreatedPages || []);
    } catch (error) {
      console.error("Error loading wiki stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bauhaus-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-300">
            Chargement de vos contributions Wiki...
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-bauhaus-black flex items-center justify-center">
        <div className="text-gray-300">
          Veuillez vous connecter pour voir vos contributions Wiki.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bauhaus-black py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-gray-50 mb-2">
                Vos contributions Wiki
              </h1>
            </div>
            <div className="flex gap-3">
              <Link
                to="/user-dashboard"
                className="bg-blue-600 text-bauhaus-white px-4 py-2 hover:bg-blue-700 font-semibold"
              >
                Votre tableau de bord
              </Link>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="   shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 text-green-600">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-300">
                  Éditions totales
                </p>
                <p className="text-2xl font-bold text-gray-50">
                  {stats?.totalEdits || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="   shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-300">
                  Pages créées
                </p>
                <p className="text-2xl font-bold text-gray-50">
                  {stats?.totalPagesCreated || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="   shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-9 0V1m10 3V1m0 3l1 1v16a2 2 0 01-2 2H6a2 2 0 01-2-2V8l1-1z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-300">
                  Pages éditées
                </p>
                <p className="text-2xl font-bold text-gray-50">
                  {stats?.uniquePagesEdited || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Chart */}
        <div className="   shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-50 mb-4">
            Activité des 6 derniers mois
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats?.activityData || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="edits" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pages Created */}
          <div className="   shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-50 mb-4">
              Pages créées
            </h2>
            {createdPages.length > 0 ? (
              <div className="space-y-3">
                {createdPages.map((page) => (
                  <div
                    key={page.id}
                    className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0"
                  >
                    <div>
                      <Link
                        to={`/wiki/${page.slug}`}
                        className="font-medium text-blue-600 hover:text-blue-800"
                      >
                        {page.title}
                      </Link>
                      <p className="text-sm text-gray-400">
                        Créée le{" "}
                        {new Date(page.created_at).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">
                Vous n'avez pas encore créé de page Wiki.
                <br />
                <Link
                  to="/wiki/new"
                  className="text-blue-600 hover:text-blue-800"
                >
                  Créer votre première page
                </Link>
              </p>
            )}
          </div>

          {/* Most Edited Pages */}
          <div className="   shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-50 mb-4">
              Pages les plus éditées
            </h2>
            {stats?.mostEditedPages?.length > 0 ? (
              <div className="space-y-3">
                {stats.mostEditedPages.map((page, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0"
                  >
                    <span className="font-medium text-gray-50">
                      {page.title}
                    </span>
                    <span className="text-sm text-gray-300">
                      {page.count} édition{page.count > 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">
                Aucune édition trouvée.
              </p>
            )}
          </div>
        </div>

        {/* Recent Edits */}
        <div className="   shadow-md p-6 mt-8">
          <h2 className="text-xl font-bold text-gray-50 mb-4">
            Éditions récentes
          </h2>
          {recentEdits.length > 0 ? (
            <div className="space-y-4">
              {recentEdits.map((edit) => (
                <div
                  key={edit.id}
                  className="flex justify-between items-start py-3 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex-1">
                    <Link
                      to={`/wiki/${edit.wiki_pages?.slug}`}
                      className="font-medium text-blue-600 hover:text-blue-800"
                    >
                      {edit.wiki_pages?.title || "Page inconnue"}
                    </Link>
                    {edit.comment && (
                      <p className="text-sm text-gray-300 mt-1">
                        {edit.comment}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-sm text-gray-400">
                    {new Date(edit.created_at).toLocaleDateString("fr-FR")}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">
              Aucune édition récente trouvée.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
