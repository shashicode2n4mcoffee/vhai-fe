/**
 * Toast — Centralized toast notification system.
 *
 * Usage:
 *   1. Wrap your app with <ToastProvider>
 *   2. In any component: const toast = useToast();
 *      toast.success("Saved!")
 *      toast.error("Something went wrong")
 *      toast.info("Uploading...")
 *      toast.dismiss(id)       // manually dismiss
 *      toast.loading("Working...")  // persistent until dismissed
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToastType = "success" | "error" | "info" | "loading";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number; // ms, 0 = persistent
}

interface ToastContext {
  toasts: Toast[];
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
  loading: (message: string) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  /** Replace the message/type of an existing toast (e.g. loading → success) */
  update: (id: string, type: ToastType, message: string, duration?: number) => void;
}

const Ctx = createContext<ToastContext | null>(null);

let _idCounter = 0;
function nextId() {
  return `toast_${++_idCounter}_${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Schedule auto-dismiss
  const schedule = useCallback((id: string, duration: number) => {
    if (duration <= 0) return;
    const handle = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, duration);
    timers.current.set(id, handle);
  }, []);

  const push = useCallback(
    (type: ToastType, message: string, duration: number): string => {
      const id = nextId();
      setToasts((prev) => [...prev, { id, type, message, duration }]);
      schedule(id, duration);
      return id;
    },
    [schedule],
  );

  // success/info are silent — only errors are shown as toasts
  const success = useCallback(
    (_msg: string, _dur = 4000) => nextId(),
    [],
  );
  const error = useCallback(
    (msg: string, dur = 5000) => push("error", msg, dur),
    [push],
  );
  const info = useCallback(
    (_msg: string, _dur = 3500) => nextId(),
    [],
  );
  const loading = useCallback(
    (_msg: string) => nextId(),
    [],
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const h = timers.current.get(id);
    if (h) {
      clearTimeout(h);
      timers.current.delete(id);
    }
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
    timers.current.forEach((h) => clearTimeout(h));
    timers.current.clear();
  }, []);

  const update = useCallback(
    (id: string, type: ToastType, message: string, duration = 4000) => {
      // Clear old timer
      const h = timers.current.get(id);
      if (h) {
        clearTimeout(h);
        timers.current.delete(id);
      }
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, type, message, duration } : t)),
      );
      schedule(id, duration);
    },
    [schedule],
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timers.current.forEach((h) => clearTimeout(h));
    };
  }, []);

  return (
    <Ctx.Provider
      value={{ toasts, success, error, info, loading, dismiss, dismissAll, update }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </Ctx.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useToast(): ToastContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Toast container / renderer
// ---------------------------------------------------------------------------

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const [exiting, setExiting] = useState(false);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 280);
  };

  return (
    <div
      className={`toast toast--${toast.type} ${exiting ? "toast--exit" : ""}`}
      role="alert"
    >
      <div className="toast__icon">
        {toast.type === "success" && <IconCheck />}
        {toast.type === "error" && <IconX />}
        {toast.type === "info" && <IconInfo />}
        {toast.type === "loading" && <div className="toast__spinner" />}
      </div>
      <span className="toast__message">{toast.message}</span>
      {toast.type !== "loading" && (
        <button className="toast__close" onClick={handleDismiss} aria-label="Dismiss">
          <IconClose />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
