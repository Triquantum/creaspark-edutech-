"use client";
import { useEffect, useState } from "react";
import { Eye, MessageSquare, Reply as ReplyIcon, Send, Trash2, Users } from "lucide-react";
import { api, notifyNotificationsChanged } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, Field, inputCls } from "@/components/ui/modal";

interface Person { id: string; fullName: string; role: string }
interface SectionRef { id: string; name: string; class: { name: string } }
interface MessageRow {
  id: string; subject?: string | null; body: string; createdAt: string; readAt?: string | null;
  sender?: Person; recipient?: Person; section?: SectionRef | null;
}
interface Me { role: string }
interface School { id: string; name: string }

const CAN_BROADCAST = new Set(["TEACHER", "SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR"]);
const ANNOUNCE_AUDIENCE = [
  { value: "TEACHER", label: "Teachers" },
  { value: "SCHOOL_ADMIN", label: "School Admins" },
] as const;
const ROLE_FILTERS = [
  { value: "", label: "All roles" },
  { value: "TEACHER", label: "Teachers" },
  { value: "STUDENT", label: "Students" },
  { value: "PARENT", label: "Parents" },
] as const;

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

function ComposeDialog({ canBroadcast, canAnnounce, onClose, onSent }: {
  canBroadcast: boolean; canAnnounce: boolean; onClose: () => void; onSent: (msg: string) => void;
}) {
  const [mode, setMode] = useState<"student" | "guardian" | "broadcast" | "announce">("student");
  const [target, setTarget] = useState<{ id: string; label: string } | null>(null);
  const [sections, setSections] = useState<{ id: string; label: string }[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [audience, setAudience] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (mode === "broadcast" && sections.length === 0) {
      api<{ id: string; label: string }[]>("/academic/sections").then(setSections).catch(() => setSections([]));
    }
  }, [mode, sections.length]);

  useEffect(() => {
    if (mode === "announce" && schools.length === 0) {
      api<School[]>("/platform/schools").then(setSchools).catch(() => setSchools([]));
    }
  }, [mode, schools.length]);

  function toggleAudience(role: string) {
    setAudience((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role); else next.add(role);
      return next;
    });
  }

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
    if (mode === "announce") {
      if (!schoolId) { setError("Choose a school"); return; }
      if (audience.size === 0) { setError("Choose at least one audience"); return; }
    } else if (mode === "broadcast" && !target) { setError("Choose a class"); return; }
    else if (mode !== "broadcast" && !target) { setError("Choose a recipient"); return; }
    if (!body.trim()) { setError("Write a message"); return; }
    setSending(true);
    try {
      if (mode === "announce") {
        const r = await api<{ sentCount: number; school: string }>("/messages/broadcast", {
          method: "POST",
          body: JSON.stringify({ schoolId, subject: subject.trim() || undefined, roles: Array.from(audience), body }),
        });
        onSent(`Sent to ${r.sentCount} ${r.sentCount === 1 ? "person" : "people"} at ${r.school}`);
      } else {
        await api("/messages", {
          method: "POST",
          body: JSON.stringify({
            subject: subject.trim() || undefined,
            ...(mode === "broadcast" ? { sectionId: target!.id } : { recipientId: target!.id }),
            body,
          }),
        });
        onSent("Message sent");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal title="New Message" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(["student", "guardian", ...(canBroadcast ? (["broadcast"] as const) : []), ...(canAnnounce ? (["announce"] as const) : [])] as const).map((m) => (
            <button key={m} type="button" onClick={() => { setMode(m); setTarget(null); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors
                ${mode === m ? "bg-primary text-white" : "bg-surface text-slate-500 dark:bg-white/5"}`}>
              {m === "student" ? "Message a Student" : m === "guardian" ? "Contact a Guardian" : m === "broadcast" ? "Broadcast to Class" : "Announce to School"}
            </button>
          ))}
        </div>

        {mode === "announce" ? (
          <>
            <Field id="announce-school" label="School">
              <select id="announce-school" className={inputCls} value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
                <option value="" disabled>Select a school…</option>
                {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field id="announce-audience" label="Audience">
              <div className="flex gap-4">
                {ANNOUNCE_AUDIENCE.map((a) => (
                  <label key={a.value} className="flex items-center gap-2 text-sm text-night dark:text-white">
                    <input type="checkbox" checked={audience.has(a.value)} onChange={() => toggleAudience(a.value)} className="accent-primary" />
                    {a.label}
                  </label>
                ))}
              </div>
            </Field>
          </>
        ) : (
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
        )}

        <Field id="subject" label="Subject" optional>
          <input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} placeholder="e.g. Fee reminder" />
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

function ReplyDialog({ to, subject, onClose, onSent }: {
  to: Person; subject?: string | null; onClose: () => void; onSent: () => void;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!body.trim()) { setError("Write a reply"); return; }
    setSending(true);
    try {
      await api("/messages", {
        method: "POST",
        body: JSON.stringify({
          recipientId: to.id,
          subject: subject ? (subject.startsWith("Re: ") ? subject : `Re: ${subject}`) : undefined,
          body,
        }),
      });
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal title={`Reply to ${to.fullName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="reply-body" label="Message">
          <textarea
            value={body} onChange={(e) => setBody(e.target.value)} rows={4} autoFocus
            className={`${inputCls} h-auto py-3`} placeholder="Type your reply…"
          />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={sending}>{sending ? "Sending…" : "Send reply"}</Button>
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
  const [toast, setToast] = useState<string | null>(null);
  const [schools, setSchools] = useState<School[]>([]);

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [schoolIdFilter, setSchoolIdFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [deleting, setDeleting] = useState<MessageRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [replyingTo, setReplyingTo] = useState<MessageRow | null>(null);
  const [viewing, setViewing] = useState<MessageRow | null>(null);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); } }, [toast]);
  useEffect(() => { const t = setTimeout(() => setQ(searchInput.trim()), 250); return () => clearTimeout(t); }, [searchInput]);
  useEffect(() => { api<School[]>("/academic/schools").then(setSchools).catch(() => setSchools([])); }, []);

  function reload() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (roleFilter) params.set("role", roleFilter);
    if (schoolIdFilter) params.set("schoolId", schoolIdFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    const qs = params.toString() ? `?${params.toString()}` : "";
    api<MessageRow[]>(`/messages/inbox${qs}`).then(setInbox).catch(() => setInbox([]));
    api<MessageRow[]>(`/messages/sent${qs}`).then(setSent).catch(() => setSent([]));
  }

  useEffect(() => { api<Me>("/auth/me").then(setMe).catch(() => setMe(null)); }, []);
  useEffect(reload, [q, roleFilter, schoolIdFilter, dateFrom, dateTo]);

  const rows = tab === "inbox" ? inbox : sent;

  async function openMessage(m: MessageRow) {
    setViewing(m);
    if (tab === "inbox" && !m.readAt) {
      await api(`/messages/${m.id}/read`, { method: "PATCH" }).catch(() => {});
      setInbox((prev) => prev.map((x) => (x.id === m.id ? { ...x, readAt: new Date().toISOString() } : x)));
      notifyNotificationsChanged();
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/messages/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      reload();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not delete");
      setDeleting(null);
    } finally {
      setBusy(false);
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

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search subject, message or person…" aria-label="Search messages"
          className={`${inputCls} max-w-xs`}
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by role" className={`${inputCls} max-w-xs`}>
          {ROLE_FILTERS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select value={schoolIdFilter} onChange={(e) => setSchoolIdFilter(e.target.value)} aria-label="Filter by school" className={`${inputCls} max-w-xs`}>
          <option value="">All schools</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <label htmlFor="dateFrom" className="text-xs text-slate-400">From</label>
          <input id="dateFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`${inputCls} w-auto`} />
          <label htmlFor="dateTo" className="text-xs text-slate-400">To</label>
          <input id="dateTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`${inputCls} w-auto`} />
        </div>
      </div>

      <Card>
        {rows.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-slate-400">
            <MessageSquare size={28} />
            <p className="text-sm">No messages match this search.</p>
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
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-slate-400">
                    {new Date(m.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); openMessage(m); }}
                    aria-label="View" title="View"
                    className="text-slate-400 hover:text-primary"
                  >
                    <Eye size={14} />
                  </button>
                  {tab === "inbox" && m.sender && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setReplyingTo(m); }}
                      aria-label="Reply" title="Reply"
                      className="text-slate-400 hover:text-primary"
                    >
                      <ReplyIcon size={14} />
                    </button>
                  )}
                  {tab === "sent" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleting(m); }}
                      aria-label="Delete message" title="Delete"
                      className="text-slate-400 hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              {m.subject && <p className="mt-1 text-sm font-semibold text-night dark:text-white">{m.subject}</p>}
              <p className="mt-1 text-sm text-slate-500">{m.body}</p>
            </li>
          ))}
        </ul>
      </Card>

      {composing && (
        <ComposeDialog
          canBroadcast={!!me && CAN_BROADCAST.has(me.role)}
          canAnnounce={me?.role === "SUPER_ADMIN"}
          onClose={() => setComposing(false)}
          onSent={(msg) => { setComposing(false); reload(); setTab("sent"); setToast(msg); }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete message?"
          message={`This permanently removes this message for both you and ${deleting.recipient?.fullName ?? "the recipient"}.`}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
          busy={busy}
        />
      )}

      {replyingTo && replyingTo.sender && (
        <ReplyDialog
          to={replyingTo.sender}
          subject={replyingTo.subject}
          onClose={() => setReplyingTo(null)}
          onSent={() => { setReplyingTo(null); reload(); setTab("sent"); setToast("Reply sent"); }}
        />
      )}

      {viewing && (
        <Modal title={viewing.subject || targetLabel(viewing, tab)} onClose={() => setViewing(null)}>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{targetLabel(viewing, tab)}</span>
              <span>{new Date(viewing.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <p className="whitespace-pre-wrap text-night dark:text-white">{viewing.body}</p>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            {tab === "inbox" && viewing.sender && (
              <Button variant="ghost" onClick={() => { setReplyingTo(viewing); setViewing(null); }}>Reply</Button>
            )}
            <Button variant="ghost" onClick={() => setViewing(null)}>Close</Button>
          </div>
        </Modal>
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl bg-night px-4 py-3 text-sm text-white shadow-lift">
          {toast}
        </div>
      )}
    </div>
  );
}
