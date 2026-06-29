export type Role = "admin" | "user";
export type ReportCategory = "asset" | "liability" | "equity" | "income" | "expense";
export type AccountType = "category" | "group" | "account";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  created_at: string;
}

export interface Entity {
  id: string;
  name: string;
  legal_name: string | null;
  currency: string;
  logo_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Account {
  id: string;
  entity_id: string;
  code: string;
  name: string;
  type: AccountType;
  report_category: ReportCategory | null;
  group_name: string | null;
  category_name: string | null;
  parent_id: string | null;
  is_postable: boolean;
  sort_order: number;
  created_at: string;
}

export interface Project {
  id: string;
  entity_id: string;
  name: string;
  code: string | null;
  status: "active" | "closed";
  budget: number | null;
  notes: string | null;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  entity_id: string;
  entry_no: number;
  ref_no: string | null;
  date: string;
  description: string | null;
  is_posted: boolean;
  created_by: string | null;
  created_at: string;
}

export interface JournalLine {
  id: string;
  entry_id: string;
  account_id: string;
  project_id: string | null;
  debit: number;
  credit: number;
  description: string | null;
  line_no: number;
}

export interface LedgerRow {
  entity_id: string;
  entry_id: string;
  entry_no: number;
  date: string;
  entry_description: string | null;
  account_id: string;
  account_code: string;
  account_name: string;
  report_category: ReportCategory | null;
  group_name: string | null;
  category_name: string | null;
  project_id: string | null;
  project_name: string | null;
  debit: number;
  credit: number;
  amount: number;
  line_description: string | null;
}

export const REPORT_CATEGORY_LABEL: Record<ReportCategory, string> = {
  asset: "الأصول",
  liability: "الخصوم / الالتزامات",
  equity: "حقوق الملكية",
  income: "الإيرادات",
  expense: "المصروفات",
};
