import axios from 'axios';

// Use sessionStorage so the session persists across page refreshes in the same tab
let sessionId = sessionStorage.getItem('sessionId');
if (!sessionId) {
  sessionId = crypto.randomUUID();
  sessionStorage.setItem('sessionId', sessionId);
}

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'x-session-id': sessionId
  }
});

// Setup beforeunload to cleanup session on server
window.addEventListener('beforeunload', () => {
  const shouldDelete = localStorage.getItem('deleteOnClose') === 'true';
  if (shouldDelete) {
    // Use navigator.sendBeacon for a fire-and-forget request right before the page closes
    // Sending as text/plain avoids CORS preflight issues that block application/json
    const data = JSON.stringify({ sessionId });
    navigator.sendBeacon('http://localhost:5000/api/jobs/cleanup', data);
  }
});

export const getSessionId = () => sessionId;
export default api;
