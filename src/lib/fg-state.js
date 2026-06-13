const pendingFg = new Map();
const stopFlags = new Set();

function setState(jid, data) {
  pendingFg.set(jid, data);
  stopFlags.delete(jid);
  setTimeout(() => pendingFg.delete(jid), 10 * 60 * 1000);
}

function getState(jid) {
  return pendingFg.get(jid) || null;
}

function clearState(jid) {
  pendingFg.delete(jid);
}

function hasState(jid) {
  return pendingFg.has(jid);
}

function requestStop(jid) {
  stopFlags.add(jid);
}

function isStopped(jid) {
  return stopFlags.has(jid);
}

function clearStop(jid) {
  stopFlags.delete(jid);
}

module.exports = { setState, getState, clearState, hasState, requestStop, isStopped, clearStop };
