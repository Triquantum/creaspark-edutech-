export function Card({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div className={`rounded-2xl bg-white dark:bg-[#16213A] shadow-card p-6 ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}
