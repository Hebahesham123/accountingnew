"use client";

import { useParams } from "next/navigation";
import JournalEntryForm from "@/components/JournalEntryForm";
import { PageHeader } from "@/components/ReportToolbar";

export default function EditJournalEntryPage() {
  const params = useParams();
  const raw = params?.id;
  const id = Array.isArray(raw) ? raw[0] : raw;

  return (
    <div dir="rtl">
      <PageHeader title="تعديل القيد" subtitle="تعديل قيد يومية" />
      {id ? <JournalEntryForm entryId={id} /> : null}
    </div>
  );
}
