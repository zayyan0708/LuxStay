// frontend/src/lib/roleContext.jsx

import React, { createContext, useContext } from "react";
import { useAuth } from "@/lib/AuthContext";

const RoleContext = createContext(null);

export function RoleProvider({ children }) {
  const { user, logout } = useAuth();

  return (
    <RoleContext.Provider
      value={{
        currentUser: user,
        login: () => {},
        logout,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}