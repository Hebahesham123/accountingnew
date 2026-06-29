"use client";
import { useEffect, useState, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Account, Project, LedgerRow, JournalEntry } from "@/lib/types";

/** Fetch ALL rows from a table/view for an entity, paging past the 1000-row cap. */
export async function fetchAll<T>(
  table: string,
  entityId: string,
  select = "*",
  order?: { col: string; asc?: boolean }
): Promise<T[]> {
  const sb = supabaseBrowser();
  const page = 1000;
  let from = 0;
  const out: T[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = sb.from(table).select(select).eq("entity_id", entityId).range(from, from + page - 1);
    if (order) q = q.order(order.col, { ascending: order.asc ?? true });
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data as unknown as T[]) ?? [];
    out.push(...rows);
    if (rows.length < page) break;
    from += page;
  }
  return out;
}

export function useAccounts(entityId: string | null) {
  const [data, setData] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!entityId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const rows = await fetchAll<Account>("accounts", entityId, "*", { col: "code" });
    setData(rows);
    setLoading(false);
  }, [entityId]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { accounts: data, loading, reload };
}

export function useProjects(entityId: string | null) {
  const [data, setData] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!entityId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const rows = await fetchAll<Project>("projects", entityId, "*", { col: "name" });
    setData(rows);
    setLoading(false);
  }, [entityId]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { projects: data, loading, reload };
}

export function useLedger(entityId: string | null) {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!entityId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await fetchAll<LedgerRow>("v_ledger", entityId, "*");
    setRows(data);
    setLoading(false);
  }, [entityId]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { rows, loading, reload };
}

export function useEntries(entityId: string | null) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!entityId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const rows = await fetchAll<JournalEntry>("journal_entries", entityId, "*", { col: "entry_no", asc: false });
    setEntries(rows);
    setLoading(false);
  }, [entityId]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { entries, loading, reload };
}
