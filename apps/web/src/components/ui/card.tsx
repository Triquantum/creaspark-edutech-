export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white dark:bg-[#16213A] shadow-card p-6 ${className}`}>
      {children}
    </div>
  );
}
