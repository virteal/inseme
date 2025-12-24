// widget/ophelia-widget.js
// Widget web minimaliste pour intégrer Ophélia sur d'autres sites

(function () {
  const style = document.createElement("style");
  style.textContent = `
    #ophelia-widget {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 340px;
      max-width: 95vw;
      background: #fff;
      box-shadow: 0 4px 24px #0002;
      font-family: sans-serif;
      z-index: 9999;
      overflow: hidden;
      border: 1px solid #eee;
    }
    #ophelia-widget-header {
      background: #2d3748;
      color: #fff;
      padding: 10px 16px;
      font-weight: bold;
      font-size: 1.1em;
    }
    #ophelia-widget-messages {
      min-height: 120px;
      max-height: 260px;
      overflow-y: auto;
      padding: 12px;
      font-size: 1em;
    }
    #ophelia-widget-input {
      display: flex;
      border-top: 1px solid #eee;
      background: #fafbfc;
    }
    #ophelia-widget-input input {
      flex: 1;
      border: none;
      padding: 10px;
      font-size: 1em;
      background: transparent;
      outline: none;
    }
    #ophelia-widget-input button {
      background: #3182ce;
      color: #fff;
      border: none;
      padding: 0 18px;
      font-size: 1em;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);

  const widget = document.createElement("div");
  widget.id = "ophelia-widget";
  widget.innerHTML = `
    <div id="ophelia-widget-header">Ophélia</div>
    <div id="ophelia-widget-messages"></div>
    <form id="ophelia-widget-input">
      <input type="text" placeholder="Posez votre question..." required />
      <button type="submit">Envoyer</button>
    </form>
  `;
  document.body.appendChild(widget);

  const messages = widget.querySelector("#ophelia-widget-messages");
  const form = widget.querySelector("#ophelia-widget-input");
  const input = form.querySelector("input");

  function addMessage(text, from) {
    const msg = document.createElement("div");
    msg.textContent = text;
    msg.style.margin = "8px 0";
    msg.style.textAlign = from === "user" ? "right" : "left";
    msg.style.color = from === "user" ? "#3182ce" : "#222";
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
  }

  async function sendQuestion(q) {
    addMessage(q, "user");
    input.value = "";
    addMessage("…", "bot");
    try {
      const res = await fetch("https://lepp.fr/api/ophelia", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "dev-demo-key",
        },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      messages.lastChild.textContent = data.answer || "[Pas de réponse]";
    } catch (e) {
      messages.lastChild.textContent = "[Erreur de connexion]";
    }
  }

  form.onsubmit = (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) sendQuestion(q);
  };
})();
