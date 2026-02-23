/**
 * Auth Slice — Manages user session state with backend JWT.
 */

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import { getAccessToken } from "./api";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "HIRING_MANAGER" | "COLLEGE" | "CANDIDATE";
  organizationId: string | null;
  avatarUrl?: string | null;
  collegeRollNumber?: string | null;
  organization?: { id: string; name: string; type: string } | null;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

// Check if we have a token to determine initial auth state
const hasToken = !!getAccessToken();
const storedUser = (() => {
  try {
    const raw = localStorage.getItem("vocalhireai_user");
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
})();

const initialState: AuthState = {
  user: hasToken ? storedUser : null,
  isAuthenticated: hasToken && !!storedUser,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
      state.isAuthenticated = true;
      localStorage.setItem("vocalhireai_user", JSON.stringify(action.payload));
    },
    clearUser(state) {
      state.user = null;
      state.isAuthenticated = false;
      localStorage.removeItem("vocalhireai_user");
    },
  },
});

export const { setUser, clearUser } = authSlice.actions;

// Selectors
export const selectUser = (state: RootState) => state.auth.user;
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated;
export const selectUserRole = (state: RootState) => state.auth.user?.role ?? null;

export default authSlice.reducer;
