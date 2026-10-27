import { ArrowRight, BadgeCheck, Building2, Search, Truck } from "lucide-react";
import { RegisterShell } from "./shared";

export default function TankerChoice() {
  return (
    <RegisterShell title="Tanker partners" subtitle="Join the delivery network" back={{ href: "/", label: "Home" }}>
      <section className="choice-hero">
        <div className="choice-hero-text">
          <span className="eyebrow">Tanker partners</span>
          <h2>Deliver treated water across Bengaluru</h2>
          <p>Get pickup offers from treatment plants near you, follow the optimised route and log every trip — from one dashboard.</p>
          <ul className="choice-points">
            <li><BadgeCheck size={16} /> Offers matched to your base and service radius</li>
            <li><BadgeCheck size={16} /> Live trip tracking shared with the buyer</li>
            <li><BadgeCheck size={16} /> Fleet and document records in one place</li>
          </ul>
        </div>
        <div className="choice-art" aria-hidden="true">
          <svg viewBox="0 0 320 200">
            <defs>
              <linearGradient id="road" x1="0" x2="1"><stop offset="0" stopColor="#c9dcf7" /><stop offset="1" stopColor="#bfe8e2" /></linearGradient>
              <linearGradient id="tank" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#38bdf8" /><stop offset="1" stopColor="#1463d6" /></linearGradient>
            </defs>
            <path d="M-10 170 C 80 140, 200 190, 330 150" stroke="url(#road)" strokeWidth="26" fill="none" strokeLinecap="round" />
            <path d="M-10 170 C 80 140, 200 190, 330 150" stroke="#fff" strokeWidth="2" strokeDasharray="10 12" fill="none" />
            <circle cx="40" cy="60" r="26" fill="#ccfbf1" /><path d="M30 72 V52 l8 5 v-5 l8 5 v-9 h6 v24z" fill="#0d9488" />
            <circle cx="280" cy="52" r="24" fill="#e0e7ff" /><path d="M280 40c-6 8-10 12-10 18a10 10 0 0 0 20 0c0-6-4-10-10-18z" fill="#4f46e5" />
            <path d="M66 62 C 140 20, 210 20, 256 50" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 6" fill="none" />
            <g transform="translate(96 92)">
              <rect x="0" y="40" width="130" height="6" rx="3" fill="#334155" />
              <rect x="4" y="6" width="86" height="34" rx="17" fill="url(#tank)" />
              <path d="M94 40 V16 a6 6 0 0 1 6 -6 h12 l12 14 v16 z" fill="#0b1626" />
              <path d="M102 15 h9 l8 10 h-17 z" fill="#bfe0ff" />
              {[22, 76, 112].map((cx) => <g key={cx}><circle cx={cx} cy="48" r="8" fill="#1d2a3d" /><circle cx={cx} cy="48" r="3" fill="#cbd5e1" /></g>)}
            </g>
          </svg>
        </div>
      </section>

      <div className="choice-grid">
        <a className="card choice" href="/tanker/register/contracted" data-tone="violet">
          <span className="choice-icon"><Building2 size={22} /></span>
          <h3>Existing Purvankara partner</h3>
          <p>You already hold a contract with Purvankara and want to register your tankers on the platform.</p>
          <ul>
            <li>Contract ID and validity dates</li>
            <li>Fleet with registration numbers</li>
          </ul>
          <span className="choice-cta">Register as contracted partner <ArrowRight size={16} /></span>
        </a>
        <a className="card choice" href="/tanker/register/independent" data-tone="sky">
          <span className="choice-icon"><Truck size={22} /></span>
          <h3>Independent operator</h3>
          <p>You run your own tankers and want delivery jobs from treatment plants on the network.</p>
          <ul>
            <li>Operating area and service radius</li>
            <li>Fleet with registration numbers</li>
          </ul>
          <span className="choice-cta">Register as independent operator <ArrowRight size={16} /></span>
        </a>
      </div>

      <div className="card choice-status">
        <span className="choice-icon" data-tone="amber"><Search size={18} /></span>
        <div>
          <strong>Already applied?</strong>
          <p>Check whether your registration has been approved.</p>
        </div>
        <a className="btn btn-secondary" href="/tanker/status">Check status <ArrowRight /></a>
      </div>
    </RegisterShell>
  );
}
