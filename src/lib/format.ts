export function fmtMoney(n: number, currency = "EGP"): string {
  const v = Math.round((n + Number.EPSILON) * 100) / 100;
  const s = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(v));
  return v < 0 ? `(${s})` : s;
}

export function fmtNum(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
}

export function fmtDate(d: string | null): string {
  if (!d) return "";
  return d.slice(0, 10);
}

export const todayISO = () => new Date().toISOString().slice(0, 10);
