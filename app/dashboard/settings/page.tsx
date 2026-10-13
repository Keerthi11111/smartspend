/**
 * FILE: app/dashboard/settings/page.tsx
 * ROUTE: /dashboard/settings
 *
 * WHAT IT DOES: The Settings page, with three cards: edit your profile (name and
 * email), change your password, and download all your transactions as a CSV file.
 * WHERE IT FITS: Reached from the "Settings" link in the Sidebar. Calls
 * GET /api/auth/me (load profile), PUT /api/settings/profile (save profile),
 * PUT /api/settings/password (change password) and GET /api/transactions (export).
 * WHY THIS CODE: "use client" because it uses state, effects and form events.
 * Each card is its own component (ProfileSection, PasswordSection, ExportSection)
 * with its own state, so saving one form never affects the others. A small
 * Section component gives all three the same card layout. The CSV is built in the
 * browser from data we already have an API for, so no extra export endpoint is needed.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
"use client";

import { Download, KeyRound, Save, User } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import FormError from "../../components/FormError";
import { toDateInputValue } from "@/lib/format";
import { apiFetch, errorMessage, inputClass, labelClass, primaryButtonClass } from "@/lib/client";

// The fields we read from GET /api/transactions to build the CSV export.
interface ExportTransaction {
    date: string;
    title: string;
    type: string;
    amount: number;
    description: string | null;
    category: { name: string } | null;
    account: { name: string } | null;
}

// Green success message box (the opposite of FormError). Renders nothing when empty.
function Success({ message }: { message: string }) {
    if (!message) return null;

    return (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            {message}
        </div>
    );
}

// The page itself is just a heading plus the three independent section cards.
export default function SettingsPage() {
    return (
        <div>
            <h1 className="text-3xl font-bold text-white">Settings</h1>
            <p className="mt-2 text-slate-400">Manage your profile, security and data.</p>

            <div className="mt-8 grid max-w-3xl gap-6">
                <ProfileSection />
                <PasswordSection />
                <ExportSection />
            </div>
        </div>
    );
}

// Shared card layout: icon + title + description at the top, then the
// section's content (`children`). `icon: Icon` renames the prop to a capitalised
// name so it can be used as a JSX component (<Icon />).
function Section({
    icon: Icon,
    title,
    description,
    children,
}: {
    icon: typeof User;
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 md:p-8">
            <div className="mb-6 flex items-start gap-3">
                <div className="rounded-lg bg-slate-800 p-2.5 text-cyan-400">
                    <Icon size={20} />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-white">{title}</h2>
                    <p className="text-sm text-slate-400">{description}</p>
                </div>
            </div>
            {children}
        </section>
    );
}

// Card 1: edit name and email.
function ProfileSection() {
    // Form fields + loading (fetching current profile), saving, error and success flags.
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Load the current user's name and email once, to pre-fill the form.
    // API call: GET /api/auth/me.
    useEffect(() => {
        apiFetch<{ user: { name: string; email: string } }>("/api/auth/me")
            .then(({ user }) => {
                setName(user.name);
                setEmail(user.email);
            })
            .catch((error) => setError(errorMessage(error)))
            .finally(() => setLoading(false));
    }, []);

    // Save the profile. API call: PUT /api/settings/profile.
    async function handleSubmit(event: FormEvent) {
        event.preventDefault();

        try {
            setSaving(true);
            setError("");
            setSuccess("");

            await apiFetch("/api/settings/profile", { method: "PUT", body: { name, email } });

            setSuccess("Profile updated.");
            // Header loads the user once on mount, so let it pick up the new name
            setTimeout(() => window.location.reload(), 800);
        } catch (error) {
            setError(errorMessage(error));
        } finally {
            setSaving(false);
        }
    }

    return (
        <Section icon={User} title="Profile" description="Your name and login email.">
            {/* Show "Loading..." until the current profile arrives, then the form */}
            {loading ? (
                <p className="text-slate-400">Loading...</p>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid gap-5 md:grid-cols-2">
                        <div>
                            <label htmlFor="profile-name" className={labelClass}>
                                Name
                            </label>
                            <input
                                id="profile-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label htmlFor="profile-email" className={labelClass}>
                                Email
                            </label>
                            <input
                                id="profile-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={inputClass}
                            />
                        </div>
                    </div>

                    <FormError message={error} />
                    <Success message={success} />

                    <div className="flex justify-end">
                        <button type="submit" disabled={saving} className={primaryButtonClass}>
                            <Save size={18} />
                            {saving ? "Saving..." : "Save Profile"}
                        </button>
                    </div>
                </form>
            )}
        </Section>
    );
}

// Card 2: change password.
function PasswordSection() {
    // The three password fields plus saving / error / success flags.
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Validate in the browser first (length, and both new passwords match),
    // then send to the API, which also checks the current password is correct.
    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        setError("");
        setSuccess("");

        if (newPassword.length < 6) {
            setError("New password must contain at least 6 characters.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("New passwords don't match.");
            return;
        }

        try {
            setSaving(true);

            // API call: PUT /api/settings/password.
            await apiFetch("/api/settings/password", {
                method: "PUT",
                body: { currentPassword, newPassword },
            });

            // Success: show a message and clear the fields so passwords don't stay on screen.
            setSuccess("Password changed.");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (error) {
            setError(errorMessage(error));
        } finally {
            setSaving(false);
        }
    }

    return (
        <Section icon={KeyRound} title="Change password" description="Use at least 6 characters.">
            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label htmlFor="current-password" className={labelClass}>
                        Current password
                    </label>
                    <input
                        id="current-password"
                        type="password"
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        className={inputClass}
                    />
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                    <div>
                        <label htmlFor="new-password" className={labelClass}>
                            New password
                        </label>
                        <input
                            id="new-password"
                            type="password"
                            autoComplete="new-password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label htmlFor="confirm-password" className={labelClass}>
                            Confirm new password
                        </label>
                        <input
                            id="confirm-password"
                            type="password"
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className={inputClass}
                        />
                    </div>
                </div>

                <FormError message={error} />
                <Success message={success} />

                <div className="flex justify-end">
                    <button type="submit" disabled={saving} className={primaryButtonClass}>
                        {saving ? "Updating..." : "Update Password"}
                    </button>
                </div>
            </form>
        </Section>
    );
}

// Card 3: download every transaction as a CSV file.
function ExportSection() {
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState("");

    // Fetch all transactions, turn them into CSV text, and make the browser
    // download it as a file.
    async function exportAll() {
        try {
            setExporting(true);
            setError("");

            // API call: GET /api/transactions (all of the user's transactions).
            const transactions = await apiFetch<ExportTransaction[]>("/api/transactions");
            // Wrap every cell in quotes and double any quotes inside it, so commas,
            // quotes or line breaks in a title don't break the CSV columns.
            const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

            // First row = column headers, then one row per transaction.
            const rows = [
                ["Date", "Title", "Type", "Category", "Account", "Amount", "Description"],
                ...transactions.map((t) => [
                    toDateInputValue(t.date),
                    t.title,
                    t.type,
                    t.category?.name ?? "",
                    t.account?.name ?? "",
                    String(t.amount),
                    t.description ?? "",
                ]),
            ];

            // Join cells with commas and rows with new lines, then wrap the text in a
            // Blob and get a temporary URL for it.
            const csv = rows.map((row) => row.map(escape).join(",")).join("\n");
            const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));

            // Trigger the download with a hidden <a download> link, then free the
            // temporary URL so it doesn't waste memory.
            const link = document.createElement("a");
            link.href = url;
            link.download = `expensepro-all-transactions-${toDateInputValue()}.csv`;
            link.click();

            URL.revokeObjectURL(url);
        } catch (error) {
            setError(errorMessage(error));
        } finally {
            setExporting(false);
        }
    }

    return (
        <Section
            icon={Download}
            title="Export your data"
            description="Download every transaction as a CSV file you can open in Excel or Google Sheets."
        >
            <FormError message={error} />
            <button
                type="button"
                onClick={exportAll}
                disabled={exporting}
                className={`${primaryButtonClass} ${error ? "mt-4" : ""}`}
            >
                <Download size={18} />
                {exporting ? "Preparing..." : "Export All Transactions"}
            </button>
        </Section>
    );
}
