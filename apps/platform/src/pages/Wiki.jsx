import React, { useState, useEffect, useMemo } from "react";
import { getSupabase } from "../lib/supabase";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link, useParams, useNavigate } from "react-router-dom";
import ErrorBoundary from "../components/common/ErrorBoundary";
import { marked } from "marked";
import DOMPurify from "dompurify";
import ShareModal from "../components/wiki/ShareModal";
import SiteFooter from "../components/layout/SiteFooter";

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

  // Calculer les statistiques
  const stats = useMemo(() => {
    if (pages.length === 0) return null;
    const lastUpdate = pages.reduce((latest, page) => {
      const pageDate = new Date(page.updated_at);
      return pageDate > latest ? pageDate : latest;
    }, new Date(0));

    return {
      totalPages: pages.length,
      lastUpdate: lastUpdate.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    };
  }, [pages]);

  function renderLink({ href, children }) {
    const isInternal = !href.startsWith("http") && !href.startsWith("//");
    if (isInternal) {
      const prefixedHref = `/wiki/${href.replace(/^\//, "")}`;
      return (
        <Link to={prefixedHref} className="text-primary hover:underline">
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
      >
        {children}
      </a>
    );
  }

  const handleShare = () => {
    setIsShareModalOpen(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getContentPreview = (page) => {
    // Always use at most 240 chars, even if summary exists
    const source = page.summary || page.content || "";
    const text = source.replace(/[#*\[\]()]/g, "").trim();
    return text.length > 240 ? text.substring(0, 240) + "..." : text || "Pas de contenu";
  };

  // Gestion du redimensionnement de la sidebar
  const handleMouseDown = (e) => {
    setIsResizing(true);
    e.preventDefault();
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      // compute width directly from viewport X (simple and robust)
      let newWidth = Math.round(e.clientX);
      const min = 240;
      const max = Math.max(320, window.innerWidth - 320);
      if (newWidth < min) newWidth = min;
      if (newWidth > max) newWidth = max;
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing) {
        localStorage.setItem("wiki-sidebar-width", String(sidebarWidth));
      }
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, sidebarWidth]);

  const isWelcomePage = !urlSlug;

  // Reusable style objects
  const styles = {
    container: {
      minHeight: "100vh",
      background: "var(--color-bg-app)",
      display: "flex",
      flexDirection: "column",
    },
    flexRow: {
      display: "flex",
      flexDirection: "row",
      gap: 0,
      flexGrow: 1,
      maxWidth: "100%",
      /* do NOT set fixed height here — allow document scrollbar to drive page scrolling */
    },
    sidebar: {
      minWidth: 240,
      maxWidth: window.innerWidth - 320,
      marginTop: 24,
      marginLeft: 24,
      position: "relative",
      background: "var(--color-surface-secondary)",
      padding: "16px",
      boxSizing: "border-box",
      border: "1px solid var(--color-border-medium)",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      /* allow natural height; no internal full-height scrollbar */
    },
    sidebarTitle: {
      fontWeight: 700,
      fontSize: "1.05em", // slightly smaller to reduce wrap risk
      color: "var(--color-action-primary)",
      marginBottom: "8px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      display: "block",
      maxWidth: "100%",
    },
    splitter: {
      width: 8,
      cursor: "col-resize",
      background: isResizing ? "var(--color-action-primary)" : "transparent",
      display: "flex",
      alignItems: "stretch",
      justifyContent: "center",
      alignSelf: "stretch", // stretch with content height
    },
    splitterBar: {
      width: 2,
      background: "var(--color-border-medium)",
      height: "100%",
    },
    main: {
      flex: 1,
      minWidth: 320,
      /* no internal scrolling; rely on document scrollbar */
      overflow: "visible",
      padding: "24px",
      display: "flex",
      flexDirection: "column",
      gap: "24px",
      background: "var(--color-bg-app)",
      boxSizing: "border-box",
    },
    themeCard: {
      background: "var(--color-surface-secondary)",
      padding: "20px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      border: "1px solid var(--color-border-medium)",
      marginBottom: "12px",
      width: "100%",
      boxSizing: "border-box",
    },
    toolbar: {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      marginBottom: "12px",
      alignItems: "center",
      width: "100%",
    },
    toolbarRow: {
      display: "flex",
      flexDirection: "row",
      gap: "12px",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      flexWrap: "wrap",
    },
    searchInput: {
      width: "100%",
      padding: "8px 12px",
      fontSize: "1em",
      background: "var(--color-bg-app)",
      color: "var(--color-content-primary)",
      marginBottom: "8px",
      boxSizing: "border-box",
    },
    select: {
      padding: "6px 10px",
      border: "1px solid var(--color-border-medium)",
      fontSize: "1em",
      background: "var(--color-bg-app)",
      color: "var(--color-content-primary)",
      marginRight: "8px",
    },
    viewToggle: {
      display: "flex",
      background: "var(--color-surface-tertiary)",
      padding: "2px",
      gap: "2px",
    },
    toolbarButton: {
      padding: "6px 16px",
      fontWeight: 500,
      fontSize: "0.95em",
      background: "none",
      border: "none",
      cursor: "pointer",
      color: "var(--color-content-secondary)",
      transition: "background var(--duration-fast) ease",
    },
    toolbarButtonActive: {
      background: "var(--color-action-primary)",
      color: "var(--color-bg-app)",
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", // limit card width
      gap: "16px",
      width: "100%",
      justifyContent: "center", // center grid content
    },
    gridMd: {
      gridTemplateColumns: "1fr 1fr",
    },
    gridLg: {
      gridTemplateColumns: "1fr 1fr 1fr",
    },
    wikiCard: {
      background: "var(--color-surface-secondary)",
      padding: "16px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      border: "1px solid var(--color-border-medium)",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      textDecoration: "none",
      color: "var(--color-content-primary)",
      transition: "background var(--duration-fast) ease",
      cursor: "pointer",
      maxWidth: "320px", // limit card width
      margin: "0 auto", // center card in grid cell
      minHeight: "220px", // add this line for uniform height
      justifyContent: "space-between", // ensures footer stays at bottom
    },
    wikiCardTitle: {
      fontWeight: 600,
      fontSize: "1.1em",
      color: "var(--color-content-primary)",
      marginBottom: "4px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    wikiCardPreview: {
      fontSize: "0.95em",
      color: "var(--color-content-secondary)",
      marginBottom: "8px",
    },
    wikiCardFooter: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      fontSize: "0.85em",
      color: "var(--color-content-secondary)",
      borderTop: "1px solid var(--color-border-medium)",
      paddingTop: "6px",
      marginTop: "8px",
    },
    listItem: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "12px 0",
      borderBottom: "1px solid var(--color-border-medium)",
      textDecoration: "none",
      color: "var(--color-content-primary)",
      cursor: "pointer",
    },
    listItemTitle: {
      fontWeight: 600,
      fontSize: "1em",
      color: "var(--color-content-primary)",
      marginBottom: "2px",
    },
    listItemPreview: {
      fontSize: "0.95em",
      color: "var(--color-content-secondary)",
      marginBottom: "2px",
    },
    listItemFooter: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: "2px",
      fontSize: "0.85em",
      color: "var(--color-content-secondary)",
    },
    footer: {
      marginTop: "auto",
      textAlign: "center",
      padding: "24px",
      borderTop: "1px solid var(--color-border-medium)",
      background: "var(--color-bg-app)",
    },
    btn: {
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px 16px",
      fontWeight: 600,
      fontSize: "1em",
      background: "var(--color-action-primary)",
      color: "var(--color-bg-app)",
      border: "none",
      cursor: "pointer",
      textDecoration: "none",
      transition: "background var(--duration-fast) ease",
    },
    btnSecondary: {
      background: "var(--color-action-accent)",
      color: "var(--color-bg-app)",
    },
    btnOutline: {
      background: "transparent",
      color: "var(--color-content-primary)",
      border: "1px solid var(--color-content-primary)",
    },
    markdownContent: {
      fontSize: "1em",
      color: "var(--color-content-primary)",
      lineHeight: 1.6,
      wordBreak: "break-word",
      background: "var(--color-bg-app)",
      padding: "8px",
    },
    errorText: {
      color: "var(--color-content-secondary)",
      fontSize: "1em",
      margin: "12px 0",
    },
    fadeIn: {
      animation: "fadeIn 0.3s",
    },
  };

  return (
    <div style={styles.container}>
      <div
        className="wiki-container-flex-row"
        style={{
          ...styles.flexRow,
        }}
      >
        {/* Sidebar (fixed width via inline style) */}
        <aside
          style={{
            ...styles.sidebar,
            width: sidebarWidth,
            flex: "0 0 auto",
          }}
        >
          <div style={{ marginBottom: "16px" }}>
            <h2 style={styles.sidebarTitle}>Wiki</h2>
            {stats && (
              <div style={styles.sidebarStats}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>
                    {stats.totalPages} {stats.totalPages > 1 ? "pages" : "page"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>Mis à jour le {stats.lastUpdate}</span>
                </div>
              </div>
            )}
          </div>
          <button onClick={handleNewPage} style={styles.btn}>
            <svg
              style={{ width: 20, height: 20 }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Nouvelle page
          </button>
          <div style={styles.sidebarQuick}>
            <h3 style={styles.sidebarQuickTitle}>Accès rapide</h3>
            <ul style={styles.sidebarQuickList}>
              {pages.slice(0, 10).map((page) => (
                <li key={page.id}>
                  <Link to={`/wiki/${page.slug}`} style={styles.sidebarQuickItem}>
                    <span
                      style={{ fontSize: "0.95em", overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                      {page.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Splitter (sibling between aside and main) */}
        <div
          role="separator"
          aria-orientation="vertical"
          style={styles.splitter}
          onMouseDown={handleMouseDown}
          title="Redimensionner la colonne"
        >
          <div style={styles.splitterBar} />
        </div>

        {/* Main Content */}
        <main
          style={{
            ...styles.main,
            marginTop: 24,
            marginRight: 24,
            marginBottom: 24,
          }}
        >
          {editMode ? (
            <div style={styles.themeCard}>
              <h1
                style={{
                  fontWeight: 700,
                  fontSize: "1.2em",
                  color: "var(--color-content-primary)",
                  marginBottom: "8px",
                }}
              >
                {formMode === "edit" ? "Modifier la page" : "Créer une nouvelle page"}
              </h1>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre"
                style={styles.searchInput}
              />
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="Identifiant unique (ex : page-exemple)"
                style={styles.searchInput}
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                placeholder="Contenu de la page..."
                style={{ ...styles.searchInput, fontFamily: "monospace", resize: "none" }}
              ></textarea>
              <div style={{ display: "flex", gap: "12px" }}>
                <button onClick={savePage} style={styles.btn}>
                  Enregistrer
                </button>
                <button
                  onClick={() => {
                    setEditMode(false);
                    setFormMode("view");
                    setEditingPageId(null);
                  }}
                  style={{ ...styles.btn, ...styles.btnSecondary }}
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : activePage ? (
            <div style={styles.themeCard}>
              <h1
                style={{
                  fontWeight: 700,
                  fontSize: "1.3em",
                  color: "var(--color-content-primary)",
                  marginBottom: "16px",
                }}
              >
                {activePage.title}
              </h1>
              {activePage.content && typeof activePage.content === "string" ? (
                <div style={styles.markdownContent}>
                  <ErrorBoundary>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      breaks={true}
                      components={{ a: renderLink }}
                      skipHtml={true}
                    >
                      {activePage.content}
                    </ReactMarkdown>
                  </ErrorBoundary>
                </div>
              ) : (
                <div style={styles.errorText}>Le contenu de cette page est invalide ou vide.</div>
              )}
              <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
                <button onClick={handleShare} style={{ ...styles.btn, ...styles.btnOutline }}>
                  Partager
                </button>
                <button
                  onClick={() => activePage && navigate(`/wiki/${activePage.slug}/edit`)}
                  style={styles.btn}
                >
                  Modifier
                </button>
              </div>
            </div>
          ) : (
            <div style={styles.fadeIn}>
              {/* Toolbar */}
              <div style={styles.toolbar}>
                <div style={styles.toolbarRow}>
                  {/* Search */}
                  <input
                    type="text"
                    placeholder="Rechercher dans les pages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={styles.searchInput}
                  />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    style={styles.select}
                  >
                    <option value="updated-desc">📝 Dernière modification ↓</option>
                    <option value="updated-asc">📝 Dernière modification ↑</option>
                    <option value="title-asc">🔤 Titre A → Z</option>
                    <option value="title-desc">🔤 Titre Z → A</option>
                    <option value="created-desc">✨ Date de création ↓</option>
                    <option value="created-asc">✨ Date de création ↑</option>
                  </select>
                  <div style={styles.viewToggle}>
                    <button
                      onClick={() => setViewMode("grid")}
                      style={
                        viewMode === "grid"
                          ? { ...styles.toolbarButton, ...styles.toolbarButtonActive }
                          : styles.toolbarButton
                      }
                    >
                      Grille
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      style={
                        viewMode === "list"
                          ? { ...styles.toolbarButton, ...styles.toolbarButtonActive }
                          : styles.toolbarButton
                      }
                    >
                      Liste
                    </button>
                  </div>
                </div>
                {searchQuery && (
                  <div
                    style={{
                      marginTop: "8px",
                      fontSize: "0.95em",
                      color: "var(--color-content-secondary)",
                    }}
                  >
                    {filteredAndSortedPages.length} résultat
                    {filteredAndSortedPages.length > 1 ? "s" : ""} trouvé
                    {filteredAndSortedPages.length > 1 ? "s" : ""}
                  </div>
                )}
              </div>
              {/* Pages Display */}
              {filteredAndSortedPages.length === 0 ? (
                <div style={{ ...styles.themeCard, textAlign: "center", padding: "32px" }}>
                  <p
                    style={{
                      color: "var(--color-content-secondary)",
                      fontSize: "1.1em",
                      marginBottom: "8px",
                    }}
                  >
                    {searchQuery ? "Aucune page trouvée" : "Aucune page pour le moment"}
                  </p>
                  <p style={{ color: "var(--color-content-secondary)", fontSize: "0.95em" }}>
                    {searchQuery
                      ? "Essayez avec d'autres mots-clés"
                      : "Créez votre première page pour commencer"}
                  </p>
                </div>
              ) : viewMode === "grid" ? (
                <div
                  style={{
                    ...styles.grid,
                    ...(filteredAndSortedPages.length > 2 ? styles.gridMd : {}),
                    ...(filteredAndSortedPages.length > 5 ? styles.gridLg : {}),
                  }}
                >
                  {filteredAndSortedPages.map((page) => (
                    <Link key={page.id} to={`/wiki/${page.slug}`} style={styles.wikiCard}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "8px",
                        }}
                      >
                        <svg
                          style={{ width: 20, height: 20 }}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <span style={styles.wikiCardTitle}>{page.title}</span>
                      </div>
                      <p style={styles.wikiCardPreview}>{getContentPreview(page)}</p>
                      <div style={styles.wikiCardFooter}>
                        <span>{formatDate(page.updated_at)}</span>
                        <span style={{ color: "var(--color-action-primary)", fontWeight: 600 }}>
                          Voir →
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div style={{ ...styles.themeCard, overflow: "hidden", padding: 0 }}>
                  {filteredAndSortedPages.map((page, index) => (
                    <Link key={page.id} to={`/wiki/${page.slug}`} style={styles.listItem}>
                      <svg
                        style={{ width: 16, height: 16 }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={styles.listItemTitle}>{page.title}</span>
                        <p style={styles.listItemPreview}>{getContentPreview(page)}</p>
                      </div>
                      <div style={styles.listItemFooter}>
                        <span>{formatDate(page.updated_at)}</span>
                        <span style={{ color: "var(--color-action-primary)", fontWeight: 600 }}>
                          Ouvrir →
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
      <SiteFooter />
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        shareUrl={window.location.href}
        shareTitle={activePage?.title || "Wiki"}
      />
    </div>
  );
}
