"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
  success: (title: string, message?: string, duration?: number) => string;
  error: (title: string, message?: string, duration?: number) => string;
  warning: (title: string, message?: string, duration?: number) => string;
  info: (title: string, message?: string, duration?: number) => string;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastCounter = 0;

function generateId(): string {
  toastCounter += 1;
  return `toast-${toastCounter}-${Date.now()}`;
}

const DEFAULT_DURATION = 5000;

const typeStyles: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: {
    bg: "bg-green-50 dark:bg-green-900/30",
    border: "border-green-400 dark:border-green-600",
    icon: "text-green-500 dark:text-green-400",
  },
  error: {
    bg: "bg-red-50 dark:bg-red-900/30",
    border: "border-red-400 dark:border-red-600",
    icon: "text-red-500 dark:text-red-400",
  },
  warning: {
    bg: "bg-yellow-50 dark:bg-yellow-900/30",
    border: "border-yellow-400 dark:border-yellow-600",
    icon: "text-yellow-500 dark:text-yellow-400",
  },
  info: {
    bg: "bg-blue-50 dark:bg-blue-900/30",
    border: "border-blue-400 dark:border-blue-600",
    icon: "text-blue-500 dark:text-blue-400",
  },
};

const icons: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, "id">): string => {
      const id = generateId();
      const newToast: Toast = { ...toast, id };
      setToasts((prev) => [...prev, newToast]);

      const duration = toast.duration ?? DEFAULT_DURATION;
      if (duration > 0) {
        const timer = setTimeout(() => removeToast(id), duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [removeToast]
  );

  const success = useCallback(
    (title: string, message?: string, duration?: number) =>
      addToast({ type: "success", title, message, duration }),
    [addToast]
  );

  const error = useCallback(
    (title: string, message?: string, duration?: number) =>
      addToast({ type: "error", title, message, duration }),
    [addToast]
  );

  const warning = useCallback(
    (title: string, message?: string, duration?: number) =>
      addToast({ type: "warning", title, message, duration }),
    [addToast]
  );

  const info = useCallback(
    (title: string, message?: string, duration?: number) =>
      addToast({ type: "info", title, message, duration }),
    [addToast]
  );

  const clearAll = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider
      value={{ toasts, addToast, removeToast, success, error, warning, info, clearAll }}
    >
      {children}

      <div
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((toast) => {
          const style = typeStyles[toast.type];
          return (
            <div
              key={toast.id}
              role="alert"
              className={[
                "pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-lg",
                "transition-all duration-300 ease-in-out",
                "animate-in slide-in-from-right-2 fade-in",
                style.bg,
                style.border,
              ].join(" ")}
            >
              <span className={`mt-0.5 text-lg font-bold ${style.icon}`}>
                {icons[toast.type]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {toast.title}
                </p>
                {toast.message && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {toast.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
