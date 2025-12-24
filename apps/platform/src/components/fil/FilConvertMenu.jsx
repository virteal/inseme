import { useNavigate } from "react-router-dom";

/**
 * Admin dropdown menu for converting Fil items to other content types.
 *
 * @param {Object} props
 * @param {Object} props.post - The Fil post to convert
 */
export default function FilConvertMenu({ post }) {
  const navigate = useNavigate();

  const metadata = post.metadata || {};
  const filItem = {
    id: post.id,
    title: metadata.title || metadata.external_url || "",
    url: metadata.external_url || "",
    content: post.content || "",
    created_at: post.created_at,
  };

  const handleConvert = (targetType) => {
    const routes = {
      incident: "/incidents/new",
      gazette: "/posts/new",
      wiki: "/wiki/create",
      proposition: "/kudocracy/new",
    };

    const route = routes[targetType];
    if (route) {
      navigate(route, { state: { filItem } });
    }
  };

  const menuStyle = {
    position: "relative",
    display: "inline-block",
  };

  const buttonStyle = {
    padding: "2px 6px",
    fontSize: "0.7rem",
    color: "var(--color-action-accent)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    textDecoration: "underline",
  };

  const dropdownStyle = {
    position: "absolute",
    top: "100%",
    left: 0,
    background: "var(--color-bg-app)",
    border: "1px solid var(--color-border-medium)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    zIndex: 100,
    minWidth: 150,
  };

  const itemStyle = {
    display: "block",
    width: "100%",
    padding: "8px 12px",
    textAlign: "left",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "0.8rem",
    color: "var(--color-content-primary)",
  };

  return (
    <details style={menuStyle}>
      <summary style={buttonStyle}>convertir</summary>
      <div style={dropdownStyle}>
        <button style={itemStyle} onClick={() => handleConvert("incident")}>
          → Incident
        </button>
        <button style={itemStyle} onClick={() => handleConvert("gazette")}>
          → Article Gazette
        </button>
        <button style={itemStyle} onClick={() => handleConvert("wiki")}>
          → Page Wiki
        </button>
        <button style={itemStyle} onClick={() => handleConvert("proposition")}>
          → Proposition
        </button>
      </div>
    </details>
  );
}
