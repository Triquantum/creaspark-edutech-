"use client";
import { ResourcePage } from "@/components/crud/resource-page";

export default function SubjectsPage() {
  return (
    <ResourcePage
      title="Subjects" singular="Subject" group="Academic"
      endpoint="/academic/subjects"
      columns={[
        { key: "name", label: "Subject" },
        { key: "code", label: "Code", muted: true },
      ]}
      fields={[
        { name: "name", label: "Subject name", required: true, placeholder: "Mathematics" },
        { name: "code", label: "Code", placeholder: "MATH" },
      ]}
      deleteHint="Subjects used in exams can't be deleted."
    />
  );
}
