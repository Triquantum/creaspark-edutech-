# ER Diagram (core domain)

```mermaid
erDiagram
    Tenant ||--o{ School : owns
    Tenant ||--o{ User : has
    School ||--o{ Class : has
    Class ||--o{ Section : has
    School ||--o{ Student : enrolls
    Section ||--o{ Student : contains
    Student ||--o{ Guardian : "cared for by"
    User |o--o| Student : "student login"
    User |o--o| StaffProfile : "staff record"
    School ||--o{ StaffProfile : employs
    Section ||--o{ AttendanceRecord : records
    Student ||--o{ AttendanceRecord : has
    School ||--o{ FeePlan : defines
    FeePlan ||--o{ FeePlanItem : contains
    Student ||--o{ FeeInvoice : billed
    FeePlan |o--o{ FeeInvoice : generates
    FeeInvoice ||--o{ Payment : "settled by"
    Exam ||--o{ ExamSubject : covers
    Subject ||--o{ ExamSubject : "assessed in"
    ExamSubject ||--o{ ExamResult : yields
    Student ||--o{ ExamResult : scores
    School ||--o{ Announcement : publishes
    User ||--o{ RefreshToken : holds
    User ||--o{ AuditLog : performs

    Tenant { string id PK  string slug UK  string plan }
    School { string id PK  string tenantId FK  string code }
    User { string id PK  string tenantId FK  string email  enum role }
    Student { string id PK  string tenantId FK  string admissionNo }
    FeeInvoice { string id PK  decimal amount  enum status }
    AttendanceRecord { string id PK  date date  enum status  enum method }
```

Every tenant-scoped table carries `tenantId` with composite indexes; unique keys are
tenant- or school-scoped (`[tenantId,email]`, `[schoolId,admissionNo]`, `[studentId,date]`).
