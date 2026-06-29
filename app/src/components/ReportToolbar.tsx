"use client";
import { Button, Input, Select } from "@/components/ui";
import type { Project } from "@/lib/types";

export interface ReportFilters {
  from: string;
  to: string;
  projectId: string;
}

export function ReportToolbar({
  filters,
  setFilters,
  projects,
  onExport,
  showProject = true,
}: {
  filters: ReportFilters;
  setFilters: (f: ReportFilters) => void;
  projects?: Project[];
  onExport?: () => void;
  showProject?: boolean;
}) {
  return (
    <div className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <label className="text-sm">
        <span className="mb-1 block text-xs font-semibold text-slate-500">من تاريخ</span>
        <Input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          dir="ltr"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-xs font-semibold text-slate-500">إلى تاريخ</span>
        <Input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          dir="ltr"
        />
      </label>
      {showProject && projects && (
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-slate-500">المشروع</span>
          <div className="w-56">
            <Select
              value={filters.projectId}
              onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
            >
              <option value="">كل المشاريع</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
        </label>
      )}
      <div className="ms-auto flex gap-2">
        <Button variant="outline" onClick={() => setFilters({ from: "", to: "", projectId: "" })}>
          إعادة ضبط
        </Button>
        {onExport && (
          <Button variant="outline" onClick={onExport}>
            ⬇ تصدير CSV
          </Button>
        )}
        <Button variant="outline" onClick={() => window.print()}>
          🖨 طباعة
        </Button>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}
