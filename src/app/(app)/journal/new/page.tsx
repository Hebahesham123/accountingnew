"use client";

import JournalEntryForm from "@/components/JournalEntryForm";
import { PageHeader } from "@/components/ReportToolbar";

export default function NewJournalEntryPage() {
  return (
    <div dir="rtl">
      <PageHeader title="قيد جديد" subtitle="إنشاء قيد يومية جديد" />
      <JournalEntryForm />
    </div>
  );
}
