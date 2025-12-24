# app.py – Hugging Face Space Ophélia

import gradio as gr
import requests

API_URL = "https://lepp.fr/api/ophelia"
API_KEY = "dev-demo-key"  # À remplacer en prod


def ask_ophelia(question, history=None):
    payload = {"question": question}
    if history:
        payload["conversation_history"] = history
    try:
        r = requests.post(
            API_URL,
            headers={"Content-Type": "application/json", "x-api-key": API_KEY},
            json=payload,
            timeout=20
        )
        data = r.json()
        return data.get("answer", "[Pas de réponse]"), history + [[question, data.get("answer", "")]]
    except Exception as e:
        return f"[Erreur API: {e}]", history or []


demo = gr.ChatInterface(
    fn=ask_ophelia,
    title="Ophélia (LePP.fr)",
    description="Posez une question sur la vie municipale à Corte, la transparence, ou la Corse. Powered by LePP.fr.",
    examples=[
        ["Quelle est la capitale de la Corse ?"],
        ["Comment assister au prochain conseil municipal ?"]
    ],
    theme="default",
)

demo.launch()
