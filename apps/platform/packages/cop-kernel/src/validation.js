// File: packages/cop-kernel/src/validation.js
// Description: Minimal structural validation for COP_MESSAGE and COP_EVENT.

import { COP_VERSION } from "./message.js";

export function validateCopMessage(msg) {
  if (!msg || typeof msg !== "object") {
    throw new Error("validateCopMessage: message must be an object");
  }

  if (!msg.cop_version) {
    throw new Error("validateCopMessage: missing cop_version");
  }
  if (!String(msg.cop_version).startsWith("0.2")) {
    throw new Error("validateCopMessage: unsupported cop_version: " + msg.cop_version);
  }

  if (!msg.message_id) {
    throw new Error("validateCopMessage: missing message_id");
  }
  if (!msg.from) {
    throw new Error("validateCopMessage: missing from");
  }
  if (!msg.to) {
    throw new Error("validateCopMessage: missing to");
  }
  if (!msg.intent) {
    throw new Error("validateCopMessage: missing intent");
  }

  // payload, channel, metadata, auth: optional, no strict typing here
  return true;
}

export function validateCopEvent(ev) {
  if (!ev || typeof ev !== "object") {
    throw new Error("validateCopEvent: event must be an object");
  }

  if (!ev.cop_version) {
    throw new Error("validateCopEvent: missing cop_version");
  }
  if (!String(ev.cop_version).startsWith("0.2")) {
    throw new Error("validateCopEvent: unsupported cop_version: " + ev.cop_version);
  }

  if (!ev.event_id) {
    throw new Error("validateCopEvent: missing event_id");
  }
  if (!ev.from) {
    throw new Error("validateCopEvent: missing from");
  }
  if (!ev.channel) {
    throw new Error("validateCopEvent: missing channel");
  }
  if (!ev.event_type) {
    throw new Error("validateCopEvent: missing event_type");
  }

  return true;
}
