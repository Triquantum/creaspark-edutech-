"use client";
import { ResourcePage } from "@/components/crud/resource-page";

export default function ClassesPage() {
  return (
    <ResourcePage
      title="Classes" singular="Class" group="Academic"
      endpoint="/academic/classes"
      columns={[
        { key: "name", label: "Class" },
        { key: "schoolName", label: "School", muted: true },
        { key: "sectionCount", label: "Divisions" },
      ]}
      fields={[
        { name: "schoolId", label: "School", type: "select", optionsUrl: "/academic/schools", required: true, editable: false },
        { name: "name", label: "Class name", required: true, placeholder: "Grade 11" },
      ]}
      deleteHint="Classes with divisions can't be deleted until the divisions are removed."
    />
  );
}
