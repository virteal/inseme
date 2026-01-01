import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  substituteVariables,
  getCommonVariables,
  getConfig,
} from "@inseme/cop-host";

/**
 * Composant de rendu Markdown sécurisé et extensible.
 * @param {Object} props
 * @param {string} props.content - Le contenu markdown à afficher.
 * @param {string} props.className - Classes CSS additionnelles.
 * @param {Object} props.components - Composants personnalisés pour react-markdown.
 * @param {boolean} props.breaks - Activer les retours à la ligne automatiques.
 * @param {boolean} props.substitute - Activer la substitution de variables.
 */
export function MarkdownViewer({
  content,
  className = "",
  components = {},
  breaks = true,
  substitute = true,
}) {
  if (!content) return null;

  // Appliquer la substitution si demandée
  let finalContent = content;
  if (substitute) {
    const vars = getCommonVariables(getConfig);
    finalContent = substituteVariables(content, vars);
  }

  const defaultComponents = {
    a: ({ href, children, ...props }) => {
      const isInternal = href && (href.startsWith("/") || href.startsWith("#"));
      return (
        <a
          href={href}
          target={isInternal ? undefined : "_blank"}
          rel={isInternal ? undefined : "noopener noreferrer"}
          {...props}
        >
          {children}
        </a>
      );
    },
    ...components,
  };

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={defaultComponents}
        breaks={breaks}
      >
        {finalContent}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownViewer;
