const API_BASE = "/api/cafe";

const api = {
  async createSession(details) {
    const res = await fetch(`${API_BASE}/topics/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async joinSession(topic_id, user_id, display_name, role = "local_phone", guest_id = null) {
    const res = await fetch(`${API_BASE}/topics/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic_id, user_id, display_name, device_role: role, guest_id }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async controlMic(participant_id, action, host_secret = null) {
    const res = await fetch(`${API_BASE}/control/mic`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participant_id, action, host_secret }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async controlPhase(topic_id, action, phase, host_secret = null) {
    const res = await fetch(`${API_BASE}/control/phase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic_id, action, phase, host_secret }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async sendReaction(topic_id, participant_id, reaction_type, utterance_id) {
    const res = await fetch(`${API_BASE}/reaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic_id, participant_id, reaction_type, utterance_id }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async sendUtterance(
    topic_id,
    participant_id,
    text,
    speaker_type = "participant",
    duration_ms = 0,
    speech_type = "speech"
  ) {
    const res = await fetch(`${API_BASE}/utterance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic_id,
        participant_id,
        text,
        speaker_type,
        duration_ms,
        speech_type,
      }), // Pass speech_type
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};

export default api;
