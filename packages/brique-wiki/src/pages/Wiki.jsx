import React, { useState, useEffect, useMemo } from "react";
import { getSupabase } from "@inseme/cop-host";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ErrorBoundary, MarkdownViewer } from "@inseme/ui";
import ShareModal from "../components/ShareModal";

export default function Wiki() {
  const [pages, setPages] = useState([]);
  const [activePage, setActivePage] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [editingPageId, setEditingPageId] = useState(null);
  const [formMode, setFormMode] = useState("view");
  const { slug: urlSlug } = useParams();
  const navigate = useNavigate();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Nouveaux états pour la navigation moderne
  const [sortBy, setSortBy] = useState(() => localStorage.getItem("wiki-sort") || "updated-desc");
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("wiki-view") || "grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(
    () => parseInt(localStorage.getItem("wiki-sidebar-width")) || 400
  );
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    loadPages();
  }, []);

  useEffect(() => {
    if (urlSlug) {
      loadPageBySlug(urlSlug);
    } else {
      setActivePage(null);
    }
  }, [urlSlug]);

  // Sauvegarder les préférences
  useEffect(() => {
    localStorage.setItem("wiki-sort", sortBy);
  }, [sortBy]);

  useEffect(() => {
    localStorage.setItem("wiki-view", viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem("wiki-sidebar-width", sidebarWidth.toString());
  }, [sidebarWidth]);

  const loadPages = async () => {
    const { data } = await getSupabase()
      .from("wiki_pages")
      .select("*")
      .order("updated_at", { ascending: false });
    setPages(data || []);
  };

  const loadPageBySlug = async (slug) => {
    const { data } = await getSupabase().from("wiki_pages").select("*").eq("slug", slug).single();
    setActivePage(data || null);
  };

  const handleNewPage = () => navigate("/wiki/new");

  // Fonction de tri et filtrage
  const filteredAndSortedPages = useMemo(() => {
    let result = [...pages];

    // Filtrage par recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (page) =>
          page.title.toLowerCase().includes(query) ||
          (page.content && page.content.toLowerCase().includes(query))
      );
    }

    // Tri
    result.sort((a, b) => {
      switch (sortBy) {
        case "title-asc":
          return a.title.localeCompare(b.title);
        case "title-desc":
          return b.title.localeCompare(a.title);
        case "updated-desc":
          return new Date(b.updated_at) - new Date(a.updated_at);
        case "updated-asc":
          return new Date(a.updated_at) - new Date(b.updated_at);
        case "created-desc":
          return new Date(b.created_at) - new Date(a.created_at);
        case "created-asc":
          return new Date(a.created_at) - new Date(b.created_at);
        default:
          return 0;
      }
    });

    return result;
  }, [pages, searchQuery, sortBy]);

  // Redirection vers une page
  const handlePageClick = (pageSlug) => {
    navigate(`/wiki/${pageSlug}`);
  };

  // Redimensionnement de la sidebar
  const startResizing = (e) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = e.clientX;
      if (newWidth > 200 && newWidth < 800) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-full bg-gray-50 wiki-root">
        {/* En-tête de navigation moderne */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b shadow-sm sticky top-0 z-10">
          <div className="flex items-center space-x-4">
            <Link to="/wiki" className="text-xl font-bold text-indigo-700 flex items-center">
              <span className="mr-2">📚</span> Wiki Collaboratif
            </Link>
          </div>

          <div className="flex items-center space-x-4 flex-grow max-w-2xl mx-8">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="Rechercher dans le wiki..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate("/wiki/dashboard")}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center"
            >
              <span className="mr-2">📊</span> Dashboard
            </button>
            <button
              onClick={handleNewPage}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center shadow-sm"
            >
              <span className="mr-2">➕</span> Nouvelle Page
            </button>
          </div>
        </div>

        <div className="flex flex-grow overflow-hidden relative">
          {/* Sidebar de navigation */}
          <div
            style={{ width: `${sidebarWidth}px` }}
            className="bg-white border-r flex flex-col flex-shrink-0 relative transition-all duration-75"
          >
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <div className="flex space-x-2">
                <select
                  className="text-xs border rounded px-2 py-1 bg-white outline-none"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="updated-desc">Récents</option>
                  <option value="title-asc">A-Z</option>
                  <option value="title-desc">Z-A</option>
                  <option value="created-desc">Nouveaux</option>
                </select>
                <div className="flex border rounded overflow-hidden">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-1 ${viewMode === "grid" ? "bg-indigo-100 text-indigo-700" : "bg-white text-gray-400"}`}
                    title="Grille"
                  >
                    🔳
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-1 ${viewMode === "list" ? "bg-indigo-100 text-indigo-700" : "bg-white text-gray-400"}`}
                    title="Liste"
                  >
                    📄
                  </button>
                </div>
              </div>
              <span className="text-xs text-gray-500 font-medium">
                {filteredAndSortedPages.length} pages
              </span>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar">
              {viewMode === "grid" ? (
                <div className="p-3 grid grid-cols-1 gap-3">
                  {filteredAndSortedPages.map((page) => (
                    <div
                      key={page.id}
                      onClick={() => handlePageClick(page.slug)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer group hover:shadow-md ${
                        urlSlug === page.slug
                          ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                          : "border-gray-200 hover:border-indigo-300"
                      }`}
                    >
                      <h3
                        className={`font-semibold mb-1 group-hover:text-indigo-700 transition-colors ${
                          urlSlug === page.slug ? "text-indigo-800" : "text-gray-800"
                        }`}
                      >
                        {page.title}
                      </h3>
                      <p className="text-xs text-gray-500 line-clamp-2">
                        {page.content?.replace(/[#*`]/g, "").substring(0, 100)}...
                      </p>
                      <div className="mt-3 flex items-center justify-between text-[10px] text-gray-400 uppercase tracking-wider">
                        <span>{new Date(page.updated_at).toLocaleDateString()}</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-600 font-bold">
                          VOIR →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredAndSortedPages.map((page) => (
                    <div
                      key={page.id}
                      onClick={() => handlePageClick(page.slug)}
                      className={`px-4 py-3 cursor-pointer hover:bg-indigo-50 transition-colors flex items-center justify-between group ${
                        urlSlug === page.slug ? "bg-indigo-50 border-l-4 border-indigo-500" : ""
                      }`}
                    >
                      <div className="flex flex-col overflow-hidden">
                        <span
                          className={`font-medium truncate ${urlSlug === page.slug ? "text-indigo-700" : "text-gray-700"}`}
                        >
                          {page.title}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          Mis à jour le {new Date(page.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="text-gray-300 group-hover:text-indigo-400 transition-colors">
                        ›
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Handle de redimensionnement */}
            <div
              onMouseDown={startResizing}
              className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 transition-colors z-20 ${
                isResizing ? "bg-indigo-500 w-1.5" : "bg-transparent"
              }`}
            />
          </div>

          {/* Zone de contenu principale */}
          <div className="flex-grow overflow-y-auto bg-white relative scroll-smooth custom-scrollbar">
            {activePage ? (
              <div className="max-w-4xl mx-auto px-8 py-12">
                <div className="mb-10 flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2 text-xs text-indigo-600 font-bold uppercase tracking-widest mb-2">
                      <Link to="/wiki" className="hover:underline">
                        Wiki
                      </Link>
                      <span>/</span>
                      <span className="text-gray-400">{activePage.slug}</span>
                    </div>
                    <h1 className="text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">
                      {activePage.title}
                    </h1>
                  </div>

                  <div className="flex space-x-3 self-start mt-4">
                    <button
                      onClick={() => setIsShareModalOpen(true)}
                      className="p-3 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all border border-transparent hover:border-indigo-100"
                      title="Partager"
                    >
                      🔗
                    </button>
                    <button
                      onClick={() => navigate(`/wiki/${activePage.slug}/edit`)}
                      className="px-6 py-2.5 bg-white border-2 border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all font-bold shadow-sm"
                    >
                      Modifier la page
                    </button>
                  </div>
                </div>

                <div className="prose prose-indigo prose-lg max-w-none wiki-content">
                  <MarkdownViewer content={activePage.content} />
                </div>

                <div className="mt-16 pt-8 border-t flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center">
                    <span className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mr-3 font-bold">
                      👤
                    </span>
                    <span>
                      Dernière modification le{" "}
                      {new Date(activePage.updated_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <button className="hover:text-indigo-600">Signaler</button>
                    <button className="hover:text-indigo-600">Historique</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                <div className="w-32 h-32 bg-indigo-50 rounded-full flex items-center justify-center text-6xl mb-8 animate-pulse">
                  📖
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Bienvenue sur le Wiki</h2>
                <p className="text-gray-500 max-w-md text-lg leading-relaxed">
                  Sélectionnez une page dans la liste à gauche pour commencer votre lecture, ou
                  créez une nouvelle page pour partager vos connaissances.
                </p>
                <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
                  <div className="p-6 border rounded-2xl hover:border-indigo-500 hover:shadow-lg transition-all cursor-pointer group">
                    <span className="text-3xl mb-4 block">🆕</span>
                    <h3 className="font-bold text-gray-900 group-hover:text-indigo-600">Nouveau</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Créer une nouvelle page de documentation
                    </p>
                  </div>
                  <div className="p-6 border rounded-2xl hover:border-indigo-500 hover:shadow-lg transition-all cursor-pointer group">
                    <span className="text-3xl mb-4 block">🔎</span>
                    <h3 className="font-bold text-gray-900 group-hover:text-indigo-600">Aide</h3>
                    <p className="text-sm text-gray-500 mt-1">Apprendre à utiliser le wiki</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title={activePage?.title}
        url={window.location.href}
      />
    </ErrorBoundary>
  );
}
