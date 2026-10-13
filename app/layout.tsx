/**
 * FILE: app/layout.tsx
 * ROUTE: wraps every page (/, /login, /register, /dashboard/*, ...)
 *
 * WHAT IT DOES: The root layout. It builds the outer <html> and <body> that every
 * page is placed inside. It loads the Geist fonts and the global CSS, and sets the
 * default page title and description.
 * WHERE IT FITS: Next.js renders it around every page automatically. `children` is
 * the current page (e.g. app/page.tsx). app/dashboard/layout.tsx is nested inside it
 * for logged-in pages. It imports app/globals.css.
 * WHY THIS CODE: The App Router needs one root layout, and it must contain <html> and
 * <body>. next/font downloads the fonts at build time and serves them from our own
 * site (no layout shift, no request to Google from the browser). It sets them as CSS
 * variables so Tailwind can use them (see globals.css).
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Load the fonts and expose them as CSS variables (--font-geist-sans / --font-geist-mono).
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Default <title> and <meta name="description"> for every page (pages may override).
export const metadata: Metadata = {
  title: "ExpensePro",
  description: "Track expenses, manage budgets and understand your spending.",
};

// LayoutProps<"/"> is a Next 16 global type that types `children` for this route.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
