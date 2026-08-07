"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";

interface SubjectOpt { id: string; name: string }
interface ContentItem { subjectId: string | null }
interface SubjectCard { id: string; name: string; lessons: number; assignments: number; quizzes: number }

export default function MyLearningPage() {
  const [cards, setCards] = useState<SubjectCard[] | null>(null);

  useEffect(() => {
    Promise.all([
      api<SubjectOpt[]>("/academic/subjects"),
      api<ContentItem[]>("/lessons"),
      api<ContentItem[]>("/assignments"),
      api<ContentItem[]>("/quizzes"),
    ])
      .then(([subjects, lessons, assignments, quizzes]) => {
        const nameOf = new Map(subjects.map((s) => [s.id, s.name]));
        const counts = new Map<string, { lessons: number; assignments: number; quizzes: number }>();
        const bump = (id: string | null, key: "lessons" | "assignments" | "quizzes") => {
          if (!id) return;
          const entry = counts.get(id) ?? { lessons: 0, assignments: 0, quizzes: 0 };
          entry[key] += 1;
          counts.set(id, entry);
        };
        lessons.forEach((l) => bump(l.subjectId, "lessons"));
        assignments.forEach((a) => bump(a.subjectId, "assignments"));
        quizzes.forEach((q) => bump(q.subjectId, "quizzes"));
        const result = [...counts.entries()]
          .map(([id, c]) => ({ id, name: nameOf.get(id) ?? "Subject", ...c }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setCards(result);
      })
      .catch(() => setCards([]));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Learning</p>
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">My Learning</h1>
        <p className="mt-1 text-sm text-slate-500">Lessons, assignments and quizzes published for your class.</p>
      </div>

      {cards === null ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : cards.length === 0 ? (
        <Card><p className="text-sm text-slate-500">Nothing published for your class yet.</p></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <Link key={c.id} href={`/lms/courses/${c.id}`}>
              <Card className="h-full transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lift">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <BookOpen size={18} />
                </span>
                <h3 className="mt-3 font-display font-semibold text-night dark:text-white">{c.name}</h3>
                <p className="mt-2 text-xs text-slate-400">
                  {c.lessons} lesson{c.lessons === 1 ? "" : "s"} · {c.assignments} assignment{c.assignments === 1 ? "" : "s"} · {c.quizzes} quiz{c.quizzes === 1 ? "" : "zes"}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
