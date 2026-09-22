# Printex Print Shop Management System
### Product Requirements Document — V1

**Document Type:** Product Requirements Document  
**Product:** Printex Internal Print Shop Management System  
**Primary Users:** Reception, Designers, Head Designer, Production Operators, Print Reception/Delivery, Accounting, Admin/Owner  
**Primary Language:** Arabic (RTL)  
**Deployment Model:** Local LAN / On-Premises  
**Status:** V1 Product Definition

---

# 1. Product Definition

Printex is a custom internal operating system for a printing business.

The system is not primarily an accounting application. Its core purpose is to make the complete lifecycle of every customer job visible, traceable, and controlled:

**Customer Request → Order → Design → Review → Production → Collection → Delivery → Financial Closure**

The system replaces the current dependency on:

- WhatsApp conversations distributed across multiple devices
- Manual folders
- Manual order tracking
- Manual pricing
- Unstructured internal communication
- Untracked revisions
- Missing production records
- Manual reconciliation between departments
- Informal knowledge about which employee should handle which job

The source meeting repeatedly identifies the central problem as losing visibility of a job while it moves between departments. The desired system therefore treats the **Order and its Work Items as the central operational objects**, rather than treating folders or invoices as the source of truth.

---

# 2. Product Goals

## Primary Goals

### 2.1 One source of truth

Every job must exist in the system regardless of how the customer initiated it:

- Walk-in
- WhatsApp
- Phone
- Returning customer
- Existing customer requesting a previous job
- Customer working directly with a designer

No production work should depend on an undocumented external request.

The source meeting explicitly identifies WhatsApp and phone requests that currently bypass structured entry as part of the operational problem.

### 2.2 End-to-end visibility

At any moment, authorized users should be able to answer:

> Where is this order now?

Examples:

- Reception
- Assigned to Designer A
- In Design
- Waiting for Head Designer
- Rejected / Rework Required
- Approved
- Waiting for Pricing
- In Digital Production
- In Banner Production
- Ready for Collection
- Delivered

Management must be able to view this globally across departments.

### 2.3 Eliminate uncontrolled changes

The system must prevent the current situation where an order or folder can be edited or deleted without accounting or management knowing what happened.

Normal users must not physically delete operational history.

Changes must create immutable audit events.

### 2.4 Reduce operational dependency on individual memory

The system should preserve institutional knowledge such as:

- Which designer is experienced with a customer
- Which employee usually handles a specific type of job
- Which production department owns the job
- Why a job was rejected
- What was changed
- What was damaged
- How the issue was compensated

---

# 3. Non-Goals for V1

The following are explicitly outside the initial core scope or are intended for later phases:

- Full inventory management
- Full payroll management
- Advanced AI production estimation
- Multi-branch accounting separation
- Complex multi-company ERP functionality
- Full customer self-service portal
- Automatic production optimization
- Automated AI pricing as an authoritative pricing source

These may be introduced later without changing the core Order model.

The meeting explicitly recognizes that inventory alone contains significant complexity and should evolve in stages.

---

# 4. Core Domain Model

The system should be based on a small number of clear entities.

## 4.1 Customer

Represents the customer identity and customer-specific information.

Possible identifying information:

- Customer name
- Phone number
- Optional national ID
- Alternative phone numbers
- Addresses
- Notes
- Customer classification
- Special pricing rules
- Customer history

Phone number is the preferred primary lookup mechanism because the same customer may appear repeatedly with slightly different names.

---

## 4.2 Order

Represents the customer's overall request.

One customer may have one Order containing multiple types of work.

Example:

**Order #1025 — Customer: ABC Factory**

- Banner
- Digital Printing
- Laser
- Stickers

The Order remains the parent business object.

---

## 4.3 Work Item

A Work Item represents an independently executable component of an Order.

Example:

```text
Order #1025
│
├── Work Item A — Digital
├── Work Item B — Banner
├── Work Item C — Laser
└── Work Item D — Stickers
```

Each Work Item may have:

- Assigned designer
- Design state
- Review state
- Production department
- Production state
- Quantity
- Dimensions
- Material
- Files
- Pricing
- Timers
- Notes
- Revision history
- Damage/waste records

This structure supports both requested operating modes:

### Separate mode

Each Work Item moves independently.

### Grouped mode

Multiple Work Items remain visually and operationally grouped under one Order and can be treated as one customer package.

Internally, Work Items should still remain individually traceable even when grouped.

This avoids creating two completely different workflows.

---

# 5. Order Creation Rules

## Mandatory Creation

Every customer request must be represented in the system.

This applies even when:

- The request arrives through WhatsApp.
- The customer calls.
- The customer walks in.
- The customer already knows the designer.
- A previous customer requests an old job.
- The job is urgent.
- The customer goes directly to a designer.

The system should support a **Quick Create** flow for situations where staff must record a job immediately without going through a long form.

Missing secondary information may be completed later.

---

# 6. Priority and Urgent Work

Orders must support a priority level.

Minimum priorities:

- Normal
- Urgent

Urgent work may bypass normal waiting queues when operationally necessary.

However:

> Urgent priority must not silently bypass mandatory control gates such as required review, audit logging, or pricing-before-delivery.

Urgent work should remain fully recorded and visible.

---

# 7. Order Lifecycle

The core lifecycle is:

```text
Customer Request
      ↓
Order Created
      ↓
Work Items Defined
      ↓
Designer Assignment
      ↓
Design
      ↓
Head Designer Review
      ↓
 ┌───────────────┐
 │   Rejected    │
 │      ↓        │
 │   Rework      │
 │      ↓        │
 └──→ Review ────┘
      ↓
Approved
      ↓
Production Queue
      ↓
Production
      ↓
Production Completed
      ↓
Print Reception / Collection Area
      ↓
Ready for Customer
      ↓
Delivery
      ↓
Financial Closure
      ↓
Completed
```

The Order-level status is derived from the states of its Work Items.

This is necessary because a single Order may contain multiple production paths simultaneously.

---

# 8. Order Status Model

Recommended Work Item states:

```text
NEW
ASSIGNED
IN_DESIGN
DESIGN_COMPLETED
WAITING_REVIEW
REWORK_REQUIRED
APPROVED
WAITING_PRICING
READY_FOR_PRODUCTION
IN_PRODUCTION
PRODUCTION_COMPLETED
READY_FOR_COLLECTION
DELIVERED
COMPLETED
CANCELLED
```

Not every Work Item must pass through every state.

For example, a simple fixed-price job may move rapidly from production-ready to production.

A complex job may require pricing, revision, review, and multiple production steps.

---

# 9. Reception Workflow

Reception is the operational entry point.

## Responsibilities

Reception can:

- Find existing customers
- Create customers
- Create Orders
- Add Work Items
- Record specifications
- Attach initial customer files
- Assign designers
- Mark priority
- View order status
- Communicate with customers
- Follow up on delayed jobs
- Trigger predefined customer messages
- View customer financial summary where permitted
- Handle urgent jobs

Reception users should have equivalent operational capabilities so one employee can cover another when necessary.

This reflects the owner's explicit requirement that reception employees should be able to cover one another rather than being locked into isolated responsibilities.

---

# 10. Designer Assignment

Default responsibility:

**Reception assigns the Designer.**

Assignment is based primarily on:

- Experience
- Customer familiarity
- Job type
- Required skill
- Existing workload

The system should display:

- Current workload per designer
- Active jobs
- Queue size
- Estimated waiting time

### Optional Assistant

The system may provide an assistant feature that answers:

> Which eligible designer currently has the lightest workload?

This can initially be rule-based rather than AI.

AI may later enhance the recommendation using historical performance and specialization data.

The system must never automatically assign a designer in V1 unless explicitly enabled.

---

# 11. Designer Workflow

When a Work Item is assigned:

1. Designer receives notification.
2. Work Item enters Designer queue.
3. Designer opens the Work Item.
4. Designer starts the work timer.
5. Designer works on the design.
6. Designer uploads the resulting design/version.
7. Designer marks work as completed.
8. Work Item moves to Head Designer Review.

The Designer does not directly bypass the Head Designer when review is required.

---

# 12. Time Tracking

Timing is a core operational feature.

The system must measure at least:

### Queue Time

Time spent waiting for the employee.

### Active Work Time

Actual time spent actively working.

### Total Phase Duration

Total elapsed duration of the phase.

Every phase should have its own timing.

Example:

```text
Reception → Designer Assignment
Queue: 18m

Design
Active Work: 42m
Total Duration: 1h 05m

Head Review
Duration: 7m

Production
Active Work: 25m
```

Timers must survive browser refreshes and application restarts.

The system must store timestamps instead of relying only on a running stopwatch.

---

# 13. Head Designer Review

The Head Designer is a mandatory quality gate for Work Items that require design review.

Responsibilities:

- Review dimensions
- Review design correctness
- Review production suitability
- Review required specifications
- Approve or reject

Approval moves the Work Item forward.

Rejection moves it to:

**REWORK_REQUIRED**

---

# 14. Rejection and Rework

A rejection is never just a status change.

Every rejection must contain:

- Rejecting employee
- Timestamp
- Rejection category
- Explanation
- Optional text note
- Optional voice note
- Optional image
- Optional file attachment

Possible categories:

- Design issue
- Dimension issue
- Customer change
- Pricing issue
- Accounting issue
- Production issue
- Missing information
- Other

The category must identify **where the problem originated**.

This is important because the business wants to distinguish whether a returned job resulted from design, pricing, accounting, or another department rather than simply knowing that "something was wrong."

When rejected:

**The responsible Designer must receive a notification immediately.**

The Designer must be able to open the rejection details and continue the job.

The revision becomes part of the permanent history.

---

# 15. Versioning and Design History

Every significant design change must create a new version.

Example:

```text
Design v1
Design v2
Design v3
Approved v4
```

The system must preserve:

- Version number
- Uploaded by
- Timestamp
- Version type
- Related note
- Approval/rejection information

Older versions must remain accessible to authorized users.

No normal operational action should permanently overwrite an existing approved version.

---

# 16. Production Workflow

Production is divided into configurable Production Departments.

Initial departments:

- Digital
- Banner
- Outdoor
- Laser
- External Production

The architecture must allow Admin to add new production departments later.

Examples:

```text
Offset
Screen Printing
Packaging
Cards
Other
```

The current business already has production work divided by machine/type and also uses external production paths.

---

# 17. Production Operator Permissions

Production operators should only see Work Items relevant to:

- Their production department
- Their assigned machine or operational scope, where applicable

They should primarily be able to:

- View assigned production work
- Download production files
- View specifications
- Start production timer
- Stop production timer
- Mark production completed
- Record production notes
- Record waste/damage where permitted

They should not be able to freely modify:

- Customer identity
- Original order specification
- Pricing
- Financial data
- Design history

The owner explicitly wants controlled access because an incorrect production interpretation can result in unusable output.

---

# 18. Production Completion

When a production operator completes a job:

- Production timer closes.
- Completion timestamp is stored.
- Operator is recorded.
- Production status changes.
- Work Item is moved to Print Reception / Collection.

The system then knows that the production stage is complete.

---

# 19. Print Reception / Collection Area

This department receives completed production output.

Responsibilities:

- Receive completed work
- Identify the associated Order
- Check quantities
- Mark available quantities
- Record shortages
- Record damaged items
- Store relevant notes
- Prepare work for customer delivery

The physical operation described in the meeting involves completed print work moving to a separate reception/collection point before customer handover.

---

# 20. Damage, Waste, and Missing Items

Every production discrepancy must be recorded.

Possible discrepancy types:

- Damaged
- Waste
- Missing
- Short-produced
- Incorrectly produced
- Customer rejection

The system should store:

- Expected quantity
- Produced quantity
- Accepted quantity
- Damaged quantity
- Missing quantity
- Waste quantity
- Cause/category
- Employee
- Timestamp
- Notes
- Optional voice note
- Optional image
- Optional file

---

# 21. Compensation Tracking

When a discrepancy occurs, the system must also record how it was resolved.

Examples:

- Reprint
- Replacement in next order
- Credit
- Price adjustment
- Customer acceptance of shortage
- Other manual resolution

The resolution record must preserve the reason and supporting notes.

This allows management to later calculate:

- Waste percentage
- Damage percentage
- Missing percentage
- Reprint frequency
- Loss by department
- Loss by machine
- Loss by material
- Loss by employee/process

The goal is not merely accounting for today's loss, but creating historical data that can improve future production quality.

---

# 22. Customer Delivery

Delivery occurs through Print Reception / Delivery.

Before an Order can be marked fully complete:

### Mandatory Gate

**Pricing must be completed.**

Production may continue while pricing is still pending.

Delivery may not be finalized while the required pricing is unresolved.

This directly solves the current situation where work can be produced and even delivered before being financially entered.

### Payment

The system must support:

- Total
- Paid
- Remaining
- Payment history

Each payment record contains:

- Amount
- Date
- Time
- Payment method
- Payment location/source
- Recorded by
- Optional note

Customers operating on credit may retain an outstanding balance according to business policy.

Cash/one-off customers can be handled through the shared **Cash Customer** account concept.

---

# 23. Cash Customer

The system shall provide a built-in customer record:

**Cash Customer**

This is used for customers who:

- Do not require a persistent customer account
- Pay immediately
- Do not require long-term customer history

Their individual Orders remain independently identifiable even though they are grouped financially under the Cash Customer account.

If the same person later becomes a recurring customer, a permanent Customer record can be created.

This matches the current operational model described in the meeting.

---

# 24. Pricing Engine

Pricing contains two major paths.

## 24.1 Fixed Pricing

Products with predefined pricing use configured Price Lists.

Examples:

- Banner
- Cards
- Notebooks
- Standard digital printing
- Other stable products

The system calculates prices using configured rules.

---

## 24.2 Variable Pricing

Complex or changing products use manual pricing.

Examples include work where:

- Material cost changes frequently
- Job construction changes
- Customer-specific pricing applies
- Quantity affects the quote
- External production is involved
- Manufacturing details are complex

Authorized pricing users can enter the final price.

---

# 25. Customer-Specific Pricing

A customer may have a special price.

Example:

```text
Standard Banner:
100 EGP / meter

Customer ABC:
90 EGP / meter
```

The pricing engine should apply the customer-specific rule automatically when applicable.

Pricing rules may support:

- Product-specific price
- Customer-specific price
- Quantity tiers
- Effective dates
- Manual override

---

# 26. Pricing Permissions

Fixed-price items:

**Reception may initiate/use configured pricing rules.**

Variable-price items:

**Only authorized pricing users may set or modify the price.**

Pricing users should be explicitly configurable rather than assuming that every accountant or manager can modify pricing.

---

# 27. Pricing Delays

A Work Item can be produced while its price is pending.

However, if pricing remains unresolved beyond a configurable threshold:

The system sends notifications to the configured responsible roles, such as:

- Owner
- Reception
- Accounting
- Pricing Officer

The system should show:

```text
Pricing Pending
Waiting Since: 2h 14m
```

Management dashboard should highlight pricing delays.

---

# 28. Pricing and Rework Traceability

A job returned because of an incorrect price must be distinguishable from a design error.

The system must record:

```text
Returned
Reason: Pricing Issue
Origin Department: Pricing
Raised By: User X
Assigned To: User Y
Timestamp
Notes / Attachments
```

This is critical for future operational analytics.

---

# 29. Accounting Module

Accounting is primarily a financial operations layer.

Accounting responsibilities:

- Financial data entry
- Payment recording
- Expense recording
- Revenue-related records
- Manufacturing cost recording
- Profit/loss reporting
- Financial reports
- Reconciliation

Accounting is **not the owner of customer relationship data**.

Customer profiles remain an operational entity in the system.

---

# 30. Profitability

The system should provide profitability visibility at Order and overall business levels.

Minimum Order financial summary:

```text
Sales Revenue
- Direct Manufacturing Cost
- Recorded Job Expenses
= Order Gross Profit
```

The exact treatment of salaries and broader overhead can be added later with Payroll/Advanced Accounting.

All cost inputs must remain traceable to their source.

---

# 31. Expenses

Expenses must support:

- Amount
- Category
- Date
- Employee
- Description
- Related Order, where applicable
- Attachment
- Optional approval

Examples:

- Material
- External production
- Transport
- Maintenance
- Supplies
- Other operating expense

---

# 32. Reporting

Management and authorized finance users should be able to generate:

### Operations

- Orders by state
- Delayed orders
- Orders by department
- Orders by employee
- Production workload
- Average phase duration

### Financial

- Revenue
- Payments
- Outstanding balances
- Expenses
- Manufacturing cost
- Profitability
- Losses

### Quality

- Damage rate
- Waste rate
- Missing quantity
- Reprints
- Rework count
- Rejection reasons
- Rejections by department

---

# 33. Customer Management

Customer records should provide a complete operational history.

A Customer profile should show:

- Contact details
- Orders
- Active orders
- Completed orders
- Payment history
- Current financial position
- Special pricing
- Communication history
- Notes

Customer lookup should primarily use phone number, with optional additional identifiers.

---

# 34. WhatsApp Integration

All customer communication should originate from the application dashboard.

Reception should not need to switch to a shared WhatsApp interface simply to perform standard operational communication.

The system should support:

- Incoming messages
- Outgoing messages
- Message history
- Employee attribution
- Attachments/media
- Message status
- Order association
- Customer association
- Predefined message templates
- Operational notifications

The current shared-device WhatsApp model is explicitly identified as a source of lost messages and files.

---

# 35. WhatsApp Message Attribution

Every outgoing message must record:

- Employee who initiated it
- Message ID
- Customer
- Order
- Timestamp
- Message content/template
- Delivery status
- Read status where available

Meta's WhatsApp Cloud API assigns unique message IDs and provides message-status events through webhooks, making this attribution model technically feasible.

---

# 36. WhatsApp Architecture

The core Printex application runs inside the local LAN.

Because the local server is intentionally isolated from the public Internet, it should not expose the internal application directly to Meta.

Recommended architecture:

```text
                    INTERNET
                       │
                       ▼
              ┌─────────────────┐
              │ Meta WhatsApp   │
              │ Cloud API       │
              └────────┬────────┘
                       │ HTTPS
                       ▼
              ┌─────────────────┐
              │ WhatsApp        │
              │ Integration     │
              │ Gateway         │
              └────────┬────────┘
                       │ Secure Sync
                       ▼
              ┌─────────────────┐
              │ Local Printex   │
              │ Application     │
              │ LAN Server      │
              └─────────────────┘
```

The Gateway can be hosted separately and should handle:

- Meta webhooks
- WhatsApp API calls
- Message retries
- External authentication
- Event normalization

The local application remains the source of truth for Orders, Customers, Staff, and operational history.

Meta's webhook model requires a reachable HTTPS endpoint, which is why the gateway should be separated from the isolated local server.

---

# 37. Predefined Customer Messages

The system should provide reusable operational messages such as:

- Order received
- Design ready for approval
- Additional information required
- Order in production
- Order ready
- Order ready for collection
- Order shipped
- Order delayed

Staff should be able to trigger a message directly from the Order screen.

Where Meta policy requires a template or specific message flow, the integration layer must enforce the current WhatsApp rules rather than allowing arbitrary unsupported sending.

---

# 38. Internal Notifications

The system must notify employees about events relevant to them.

Examples:

### Designer

- New assignment
- Rejection
- Customer modification
- Returned work

### Head Designer

- New design awaiting review

### Production

- New production job
- Revised production file
- Urgent job

### Reception

- Order ready
- Pricing delayed
- Production delayed
- Customer inquiry

### Owner/Admin

- Delayed order
- Pricing delay
- Repeated rejection
- Major discrepancy
- Operational anomaly

---

# 39. File Management

The file system should completely replace manual operational folders.

The user should interact with files through the Printex dashboard.

A Work Item should contain logical file categories such as:

```text
Original Files
Design Versions
Review/Proof Files
Approved Files
Production Files
Supporting Attachments
```

---

# 40. File Storage Architecture

Recommended V1 approach:

**Application-managed object storage on the local server.**

The application stores metadata in the database and binary files in object storage.

Example:

```text
Database
│
├── file_id
├── work_item_id
├── version
├── type
├── uploaded_by
├── created_at
├── checksum
└── storage_key

Object Storage
│
├── object-001
├── object-002
├── object-003
└── ...
```

The application must never depend on manually named Windows folders as business identifiers.

---

# 41. Recommended Storage Technology

For the local deployment, use a storage abstraction layer so that the application does not care whether the backend is:

- Local filesystem storage
- Self-hosted Supabase Storage
- S3-compatible local object storage
- Future cloud object storage

This means the implementation can begin with local storage and evolve later.

Supabase Storage self-hosting supports local filesystem storage and S3-compatible backends, making this portability strategy practical.

A dedicated S3-compatible system such as RustFS is another future option because it supports single-node deployments, versioning, and S3-compatible access.

---

# 42. File Versioning

Files must never simply overwrite previous versions.

Uploading a changed file creates:

```text
Version 1
Version 2
Version 3
```

Every version stores:

- Version number
- File name
- File type
- Size
- Checksum
- Uploaded by
- Timestamp
- Associated action/note

The application controls version history instead of relying on backend bucket versioning.

---

# 43. File Security

Internal files are private by default.

Access must be determined by:

- User identity
- Role
- Order access
- Department access
- Explicit authorization

Files should not be exposed using permanently public URLs.

The preferred mechanism is application-authorized access or short-lived signed URLs.

For external sharing, an optional:

- Expiring share link
- Access token
- Optional password

may be provided.

A per-file password should not be required for normal internal usage; RBAC and controlled signed access should be the default.

---

# 44. File Operations

Users with permission can:

- Upload
- Download
- Preview where supported
- Add new version
- View history
- Open related notes
- Share through an approved mechanism

Normal users should not permanently delete production history.

Delete operations should normally be replaced by:

**Archive / Void / Supersede**

with an audit record.

---

# 45. Audit Log

Audit logging is a core platform requirement.

The system must record significant actions across the entire application.

Examples:

```text
Order Created
Customer Changed
Designer Assigned
Priority Changed
File Uploaded
File Replaced
Version Approved
Design Rejected
Pricing Changed
Payment Added
Expense Added
Work Item Reassigned
Production Started
Production Completed
Damage Recorded
Order Cancelled
Order Delivered
```

Each audit event contains:

- Actor
- Action
- Entity
- Entity ID
- Timestamp
- Previous value where applicable
- New value where applicable
- Reason where applicable
- Related attachments

Audit entries should be append-only.

---

# 46. Order Modification Policy

Orders should not be freely editable after they enter controlled workflow stages.

Modifications depend on current state.

Examples:

### Before production

Specification changes may be allowed with audit logging.

### After production starts

Changes require controlled rework/change workflow.

### After production completion

Changes require explicit administrative action and must preserve previous state.

This prevents a user from silently changing the meaning of a historical production action.

---

# 47. Customer Changes During Production

Customer modifications must create a new change event.

The system should preserve:

```text
Original Specification
       ↓
Customer Change Request
       ↓
Approval / Confirmation
       ↓
Revised Specification
       ↓
New Production Instruction
```

The original instruction must remain accessible.

This addresses the exact operational issue in which a customer changed quantities and previous quantities became unclear.

---

# 48. Role Model

## Reception

Can:

- Manage Orders
- Manage customer lookup
- Create customers
- Assign Designers
- Track orders
- Communicate with customers
- Use configured pricing
- Trigger notifications
- View relevant payment/order information

Cannot:

- Modify production financial records freely
- Approve restricted pricing
- Override audit history

---

## Designer

Can:

- View assigned Work Items
- Work on designs
- Upload files
- Start/stop timers
- View customer requirements
- Respond to rework
- View relevant communication

Cannot:

- Change financial records
- Approve own work as Head Designer
- Modify customer account rules

---

## Head Designer

Can:

- Review designs
- Approve
- Reject
- Add notes
- Add voice notes
- Add images/files
- Send work to production

---

## Production Operator

Can:

- View relevant production queue
- Download approved production files
- Start/stop production timer
- Mark production complete
- Record production notes
- Record discrepancies

Cannot:

- Change design approval
- Change pricing
- Change customer identity
- Edit financial records

---

## Print Reception / Delivery

Can:

- Receive production
- Verify quantity
- Record discrepancies
- Prepare delivery
- Record delivery
- Trigger customer notification

---

## Accounting

Can:

- Enter payments
- Enter expenses
- Enter financial data
- Record production/manufacturing costs
- Review financial reports
- View profitability

Cannot:

- Freely modify production workflows
- Modify design
- Approve design
- Own the Customer CRM

---

## Admin / Owner

Can:

- View all operations
- Manage users
- Configure roles
- Configure production departments
- Configure price lists
- Manage pricing permissions
- Override controlled operations
- Access audit history
- Access analytics
- Configure notifications
- Manage system settings

---

# 49. Management Dashboard

The management dashboard is an operational control room.

It should display:

```text
Orders Today
Active Orders
Delayed Orders
Urgent Orders
Waiting for Design
Waiting for Review
Waiting for Pricing
In Production
Ready for Collection
Delivered Today
```

It should also visualize employee workload:

```text
Designer A — 20 active
Designer B — 10 active
Designer C — 5 active
```

The meeting specifically describes management wanting a visible queue showing where jobs are and how long they have remained there.

---

# 50. Delayed Work Detection

The system should support configurable thresholds.

Example:

```text
Design waiting > X hours
Review waiting > X hours
Pricing waiting > X hours
Production waiting > X hours
Collection waiting > X hours
```

When a threshold is exceeded:

- Highlight the Work Item
- Generate notification
- Show age
- Show responsible department

---

# 51. Customer Order Tracking

V1 should maintain the internal infrastructure for customer tracking.

A later customer-facing view may allow the customer to open a simple page using:

- Secure token
- QR code
- Direct link

The customer would see only high-level status:

```text
Order Received
Designing
Under Review
In Production
Ready
Delivered
```

The customer should never receive internal notes, financial details, employee-only data, or internal files unless explicitly shared.

The transcript describes exactly this desired future interaction through QR/link-based tracking.

---

# 52. Offline / Local Operation

The core business system must operate without Internet connectivity.

Important distinction:

> The system is **offline from the Internet**, but not necessarily offline from the local LAN.

The expected V1 topology is:

```text
Employees' Devices
        │
        │ LAN
        ▼
Local Print Shop Server
        │
        ├── Application
        ├── Database
        └── File Storage
```

Internet is not required for:

- Order creation
- Design workflow
- Production workflow
- File management
- Customer records
- Payments
- Accounting data entry
- Reports
- Timers

Internet is required only for external integrations such as WhatsApp or optional cloud backups.

V1 should avoid introducing unnecessary client-side database replication or eventual-consistency synchronization unless operational testing later proves it necessary.

---

# 53. Backup and Recovery

Because the local server contains critical operational data, backup is mandatory.

Backup must cover:

- Database
- File objects
- File metadata
- Audit logs
- Configuration

At minimum:

```text
Primary Server
      │
      ├── Local Backup
      │
      └── External Backup
```

The backup must not reside only on the same server.

An external drive or separate backup host can be used for local disaster recovery, with optional encrypted cloud backup when available.

The meeting explicitly identifies same-server backup as insufficient.

---

# 54. Security Requirements

The system must enforce:

- Authentication
- Role-based access control
- Department-based access
- Private files
- Session management
- Audit logging
- No uncontrolled destructive deletion
- Secure backup handling
- Secrets kept outside source code
- Local server not publicly exposed
- Controlled external integration boundary

---

# 55. Data Integrity Rules

The following rules are mandatory:

### Rule 1
Every Work Item belongs to an Order.

### Rule 2
Every Order belongs to a Customer or Cash Customer.

### Rule 3
Every status transition is recorded.

### Rule 4
Every rejection has a reason.

### Rule 5
Every file change creates a history entry.

### Rule 6
Every payment creates a transaction record.

### Rule 7
Every production discrepancy is recorded.

### Rule 8
No normal user permanently deletes operational history.

### Rule 9
Pricing status must be visible independently from production status.

### Rule 10
Delivery cannot finalize while required pricing is unresolved.

### Rule 11
All important actions record the responsible employee.

### Rule 12
Urgent work is still fully auditable.

---

# 56. AI-Assisted Features

AI is optional and assistive.

It must not become a hidden dependency of the core workflow.

Potential AI-assisted features:

### Designer Recommendation

Suggest the most suitable available designer using:

- Workload
- Experience
- Customer history
- Job type
- Historical completion times

### Pricing Assistance

Estimate ranges for complex jobs.

The estimate must be clearly labeled:

**AI Estimate**

not final business price.

Authorized employees remain responsible for accepting/editing the price.

### Delay Prediction

Identify Work Items likely to become late.

### Anomaly Detection

Flag:

- Unusually high waste
- Repeated rejection
- Unusually long phase durations
- Unexpected cost
- Abnormal production discrepancy

All AI suggestions must be editable and explainable.

---

# 57. Inventory — Future Phase

Inventory should not block the core workflow.

The eventual Inventory module can model:

- Materials
- Rolls
- Paper
- Ink
- Lamination
- Consumables
- External materials
- Estimated usage
- Actual usage
- Waste
- Stock movement

The initial system should support recording cost data without requiring full inventory automation.

The meeting specifically recognizes that accurate production material consumption is complex and may initially require estimated rather than exact calculations.

---

# 58. MVP Scope

## Must Have

### Core

- Authentication
- Roles
- Customers
- Orders
- Work Items
- Order tracking
- Reception workflow
- Designer assignment
- Designer workflow
- Head Designer review
- Rework
- Production workflow
- Delivery workflow
- Timers
- Audit log

### Pricing

- Price List
- Fixed pricing
- Customer-specific pricing
- Manual variable pricing
- Pricing pending
- Pricing notifications

### Finance

- Payments
- Payment history
- Expenses
- Manufacturing/job costs
- Profitability reporting

### Files

- Upload
- Download
- Versioning
- File history
- Permissions
- Private storage

### Communication

- Internal notifications
- WhatsApp dashboard integration
- Message attribution
- Message history

### Management

- Dashboard
- Delayed work
- Department workload
- Basic reports

---

# 59. Phase 2

Potential Phase 2:

- Inventory
- Customer tracking portal
- QR tracking
- Payroll
- Advanced financial accounting
- Advanced WhatsApp automation
- AI workload recommendation
- AI pricing assistance
- AI anomaly detection
- Multi-branch support
- Advanced production analytics
- Automated backup management

---

# 60. UX Principles

The application is an internal operational tool.

Therefore:

- Arabic-first
- RTL
- Low cognitive load
- Fast order creation
- Minimal clicks
- Large obvious status indicators
- Queue-oriented views
- Clear ownership
- No unnecessary ERP complexity
- Important actions visible
- Every critical change explainable

The UI should be designed around:

**“What do I need to do next?”**

rather than around database entities.

---

# 61. AI Agent Context Rules

Any future AI coding agent working on this project must follow these rules.

### Rule A — Do not invent workflow

Use the defined Order → Work Item workflow.

### Rule B — Do not bypass business gates

Never allow an implementation shortcut to bypass:

- Approval
- Pricing-before-delivery
- Audit
- Permission checks

### Rule C — Preserve history

Do not implement destructive updates where historical traceability is required.

### Rule D — Files are immutable versions

A new file is a new version, not a destructive replacement.

### Rule E — Business logic belongs in the backend

The frontend must not be the authority for:

- Permissions
- Pricing
- State transitions
- Payment rules
- Audit

### Rule F — Roles are permission scopes

Avoid hard-coding individual employee names into business logic.

### Rule G — Departments are configurable

Do not hard-code Digital/Banner/Laser as permanent architectural assumptions.

### Rule H — AI is optional

The system must remain fully operational if all AI services are disabled.

### Rule I — Local-first architecture

The core application must remain usable without Internet access.

### Rule J — External integrations are isolated

WhatsApp and other external services must not become tightly coupled to core order state.

---

# 62. Acceptance Criteria — Initial V1

A V1 release is successful when:

1. Reception can create an Order in seconds.
2. Every Order has a visible lifecycle.
3. Multiple Work Items can exist under one Order.
4. Each Work Item can follow its own production path.
5. Reception can assign a Designer.
6. Designers can track their active work and timers.
7. Head Designer can approve/reject work.
8. Rejection automatically notifies the responsible Designer.
9. Rejection reason and attachments remain in history.
10. Production users only see relevant jobs.
11. Every production phase is timed.
12. Production completion is recorded.
13. Damage/missing quantities can be recorded.
14. Payments are fully traceable.
15. Pricing remains visible and independently tracked.
16. Production can occur before pricing.
17. Delivery cannot finalize before required pricing is complete.
18. Every important mutation is audited.
19. Files remain versioned and private.
20. Management can identify delayed jobs.
21. WhatsApp interactions can be attributed to employees.
22. The system continues to operate when Internet connectivity is unavailable, except for external integrations.
23. Backups exist outside the primary server.

---

# 63. Core Product Principle

The system should not try to reproduce every existing manual process.

The objective is:

> **Replace operational chaos with a simple, traceable digital workflow.**

The system should make the correct path easier than the old path.

The user should not need to understand:

- Server folders
- Windows directory structures
- Internal file naming
- Informal employee handoffs
- Which WhatsApp device received a message
- Who remembered the customer request

The dashboard should become the operational interface for the business.

---

# 64. Final Product Model

The conceptual architecture is:

```text
                         ┌──────────────┐
                         │   Customer   │
                         └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │    Order     │
                         └──────┬───────┘
                                │
                     ┌──────────┼──────────┐
                     ▼          ▼          ▼
                 Work Item   Work Item   Work Item
                     │          │          │
                     ▼          ▼          ▼
                  Design      Design      Design
                     │          │          │
                     └──────┬───┴───┬──────┘
                            ▼       ▼
                       Head Review / QA
                            │
                            ▼
                      Production Queue
                     ┌──────┼──────┐
                     ▼      ▼      ▼
                  Digital  Banner  Laser
                     │      │      │
                     └──────┼──────┘
                            ▼
                  Print Reception / Delivery
                            │
                            ▼
                        Customer
                            │
                            ▼
                     Financial Closure
```

Behind the entire flow:

```text
           ┌───────────────────────┐
           │      Audit Log        │
           └───────────────────────┘

           ┌───────────────────────┐
           │   File Versioning     │
           └───────────────────────┘

           ┌───────────────────────┐
           │ Notifications / WA    │
           └───────────────────────┘

           ┌───────────────────────┐
           │ Pricing + Finance     │
           └───────────────────────┘

           ┌───────────────────────┐
           │ Timers + Analytics    │
           └───────────────────────┘
```

The core idea is therefore not “ERP screens.”

It is:

**One Order → many Work Items → controlled transitions → complete history → measurable performance.**