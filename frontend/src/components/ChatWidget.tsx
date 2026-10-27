import { useEffect, useRef, useState, type FormEvent } from "react";
import { MessageCircle, Send, Sparkles, X } from "lucide-react";

interface Msg { from: "bot" | "user"; text: string }

const SUGGESTIONS: Record<string, string[]> = {
  demand: ["How do I place an order?", "What do the quality grades mean?", "Where is my order?"],
  stp: ["How do I accept a request?", "How is pricing calculated?", "How do I upload OCEMS data?"],
  tanker: ["How do I accept a pickup?", "How does live tracking work?", "Show my active trips"],
};

/** Juno assistant — talks to the existing /api/chat endpoint. */
export function ChatWidget({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: "bot", text: "Hi, I'm Juno. Ask me about orders, plants, deliveries or water quality." },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(message: string) {
    const m = message.trim();
    if (!m || busy) return;
    setMsgs((x) => [...x, { from: "user", text: m }]);
    setText("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: m, latitude: null, longitude: null }),
      });
      const data = await res.json().catch(() => null);
      setMsgs((x) => [
        ...x,
        { from: "bot", text: res.ok && data?.reply ? data.reply : "Sorry, I couldn't process that right now. Please try again." },
      ]);
    } catch {
      setMsgs((x) => [...x, { from: "bot", text: "I can't reach the server right now. Check your connection and try again." }]);
    } finally {
      setBusy(false);
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(text);
  };

  return (
    <>
      {open && (
        <section className="chat-panel" aria-label="Juno assistant">
          <header className="chat-head">
            <span className="chat-mark"><Sparkles size={16} /></span>
            <div style={{ flex: 1 }}>
              <strong>Juno</strong>
              <span>Assistant for ReFlow</span>
            </div>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setOpen(false)} aria-label="Close assistant">
              <X size={16} />
            </button>
          </header>
          <div className="chat-log" ref={logRef}>
            {msgs.map((m, i) => (
              <div key={i} className={`chat-msg ${m.from}`}>{m.text}</div>
            ))}
            {busy && (
              <div className="chat-msg bot"><span className="typing"><i /><i /><i /></span></div>
            )}
            {msgs.length === 1 && (
              <div className="chat-suggest">
                {(SUGGESTIONS[role] ?? SUGGESTIONS.demand!).map((s) => (
                  <button key={s} type="button" onClick={() => void send(s)}>{s}</button>
                ))}
              </div>
            )}
          </div>
          <form className="chat-form" onSubmit={submit}>
            <input ref={inputRef} className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask Juno…" aria-label="Message" />
            <button className="btn btn-primary btn-icon" type="submit" disabled={!text.trim() || busy} aria-label="Send">
              <Send size={16} />
            </button>
          </form>
        </section>
      )}
      <button type="button" className="chat-fab" onClick={() => setOpen((o) => !o)} aria-label={open ? "Close assistant" : "Open Juno assistant"} aria-expanded={open}>
        {open ? <X size={20} /> : <MessageCircle size={20} />}
      </button>
    </>
  );
}
