# ExpensePro — Project Guide

ExpensePro is a personal-finance app. You use it to track income and expenses,
manage accounts, budgets, savings goals, recurring bills and debts, and see
reports. This guide covers the whole project: which page loads first, how a
request moves through the code, and why each folder exists.
Every source file also starts with a header comment explaining that file.

---

## 1. Tech stack (and why)

| Tool | Used for | Why |
|------|----------|-----|
| **Next.js 16 (App Router)** | Pages (`app/**/page.tsx`) and the backend API (`app/api/**/route.ts`) | Frontend and backend live in one project, with file-based routing |
| **React 19** | UI components | Component model, hooks (`useState`, `useEffect`) |
| **TypeScript** | All code | Catches type mistakes before runtime |
| **Tailwind CSS 4** | Styling via class names | No separate CSS files per component |
| **Prisma 7 + PostgreSQL** | Database access (`lib/prisma.ts`, `prisma/schema.prisma`) | Type-safe queries generated from the schema |
| **jose** | Creating and verifying JWT login tokens (`lib/auth.ts`) | Also works in the Edge runtime, so `proxy.ts` can use it |
| **bcryptjs** | Hashing passwords | Plain-text passwords are never stored |
| **recharts** | Charts on the dashboard and reports pages | Ready-made React chart components |
| **lucide-react** | Icons | Lightweight SVG icon set |

---

## 2. Which page comes first? (the user journey)

```
1. /                 app/page.tsx              Landing page ("Get Started")
        │
        ▼
2. /register         app/register/page.tsx     Create account → POST /api/auth/register
        │
        ▼
3. /login            app/login/page.tsx        Login → POST /api/auth/login → sets "token" cookie
        │
        ▼
4. /dashboard        app/dashboard/page.tsx    Overview (stats, charts, recent items)
        │            wrapped by app/dashboard/layout.tsx (Sidebar + Header)
        ▼
5. Sidebar pages (in sidebar order):
   Dashboard, Calendar, Transactions, Accounts, Bills & Recurring,
   Budget, Savings Goals, Debts & Loans, Reports, Categories, Settings
        │
        ▼
6. Logout (Sidebar button) → POST /api/auth/logout → cookie cleared → /login
```

### Why this order
- **Landing page first**: `app/page.tsx` is the `/` route, so every visitor sees it first.
- **Login is required for the dashboard.** `proxy.ts` runs before every `/dashboard/*`
  request. Without a valid token it sends you to `/login?next=/dashboard/...`.
  After login, the login page sends you back to that `next` path.
- **Logged-in users skip login.** If you are already logged in and open `/login` or
  `/register`, `proxy.ts` redirects you to `/dashboard`.

---

## 3. How a request flows

```
Browser page (client component, "use client")
   │  apiFetch("/api/...")            ← lib/client.ts (adds JSON, handles 401 → /login)
   ▼
API route  app/api/<name>/route.ts    ← GET / POST / PUT / DELETE functions
   │  getAuthenticatedUser()          ← lib/get-auth-user.ts (reads cookie, verifies JWT)
   │  parse*/validate body            ← lib/api.ts, lib/validation.ts
   │  processDueRecurring(userId)     ← lib/recurring.ts (auto-posts due bills, where relevant)
   ▼
prisma.<model>.<query>()              ← lib/prisma.ts (single shared DB client)
   ▼
PostgreSQL (tables defined in prisma/schema.prisma)
   ▼
NextResponse.json(...) → page updates its React state → UI re-renders
```

**Security in two layers:**
1. `proxy.ts` is a fast, *optimistic* redirect for pages.
2. **Every API route checks the user again** with `getAuthenticatedUser()` and filters
   every query by `userId`. One user can never read or change another user's data.

---

## 4. Folder map

```
proxy.ts                    Route guard (runs before /dashboard, /login, /register)
prisma/
  schema.prisma             Database tables (User, Category, Expense, Budget, Account,
                            Transfer, SavingsGoal, RecurringTransaction, Debt)
  migrations/               SQL history of schema changes
generated/prisma/           AUTO-GENERATED Prisma client (do not edit by hand)
lib/                        Shared helpers
  prisma.ts                   Database client (one instance, reused)
  auth.ts                     createToken / verifyToken (JWT)
  get-auth-user.ts            Current user from the cookie (used by API routes)
  api.ts                      Server helpers: jsonError, parseId, parseAmount, ownership checks
  validation.ts               Request-body validators for accounts, goals, recurring, debts...
  recurring.ts                Auto-posts due recurring transactions
  schedule.ts                 advanceDate() for weekly / monthly / yearly repeats
  client.ts                   Browser helpers: apiFetch, shared Tailwind class strings, colors
  format.ts                   formatCurrency (₹), formatDate, monthLabel
  redirect.ts                 redirectToLogin()
app/
  layout.tsx                Root HTML layout (fonts, globals.css) wrapping every page
  globals.css               Tailwind import and global styles
  page.tsx                  Landing page  (/)
  login/, register/         Auth pages
  expenses/page.tsx         Old demo form (legacy; the real UI is /dashboard/transactions)
  types/transaction.ts      Shared TypeScript type
  components/               Reusable UI: Sidebar, Header, StatCard, Modal,
                            TransactionForm, ColorPicker, FormError
  dashboard/                All logged-in pages (share dashboard/layout.tsx)
    page.tsx                  Overview
    calendar/                 Month calendar of transactions and upcoming bills
    transactions/             List, add, [id]/edit
    accounts/                 Bank / cash / card accounts, balances, transfers
    recurring/                Bills & subscriptions (auto-add or "mark paid")
    budgets/                  Monthly budget per category (list + add)
    goals/                    Savings goals with progress
    debts/                    Money lent / borrowed, repayments
    reports/                  Charts and summaries over a date range
    categories/               Custom categories with colors
    settings/                 Profile and password
  api/                      Backend endpoints (one folder per resource)
    auth/{login,register,logout,me}
    dashboard, reports       Aggregated data for those pages
    transactions, expenses   Income and expense records ([id] = single item)
    accounts, transfers, budgets, goals, recurring, debts, categories, settings
```

---

## 5. Next.js conventions used here

- `page.tsx` → a URL page. Folder path = URL (`app/dashboard/goals/page.tsx` → `/dashboard/goals`).
- `layout.tsx` → wraps every page below it (the dashboard layout adds Sidebar and Header).
- `route.ts` → an API endpoint. Exported function names (`GET`, `POST`, `PUT`, `DELETE`) are the HTTP methods.
- `[id]` folder → a dynamic segment. Read it with `const { id } = await params` (params is a Promise in Next 16).
- `"use client"` → the component runs in the browser (needed for `useState`, `onClick` and so on).
- `proxy.ts` → Next 16's name for what was `middleware.ts`.

---

## 6. Running it

```bash
npm install
# .env needs DATABASE_URL (PostgreSQL) and JWT_SECRET
npx prisma migrate dev      # create tables
npm run dev                 # http://localhost:3000
```
