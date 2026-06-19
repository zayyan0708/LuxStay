const DB_KEY = "luxstay_local_db";
const AUTH_KEY = "luxstay_auth_user";
const TOKEN_KEY = "luxstay_auth_token";

const now = () => new Date().toISOString();

const DEMO_USERS = [
  { id: "u1", name: "James Wilson", email: "admin@luxstay.local", password: "admin123", role: "admin", room_number: null, avatar: "JW" },
  { id: "6a2968b6a21deb4b56551654", name: "Maria Garcia", email: "maria@luxstay.local", password: "staff123", role: "staff", room_number: null, specialty: "plumbing", avatar: "MG" },
  { id: "6a2968b6a21deb4b56551655", name: "David Chen", email: "david@luxstay.local", password: "staff123", role: "staff", room_number: null, specialty: "electrical", avatar: "DC" },
  { id: "6a2968b6a21deb4b56551656", name: "Sarah Johnson", email: "sarah@luxstay.local", password: "staff123", role: "staff", room_number: null, specialty: "hvac", avatar: "SJ" },
  { id: "u5", name: "Guest Room 101", email: "guest101@luxstay.local", password: "guest123", role: "guest", room_number: "101", avatar: "G1" },
  { id: "u6", name: "Guest Room 205", email: "guest205@luxstay.local", password: "guest123", role: "guest", room_number: "205", avatar: "G2" }
];

const defaultDb = {
  StaffMember: [
    {
      id: "6a2968b6a21deb4b56551654",
      name: "Maria Garcia",
      employee_id: "EMP-001",
      specialty: "plumbing",
      status: "available",
      active_tickets: 0,
      created_date: now(),
      updated_date: now()
    },
    {
      id: "6a2968b6a21deb4b56551655",
      name: "David Chen",
      employee_id: "EMP-002",
      specialty: "electrical",
      status: "available",
      active_tickets: 0,
      created_date: now(),
      updated_date: now()
    },
    {
      id: "6a2968b6a21deb4b56551656",
      name: "Sarah Johnson",
      employee_id: "EMP-003",
      specialty: "hvac",
      status: "busy",
      active_tickets: 1,
      created_date: now(),
      updated_date: now()
    }
  ],
  Ticket: [
    {
      id: "t1",
      ticket_number: "TKT-100001",
      title: "Wi-Fi not working",
      description: "The internet connection is unstable in the room.",
      category: "wifi",
      priority: "urgent",
      status: "OPEN",
      room_number: "101",
      guest_name: "Guest Room 101",
      assigned_to_id: null,
      assigned_to_name: null,
      created_date: now(),
      updated_date: now()
    },
    {
      id: "t2",
      ticket_number: "TKT-100002",
      title: "Air conditioning issue",
      description: "AC is not cooling properly.",
      category: "ac",
      priority: "medium",
      status: "IN_PROGRESS",
      room_number: "205",
      guest_name: "Guest Room 205",
      assigned_to_id: "6a2968b6a21deb4b56551656",
      assigned_to_name: "Sarah Johnson",
      created_date: now(),
      updated_date: now()
    }
  ],
  ChatMessage: [],
  EventLog: []
};

function readDb() {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) {
    localStorage.setItem(DB_KEY, JSON.stringify(defaultDb));
    return structuredClone(defaultDb);
  }

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.setItem(DB_KEY, JSON.stringify(defaultDb));
    return structuredClone(defaultDb);
  }
}

function writeDb(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function sortRows(rows, sort) {
  if (!sort) return rows;

  const desc = sort.startsWith("-");
  const field = desc ? sort.slice(1) : sort;

  return [...rows].sort((a, b) => {
    const av = a?.[field] ?? "";
    const bv = b?.[field] ?? "";

    if (av < bv) return desc ? 1 : -1;
    if (av > bv) return desc ? -1 : 1;
    return 0;
  });
}

function emit(entityName, event) {
  window.dispatchEvent(
    new CustomEvent(`luxstay:${entityName}`, {
      detail: event
    })
  );
}

function makeEntity(entityName) {
  return {
    async list(sort = "-created_date", limit) {
      const db = readDb();
      const rows = sortRows(db[entityName] || [], sort);
      return typeof limit === "number" ? rows.slice(0, limit) : rows;
    },

    async filter(criteria = {}, sort = "-created_date", limit) {
      const db = readDb();
      const rows = (db[entityName] || []).filter((row) =>
        Object.entries(criteria).every(([key, value]) => row?.[key] === value)
      );

      const sorted = sortRows(rows, sort);
      return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
    },

    async get(id) {
      const db = readDb();
      return (db[entityName] || []).find((row) => row.id === id) || null;
    },

    async create(data) {
      const db = readDb();
      const row = {
        id: data.id || uid(entityName.toLowerCase()),
        ...data,
        created_date: data.created_date || now(),
        updated_date: now()
      };

      db[entityName] = [row, ...(db[entityName] || [])];
      writeDb(db);

      emit(entityName, {
        type: "create",
        id: row.id,
        data: row
      });

      return row;
    },

    async update(id, patch) {
      const db = readDb();
      const rows = db[entityName] || [];
      const index = rows.findIndex((row) => row.id === id);

      if (index === -1) {
        throw new Error(`${entityName} with id ${id} not found`);
      }

      const updated = {
        ...rows[index],
        ...patch,
        updated_date: now()
      };

      rows[index] = updated;
      db[entityName] = rows;
      writeDb(db);

      emit(entityName, {
        type: "update",
        id,
        data: updated
      });

      return updated;
    },

    async delete(id) {
      const db = readDb();
      const rows = db[entityName] || [];
      const existing = rows.find((row) => row.id === id);

      db[entityName] = rows.filter((row) => row.id !== id);
      writeDb(db);

      emit(entityName, {
        type: "delete",
        id,
        data: existing
      });

      return true;
    },

    subscribe(callback) {
      const handler = (event) => callback(event.detail);
      window.addEventListener(`luxstay:${entityName}`, handler);

      return () => {
        window.removeEventListener(`luxstay:${entityName}`, handler);
      };
    }
  };
}

function saveAuthUser(user) {
  const safeUser = { ...user };
  delete safeUser.password;

  localStorage.setItem(AUTH_KEY, JSON.stringify(safeUser));
  localStorage.setItem(TOKEN_KEY, `local-token-${safeUser.id}`);
  window.dispatchEvent(new CustomEvent("luxstay-auth-changed", { detail: safeUser }));

  return safeUser;
}

function getAuthUser() {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getAccounts() {
  const raw = localStorage.getItem("luxstay_accounts");
  const custom = raw ? JSON.parse(raw) : [];
  return [...DEMO_USERS, ...custom];
}

function saveCustomAccount(account) {
  const raw = localStorage.getItem("luxstay_accounts");
  const custom = raw ? JSON.parse(raw) : [];
  localStorage.setItem("luxstay_accounts", JSON.stringify([...custom, account]));
}

export const luxStay = {
  entities: {
    Ticket: makeEntity("Ticket"),
    StaffMember: makeEntity("StaffMember"),
    ChatMessage: makeEntity("ChatMessage"),
    EventLog: makeEntity("EventLog")
  },

  auth: {
    async me() {
      const user = getAuthUser();

      if (!user) {
        throw Object.assign(new Error("Not authenticated"), { status: 401 });
      }

      return user;
    },

    async loginViaEmailPassword(email, password) {
      const account = getAccounts().find(
        (user) =>
          user.email?.toLowerCase() === email.toLowerCase() &&
          user.password === password
      );

      if (!account) {
        throw new Error("Invalid email or password");
      }

      return saveAuthUser(account);
    },

    async register({ email, password }) {
      const exists = getAccounts().some(
        (user) => user.email?.toLowerCase() === email.toLowerCase()
      );

      if (exists) {
        throw new Error("Account already exists");
      }

      const account = {
        id: uid("u"),
        email,
        password,
        name: email.split("@")[0],
        role: "guest",
        room_number: "101",
        avatar: "GU"
      };

      localStorage.setItem("luxstay_pending_account", JSON.stringify(account));
      return { ok: true };
    },

    async verifyOtp({ otpCode }) {
      if (otpCode && otpCode !== "123456") {
        throw new Error("Use demo OTP code 123456");
      }

      const raw = localStorage.getItem("luxstay_pending_account");
      if (!raw) throw new Error("No pending registration found");

      const account = JSON.parse(raw);
      saveCustomAccount(account);
      localStorage.removeItem("luxstay_pending_account");

      const user = saveAuthUser(account);
      return {
        access_token: localStorage.getItem(TOKEN_KEY),
        user
      };
    },

    async resendOtp() {
      return { ok: true };
    },

    async resetPasswordRequest() {
      return { ok: true };
    },

    async resetPassword() {
      return { ok: true };
    },

    setToken(token) {
      localStorage.setItem(TOKEN_KEY, token);
    },

    logout() {
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new CustomEvent("luxstay-auth-changed", { detail: null }));
    },

    redirectToLogin() {
      window.location.href = "/login";
    },

    loginWithProvider() {
      return saveAuthUser(DEMO_USERS[0]);
    }
  }
};