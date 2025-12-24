// profiles/chat/types.ts

import type {
  Event as CoreEvent,
  EventType as CoreEventType,
  Artifact as CoreArtifact,
  TopicStatus,
  TaskStatus,
} from "../../cop-core/src/types";

/** Delivery mode description, usable by higher layers. */
export type DeliveryMode = "sync" | "stream" | "background";

// Event types spécifiques
export type ChatEventType =
  | "user_message"
  | "assistant_reflex"
  | "assistant_update"
  | "topic_update"
  | "task_state_changed"
  | "artifact_created";

// Payloads
export interface UserMessagePayload {
  role: "user";
  content: string;
  channel?: string;
}

export interface AssistantReflexPayload {
  role: "assistant";
  content: string;
  mode?: "stream" | "final" | "partial";
}

export interface AssistantUpdatePayload {
  targetMessageArtifactId: string;
  newContent: string;
}

export interface TopicUpdatePayload {
  title?: string;
  summaryArtifactId?: string;
  newStatus?: TopicStatus;
}

export interface TaskStateChangedPayload {
  taskId: string;
  oldStatus: TaskStatus;
  newStatus: TaskStatus;
}

export interface ArtifactCreatedPayload {
  artifactId: string;
  artifactType: string;
}

export type ChatEventPayload =
  | UserMessagePayload
  | AssistantReflexPayload
  | AssistantUpdatePayload
  | TopicUpdatePayload
  | TaskStateChangedPayload
  | ArtifactCreatedPayload
  | unknown;

// Event spécialisé
export interface ChatEvent extends CoreEvent {
  type: ChatEventType & CoreEventType;
  payload: ChatEventPayload;
}

// Artifacts spécifiques
export type ChatArtifactType =
  | "chat_message"
  | "chat_trace"
  | "llm_call"
  | "system_summary"
  | (string & {});

export interface ChatMessageArtifact extends CoreArtifact {
  type: "chat_message";
  format: "text/plain" | "text/markdown" | "application/json";
  schemaVersion: "cop.chat.message.v0.2";
  payload: {
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    parentMessageId?: string;
  };
}

export interface LlmCallArtifact extends CoreArtifact {
  type: "llm_call";
  format: "application/json";
  schemaVersion: "cop.chat.llm_call.v0.2";
  payload: {
    model: string;
    prompt: string;
    completion: string;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
    params?: Record<string, unknown>;
  };
}

export type ChatArtifact = ChatMessageArtifact | LlmCallArtifact | CoreArtifact;
