import React, { createContext, useContext, useEffect, useState } from "react";

const RoleContext = createContext(null);

export const DEMO_USERS = [
  { id: "u1", name: "James Wilson", email: "admin@luxstay.local", role: "admin", room_number: null, avatar: "JW" },
  { id: "6a2968b6a21deb4b56551654", name: "Maria Garcia", email: "maria@luxstay.local", role: "staff", room_number: null, specialty: "plumbing", avatar: "MG" },
  { id: "6a2968b6a21deb4b56551655", name: "David Chen", email: "david@luxstay.local", role: "staff", room_number: null, specialty: "electrical", avatar: "DC" },
  { id: "6a2968b6a21deb4b56551656", name: "Sarah Johnson", email: "sarah@luxstay.local", role: "staff", room_number: null, specialty: "hvac", avatar: "SJ" },
  { id: "u5", name: "Guest Room 101", email: "guest101@luxstay.local", role: "guest", room_number: "101", avatar: "G1" },
  { id: "u6", name: "Guest Room 205", email: "guest205@luxstay.local", role: "guest", room_number: "205", avatar: "G2" }
];

function readAuthUser() {
  const raw = localStorage.getItem("luxstay_auth_user");
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function RoleProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => readAuthUser() || DEMO_USERS[0]);

  useEffect(() => {
    const handler = (event) => {
      setCurrentUser(event.detail || readAuthUser() || DEMO_USERS[0]);
    };

    window.addEventListener("luxstay-auth-changed", handler);

    return () => {
      window.removeEventListener("luxstay-auth-changed", handler);
    };
  }, []);

  const login = (userId) => {
    const user = DEMO_USERS.find((u) => u.id === userId);
    if (!user) return;

    localStorage.setItem("luxstay_auth_user", JSON.stringify(user));
    localStorage.setItem("luxstay_auth_token", `local-token-${user.id}`);
    setCurrentUser(user);
    window.dispatchEvent(new CustomEvent("luxstay-auth-changed", { detail: user }));
  };

  const logout = () => {
    localStorage.removeItem("luxstay_auth_user");
    localStorage.removeItem("luxstay_auth_token");
    setCurrentUser(DEMO_USERS[0]);
    window.dispatchEvent(new CustomEvent("luxstay-auth-changed", { detail: null }));
  };

  return (
    <RoleContext.Provider value={{ currentUser, login, logout, DEMO_USERS }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}