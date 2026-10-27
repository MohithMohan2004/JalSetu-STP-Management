import { useState, type FormEvent } from "react";
import { ArrowRight, Factory, Gauge, ShieldCheck } from "lucide-react";
import { LocationPicker, type PickedPoint } from "../../components/LocationPicker";
import { Notice, Spinner } from "../../components/ui";
import { submitForm } from "../../lib/api";
import { Checklist, digits, EMAIL_RE, Field, PHONE_RE, RegisterHero, RegisterShell, Section, SuccessView } from "./shared";

const GRADES = ["General", "Bronze", "Silver", "Gold"];

export default function StpRegister() {
  const [f, setF] = useState({
    owner_name: "", phone: "", email: "", company_name: "",
    stp_name: "", technology: "", quality_grade: "",
    total_capacity_kld: "", current_load_kld: "", treatment_cost_per_kl: "",
  });
  const [loc, setLoc] = useState<PickedPoint | null>(null);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ registration_id: string; stp_name: string } | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const total = Number(f.total_capacity_kld), load = Number(f.current_load_kld);

  const errors = {
    owner_name: !f.owner_name.trim() && "Enter the owner's name.",
    phone: !PHONE_RE.test(f.phone) && "Enter a 10-digit mobile number.",
    email: !EMAIL_RE.test(f.email) && "Enter a valid email address.",
    stp_name: !f.stp_name.trim() && "Enter the plant name.",
    technology: !f.technology.trim() && "Describe the treatment technology.",
    quality_grade: !f.quality_grade && "Choose a quality grade.",
    total_capacity_kld: !(total > 0) && "Capacity must be greater than zero.",
    current_load_kld: (f.current_load_kld === "" || load < 0) ? "Enter the current load (0 or more)." : load > total ? "Load can't exceed capacity." : false,
    treatment_cost_per_kl: f.treatment_cost_per_kl === "" && "Enter the treatment cost.",
    location: !loc && "Place the plant on the map.",
  };
  const valid = Object.values(errors).every((e) => !e);
  const show = (k: keyof typeof errors) => tried && errors[k];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    setError(null);
    if (!valid) {
      document.querySelector("[aria-invalid='true'], .picker[data-invalid]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const body = new FormData();
    Object.entries(f).forEach(([k, v]) => body.append(k, v.trim()));
    body.append("latitude", String(loc!.lat));
    body.append("longitude", String(loc!.lon));
    setSaving(true);
    try {
      setDone(await submitForm("/stp/register", body));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <RegisterShell title="Register a plant" subtitle="Treatment plant onboarding">
        <SuccessView tone="teal" title={`${done.stp_name} is registered`} idLabel="Registration ID" id={done.registration_id}
          actions={<><a className="btn btn-secondary" href="/">Back to home</a><a className="btn btn-primary" href="/signup">Create your account <ArrowRight /></a></>}>
          <p>An administrator will verify the plant details. Once approved, the plant appears on the network and can receive orders.</p>
          <p className="muted">Keep the registration ID for any follow-up with the team.</p>
        </SuccessView>
      </RegisterShell>
    );
  }

  return (
    <RegisterShell title="Register a plant" subtitle="Treatment plant onboarding" back={{ href: "/", label: "Home" }}>
      <RegisterHero tone="teal" icon={Factory} eyebrow="Plant operators" title="Put your treated water to work">
        Register your sewage treatment plant to list available capacity, receive orders from demand sites and report water quality.
      </RegisterHero>

      <div className="reg-layout">
        <form className="card reg-form" onSubmit={submit} noValidate>
          <Section n={1} title="Owner" hint="Who we contact about this plant">
            <div className="grid grid-2">
              <Field label="Owner name" required error={show("owner_name")}><input className="input" value={f.owner_name} onChange={set("owner_name")} aria-invalid={!!show("owner_name")} autoComplete="name" /></Field>
              <Field label="Company / organisation" hint="Optional"><input className="input" value={f.company_name} onChange={set("company_name")} autoComplete="organization" /></Field>
              <Field label="Mobile number" required error={show("phone")}>
                <div className="input-prefix"><span>+91</span><input className="input num" style={{ paddingLeft: 44 }} inputMode="numeric" maxLength={10} value={f.phone} onChange={(e) => setF((x) => ({ ...x, phone: digits(e.target.value) }))} aria-invalid={!!show("phone")} autoComplete="tel-national" /></div>
              </Field>
              <Field label="Email" required error={show("email")}><input className="input" type="email" value={f.email} onChange={set("email")} aria-invalid={!!show("email")} autoComplete="email" /></Field>
            </div>
          </Section>

          <Section n={2} title="Plant" hint="How the plant appears on the network">
            <div className="grid grid-2">
              <Field label="Plant name" required error={show("stp_name")}><input className="input" value={f.stp_name} onChange={set("stp_name")} aria-invalid={!!show("stp_name")} placeholder="e.g. GreenFlow Hebbal STP" /></Field>
              <Field label="Technology" required error={show("technology")}><input className="input" value={f.technology} onChange={set("technology")} aria-invalid={!!show("technology")} placeholder="e.g. 450 KLD SBR" /></Field>
              <Field label="Quality grade" required error={show("quality_grade")}>
                <select className="select" value={f.quality_grade} onChange={set("quality_grade")} aria-invalid={!!show("quality_grade")}>
                  <option value="">Choose a grade…</option>
                  {GRADES.map((g) => <option key={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Treatment cost" required error={show("treatment_cost_per_kl")} hint="Per kilolitre">
                <div className="input-prefix"><span>₹</span><input className="input num" inputMode="decimal" value={f.treatment_cost_per_kl} onChange={(e) => setF((x) => ({ ...x, treatment_cost_per_kl: e.target.value.replace(/[^\d.]/g, "") }))} aria-invalid={!!show("treatment_cost_per_kl")} /></div>
              </Field>
            </div>
          </Section>

          <Section n={3} title="Capacity" hint="Daily treated-water capacity and today's load">
            <div className="grid grid-2">
              <Field label="Total capacity" required error={show("total_capacity_kld")}>
                <div className="input-suffix"><input className="input num" inputMode="decimal" value={f.total_capacity_kld} onChange={(e) => setF((x) => ({ ...x, total_capacity_kld: e.target.value.replace(/[^\d.]/g, "") }))} aria-invalid={!!show("total_capacity_kld")} /><span>KLD</span></div>
              </Field>
              <Field label="Current load" required error={show("current_load_kld")}>
                <div className="input-suffix"><input className="input num" inputMode="decimal" value={f.current_load_kld} onChange={(e) => setF((x) => ({ ...x, current_load_kld: e.target.value.replace(/[^\d.]/g, "") }))} aria-invalid={!!show("current_load_kld")} /><span>KLD</span></div>
              </Field>
            </div>
            {total > 0 && load >= 0 && load <= total && (
              <div className="cap-preview">
                <Gauge size={15} />
                <span><b className="num">{(total - load).toLocaleString("en-IN")}</b> KLD would be available to the network</span>
                <span className="meter" aria-hidden="true"><span style={{ width: `${(load / total) * 100}%` }} /></span>
              </div>
            )}
          </Section>

          <Section n={4} title="Location" hint="Drop the pin exactly on the plant — tankers navigate here">
            <LocationPicker value={loc} onChange={setLoc} invalid={!!show("location")} />
            {show("location") && <span className="field-error">{errors.location}</span>}
          </Section>

          {error && <div style={{ padding: "0 24px" }}><Notice tone="danger">{error}</Notice></div>}
          <footer className="reg-foot">
            <span className="muted"><ShieldCheck size={14} /> Details are reviewed before the plant goes live.</span>
            <button className="btn btn-primary btn-lg" disabled={saving}>{saving && <Spinner />} Submit registration <ArrowRight /></button>
          </footer>
        </form>

        <aside className="reg-aside">
          <Checklist items={[
            { label: "Owner details", done: !errors.owner_name && !errors.phone && !errors.email },
            { label: "Plant details", done: !errors.stp_name && !errors.technology && !errors.quality_grade && !errors.treatment_cost_per_kl },
            { label: "Capacity", done: !errors.total_capacity_kld && !errors.current_load_kld },
            { label: "Location", done: !!loc },
          ]} />
          <div className="card reg-next">
            <strong>What happens next</strong>
            <ol>
              <li>An administrator reviews your registration.</li>
              <li>Once approved, your plant appears on the network map.</li>
              <li>Create an account to manage orders, pricing and OCEMS reports.</li>
            </ol>
          </div>
        </aside>
      </div>
    </RegisterShell>
  );
}
