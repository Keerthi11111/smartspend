import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
}

export default function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">
            {title}
          </p>

          <h3 className="mt-2 text-2xl font-bold text-white">
            {value}
          </h3>

          <p className="mt-2 text-xs text-slate-500">
            {description}
          </p>
        </div>

        <div className="rounded-lg bg-slate-800 p-3 text-cyan-400">
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}