"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AuthNotice, type AuthNoticeTone } from "@/components/healthy-life/AuthNotice";

type Toast = {
  id: number;
  message: string;
  tone: AuthNoticeTone;
};

type ToastApi = {
  show: (message: string, tone?: AuthNoticeTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function HlToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);

  const show = useCallback((message: string, tone: AuthNoticeTone = "success") => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message) => show(message, "success"),
      error: (message) => show(message, "error"),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? (
        <AuthNotice
          key={toast.id}
          message={toast.message}
          tone={toast.tone}
          autoHideMs={2800}
          onDismiss={() => setToast(null)}
        />
      ) : null}
    </ToastContext.Provider>
  );
}

export function useHlToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      show: () => {},
      success: () => {},
      error: () => {},
    };
  }
  return ctx;
}
