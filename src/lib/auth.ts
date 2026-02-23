/**
 * Auth & Interview History Utilities
 *
 * Uses localStorage for demo/local persistence.
 * In production, replace with a proper backend + JWT auth.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  name: string;
  email: string;
}

interface StoredUser extends User {
  password: string;
}

export interface InterviewRecord {
  id: string;
  date: string;
  position: string;
  candidateName: string;
  overallScore: number;
  overallPercent: number;
  recommendation: string;
  duration: string;
}

export interface InterviewStats {
  total: number;
  avgScore: number;
  bestScore: number;
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const USERS_KEY = "vocalhireai_users";
const SESSION_KEY = "vocalhireai_session";
const HISTORY_KEY = "vocalhireai_history";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function getUsers(): StoredUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function signup(name: string, email: string, password: string): User {
  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();

  if (!trimmedName) throw new Error("Name is required");
  if (!trimmedEmail) throw new Error("Email is required");
  if (password.length < 6) throw new Error("Password must be at least 6 characters");

  const users = getUsers();
  if (users.some((u) => u.email === trimmedEmail)) {
    throw new Error("An account with this email already exists");
  }

  const newUser: StoredUser = {
    id: `user_${Date.now().toString(36)}`,
    name: trimmedName,
    email: trimmedEmail,
    password,
  };

  users.push(newUser);
  saveUsers(users);

  const user: User = { id: newUser.id, name: newUser.name, email: newUser.email };
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
}

export function login(email: string, password: string): User {
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail) throw new Error("Email is required");
  if (!password) throw new Error("Password is required");

  const users = getUsers();
  const found = users.find(
    (u) => u.email === trimmedEmail && u.password === password,
  );

  if (!found) throw new Error("Invalid email or password");

  const user: User = { id: found.id, name: found.name, email: found.email };
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function getCurrentUser(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Profile management
// ---------------------------------------------------------------------------

export function updateProfile(name: string): User {
  const user = getCurrentUser();
  if (!user) throw new Error("Not logged in");

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");

  const users = getUsers();
  const idx = users.findIndex((u) => u.id === user.id);
  if (idx === -1) throw new Error("User not found");

  users[idx]!.name = trimmed;
  saveUsers(users);

  const updated: User = { ...user, name: trimmed };
  localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
  return updated;
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
): void {
  const user = getCurrentUser();
  if (!user) throw new Error("Not logged in");
  if (!currentPassword) throw new Error("Current password is required");
  if (newPassword.length < 6)
    throw new Error("New password must be at least 6 characters");

  const users = getUsers();
  const idx = users.findIndex((u) => u.id === user.id);
  if (idx === -1) throw new Error("User not found");
  if (users[idx]!.password !== currentPassword)
    throw new Error("Current password is incorrect");

  users[idx]!.password = newPassword;
  saveUsers(users);
}

export function deleteAccount(): void {
  const user = getCurrentUser();
  if (!user) throw new Error("Not logged in");

  const users = getUsers();
  saveUsers(users.filter((u) => u.id !== user.id));
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem("vocalhireai_aptitude");
  localStorage.removeItem("vocalhireai_settings");
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface AppSettings {
  defaultQuestionCount: number;
  defaultDifficulty: "Easy" | "Medium" | "Hard";
}

const SETTINGS_KEY = "vocalhireai_settings";

const DEFAULT_SETTINGS: AppSettings = {
  defaultQuestionCount: 10,
  defaultDifficulty: "Medium",
};

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  return updated;
}

// ---------------------------------------------------------------------------
// Data management
// ---------------------------------------------------------------------------

export function clearInterviewHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

// ---------------------------------------------------------------------------
// Interview History
// ---------------------------------------------------------------------------

export function saveInterviewRecord(record: InterviewRecord): void {
  const records = getInterviewHistory();
  records.unshift(record);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(records));
}

// Full detail storage keyed by record ID
const INTERVIEW_DETAIL_KEY = "vocalhireai_interview_detail";

export function saveInterviewDetail(id: string, detail: unknown): void {
  try {
    const all = JSON.parse(localStorage.getItem(INTERVIEW_DETAIL_KEY) || "{}");
    all[id] = detail;
    localStorage.setItem(INTERVIEW_DETAIL_KEY, JSON.stringify(all));
  } catch { /* quota exceeded — ignore */ }
}

export function getInterviewDetail(id: string): unknown | null {
  try {
    const all = JSON.parse(localStorage.getItem(INTERVIEW_DETAIL_KEY) || "{}");
    return all[id] ?? null;
  } catch { return null; }
}

export function getInterviewHistory(): InterviewRecord[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

export function getInterviewStats(): InterviewStats {
  const records = getInterviewHistory();
  if (records.length === 0) {
    return { total: 0, avgScore: 0, bestScore: 0 };
  }

  const total = records.length;
  const avgScore =
    records.reduce((sum, r) => sum + r.overallScore, 0) / total;
  const bestScore = Math.max(...records.map((r) => r.overallScore));

  return {
    total,
    avgScore: Math.round(avgScore * 10) / 10,
    bestScore: Math.round(bestScore * 10) / 10,
  };
}
