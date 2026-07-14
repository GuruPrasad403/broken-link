/**
 * Simple in-memory event bus for streaming crawl logs per job.
 * Uses Server-Sent Events (SSE) to push logs to connected UI clients.
 *
 * IMPORTANT: All jobId values are coerced to String so that Mongoose
 * ObjectId instances and plain string route params map to the same key.
 */

// Map of jobId(string) -> array of SSE response objects
const listeners = new Map();

// Map of jobId(string) -> buffered log entries (so late connections get history)
const logBuffer = new Map();
const MAX_BUFFER = 500;

export const registerListener = (jobId, res) => {
  const key = String(jobId);
  if (!listeners.has(key)) listeners.set(key, []);
  listeners.get(key).push(res);

  // Send buffered history to the new connection immediately
  const history = logBuffer.get(key) || [];
  for (const entry of history) {
    try { res.write(`data: ${JSON.stringify(entry)}\n\n`); } catch (_) {}
  }
};

export const removeListener = (jobId, res) => {
  const key = String(jobId);
  const list = listeners.get(key) || [];
  const updated = list.filter(r => r !== res);
  if (updated.length === 0) listeners.delete(key);
  else listeners.set(key, updated);
};

export const emitLog = (jobId, type, message, url = null, status = null) => {
  const key = String(jobId);

  const entry = {
    t: Date.now(),
    type,    // 'page' | 'css' | 'js' | 'link' | 'ok' | 'broken' | 'skip' | 'info' | 'error'
    message,
    url,
    status
  };

  // Buffer the entry
  if (!logBuffer.has(key)) logBuffer.set(key, []);
  const buf = logBuffer.get(key);
  buf.push(entry);
  if (buf.length > MAX_BUFFER) buf.shift();

  // Broadcast to all connected SSE clients for this job
  const list = listeners.get(key) || [];
  const payload = `data: ${JSON.stringify(entry)}\n\n`;
  for (const res of list) {
    try { res.write(payload); } catch (_) { /* client disconnected */ }
  }
};

export const clearJobLogs = (jobId) => {
  const key = String(jobId);
  logBuffer.delete(key);
  // Don't delete listeners — they stay connected and will get new events
};
