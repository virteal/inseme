import express from "express";
import * as db from "./db.js";

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ ok: true, service: "cop", version: "0.1" });
});

router.get("/topics", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "50");
    const offset = parseInt(req.query.offset || "0");
    const rows = await db.listTopics({ limit, offset });
    res.json({ data: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/topics", async (req, res) => {
  try {
    const { title, description, created_by = null, metadata = {} } = req.body;
    const topic = await db.createTopic({ title, description, created_by, metadata });
    res.status(201).json(topic);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Participants
router.post("/topics/:id/participants", async (req, res) => {
  try {
    const { user_id = null, role = "participant", metadata = {} } = req.body;
    const participant = await db.createParticipant({
      topic_id: req.params.id,
      user_id,
      role,
      metadata,
    });
    res.status(201).json(participant);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/topics/:id", async (req, res) => {
  try {
    const topic = await db.getTopic(req.params.id);
    if (!topic) return res.status(404).json({ error: "Topic not found" });
    res.json(topic);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/topics/:id/events", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "100");
    const offset = parseInt(req.query.offset || "0");
    const type = req.query.type || null;
    const rows = await db.listEvents(req.params.id, { limit, offset, type });
    res.json({ data: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/topics/:id/events", async (req, res) => {
  try {
    const {
      participant_id = null,
      content,
      content_type = "text",
      metadata,
      type = "user_message",
    } = req.body;
    if (!content && type === "user_message")
      return res.status(400).json({ error: "content is required" });
    let ev;
    if (type === "user_message") {
      ev = await db.createUserMessage({
        topic_id: req.params.id,
        participant_id,
        content,
        content_type,
        metadata,
      });
    } else {
      ev = await db.createEvent({
        topic_id: req.params.id,
        type,
        payload: req.body.payload || {},
        meta: metadata,
        created_by: participant_id,
      });
    }
    res.status(201).json(ev);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
