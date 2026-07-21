"use client";
import { ResourcePage } from "@/components/crud/resource-page";

export default function DepartmentsPage() {
  return (
    <ResourcePage
      title="Departments" singular="Department" group="Academic"
      endpoint="/academic/departments"
      columns={[
        { key: "name", label: "Department" },
        { key: "staffCount", label: "Staff" },
      ]}
      fields={[
        { name: "schoolId", label: "School", type: "select", optionsUrl: "/academic/schools", required: true, editable: false },
        { name: "name", label: "Department name", required: true, placeholder: "Science & Math" },
      ]}
    />
  );
}
