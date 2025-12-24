import { Link } from "react-router-dom";

/**
 * Header de navigation pour les pages du Fil
 * @param {string} activePage - Page active ("guidelines" | "faq" | null)
 */
export default function FilHeader({ activePage = null }) {
  const styles = {
    header: {
      background: "var(--color-action-primary)",
      padding: "4px 8px",
      display: "flex",
      alignItems: "center",
      gap: 8,
    },
    logo: {
      width: 20,
      height: 20,
      border: "1px solid var(--color-bg-app)",
    },
    title: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: "0.9rem",
      color: "var(--color-bg-app)",
      textDecoration: "none",
    },
    navLink: {
      fontSize: "0.75rem",
      color: "var(--color-bg-app)",
      textDecoration: "none",
      marginLeft: 8,
    },
  };

  return (
    <div style={styles.header}>
      <img src="/images/favicon.svg" alt="" style={styles.logo} />
      <Link to="/fil" style={styles.title}>
        Le Fil
      </Link>
      <Link to="/fil/new" style={styles.navLink}>
        soumettre
      </Link>
      <span style={{ flex: 1 }} />
      <Link
        to="/fil/guidelines"
        style={{ ...styles.navLink, fontWeight: activePage === "guidelines" ? 700 : 400 }}
      >
        règles
      </Link>
      <Link
        to="/fil/faq"
        style={{ ...styles.navLink, fontWeight: activePage === "faq" ? 700 : 400 }}
      >
        faq
      </Link>
    </div>
  );
}
