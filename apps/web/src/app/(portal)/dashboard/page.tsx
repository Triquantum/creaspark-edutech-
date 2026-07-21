import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";

// Attendance last 7 days (would come from /attendance/summary)
const week = [92, 94, 90, 95, 93, 96, 94];

export default function Dashboard() {
  const max = 100;
  const points = week.map((v, i) => `${(i / (week.length - 1)) * 100},${100 - (v / max) * 100}`).join(" ");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Good morning, Asha</h1>
        <p className="text-sm text-slate-500">Wednesday, 15 July 2026 · Creaspark Demo School</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Students" value="1,248" delta="+12 this month" tone="up" />
        <StatCard label="Attendance today" value="94.2%" delta="+1.4%" tone="up" />
        <StatCard label="Fees collected (Jul)" value="₹18.4L" delta="76% of target" />
        <StatCard label="Pending invoices" value="87" delta="−9 vs last week" tone="up" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-night dark:text-white">Attendance — last 7 days</h2>
            <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">Healthy</span>
          </div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-6 h-48 w-full" role="img"
            aria-label="Line chart of daily attendance percentage over the last seven days, ranging from 90 to 96 percent">
            <polyline points={points} fill="none" stroke="#2F6FB8" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <polygon points={`0,100 ${points} 100,100`} fill="url(#g)" opacity="0.25" />
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4AA3FF" />
                <stop offset="100%" stopColor="#4AA3FF" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
          <div className="mt-2 flex justify-between text-xs text-slate-400">
            {["Wed","Thu","Fri","Sat","Mon","Tue","Today"].map((d) => <span key={d}>{d}</span>)}
          </div>
        </Card>

        <Card>
          <h2 className="font-display font-semibold text-night dark:text-white">Announcements</h2>
          <ul className="mt-4 space-y-4">
            {[
              ["Robotics Lab inauguration — Friday 10 AM", "Pinned · Principal"],
              ["Term 1 exam timetable published", "Yesterday · Exams"],
              ["Bus route 4 delayed 15 min today", "Today · Transport"],
            ].map(([title, meta]) => (
              <li key={title} className="border-l-2 border-accent pl-3">
                <p className="text-sm font-medium text-night dark:text-white">{title}</p>
                <p className="text-xs text-slate-400">{meta}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
