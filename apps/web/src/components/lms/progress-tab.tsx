"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";

interface RosterEntry {
  studentId: string; firstName: string; lastName: string;
  lessonsCompleted: number; totalLessons: number; percentComplete: number | null;
  assignmentsGraded: number; totalAssignments: number;
  quizzesAttempted: number; totalQuizzes: number; avgQuizScore: number | null;
}
interface SelfProgress extends Omit<RosterEntry, "firstName" | "lastName"> {}
interface ProgressResponse { roster?: RosterEntry[]; self?: SelfProgress }

export function ProgressTab({ courseId, isManager }: { courseId: string; isManager: boolean }) {
  const [data, setData] = useState<ProgressResponse | null>(null);

  useEffect(() => {
    api<ProgressResponse>(`/courses/${courseId}/progress`).then(setData).catch(() => setData(null));
  }, [courseId]);

  if (!data) return <p className="text-sm text-slate-500">Loading…</p>;

  if (isManager) {
    if (!data.roster || data.roster.length === 0) {
      return <Card><p className="text-sm text-slate-500">Assign this course to a class to see roster progress.</p></Card>;
    }
    return (
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr className="border-b border-slate-100 dark:border-white/5">
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 text-right font-medium">Lessons</th>
              <th className="px-4 py-3 text-right font-medium">Assignments graded</th>
              <th className="px-4 py-3 text-right font-medium">Quizzes</th>
              <th className="px-4 py-3 text-right font-medium">Avg quiz score</th>
            </tr>
          </thead>
          <tbody>
            {data.roster.map((r) => (
              <tr key={r.studentId} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                <td className="px-4 py-3 font-medium text-night dark:text-white">{r.firstName} {r.lastName}</td>
                <td className="px-4 py-3 text-right text-night dark:text-white">
                  {r.lessonsCompleted}/{r.totalLessons}{r.percentComplete !== null ? ` (${r.percentComplete}%)` : ""}
                </td>
                <td className="px-4 py-3 text-right text-night dark:text-white">{r.assignmentsGraded}/{r.totalAssignments}</td>
                <td className="px-4 py-3 text-right text-night dark:text-white">{r.quizzesAttempted}/{r.totalQuizzes}</td>
                <td className="px-4 py-3 text-right text-night dark:text-white">{r.avgQuizScore ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    );
  }

  if (!data.self) return <Card><p className="text-sm text-slate-500">No progress data yet.</p></Card>;
  const s = data.self;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Lessons completed" value={`${s.lessonsCompleted}/${s.totalLessons}`} delta={s.percentComplete !== null ? `${s.percentComplete}%` : undefined} />
      <StatCard label="Assignments graded" value={`${s.assignmentsGraded}/${s.totalAssignments}`} />
      <StatCard label="Quizzes attempted" value={`${s.quizzesAttempted}/${s.totalQuizzes}`} />
      <StatCard label="Avg quiz score" value={s.avgQuizScore !== null ? String(s.avgQuizScore) : "—"} />
    </div>
  );
}
