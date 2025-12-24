// File: packages/cop-kernel/src/address.js
// Description: Helpers to build and parse COP_ADDR (cop://...) and COPCHAN_ADDR (copchan://...).

const COP_ADDR_RE = /^cop:\/\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)$/;
const COP_CHAN_RE = /^copchan:\/\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)$/;

/**
 * Build a COP_ADDR: cop://{networkId}/{nodeId}/{instanceId}/{agentName}
 */
export function mkCopAddr({ networkId, nodeId, instanceId, agentName }) {
  if (!networkId || !nodeId || !instanceId || !agentName) {
    throw new Error("mkCopAddr: missing component(s)");
  }
  return `cop://${networkId}/${nodeId}/${instanceId}/${agentName}`;
}

/**
 * Parse a COP_ADDR string.
 * Returns { networkId, nodeId, instanceId, agentName } or throws on error.
 */
export function parseCopAddr(addr) {
  const m = typeof addr === "string" ? addr.match(COP_ADDR_RE) : null;
  if (!m) {
    throw new Error("parseCopAddr: invalid COP_ADDR: " + addr);
  }
  return {
    networkId: m[1],
    nodeId: m[2],
    instanceId: m[3],
    agentName: m[4],
  };
}

/**
 * Build a COPCHAN_ADDR: copchan://{networkId}/{nodeId}/{instanceId}/{channelId}
 */
export function mkChanAddr({ networkId, nodeId, instanceId, channelId }) {
  if (!networkId || !nodeId || !instanceId || !channelId) {
    throw new Error("mkChanAddr: missing component(s)");
  }
  return `copchan://${networkId}/${nodeId}/${instanceId}/${channelId}`;
}

/**
 * Parse a COPCHAN_ADDR string.
 * Returns { networkId, nodeId, instanceId, channelId } or throws on error.
 */
export function parseChanAddr(addr) {
  const m = typeof addr === "string" ? addr.match(COP_CHAN_RE) : null;
  if (!m) {
    throw new Error("parseChanAddr: invalid COPCHAN_ADDR: " + addr);
  }
  return {
    networkId: m[1],
    nodeId: m[2],
    instanceId: m[3],
    channelId: m[4],
  };
}
