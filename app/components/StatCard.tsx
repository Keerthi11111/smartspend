/**
 * FILE: app/components/StatCard.tsx
 * ROUTE: n/a (component)
 *
 * WHAT IT DOES: A small card that shows one number (e.g. "Total Balance"),
 * a short description, an icon, and an optional coloured trend label
 * such as "+12%".
 * WHERE IT FITS: Used by the dashboard overview (app/dashboard/page.tsx) for
 * its row of summary cards. It calls no API; the page passes in the values.
 * WHY THIS CODE:
 * - No "use client": it has no state or event handlers, so it can render
 *   anywhere. It runs in the browser here only because the page that uses it
 *   is a client component.
 * - It is purely presentational (data in through props), so the same card
 *   design is reused for every stat instead of repeating the markup.
 * - The icon is passed as a component (not an element) so the card controls
 *   its size and colour.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { LucideIcon } from "lucide-react";

// Props: title/value/description are display text; icon is a lucide icon
// component; trend is an optional small label shown before the description.
interface StatCardProps {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  trend?: {
    label: string;
    // Whether this change is good news for the user
    positive: boolean;
  };
}

export default function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
}: StatCardProps) {
  // "icon: Icon" above renames the prop to a capitalised name so it can be
  // used as a JSX tag (<Icon />).
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-start justify-between">
        {/* Left: title, big value, and description (with optional trend) */}
        <div>
          <p className="text-sm text-slate-400">
            {title}
          </p>

          <h3 className="mt-2 text-2xl font-bold text-white">
            {value}
          </h3>

          <p className="mt-2 text-xs text-slate-500">
            {/* Green when the change is good for the user, red when it is bad */}
            {trend && (
              <span
                className={`mr-1 font-medium ${
                  trend.positive ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {trend.label}
              </span>
            )}
            {description}
          </p>
        </div>

        {/* Right: the icon */}
        <div className="rounded-lg bg-slate-800 p-3 text-cyan-400">
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}
