import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, PanelLeftClose, X } from "lucide-react";
import { BrandMark, Wordmark } from "./BrandMark";
import type { NavSection } from "./nav";

const STORAGE_KEY = "reflow.sidebar.collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

interface Props {
  nav: NavSection[];
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  sidebarFoot?: ReactNode;
  children: ReactNode;
}

export function AppShell({ nav, title, subtitle, actions, sidebarFoot, children }: Props) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* private mode */
    }
  }, [collapsed]);

  // Close the drawer on navigation and on Escape.
  useEffect(() => setMobileOpen(false), [location.pathname, location.hash]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="shell" data-collapsed={collapsed} data-mobile-open={mobileOpen}>
      <aside className="sidebar" aria-label="Primary">
        <div className="sidebar-head">
          <Link to="/" className="sidebar-brand" aria-label="ReFlow home">
            <BrandMark size={30} />
            <span className="sidebar-brand-text">
              <strong><Wordmark /></strong>
              <span>Treated water network</span>
            </span>
          </Link>
          <button
            type="button"
            className="collapse-btn"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeftClose size={17} />
          </button>
          <button type="button" className="collapse-btn menu-close" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X size={17} />
          </button>
        </div>

        <nav>
          {nav.map((section) => (
            <div className="nav-section" key={section.label}>
              <div className="nav-label">{section.label}</div>
              <div className="nav-list">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const inner = (
                    <>
                      <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                      <span className="nav-text">{item.label}</span>
                    </>
                  );
                  return item.spa ? (
                    <NavLink key={item.href} to={item.href} end className="nav-item" data-tip={item.label}>
                      {inner}
                    </NavLink>
                  ) : (
                    <a key={item.href} href={item.href} className="nav-item" data-tip={item.label}>
                      {inner}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {sidebarFoot && <div className="sidebar-foot">{sidebarFoot}</div>}
      </aside>

      <div className="scrim" onClick={() => setMobileOpen(false)} aria-hidden="true" />

      <div className="main">
        <header className="topbar">
          <button type="button" className="btn btn-ghost btn-icon menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu size={18} />
          </button>
          <div className="topbar-title">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="topbar-actions">{actions}</div>
        </header>
        {children}
      </div>
    </div>
  );
}
