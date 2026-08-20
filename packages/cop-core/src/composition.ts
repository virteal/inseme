import { CognitivePacket, PacketYield, IthacaTarget } from "./packet.js";

export interface CopForkParams {
  id?: string;
  kind: string;
  intent: string;
  routeTo?: string;
  requiredCapability?: string;
  payload: Record<string, unknown>;
  ithaca?: IthacaTarget;
  spawnReason?: string;
}

export interface CopCompositionResult<T = unknown> {
  ok: boolean;
  status: "completed" | "cancelled" | "failed" | "timeout";
  yields: PacketYield[];
  winnerPacketId?: string;
  winningYield?: PacketYield;
  combinedYield?: T;
  error?: string;
  elapsedMs: number;
}
