import { useState, type FormEvent } from "react";
import { ArrowRight, Building2, Minus, Plus, ShieldCheck, Truck } from "lucide-react";
import { LocationPicker, type PickedPoint } from "../../components/LocationPicker";
import { Notice, Spinner } from "../../components/ui";
import { submitForm } from "../../lib/api";
import { Checklist, digits, EMAIL_RE, Field, PHONE_RE, RegisterHero, RegisterShell, Section, SuccessView } from "./shared";

type Variant = "independent" | "contracted";
interface Vehicle { reg: string; cap: string; model: string }

const CAPACITIES = [5, 6, 8, 10, 12, 16, 20];
const RADII = [2, 5, 7, 9, 10, 15];
const WATER = [{ v: "treated", l: "Treated water" }, { v: "fresh", l: "Fresh water" }, { v: "general", l: "General" }];
// Loose on purpose: the server only requires a unique, non-empty number (BH-series plates differ).
const REG_RE = /^[A-Z0-9][A-Z0-9 -]{4,14}$/;
const blank = (): Vehicle => ({ reg: "", cap: "", model: "" });

export default function TankerForm({ variant }: { variant: Variant }) {
  const contracted = variant === "contracted";
  const [f, setF] = useState({
    operator_name: "", phone: "", email: "", area: "", pincode: "", water_type: "", radius: "",
    contract_id: "", contract_start: "", contract_end: "",
  });
  const [loc, setLoc] = useState<PickedPoint | null>(null);
  const [fleet, setFleet] = useState<Vehicle[]>([blank()]);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ operator_id: string; operator_type: string } | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setV = (i: number, k: keyof Vehicle, v: string) => setFleet((list) => list.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const resize = (n: number) => setFleet((list) => (n > list.length ? [...list, ...Array.from({ length: n - list.length }, blank)] : list.slice(0, n)));

  const regs = fleet.map((v) => v.reg.trim().toUpperCase());
  const dupes = new Set(regs.filter((r, i) => r && regs.indexOf(r) !== i));
  const vErr = fleet.map((v) => ({
    reg: !v.reg.trim() ? "Required" : !REG_RE.test(v.reg.trim().toUpperCase()) ? "Check the registration number" : dupes.has(v.reg.trim().toUpperCase()) ? "Duplicate number" : false,
    cap: !v.cap && "Required",
    model: !v.model.trim() && "Required",
  }));
  const errors = {
    operator_name: !f.operator_name.trim() && "Enter your full name.",
    phone: !PHONE_RE.test(f.phone) && "Enter a 10-digit mobile number.",
    email: !EMAIL_RE.test(f.email) && "Enter a valid email address.",
    area: !contracted && !f.area.trim() && "Enter your operating area.",
    pincode: !contracted && !/^\d{6}$/.test(f.pincode) && "Enter a 6-digit pincode.",
    water_type: !contracted && !f.water_type && "Choose a water type.",
    radius: !contracted && !f.radius && "Choose a service radius.",
    contract_id: contracted && !f.contract_id.trim() && "Enter your contract ID.",
    contract_start: contracted && !f.contract_start && "Choose a start date.",
    contract_end: contracted && (!f.contract_end ? "Choose an end date." : f.contract_start && f.contract_end < f.contract_start ? "End date is before the start date." : false),
    location: !loc && "Place your base on the map.",
    fleet: vErr.some((e) => e.reg || e.cap || e.model) && "Complete every vehicle.",
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
    body.append("operator_name", f.operator_name.trim());
    body.append("phone", f.phone);
    body.append("email", f.email.trim());
    body.append("latitude", String(loc!.lat));
    body.append("longitude", String(loc!.lon));
    body.append("operational_tankers", String(fleet.length));
    if (contracted) {
      body.append("contract_id", f.contract_id.trim());
      body.append("contract_start", f.contract_start);
      body.append("contract_end", f.contract_end);
    } else {
      body.append("area", f.area.trim());
      body.append("pincode", f.pincode);
      body.append("water_type", f.water_type);
      body.append("radius", f.radius);
    }
    fleet.forEach((v) => {
      body.append("vehicle_registration_no[]", v.reg.trim().toUpperCase());
      body.append("vehicle_capacity[]", v.cap);
      body.append("vehicle_model[]", v.model.trim());
    });
    setSaving(true);
    try {
      setDone(await submitForm(`/tanker/register/${variant}`, body));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const title = contracted ? "Contracted partner" : "Independent operator";
  if (done) {
    return (
      <RegisterShell title={title} subtitle="Tanker partner onboarding">
        <SuccessView tone={contracted ? "violet" : "sky"} title="Registration received" idLabel="Operator ID" id={done.operator_id}
          actions={<><a className="btn btn-secondary" href="/tanker/status">Check status</a><a className="btn btn-primary" href="/signup">Create your account <ArrowRight /></a></>}>
          <p>Your {done.operator_type.toLowerCase()} application and {fleet.length} vehicle{fleet.length === 1 ? "" : "s"} are pending verification.</p>
          <p className="muted">Use your operator ID or registered phone number to check the status.</p>
        </SuccessView>
      </RegisterShell>
    );
  }

  const totalKl = fleet.reduce((a, v) => a + (Number(v.cap) || 0), 0);
  return (
    <RegisterShell title={title} subtitle="Tanker partner onboarding" back={{ href: "/tanker/register", label: "All options" }}>
      <RegisterHero tone={contracted ? "violet" : "sky"} icon={contracted ? Building2 : Truck} eyebrow="Tanker partners"
        title={contracted ? "Register your contracted fleet" : "Join as an independent operator"}>
        {contracted
          ? "Link your Purvankara contract and register each tanker so pickups can be assigned to your fleet."
          : "Tell us where you operate and which tankers you run — we'll send pickup offers within your service radius."}
      </RegisterHero>

      <div className="reg-layout">
        <form className="card reg-form" onSubmit={submit} noValidate>
          <Section n={1} title="Operator" hint="The person or business we contact">
            <div className="grid grid-2">
              <Field label={contracted ? "Operator / company name" : "Full name"} required error={show("operator_name")} wide>
                <input className="input" value={f.operator_name} onChange={set("operator_name")} aria-invalid={!!show("operator_name")} autoComplete="name" />
              </Field>
              <Field label="Mobile number" required error={show("phone")}>
                <div className="input-prefix"><span>+91</span><input className="input num" style={{ paddingLeft: 44 }} inputMode="numeric" maxLength={10} value={f.phone} onChange={(e) => setF((x) => ({ ...x, phone: digits(e.target.value) }))} aria-invalid={!!show("phone")} autoComplete="tel-national" /></div>
              </Field>
              <Field label="Email" required error={show("email")}><input className="input" type="email" value={f.email} onChange={set("email")} aria-invalid={!!show("email")} autoComplete="email" /></Field>
            </div>
          </Section>

          {contracted ? (
            <Section n={2} title="Contract" hint="As printed on your Purvankara agreement">
              <div className="grid grid-3">
                <Field label="Contract ID" required error={show("contract_id")}><input className="input num" value={f.contract_id} onChange={set("contract_id")} aria-invalid={!!show("contract_id")} /></Field>
                <Field label="Start date" required error={show("contract_start")}><input className="input" type="date" value={f.contract_start} onChange={set("contract_start")} aria-invalid={!!show("contract_start")} /></Field>
                <Field label="End date" required error={show("contract_end")}><input className="input" type="date" value={f.contract_end} min={f.contract_start || undefined} onChange={set("contract_end")} aria-invalid={!!show("contract_end")} /></Field>
              </div>
            </Section>
          ) : (
            <Section n={2} title="Service" hint="Where and what you can deliver">
              <div className="grid grid-2">
                <Field label="Operating area" required error={show("area")}><input className="input" value={f.area} onChange={set("area")} aria-invalid={!!show("area")} placeholder="e.g. Whitefield" /></Field>
                <Field label="Pincode" required error={show("pincode")}><input className="input num" inputMode="numeric" maxLength={6} value={f.pincode} onChange={(e) => setF((x) => ({ ...x, pincode: digits(e.target.value) }))} aria-invalid={!!show("pincode")} /></Field>
              </div>
              <div className="field mt-12">
                <span className="field-label">Water type<span className="req"> *</span></span>
                <div className="choice-pills" role="radiogroup" aria-invalid={!!show("water_type")}>
                  {WATER.map((w) => (
                    <button key={w.v} type="button" role="radio" aria-checked={f.water_type === w.v} onClick={() => setF((x) => ({ ...x, water_type: w.v }))}>{w.l}</button>
                  ))}
                </div>
                {show("water_type") && <span className="field-error">{errors.water_type}</span>}
              </div>
              <div className="field mt-12">
                <span className="field-label">Service radius<span className="req"> *</span></span>
                <div className="choice-pills" role="radiogroup" aria-invalid={!!show("radius")}>
                  {RADII.map((r) => (
                    <button key={r} type="button" role="radio" aria-checked={f.radius === String(r)} onClick={() => setF((x) => ({ ...x, radius: String(r) }))}>{r} km</button>
                  ))}
                </div>
                {show("radius") && <span className="field-error">{errors.radius}</span>}
              </div>
            </Section>
          )}

          <Section n={3} title="Base location" hint="Where your tankers usually start — offers are matched from here">
            <LocationPicker value={loc} onChange={setLoc} icon="truck" invalid={!!show("location")} />
            {show("location") && <span className="field-error">{errors.location}</span>}
          </Section>

          <Section n={4} title="Fleet" hint="One row per tanker, up to 15">
            <div className="fleet-count">
              <span className="field-label">Operational tankers</span>
              <div className="stepper">
                <button type="button" className="btn btn-secondary btn-icon btn-sm" onClick={() => resize(Math.max(1, fleet.length - 1))} disabled={fleet.length <= 1} aria-label="Remove a tanker"><Minus /></button>
                <span className="num">{fleet.length}</span>
                <button type="button" className="btn btn-secondary btn-icon btn-sm" onClick={() => resize(Math.min(15, fleet.length + 1))} disabled={fleet.length >= 15} aria-label="Add a tanker"><Plus /></button>
              </div>
              <span className="muted num">{totalKl ? `${totalKl} KL total capacity` : ""}</span>
            </div>
            <div className="vehicle-rows">
              {fleet.map((v, i) => (
                <div className="vehicle-row" key={i}>
                  <span className="vehicle-n num">{i + 1}</span>
                  <Field label="Registration no." required error={tried && vErr[i]!.reg}>
                    <input className="input num plate-input" value={v.reg} onChange={(e) => setV(i, "reg", e.target.value.toUpperCase())} placeholder="KA-01-AB-1234" aria-invalid={!!(tried && vErr[i]!.reg)} />
                  </Field>
                  <Field label="Capacity" required error={tried && vErr[i]!.cap}>
                    <select className="select" value={v.cap} onChange={(e) => setV(i, "cap", e.target.value)} aria-invalid={!!(tried && vErr[i]!.cap)}>
                      <option value="">KL…</option>
                      {CAPACITIES.map((c) => <option key={c} value={c}>{c} KL</option>)}
                    </select>
                  </Field>
                  <Field label="Model" required error={tried && vErr[i]!.model}>
                    <input className="input" value={v.model} onChange={(e) => setV(i, "model", e.target.value)} placeholder="e.g. Tata 709" aria-invalid={!!(tried && vErr[i]!.model)} />
                  </Field>
                </div>
              ))}
            </div>
          </Section>

          {error && <div style={{ padding: "0 24px" }}><Notice tone="danger">{error}</Notice></div>}
          <footer className="reg-foot">
            <span className="muted"><ShieldCheck size={14} /> Applications are verified before offers start.</span>
            <button className="btn btn-primary btn-lg" disabled={saving}>{saving && <Spinner />} Submit application <ArrowRight /></button>
          </footer>
        </form>

        <aside className="reg-aside">
          <Checklist items={[
            { label: "Operator details", done: !errors.operator_name && !errors.phone && !errors.email },
            contracted
              ? { label: "Contract", done: !errors.contract_id && !errors.contract_start && !errors.contract_end }
              : { label: "Service area", done: !errors.area && !errors.pincode && !errors.water_type && !errors.radius },
            { label: "Base location", done: !!loc },
            { label: `Fleet (${fleet.length})`, done: !errors.fleet },
          ]} />
          <div className="card reg-next">
            <strong>What happens next</strong>
            <ol>
              <li>The team verifies your details and vehicles.</li>
              <li>Track approval with your operator ID.</li>
              <li>Create an account to start receiving pickup offers.</li>
            </ol>
          </div>
        </aside>
      </div>
    </RegisterShell>
  );
}
