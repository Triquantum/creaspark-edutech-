"use client";
import { ResourcePage } from "@/components/crud/resource-page";

export default function DivisionsPage() {
  return (
    <ResourcePage
      title="Divisions" singular="Division" group="Academic"
      endpoint="/academic/sections"
      columns={[
        { key: "name", label: "Division" },
        { key: "className", label: "Class", muted: true },
        { key: "studentCount", label: "Students" },
      ]}
      fields={[
        { name: "classId", label: "Class", type: "select", optionsUrl: "/academic/classes", required: true },
        { name: "name", label: "Division name", required: true, placeholder: "C" },
      ]}
      deleteHint="Divisions with students can't be deleted until students are moved."
    />
  );
}
