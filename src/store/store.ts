/**
 * Redux Store — Central state management.
 */

import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import interviewReducer from "./interviewSlice";
import { api } from "./api";
// Ensure API endpoint modules are registered at startup
import "./endpoints/codingQuestions";
import "./endpoints/errors";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    interview: interviewReducer,
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefault) => getDefault().concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
