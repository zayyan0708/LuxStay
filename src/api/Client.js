// frontend/src/api/Client.js

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080/api";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch {
      // ignore non-json error
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

function query(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "" && v !== "all") q.set(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const luxStay = {
  auth: {
    me: () => request("/auth/me"),
    loginViaEmailPassword: (email, password) =>
      request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    register: ({ email, password, name, room_number }) =>
      request("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, name, room_number }),
      }),
    logout: () => request("/auth/logout", { method: "POST" }),
  },

  entities: {
    Ticket: {
      list: (_sort = "-created_date", limit = 100) =>
        request(`/tickets${query({ limit })}`),

      filter: (criteria = {}, _sort = "-created_date", limit = 100) =>
        request(`/tickets${query({ ...criteria, limit })}`),

      get: (id) => request(`/tickets/${id}`),

      create: (data) =>
        request("/tickets", {
          method: "POST",
          body: JSON.stringify(data),
        }),

      update: (id, patch) =>
        request(`/tickets/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        }),

      delete: (id) =>
        request(`/tickets/${id}`, {
          method: "DELETE",
        }),

      subscribe(callback) {
        const es = new EventSource(`${API_BASE}/events/stream`, {
          withCredentials: true,
        });

        es.onmessage = (msg) => {
          try {
            const event = JSON.parse(msg.data);
            callback(event);
          } catch {
            // ignore malformed event
          }
        };

        return () => es.close();
      },
    },

    StaffMember: {
      list: () => request("/staff"),
      create: (data) =>
        request("/staff", {
          method: "POST",
          body: JSON.stringify(data),
        }),
      update: (id, patch) =>
        request(`/staff/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        }),
      delete: (id) =>
        request(`/staff/${id}`, {
          method: "DELETE",
        }),
    },

    ChatMessage: {
      filter: (criteria = {}) =>
        request(`/chat${query(criteria)}`),

      create: (data) =>
        request("/chat", {
          method: "POST",
          body: JSON.stringify(data),
        }),

      subscribe(callback) {
        const es = new EventSource(`${API_BASE}/events/stream`, {
          withCredentials: true,
        });

        es.onmessage = (msg) => {
          const event = JSON.parse(msg.data);
          if (event.type === "chat_message") callback(event);
        };

        return () => es.close();
      },
    },

    EventLog: {
      list: () => request("/events"),
    },
  },
};