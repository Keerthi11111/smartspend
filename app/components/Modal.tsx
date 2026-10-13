/**
 * FILE: app/components/Modal.tsx
 * ROUTE: n/a (component)
 *
 * WHAT IT DOES: A reusable pop-up dialog. It dims the page, shows a box with
 * a title, optional description, a close (X) button, and whatever content
 * you put inside it (usually a form).
 * WHERE IT FITS: Used by the Accounts, Bills & Recurring, Savings Goals,
 * Debts & Loans and Categories pages for their "add / edit" forms. It calls
 * no API itself; the page inside it does.
 * WHY THIS CODE:
 * - "use client" because it uses hooks (useEffect, useId) and click handlers.
 * - useEffect adds a window "keydown" listener so Escape closes the modal,
 *   and returns a cleanup function that removes it when the modal closes
 *   (otherwise listeners would pile up).
 * - useId makes a unique id so screen readers can link the dialog to its
 *   title (aria-labelledby), even if two modals exist.
 * - Clicking the dark backdrop closes it; stopPropagation on the inner box
 *   stops clicks inside the form from also closing it.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
"use client";

import { X } from "lucide-react";
import { useEffect, useId } from "react";

// Props: text for the heading, a close callback, and the content (children)
interface ModalProps {
    title: string;
    description?: string;
    onClose: () => void;
    children: React.ReactNode;
}

export default function Modal({ title, description, onClose, children }: ModalProps) {
    // Unique id that connects the dialog to its <h2> title for accessibility
    const titleId = useId();

    // Close on Escape. The cleanup function removes the listener when the
    // modal unmounts (or onClose changes), so we never leak listeners.
    useEffect(() => {
        function handleKey(event: KeyboardEvent) {
            if (event.key === "Escape") onClose();
        }

        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [onClose]);

    // Outer div = dark full-screen backdrop (click it to close).
    // Inner div = the dialog box (clicks inside do not reach the backdrop).
    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 py-6"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                {/* Title row with close button */}
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                        <h2 id={titleId} className="text-xl font-semibold text-white">
                            {title}
                        </h2>

                        {description && (
                            <p className="mt-1 text-sm text-slate-400">{description}</p>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Whatever the page passes in (usually a form) */}
                {children}
            </div>
        </div>
    );
}
