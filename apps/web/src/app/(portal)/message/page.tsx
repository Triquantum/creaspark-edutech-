"use client";
import { useEffect, useState } from "react";
import { MessageSquare, Send, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, Field, inputCls } from "@/components/ui/modal";

interface Person { id: string; fullName: string; role: string }
interface SectionRef { id: string; name: string; class: { name: string } }
interface MessageRow {
  id: string; body: string; createdAt: string; readAt?: string | null;
  sender?: Person; recipient?: Person; section?: SectionRef | null;
}
interface Me { role: string }

const CAN_BROADCAST = new Set(["TEACHER", "SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR"]);

function targetLabel(m: MessageRow, mine: "inbox" | "sent") {
  if (m.section) return `Broadcast to ${m.section.class.name} · ${m.section.name}`;
  const person = mine === "inbox" ? m.sender : m.recipient;
  return person ? `${person.fullName} (${person.role})` : "Unknown";
}

function Picker({ placeholder, search, onPick }: {
  placeholder: string;
  search: (q: string) => Promise<{ id: string; label: string }[]>;
  onPick: (pick: { id: string; label: string }) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; label: string }[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => search(q).then(setResults).catch(() => setResults([])), 250);
    return () => clearTimeout(t);
  }, [q, search]);

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={`${inputCls} h-9`}
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-11 z-20 max-h-56 overflow-y-auto rounded-xl border border-slate-100 bg-white shadow-lift dark:border-white/10 dark:bg-[#16213A]">
          {results.length === 0 && <p className="p-3 text-sm text-slate-500">No matches.</p>}
          {results.map((r) => (
            <button key={r.id} type="button"
              onClick={() => { onPick(r); setQ(""); setResults([]); setOpen(false); }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-surface dark:hover:bg-white/5">
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ComposeDialog({ canBroadcast, onClose, onSent }: {
  canBroadcast: boolean; onClose: () => void; onSent: () => void;
}) {
  const [mode, setMode] = useState<"student" | "guardian" | "broadcast">("student");
  const [target, setTarget] = useState<{ id: string; label: string } | null>(null);
  const [sections, setSections] = useState<{ id: string; label: string }[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (mode === "broadcast" && sections.length === 0) {
      api<{ id: string; label: string }[]>("/academic/sections").then(setSections).catch(() => setSections([]));
    }
  }, [mode, sections.length]);

  const searchStudents = async (q: string) => {
    const r = await api<{ items: { id: string; userId?: string | null; firstName: string; lastName: string; admissionNo: string }[] }>(
      `/students?q=${encodeURIComponent(q)}`,
    );
    return r.items.filter((s) => s.userId).map((s) => ({ id: s.userId as string, label: `${s.firstName} ${s.lastName} · ${s.admissionNo}` }));
  };
  const searchGuardians = async (q: string) => {
    const r = await api<{ id: string; fullName: string; guardianLinks: { student: { firstName: string; lastName: string } }[] }[]>(
      `/parents?q=${encodeURIComponent(q)}`,
    );
    return r.map((p) => ({
      id: p.id,
      label: `${p.fullName}${p.guardianLinks[0] ? ` (${p.guardianLinks[0].student.firstName} ${p.guardianLinks[0].student.lastName}'s guardian)` : ""}`,
    }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode !== "broadcast" && !target) { setError("Choose a recipient"); return; }
    if (mode === "broadcast" && !target) { setError("Choose a class"); return; }
    if (!body.trim()) { setError("Write a message"); return; }
    setSending(true);
    try {
      await api("/messages", {
        method: "POST",
        body: JSON.stringify(
          mode === "broadcast" ? { sectionId: target!.id, body } : { recipientId: target!.id, body },
        ),
      });
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal title="New Message" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex gap-2">
          {(["student", "guardian", ...(canBroadcast ? (["broadcast"] as const) : [])] as const).map((m) => (
            <button key={m} type="button" onClick={() => { setMode(m); setTarget(null); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors
                ${mode === m ? "bg-primary text-white" : "bg-surface text-slate-500 dark:bg-white/5"}`}>
              {m === "student" ? "Message a Student" : m === "guardian" ? "Contact a Guardian" : "Broadcast to Class"}
            </button>
          ))}
        </div>

        <Field id="target" label={mode === "broadcast" ? "Class" : "Recipient"}>
          {target ? (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-white/10">
              <span>{target.label}</span>
              <button type="button" onClick={() => setTarget(null)} className="text-xs text-danger">Change</button>
            </div>
          ) : mode === "broadcast" ? (
            <select className={inputCls} onChange={(e) => {
              const s = sections.find((x) => x.id === e.target.value);
              if (s) setTarget(s);
            }} defaultValue="">
              <option value="" disabled>Select a class…</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          ) : (
            <Picker
              placeholder={mode === "student" ? "Search student by name…" : "Search guardian by name…"}
              search={mode === "student" ? searchStudents : searchGuardians}
              onPick={setTarget}
            />
          )}
          {mode === "student" && !target && (
            <p className="mt-1 text-xs text-slate-400">Only students with a login account can be messaged.</p>
          )}
        </Field>

        <Field id="body" label="Message">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4}
            className={`${inputCls} h-auto py-3`} placeholder="Type your message…" />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={sending}>{sending ? "Sending…" : "Send"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function MessagePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [inbox, setInbox] = useState<MessageRow[]>([]);
  const [sent, setSent] = useState<MessageRow[]>([]);
  const [composing, setComposing] = useState(false);

  function reload() {
    api<MessageRow[]>("/messages/inbox").then(setInbox).catch(() => setInbox([]));
    api<MessageRow[]>("/messages/sent").then(setSent).catch(() => setSent([]));
  }

  useEffect(() => {
    api<Me>("/auth/me").then(setMe).catch(() => setMe(null));
    reload();
  }, []);

  const rows = tab === "inbox" ? inbox : sent;

  async function openMessage(m: MessageRow) {
    if (tab === "inbox" && !m.readAt) {
      await api(`/messages/${m.id}/read`, { method: "PATCH" }).catch(() => {});
      setInbox((prev) => prev.map((x) => (x.id === m.id ? { ...x, readAt: new Date().toISOString() } : x)));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Messages</h1>
          <p className="text-sm text-slate-500">Direct messages and class broadcasts.</p>
        </div>
        <Button onClick={() => setComposing(true)}><Send size={16} /> New Message</Button>
      </div>

      <div className="flex gap-2">
        {(["inbox", "sent"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors
              ${tab === t ? "bg-primary text-white" : "bg-surface text-slate-500 dark:bg-white/5"}`}>
            {t}
          </button>
        ))}
      </div>

      <Card>
        {rows.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-slate-400">
            <MessageSquare size={28} />
            <p className="text-sm">No messages yet.</p>
          </div>
        )}
        <ul className="divide-y divide-slate-100 dark:divide-white/10">
          {rows.map((m) => (
            <li key={m.id} onClick={() => openMessage(m)}
              className={`cursor-pointer py-4 first:pt-0 last:pb-0 ${tab === "inbox" && !m.readAt ? "font-medium" : ""}`}>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-sm text-night dark:text-white">
                  {m.section ? <Users size={14} className="text-accent" /> : null}
                  {targetLabel(m, tab)}
                </span>
                <span className="shrink-0 text-xs text-slate-400">
                  {new Date(m.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">{m.body}</p>
            </li>
          ))}
        </ul>
      </Card>

      {composing && (
        <ComposeDialog
          canBroadcast={!!me && CAN_BROADCAST.has(me.role)}
          onClose={() => setComposing(false)}
          onSent={() => { setComposing(false); reload(); setTab("sent"); }}
        />
      )}
    </div>
  );
}
