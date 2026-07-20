// Generated from ../schema/cop-packet-kernel.schema.json.
// Experimental and non-normative. Do not edit by hand.
export type Identifier = string;

export type NonEmptyString = string;

export type StringSet = string[];

export interface MissionRef {
  "missionId": Identifier;
  "version": number;
}

export interface ReturnPolicy {
  "trigger": NonEmptyString;
  "recipientId": Identifier;
  "mode": "physical" | "logical" | "either";
  "threshold"?: number;
  "destination"?: NonEmptyString;
}

export interface Mission {
  "missionId": Identifier;
  "version": number;
  "previousVersion"?: number;
  "changedByControlPacketId"?: Identifier;
  "statement": NonEmptyString;
  "successCriteria": NonEmptyString[];
  "returnPolicy": ReturnPolicy;
  "status": "active" | "satisfied" | "failed" | "superseded";
}

export interface Mandate {
  "mandateId": Identifier;
  "principalId": Identifier;
  "granteeId": Identifier;
  "missionIds": Identifier[];
  "allowedCapabilities": StringSet;
  "allowedActions": Array<"accept" | "process" | "continue" | "return" | "control" | "transfer-custody" | "record-testimony">;
  "canDelegate": boolean;
  "issuedAt": NonEmptyString;
  "expiresAt"?: NonEmptyString;
}

export interface ReferencedContent {
  "mode": "reference";
  "uri": NonEmptyString;
  "mediaType": NonEmptyString;
  "digest"?: NonEmptyString;
  "accessibleToHandlers": boolean;
}

export interface EmbeddedContent {
  "mode": "embedded";
  "value": Record<string, unknown>;
  "mediaType": NonEmptyString;
  "digest"?: NonEmptyString;
  "accessibleToHandlers": boolean;
}

export interface PhysicalContent {
  "mode": "physical";
  "carrierId": Identifier;
  "mediaType": NonEmptyString;
  "accessibleToHandlers": boolean;
}

export type ContentRef = ReferencedContent | EmbeddedContent | PhysicalContent;

export interface PacketEnvelope {
  "missionId": Identifier;
  "missionVersion": number;
  "mandateId": Identifier;
  "kind": "work" | "control" | "return";
  "requiredCapabilities": StringSet;
  "contentClass": NonEmptyString;
  "hopLimit": number;
}

export interface ContinuationContext {
  "stateRef": ContentRef;
  "accessibleToNextHandler": boolean;
}

export interface ControlEffect {
  "fromVersion": number;
  "toVersion": number;
  "conditionsObserved": StringSet;
}

export interface Packet {
  "packetId": Identifier;
  "lineageId": Identifier;
  "mission": MissionRef;
  "kind": "work" | "control" | "return";
  "relation": "emit" | "continue" | "copy" | "fork" | "replica" | "control" | "return";
  "parentPacketIds": Identifier[];
  "correlationId": Identifier;
  "envelope": PacketEnvelope;
  "content": ContentRef;
  "continuation"?: ContinuationContext;
  "control"?: ControlEffect;
  "emittedAt": NonEmptyString;
  "emitterId": Identifier;
}

export interface ReturnDisposition {
  "status": "forwarded" | "delivered" | "failed";
  "recipientId": Identifier;
  "mode": "physical" | "logical";
}

export interface Outcome {
  "outcomeId": Identifier;
  "packetId": Identifier;
  "handlerId": Identifier;
  "mandateId": Identifier;
  "disposition": "refused" | "accepted" | "partial" | "continued" | "returned" | "completed" | "timed-out";
  "usedCapabilities": StringSet;
  "producedPacketIds": Identifier[];
  "traceRef": NonEmptyString;
  "returnDisposition"?: ReturnDisposition;
  "recordedAt": NonEmptyString;
  "reason"?: NonEmptyString;
}

export interface RoutingDecision {
  "decisionId": Identifier;
  "packetId": Identifier;
  "nodeId": Identifier;
  "advertisedCapabilities": StringSet;
  "mandateId": Identifier;
  "payloadInspected": boolean;
  "disposition": "offered" | "accepted" | "refused" | "timed-out" | "fallback";
  "nextNodeId"?: Identifier;
  "observedAt": NonEmptyString;
}

export interface CustodyTransition {
  "transitionId": Identifier;
  "carrierId": Identifier;
  "packetId": Identifier;
  "fromCustodianId": Identifier;
  "toCustodianId": Identifier;
  "relation": "transfer" | "return";
  "evidenceRef": NonEmptyString;
  "observedAt": NonEmptyString;
}

export interface ExpectedEvidence {
  "valid": true;
  "executableLaws": StringSet;
  "openQuestions": StringSet;
}

export interface ScenarioVector {
  "schemaVersion": "0.1.0-experimental";
  "scenario": "immortelle-bottle" | "cli-llm-continuation" | "intermittent-fractanet-node";
  "description": NonEmptyString;
  "missions": Mission[];
  "mandates": Mandate[];
  "packets": Packet[];
  "outcomes": Outcome[];
  "routingDecisions": RoutingDecision[];
  "custodyTransitions": CustodyTransition[];
  "expected": ExpectedEvidence;
}
