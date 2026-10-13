/**
 * FILE: app/types/transaction.ts
 * ROUTE: n/a (shared TypeScript types)
 *
 * WHAT IT DOES: Describes the shape of a simple transaction object for TypeScript.
 * It doesn't run at all; types are removed when the code is compiled.
 * WHERE IT FITS: Left over from the early version of the app. No file imports it
 * right now (the dashboard pages define their own types). Note the lowercase
 * "income"/"expense" values.
 * The database (prisma/schema.prisma) uses the TransactionType enum INCOME/EXPENSE instead.
 * WHY THIS CODE: Putting shared types in one file means every component agrees on
 * the same field names and types, and TypeScript warns if one is wrong.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */

// Only these two strings are allowed.
export type TransactionType="income" | "expense";

// One transaction as used in the UI. `description?` means the field is optional.
export interface Transaction {
    id:number;
    title:string;
    amount:number;
    type:TransactionType;
    category:string;
    date:string;
    description?:string;
}