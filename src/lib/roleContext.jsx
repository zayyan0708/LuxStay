/**
 * Role Context — simulates the Auth Service role system.
 *
 * GO_API INTEGRATION NOTE:
 * Replace the mock login logic below with calls to:
 *   POST http://localhost:8081/auth/login  { username, password }
 * which returns: { token, user: { id, name, role, room_number } }
 *
 * Then store the token and replace useRole() consumers to read from
 * the real authenticated user object.
 */
import React, { createContext, useContext, useState } from 'react';

const RoleContext = createContext(null);

// GO_API: These demo users simulate what the Go Auth Service would return.
// In production, these come from POST /auth/login response.
export const DEMO_USERS = [
  { id: 'u1',                      name: 'James Wilson',   role: 'admin',  room_number: null,   avatar: 'JW' },
  // GO_API: staff IDs come from Auth Service user records — these match StaffMember entity ids
  { id: '6a2968b6a21deb4b56551654', name: 'Maria Garcia',   role: 'staff',  room_number: null,   specialty: 'plumbing',   avatar: 'MG' },
  { id: '6a2968b6a21deb4b56551655', name: 'David Chen',     role: 'staff',  room_number: null,   specialty: 'electrical', avatar: 'DC' },
  { id: '6a2968b6a21deb4b56551656', name: 'Sarah Johnson',  role: 'staff',  room_number: null,   specialty: 'hvac',       avatar: 'SJ' },
  { id: 'u5', name: 'Guest Room 101', role: 'guest',  room_number: '101',  avatar: 'G1' },
  { id: 'u6', name: 'Guest Room 205', role: 'guest',  room_number: '205',  avatar: 'G2' },
  { id: 'u7', name: 'Guest Room 312', role: 'guest',  room_number: '312',  avatar: 'G3' },
];

export function RoleProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(DEMO_USERS[0]);

  // GO_API: Replace this with actual POST /auth/login call
  const login = (userId) => {
    const user = DEMO_USERS.find(u => u.id === userId);
    if (user) setCurrentUser(user);
  };

  const logout = () => setCurrentUser(DEMO_USERS[0]);

  return (
    <RoleContext.Provider value={{ currentUser, login, logout, DEMO_USERS }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}