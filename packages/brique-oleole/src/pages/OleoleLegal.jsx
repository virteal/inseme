import janaLogo from "../assets/jana.svg";
import { I18nProvider, useI18n } from "../i18n/I18nContext.jsx";
import "../styles/oleole.css";

function documentKind() {
  const path = typeof window === "undefined" ? "" : window.location.pathname;
  if (path.endsWith("/privacy")) return "privacy";
  if (path.endsWith("/terms")) return "terms";
  return "legal";
}

function OleoleLegalInner() {
  const { t, locale } = useI18n();
  const kind = documentKind();
  const content =
    kind === "terms"
      ? [t("legal.terms"), t("legal.termsDetail")]
      : kind === "privacy"
        ? [t("legal.privacy"), t("legal.data")]
        : [t("legal.editor"), t("legal.data"), t("legal.host")];

  return (
    <main className="oleole-legal-page" lang={locale}>
      <header className="oleole-header">
        <a className="oleole-brand" href={`/?lang=${locale}`} aria-label={t("legal.back")}>
          <img className="oleole-brand__mark" src={janaLogo} alt="" />
          <div>
            <h1 className="oleole-brand__title">{t("meta.title")}</h1>
            <p className="oleole-brand__sub">{t("legal.back")}</p>
          </div>
        </a>
      </header>
      <article className="oleole-panel oleole-legal-page__content">
        <h2 className="oleole-panel__title">{t(`legal.${kind}Title`)}</h2>
        {content.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <ul className="oleole-links">
          <li>
            <a href="https://acorsica.org/">{t("legal.association")}</a>
          </li>
          <li>
            <a href="https://github.com/acorsica/gouvernance">{t("legal.governance")}</a>
          </li>
        </ul>
      </article>
    </main>
  );
}

export default function OleoleLegal() {
  return (
    <I18nProvider>
      <OleoleLegalInner />
    </I18nProvider>
  );
}
