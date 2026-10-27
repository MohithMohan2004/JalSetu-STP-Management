import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";

type Tone = "success" | "danger" | "info";
interface Toast { id: number; tone: Tone; text: string }

const ToastCtx = createContext<(text: string, tone?: Tone) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));
  const push = useCallback((text: string, tone: Tone = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, tone, text }]);
    window.setTimeout(() => dismiss(id), tone === "danger" ? 7000 : 4500);
  }, []);
  const Icon = { success: CircleCheck, danger: CircleAlert, info: Info };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => {
          const I = Icon[t.tone];
          return (
            <div key={t.id} className="toast" data-tone={t.tone}>
              <I size={16} />
              <span>{t.text}</span>
              <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
