import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, CircleCheck, Copy } from "lucide-react";
import { AppShell } from "../../components/AppShell";
import { publicNav } from "../../components/nav";
import { useToast } from "../../lib/toast";
import "./register.css";

export function RegisterShell({ title, subtitle, back, children }: { title: string; subtitle: string; back?: { href: string; label: string }; children: ReactNode }) {
  return (
    <AppShell
      nav={publicNav}
      title={title}
      subtitle={subtitle}
      actions={
        <>
          {back && <a className="btn btn-sm btn-ghost" href={back.href}><ArrowLeft /> {back.label}</a>}
          <a className="btn btn-sm btn-secondary" href="/login">Sign in</a>
        </>
      }
    >
      <main className="page register">{children}</main>
    </AppShell>
  );
}

/** Coloured banner at the top of each registration form. */
export function RegisterHero({ tone, icon: Icon, eyebrow, title, children }: {
  tone: string; icon: LucideIcon; eyebrow: string; title: string; children: ReactNode;
}) {
  return (
    <header className="reg-hero" data-tone={tone}>
      <div className="reg-hero-art" aria-hidden="true">
        <svg viewBox="0 0 400 160" preserveAspectRatio="none">
          <path d="M0 110 C 70 80, 130 140, 200 110 S 330 80, 400 105 V160 H0 Z" fill="rgba(255,255,255,0.10)" />
          <path d="M0 128 C 80 105, 150 150, 220 126 S 340 110, 400 124 V160 H0 Z" fill="rgba(255,255,255,0.12)" />
        </svg>
      </div>
      <span className="reg-hero-icon"><Icon size={22} /></span>
      <div>
        <span className="reg-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
    </header>
  );
}

export function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="reg-section">
      <div className="reg-section-head">
        <span className="reg-step num">{n}</span>
        <div>
          <h3>{title}</h3>
          {hint && <p>{hint}</p>}
        </div>
      </div>
      <div className="reg-section-body">{children}</div>
    </section>
  );
}

export function Field({ label, required, hint, error, children, wide }: {
  label: string; required?: boolean; hint?: string; error?: string | boolean; children: ReactNode; wide?: boolean;
}) {
  return (
    <label className={`field${wide ? " field-wide" : ""}`}>
      <span className="field-label">{label}{required && <span className="req" aria-hidden="true"> *</span>}</span>
      {children}
      {typeof error === "string" && error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Checklist({ items }: { items: { label: string; done: boolean }[] }) {
  const done = items.filter((i) => i.done).length;
  return (
    <div className="checklist">
      <div className="row-between">
        <strong>Progress</strong>
        <span className="num muted">{done}/{items.length}</span>
      </div>
      <div className="meter" aria-hidden="true"><span style={{ width: `${(done / items.length) * 100}%` }} /></div>
      <ul>
        {items.map((i) => (
          <li key={i.label} data-done={i.done}>
            <CircleCheck size={15} /> {i.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SuccessView({ tone, title, idLabel, id, children, actions }: {
  tone: string; title: string; idLabel: string; id: string; children: ReactNode; actions: ReactNode;
}) {
  const toast = useToast();
  return (
    <div className="card reg-success" data-tone={tone}>
      <div className="reg-success-mark"><CircleCheck size={30} /></div>
      <h2>{title}</h2>
      <div className="reg-id">
        <span>{idLabel}</span>
        <strong className="num">{id}</strong>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Copy ID"
          onClick={() => { void navigator.clipboard?.writeText(id).then(() => toast("Copied to clipboard.", "success"), () => {}); }}>
          <Copy size={14} />
        </button>
      </div>
      <div className="reg-success-body">{children}</div>
      <div className="reg-success-actions">{actions}</div>
    </div>
  );
}

export const PHONE_RE = /^[6-9]\d{9}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const digits = (v: string) => v.replace(/\D/g, "");
