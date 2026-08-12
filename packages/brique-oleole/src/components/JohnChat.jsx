import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nContext.jsx";
import { localJohnTurn } from "../lib/local-presence.js";

/**
 * John conversational surface for Olé Olé — /api/oleole/chat when available,
 * client-side John turn for early-proto / offline.
 */
export default function JohnChat({
  subjectRef,
  windowKey = "now",
  onMapContext,
  apiBase = "/api/oleole",
}) {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);
  const greetingLocale = useRef(null);

  // Reset greeting when language changes
  useEffect(() => {
    if (greetingLocale.current === locale && messages.length > 0) return;
    greetingLocale.current = locale;
    setMessages([{ role: "john", text: t("john.greeting") }]);
  }, [locale, t]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      let data;
      try {
        const res = await fetch(`${apiBase}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Oleole-Locale": locale,
          },
          body: JSON.stringify({
            message: text,
            window: windowKey,
            lang: locale,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
        if (data.error && !data.message) throw new Error(data.error);
      } catch {
        data = localJohnTurn({
          message: text,
          subject: subjectRef,
          windowKey,
          locale,
        });
      }
      setMessages((m) => [
        ...m,
        {
          role: "john",
          text: data.message || data.error || t("john.noReply"),
          proposal: data.proposal,
        },
      ]);
      if (data.map) onMapContext?.(data.map);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "john", text: t("john.networkError", { error: err.message }) },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="oleole-chat">
      <h2 className="oleole-panel__title">{t("john.title")}</h2>
      <div className="oleole-chat__log" role="log" aria-live="polite">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "oleole-bubble oleole-bubble--user"
                : "oleole-bubble oleole-bubble--john"
            }
          >
            <div className="oleole-bubble__role">
              {m.role === "user" ? t("john.you") : t("john.title")}
            </div>
            <div className="oleole-bubble__text">{m.text}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="oleole-chat__form" onSubmit={send}>
        <input
          className="oleole-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("john.placeholder")}
          aria-label={t("john.inputAria")}
          disabled={busy}
        />
        <button type="submit" className="oleole-btn oleole-btn--primary" disabled={busy}>
          {t("john.send")}
        </button>
      </form>
    </div>
  );
}
