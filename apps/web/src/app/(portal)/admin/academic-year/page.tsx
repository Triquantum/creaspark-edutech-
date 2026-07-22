"use client";
import { ResourcePage } from "@/components/crud/resource-page";

export default function AcademicYearPage() {
  return (
    <ResourcePage
      title="Academic Year" singular="Academic year" group="Administrator"
      endpoint="/academic/academic-years"
      columns={[
        { key: "label", label: "Year" },
        { key: "startDate", label: "Starts", muted: true },
        { key: "endDate", label: "Ends", muted: true },
        { key: "isCurrent", label: "Current", muted: true },
      ]}
      fields={[
        { name: "schoolId", label: "School", type: "select", optionsUrl: "/academic/schools", required: true, editable: false },
        { name: "label", label: "Label", required: true, placeholder: "2026-27" },
        { name: "startDate", label: "Start date", type: "date", required: true },
        { name: "endDate", label: "End date", type: "date", required: true },
      ]}
    />
  );
}
