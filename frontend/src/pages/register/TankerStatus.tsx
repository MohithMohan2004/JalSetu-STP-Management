import { useState, type FormEvent } from "react";
import { ArrowRight, CircleCheck, CircleX, ClipboardCheck, FileSearch, Hourglass, Search, Send } from "lucide-react";
import { TankerArt } from "../../components/Fleet";
import { Notice, Spinner, StatusBadge } from "../../components/ui";
import { postJSON } from "../../lib/api";
import { Field, RegisterHero, RegisterShell } from "./shared";

interface Registration {
  operator_id: string; operator_name: string; operator_type: string; phone: string; registration_date: string;
  tanker_registration_no: string; verification_status: string; area: string; operational_tankers: string;
}

type Outcome = "approved" | "rejected" | "pending";
const outcomeOf = (s: string): Outcome => {
  const v = s.toLowerCase();
  if (v === "approved" || v === "verified") return "approved";
  if (v === "rejected") return "rejected";
  return "pending";
};

export default function TankerStatus() {
  const [operatorId, setOperatorId] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reg, setReg] = useState<Registration | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await postJSON<{ operator: Registration }>("/api/tanker/status", { operator_id: operatorId, phone });
      setReg(res.operator);
    } catch (err) {
      setReg(null);
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <RegisterShell title="Registration status" subtitle="Tanker partner onboarding" back={{ href: "/tanker/register", label: "All options" }}>
      <RegisterHero tone="amber" icon={FileSearch} eyebrow="Tanker partners" title="Check your registration">
        Enter the operator ID from your confirmation and the phone number you registered with.
      </RegisterHero>

      <div className="status-layout">
        <form className="card card-pad status-form" onSubmit={submit}>
          <Field label="Operator ID" required>
            <input className="input num" value={operatorId} onChange={(e) => setOperatorId(e.target.value)} placeholder="e.g. OP-BLR-0001" autoComplete="off" required />
          </Field>
          <Field label="Registered phone number" required>
            <input className="input" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" required />
          </Field>
          {error && <Notice tone="danger">{error}</Notice>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy || !operatorId.trim() || !phone.trim()}>
            {busy ? <Spinner /> : <Search />} Check status
          </button>
        </form>

        {reg ? <Result reg={reg} /> : (
          <section className="card status-idle" aria-hidden="true">
            <div className="status-idle-art"><TankerArt capacity={14} active /></div>
            <p>Your application moves from <b>submitted</b> to <b>under review</b> to <b>approved</b>. Once approved, create an account to start receiving pickup offers.</p>
          </section>
        )}
      </div>
    </RegisterShell>
  );
}

function Result({ reg }: { reg: Registration }) {
  const outcome = outcomeOf(reg.verification_status);
  const steps = [
    { label: "Submitted", icon: Send, done: true },
    { label: "Under review", icon: Hourglass, done: outcome !== "pending", current: outcome === "pending" },
    outcome === "rejected"
      ? { label: "Not approved", icon: CircleX, done: true, bad: true }
      : { label: "Approved", icon: CircleCheck, done: outcome === "approved" },
  ];
  const registered = reg.registration_date
    ? new Date(reg.registration_date.replace(" ", "T")).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  return (
    <section className="card card-pad status-result" aria-live="polite">
      <header className="row-between wrap">
        <div>
          <h2>{reg.operator_name}</h2>
          <p className="muted num">{reg.operator_id} · {reg.operator_type === "contracted" ? "Contracted partner" : "Independent operator"}</p>
        </div>
        <StatusBadge status={reg.verification_status || "Pending"} />
      </header>

      <ol className="status-steps">
        {steps.map((s) => (
          <li key={s.label} data-done={s.done} data-current={"current" in s && s.current} data-bad={"bad" in s && s.bad}>
            <span className="status-step-icon"><s.icon size={16} /></span>
            <span>{s.label}</span>
          </li>
        ))}
      </ol>

      <dl className="status-facts">
        <div><dt>Registered</dt><dd>{registered}</dd></div>
        <div><dt>Base area</dt><dd>{reg.area || "—"}</dd></div>
        <div><dt>Tankers</dt><dd className="num">{reg.operational_tankers || "—"}</dd></div>
        <div><dt>First vehicle</dt><dd className="num">{reg.tanker_registration_no || "—"}</dd></div>
      </dl>

      {outcome === "approved" ? (
        <div className="status-next">
          <ClipboardCheck size={18} />
          <p>You're approved. Create an account with this phone number to start receiving pickup offers.</p>
          <a className="btn btn-primary" href="/signup">Create account <ArrowRight /></a>
        </div>
      ) : outcome === "rejected" ? (
        <Notice tone="danger">This application wasn't approved. Contact the ReFlow team, or register again with corrected details.</Notice>
      ) : (
        <Notice tone="info">The team is verifying your details and vehicles. Check back here for the result.</Notice>
      )}
    </section>
  );
}
