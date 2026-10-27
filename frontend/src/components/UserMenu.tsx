import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, LayoutGrid, LogOut, Mail, UserRound } from "lucide-react";
import { useSession } from "../lib/session";

export const ROLE_META: Record<string, { label: string; home: string; tone: string }> = {
  demand: { label: "Demand site", home: "/demand", tone: "sky" },
  stp: { label: "Plant operator", home: "/supply", tone: "teal" },
  tanker: { label: "Tanker partner", home: "/tanker", tone: "violet" },
  admin: { label: "Administrator", home: "/admin", tone: "amber" },
};

export function Avatar({ initials, role, size = 30 }: { initials?: string; role?: string; size?: number }) {
  const ok = initials && /^[A-Z]{1,2}$/.test(initials);
  return (
    <span className="avatar" data-tone={ROLE_META[role ?? ""]?.tone} style={{ width: size, height: size, flexBasis: size, fontSize: size * 0.38 }}>
      {ok ? initials : <UserRound size={size * 0.5} />}
    </span>
  );
}

export function UserMenu() {
  const user = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!user) return <div className="skeleton" style={{ width: 120, height: 30, borderRadius: 999 }} />;
  if (!user.logged_in) {
    return <a className="btn btn-sm btn-primary" href="/login">Sign in</a>;
  }

  const meta = ROLE_META[user.role];
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" className="user-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <Avatar initials={user.initials} role={user.role} />
        <span className="user-btn-text">
          <strong>{user.first_name || user.name || "Account"}</strong>
          {meta && <small>{meta.label}</small>}
        </span>
        <ChevronDown size={14} className="muted" />
      </button>
      {open && (
        <div className="menu account-menu" role="menu">
          <div className="account-head">
            <Avatar initials={user.initials} role={user.role} size={44} />
            <div style={{ minWidth: 0 }}>
              <strong>{user.name || "Account"}</strong>
              {user.email && <span className="account-email"><Mail size={12} /> {user.email}</span>}
              {meta && <span className="role-chip" data-tone={meta.tone}>{meta.label}</span>}
            </div>
          </div>
          {meta && (
            <a href={meta.home} role="menuitem">
              <LayoutGrid size={15} /> Dashboard
            </a>
          )}
          <Link to="/profile" role="menuitem" onClick={() => setOpen(false)}>
            <UserRound size={15} /> Profile &amp; account
          </Link>
          <div className="menu-sep" />
          <a href="/logout" role="menuitem" className="danger">
            <LogOut size={15} /> Sign out
          </a>
        </div>
      )}
    </div>
  );
}
