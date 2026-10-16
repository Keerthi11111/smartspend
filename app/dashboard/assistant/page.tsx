/**
 * FILE: app/dashboard/assistant/page.tsx
 * ROUTE: /dashboard/assistant
 *
 * WHAT IT DOES: A full-page AI chat where the user asks questions about their
 * own spending ("What did I spend on food this month?").
 * WHERE IT FITS: Linked as "AI Assistant" under Insights in the Sidebar. The
 * chat itself is the ExpenseChat component, which calls POST /api/chat.
 * WHY THIS CODE:
 * - The page only adds the title and sizes the chat; ExpenseChat does the work.
 * - The chat box height is the screen height minus the header and page padding,
 *   so the message list scrolls inside the box instead of the whole page.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import ExpenseChat from "../../components/ExpenseChat";

export default function AssistantPage() {
  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold text-white">AI Assistant</h1>

        <p className="mt-2 text-slate-400">
          Ask questions about your income and spending.
        </p>
      </div>

      <div className="mt-6 h-[calc(100dvh-14rem)] min-h-[24rem]">
        <ExpenseChat variant="page" />
      </div>
    </div>
  );
}
