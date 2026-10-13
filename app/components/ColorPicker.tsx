/**
 * FILE: app/components/ColorPicker.tsx
 * ROUTE: n/a (component)
 *
 * WHAT IT DOES: A row of round colour swatches. Clicking one selects it and
 * shows a tick mark on it.
 * WHERE IT FITS: Used inside the add/edit forms on the Accounts, Savings
 * Goals and Categories pages so each item can have its own colour. It calls
 * no API; the parent form saves the chosen colour.
 * WHY THIS CODE:
 * - It is a "controlled" component: the parent holds the selected colour
 *   (value) and receives changes via onChange. That keeps the form's data in
 *   one place.
 * - The colour list comes from lib/client.ts (colorOptions) so every page
 *   offers the same palette.
 * - role="radiogroup" / role="radio" + aria-checked tell screen readers this
 *   is a "pick one" choice; aria-checked also drives the white ring styling.
 * - No "use client" line of its own: it is only imported by client pages,
 *   so it already runs in the browser.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { Check } from "lucide-react";
import { colorOptions, labelClass } from "@/lib/client";

// value = currently selected colour (hex); onChange = called with the new colour
interface ColorPickerProps {
    value: string;
    onChange: (color: string) => void;
}

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
    return (
        <div>
            <span className={labelClass}>Color</span>

            {/* One button per colour; type="button" so it never submits the parent form */}
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
                {colorOptions.map((color) => (
                    <button
                        key={color}
                        type="button"
                        role="radio"
                        aria-checked={value === color}
                        aria-label={color}
                        onClick={() => onChange(color)}
                        className="flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 ring-offset-slate-900 transition hover:scale-110 aria-checked:ring-2 aria-checked:ring-white"
                        style={{ backgroundColor: color }}
                    >
                        {value === color && <Check size={16} className="text-slate-950" />}
                    </button>
                ))}
            </div>
        </div>
    );
}
