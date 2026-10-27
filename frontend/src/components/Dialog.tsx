import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Modal task: dim the page to focus, Escape or scrim click to dismiss. */
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("input, select, textarea, button:not(.dialog-close)");
    first?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className="dialog-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={ref}>
        <header className="dialog-head">
          <h2 id="dialog-title">{title}</h2>
          <button type="button" className="btn btn-ghost btn-sm btn-icon dialog-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <div className="dialog-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
