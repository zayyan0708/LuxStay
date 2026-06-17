/**
 * ============================================================
 * GO BACKEND API CONFIGURATION
 * ============================================================
 * This file centralizes all Go microservice endpoints.
 * Replace BASE_URLS with your actual deployed service addresses.
 *
 * SERVICES:
 *   1. Gateway Service  → handles tickets, chat, SSE, auth proxy
 *   2. Auth Service     → login, role management, room auth
 *   3. Notifier Service → MQTT event log REST endpoint
 *
 * HOW TO USE:
 *   import { GO_API, goFetch } from '@/lib/goApiConfig';
 *   const data = await goFetch(GO_API.AUTH.LOGIN, { method:'POST', body: {...} });
 * ============================================================
 */

// ── Base URLs ────────────────────────────────────────────────
// GO_API: Replace these with your actual Go service addresses
export const GO_SERVICE_URLS = {
  GATEWAY:  'http://localhost:8080',   // GO_API: Gateway service (main REST + SSE)
  AUTH:     'http://localhost:8081',   // GO_API: Auth service
  NOTIFIER: 'http://localhost:8082',   // GO_API: Notifier service (MQTT subscriber)
};

// ── Endpoint Map ─────────────────────────────────────────────
export const GO_API = {

  // ── Auth Service (port 8081) ─────────────────────────────
  AUTH: {
    LOGIN:        `${GO_SERVICE_URLS.AUTH}/auth/login`,         // POST { username, password }
    LOGOUT:       `${GO_SERVICE_URLS.AUTH}/auth/logout`,        // POST
    ME:           `${GO_SERVICE_URLS.AUTH}/auth/me`,            // GET  → { id, name, role, room_number }
    VERIFY_ROOM:  `${GO_SERVICE_URLS.AUTH}/auth/verify-room`,   // POST { token, room_number }
    // Response shape: { token: string, user: { id, name, role, room_number } }
  },

  // ── Gateway Service — Tickets (port 8080) ────────────────
  TICKETS: {
    LIST:         `${GO_SERVICE_URLS.GATEWAY}/api/tickets`,             // GET  → Ticket[]
    CREATE:       `${GO_SERVICE_URLS.GATEWAY}/api/tickets`,             // POST Ticket body
    GET:          (id) => `${GO_SERVICE_URLS.GATEWAY}/api/tickets/${id}`, // GET
    UPDATE:       (id) => `${GO_SERVICE_URLS.GATEWAY}/api/tickets/${id}`, // PUT
    ASSIGN:       (id) => `${GO_SERVICE_URLS.GATEWAY}/api/tickets/${id}/assign`, // PATCH { staff_id, staff_name }
    STATUS:       (id) => `${GO_SERVICE_URLS.GATEWAY}/api/tickets/${id}/status`, // PATCH { status: 'OPEN'|'IN_PROGRESS'|'RESOLVED' }
    BY_ROOM:      (room) => `${GO_SERVICE_URLS.GATEWAY}/api/tickets?room=${room}`, // GET (guest view)
    BY_STAFF:     (staffId) => `${GO_SERVICE_URLS.GATEWAY}/api/tickets?assigned_to=${staffId}`, // GET (staff view)
    // MQTT topic published on create:  hotel/tickets/created
    // MQTT topic published on assign:  hotel/tickets/assigned
    // MQTT topic published on update:  hotel/tickets/status_updated
  },

  // ── Gateway Service — Chat (port 8080) ───────────────────
  CHAT: {
    MESSAGES:     (ticketId) => `${GO_SERVICE_URLS.GATEWAY}/api/tickets/${ticketId}/chat`,  // GET → ChatMessage[]
    SEND:         (ticketId) => `${GO_SERVICE_URLS.GATEWAY}/api/tickets/${ticketId}/chat`,  // POST { content }
    // MQTT topic published on send:  hotel/chat/{ticketId}
  },

  // ── Gateway Service — SSE (port 8080) ────────────────────
  SSE: {
    // GO_API: Connect to this endpoint for real-time Server-Sent Events
    // The gateway bridges MQTT events → SSE for the browser
    // Event types: ticket_created | ticket_assigned | status_updated | chat_message
    STREAM:       `${GO_SERVICE_URLS.GATEWAY}/api/events/stream`,  // GET (EventSource)
    // Usage in React:
    //   const es = new EventSource(GO_API.SSE.STREAM, { withCredentials: true });
    //   es.addEventListener('ticket_created', (e) => { ... JSON.parse(e.data) ... });
    //   es.addEventListener('status_updated', (e) => { ... });
    //   return () => es.close();
  },

  // ── Notifier Service — Event Log (port 8082) ─────────────
  NOTIFIER: {
    EVENTS:       `${GO_SERVICE_URLS.NOTIFIER}/notifier/events`,   // GET → last N events
    HEALTH:       `${GO_SERVICE_URLS.NOTIFIER}/notifier/health`,   // GET → { status, subscribed_topics[] }
    // This service independently subscribes to MQTT and keeps an in-memory buffer
    // Topics subscribed: hotel/tickets/#  and  hotel/chat/#
  },

  // ── Gateway Service — Staff (port 8080) ──────────────────
  STAFF: {
    LIST:         `${GO_SERVICE_URLS.GATEWAY}/api/staff`,          // GET → StaffMember[]
    CREATE:       `${GO_SERVICE_URLS.GATEWAY}/api/staff`,          // POST
    UPDATE:       (id) => `${GO_SERVICE_URLS.GATEWAY}/api/staff/${id}`, // PUT
  },
};

// ── Helper fetch wrapper ─────────────────────────────────────
/**
 * GO_API: Generic fetch helper for Go services.
 * Attach your session token/cookie here once Auth Service is live.
 *
 * @param {string} url
 * @param {RequestInit} options
 */
export async function goFetch(url, options = {}) {
  // GO_API: Uncomment when Auth Service is ready
  // const token = localStorage.getItem('go_session_token');
  const config = {
    headers: {
      'Content-Type': 'application/json',
      // 'Authorization': `Bearer ${token}`,  // GO_API: add auth header
      ...options.headers,
    },
    credentials: 'include',  // GO_API: for session cookies from Go gateway
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  };
  const res = await fetch(url, config);
  if (!res.ok) throw new Error(`Go API error: ${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * GO_API: Connect to the SSE stream from the Gateway service.
 * Call this instead of Base44 real-time subscriptions once Go backend is live.
 *
 * @param {Function} onEvent - callback(eventType, data)
 * @returns {Function} cleanup function
 */
export function connectGoSSE(onEvent) {
  // GO_API: Uncomment when Gateway SSE endpoint is live
  // const es = new EventSource(GO_API.SSE.STREAM, { withCredentials: true });
  // ['ticket_created','ticket_assigned','status_updated','chat_message','ticket_resolved']
  //   .forEach(type => es.addEventListener(type, (e) => onEvent(type, JSON.parse(e.data))));
  // es.onerror = () => console.warn('[SSE] Connection lost, retrying...');
  // return () => es.close();

  console.info('[GO_API] SSE not connected — using Base44 real-time. Connect via GO_API.SSE.STREAM when Go Gateway is running.');
  return () => {};
}