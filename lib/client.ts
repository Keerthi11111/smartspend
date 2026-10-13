/**
 * FILE: lib/client.ts
 * ROUTE: n/a (helper)
 *
 * WHAT IT DOES: Browser-side helpers for the dashboard pages. apiFetch() calls our
 * API with JSON. errorMessage() turns any error into text. It also holds the shared
 * color palette and the Tailwind class strings for inputs, labels and buttons.
 * WHERE IT FITS: Imported by the "use client" pages in app/dashboard/** and by shared
 * components (Modal, TransactionForm, ColorPicker...). apiFetch calls the routes in
 * app/api/**, and calls redirectToLogin() (lib/redirect.ts) when the session has ended.
 * WHY THIS CODE: Without apiFetch, every page would repeat the same fetch → check
 * status → parse JSON → handle 401 code. Throwing the API's `{ error }` message
 * lets pages just `catch` and show it. Shared class strings keep forms looking the same.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { redirectToLogin } from "@/lib/redirect";

// fetch + JSON for client pages: redirects on 401, throws the API's error message
// <T> lets the caller say what shape of data it expects, e.g. apiFetch<Account[]>("/api/accounts").
// `signal` lets a page cancel the request (AbortController) when it unmounts.
export async function apiFetch<T = unknown>(
    url: string,
    options: { method?: string; body?: unknown; signal?: AbortSignal } = {}
): Promise<T> {
    // Only send a JSON header and body when there is a body (GET/DELETE usually have none).
    // The login cookie is sent automatically because the API is on the same site.
    const response = await fetch(url, {
        method: options.method ?? "GET",
        signal: options.signal,
        headers:
            options.body === undefined
                ? undefined
                : { "Content-Type": "application/json" },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    // 401 = not logged in / token expired → go to the login page.
    // We still throw so the calling page stops what it was doing.
    if (response.status === 401) {
        redirectToLogin();
        throw new Error("Your session has expired. Please log in again.");
    }

    // Some responses may have no JSON body. Use an empty object instead of crashing.
    const data = await response.json().catch(() => ({}));

    // Any other error status: throw the message the API sent via jsonError() (lib/api.ts).
    if (!response.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
    }

    return data as T;
}

// In a `catch (error)` the value can be anything. This always gives a string to display.
export function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Something went wrong.";
}

// Preset colors offered by the ColorPicker for categories, accounts and goals.
// The first one matches the server's default color in parseColor() (lib/api.ts).
export const colorOptions = [
    "#22d3ee",
    "#34d399",
    "#a3e635",
    "#facc15",
    "#fb923c",
    "#f87171",
    "#f472b6",
    "#c084fc",
    "#818cf8",
    "#94a3b8",
];

// Shared Tailwind class strings, so every form input/label/button looks the same
// and a style change only needs to be made here.
export const inputClass =
    "w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400";

export const labelClass = "mb-2 block text-sm font-medium text-slate-300";

export const primaryButtonClass =
    "flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
    "rounded-lg border border-slate-700 px-5 py-3 font-medium text-slate-300 hover:bg-slate-800 hover:text-white";
