You are acting as a Principal Software Architect, Principal Prompting Engineer, Business Process Analyst, and Senior Full-Stack Engineer.

Your task is to deeply understand our existing Printex system and then design and implement an expansion to the order workflow, production pipeline, pricing engine, file handling, and role-based progression.

This is not a greenfield project.

You MUST first understand the existing codebase, architecture, database, authentication, roles, pages, APIs, existing order/item models, calculations, and workflow before changing anything.

Do not make assumptions when the existing system already contains a concept, field, role, status, calculation, or workflow that can be reused.

==================================================

1. FIRST OBJECTIVE — UNDERSTAND THE EXISTING SYSTEM
   ==================================================

Before modifying any code:

1. Read the entire repository structure.
2. Read every relevant .md / documentation file.
3. Inspect the package configuration and technology stack.
4. Inspect the database schema and all order-related tables/models.
5. Inspect authentication and authorization.
6. Inspect all existing roles and permissions.
7. Trace the complete lifecycle of an existing order/item.
8. Find every existing order status/state/enum.
9. Find every existing pricing/calculation function.
10. Find every place where width, height, quantity, price, material, finishing, or production information is stored.
11. Find the existing Supabase integration/storage implementation.
12. Find all existing designer, accountant, reception, branding/content, and printer-related pages/components/routes.
13. Find existing validation, API, server actions, RPCs, database triggers, and background processes.
14. Find existing tests.
15. Identify any existing workflow that overlaps with the requirements below.

Do not immediately implement anything.

First produce a complete "Current System Understanding" document in your response describing:

* architecture
* relevant modules
* database structure
* order lifecycle
* existing roles
* permissions
* pricing system
* file system/storage architecture
* current status/state transitions
* important dependencies
* reusable functionality
* conflicts with the requested workflow
* risks
* areas that require migration

Then create a proposed technical specification.

Only after the specification is internally consistent should implementation begin.

We are expanding the order-management and production workflow.

The receptionist takes the customer's requirements.

The receptionist enters the order/item dimensions and pricing information.

The system automatically converts the customer's requested width into one of our available production widths.

The order then moves through a strict production pipeline:

RECEPTION
→ DESIGNER
→ ACCOUNTANT
→ BRANDING / CONTENT REVIEW
→ PRINTER

The order must move sequentially.

A later stage must NEVER become accessible before the previous required stage has been completed.

The workflow is state-driven, not merely UI-driven.

The backend/database must enforce these rules.

Do not rely only on hiding buttons in the frontend.

Our available production widths are FIXED:

80 cm
110 cm
150 cm
210 cm
260 cm
270 cm
320 cm

The system must NEVER select a production width smaller than what the customer requested.

Instead, it must round UP to the nearest supported width.

Examples:

Customer requests 75 cm
→ production width = 80 cm

Customer requests 80 cm
→ production width = 80 cm

Customer requests 81 cm
→ production width = 110 cm

Customer requests 145 cm
→ production width = 150 cm

Customer requests 150 cm
→ production width = 150 cm

Customer requests 151 cm
→ production width = 210 cm

Customer requests 205 cm
→ production width = 210 cm

Customer requests 250 cm
→ production width = 260 cm

Customer requests 265 cm
→ production width = 270 cm

Customer requests 269 cm
→ production width = 270 cm

Customer requests 271 cm
→ production width = 320 cm

Customer requests 320 cm
→ production width = 320 cm

Customer requests above 320 cm
→ DO NOT silently choose 320 cm.
→ The system must reject the value or explicitly require a manual exception according to the existing business architecture.

The original customer-requested width and the resulting production width must BOTH be stored.

Do not overwrite the customer's original dimension.

The system should make the distinction explicit:

customer_width_cm
production_width_cm

The rounded production width must be generated deterministically by the backend/business logic.

Do not duplicate the rounding algorithm in multiple frontend locations.

Create one canonical business rule/function/service and reuse it everywhere.

Height is not one of the fixed-width values.

Height is entered according to the customer's requirement.

There is a business statement that the height can go up to 3 meters.

DO NOT invent a different interpretation.

During the analysis phase:

1. Check the existing system for any height limits.
2. Check existing database constraints.
3. Check existing validation.
4. Check existing product/material rules.
5. Determine whether "3 meters maximum" already exists.

If the existing business model confirms a maximum of 3m:

height must be validated accordingly.

If the existing implementation does NOT establish the rule clearly, flag this explicitly in the specification and isolate the rule so it can be configured rather than hard-coded throughout the system.

Do not silently create conflicting height behavior.

Store dimensions consistently and explicitly.

Prefer a canonical unit internally.

For example:

width = centimeters
height = meters

or normalize everything to meters internally.

Choose the approach that best matches the existing architecture, but be consistent and document it.

Pricing is based primarily on square meters.

The system should automatically calculate the billable area.

The calculation must use the PRODUCTION WIDTH after width rounding, not the original customer width, unless the existing business model explicitly says otherwise.

Example:

Customer width = 145 cm
Production width = 150 cm
Height = 2 m

Production area =
1.50 × 2.00
= 3.00 m²

The system must clearly distinguish:

customer dimensions
production dimensions
calculated production area

Do not use ambiguous fields such as "width" where two different concepts are involved.

The receptionist determines the price per square meter.

The allowed base price range is:

80 EGP / m²
through
120 EGP / m²

The receptionist selects/enters the applicable price.

The system then calculates the total automatically.

Example:

Production area = 3 m²
Price = 100 EGP/m²

Base printing price =
3 × 100
= 300 EGP

The receptionist should NOT manually calculate the total.

The system calculates it.

The selected price per square meter must be stored on the order/item so that historical orders do not change if the global/default pricing changes later.

Do not calculate historical order totals from a mutable global price table unless the existing financial architecture explicitly requires that behavior.

There are additional production services.

Example:

SULFAN / سلوفان

Current business rule:

Sulfan = 90 EGP / m²

This is an ADDITIONAL charge.

The system should be designed so that additional services/finishing options can be extended later without rewriting the pricing architecture.

For example, the system should support a model conceptually similar to:

Base item:
area × base_price_per_m2

Additional finishing:
area × finishing_price_per_m2

Total:
base_price + additional_services

Do not hard-code "Sulfan" directly into a giant if/else chain.

Create an extensible pricing/add-on structure that can support future services.

The receptionist should be able to select applicable finishing/services.

The system should automatically calculate their costs.

Example:

Area = 3 m²

Base price = 100 EGP/m²
Base total = 300 EGP

Sulfan = 90 EGP/m²
Sulfan total = 270 EGP

Final total =
570 EGP

The actual calculation must follow the existing business/accounting architecture if one already exists.

Reception is the entry point.

The receptionist should be able to:

1. Create/order the customer request.
2. Enter the required product/item details.
3. Enter the customer's requested width.
4. Enter height.
5. Select/enter the price per square meter.
6. Select applicable finishing/additional services.
7. See the system-calculated production width.
8. See calculated square meters.
9. See calculated prices.
10. Review the order before submission.
11. Assign a designer.

CRITICAL RULE:

The receptionist MUST assign a designer before the order can leave the reception stage.

An order without an assigned designer must NOT move to the designer workflow as an executable task.

The backend must enforce this.

The production workflow is:

1. RECEPTION
2. DESIGNER
3. ACCOUNTANT
4. BRANDING / CONTENT REVIEW
5. PRINTER

This sequence is mandatory.

The stages cannot be skipped.

The stages cannot be collapsed.

The system must treat the workflow as a state machine.

For example, conceptually:

RECEPTION_PENDING
→ DESIGNER_PENDING
→ ACCOUNTANT_PENDING
→ BRANDING_PENDING
→ PRINTER_PENDING

The exact enum/state names should match existing conventions.

DO NOT blindly introduce duplicate status systems if the project already has one.

Instead, determine whether the existing status system can be extended safely.

After reception assigns a designer:

The assigned designer sees the order in their designer workspace/page.

The designer can:

1. Open the assigned order.
2. Review the order details.
3. Perform the design work.
4. Upload the completed design file.
5. Submit the completed design.

The completed file must be uploaded to our Supabase storage/database architecture.

The order must remain in the designer stage until the file has been successfully uploaded.

CRITICAL RULE:

THE DESIGNER CANNOT MOVE THE ORDER TO THE ACCOUNTANT MERELY BY CLICKING "NEXT", "DONE", "SUBMIT", OR ANY SIMILAR BUTTON.

The designer may only complete this stage by:

1. completing the required design work
2. successfully uploading the required file
3. then triggering/causing the transition to the accountant stage

The backend must enforce that the file exists before allowing:

DESIGNER → ACCOUNTANT

Do not rely only on frontend validation.

The designer's completed design file must be stored in Supabase.

Inspect the existing Supabase architecture first.

Determine whether the project already uses:

* Storage buckets
* object paths
* metadata
* signed URLs
* public URLs
* database file records
* attachment tables
* RLS policies
* upload handlers
* server actions/API routes

Reuse the existing infrastructure where appropriate.

Do not create a second parallel file-storage architecture unnecessarily.

The system must maintain a reliable relationship between:

order
designer submission
file
upload metadata
workflow state

The implementation should prevent an order from reaching the accountant without a valid required design file.

Also consider:

* failed uploads
* partial uploads
* deleted files
* replacement files
* file versioning
* unauthorized downloads
* incorrect file ownership
* duplicate submissions

Choose the minimum robust implementation that fits the existing architecture.

After the designer successfully uploads the required file and completes the designer stage:

The order moves to the accountant.

The accountant opens the order and reviews:

* customer information
* requested dimensions
* production dimensions
* area calculation
* price per square meter
* additional services
* calculated total
* designer file

The accountant verifies the pricing and order information.

The accountant may approve the order only after the required information has been reviewed.

After approval:

ACCOUNTANT → BRANDING / CONTENT REVIEW

The backend must prevent the accountant from approving an invalid/incomplete order according to the actual required fields.

Do not allow the accountant to skip the workflow or directly send the order to the printer.

After accountant approval:

The order moves to the branding/content review stage.

The uploaded design file should be available to this stage.

The exact responsibilities of this stage must first be mapped against the existing implementation.

Determine whether "branding", "content", or another existing role/module already represents this step.

Do not create a redundant role if one already exists.

The purpose of this stage is to review/prepare the approved design before production.

The final transition must be:

BRANDING / CONTENT REVIEW
→ PRINTER

Do not allow:

ACCOUNTANT
→ PRINTER

and do not allow:

DESIGNER
→ PRINTER

unless an explicit existing exception is discovered and documented.

The printer receives only orders that have successfully passed the required previous stages.

By the time the order reaches the printer, the system should provide access to the necessary production information, including:

* customer/order information
* production dimensions
* production width
* height
* area
* price/financial information as appropriate
* selected finishing/services
* approved design file

The printer must not receive an order that skipped any required previous stage.

This is critical.

Do NOT implement this workflow as simply a collection of frontend pages and buttons.

The workflow rules must be enforced at the backend/data layer.

A malicious or accidental direct API request must NOT be able to bypass the workflow.

Examples:

A designer must not be able to call an API directly and force:

DESIGNER → PRINTER

An accountant must  be able to force:

ACCOUNTANT → PRINTER

Reception must not be able to create an order directly inside the accountant queue without designer assignment.

An order must not move from designer to accountant without the required design file.

An order must not move from accountant to branding without accountant approval.

Use the architecture that best matches the existing system, potentially involving:

* service-layer validation
* server actions
* API validation
* database constraints
* transactions
* state transition functions
* authorization checks
* RLS
* database triggers where appropriate

The final architecture should have ONE authoritative transition mechanism rather than scattered state changes throughout the UI.

Inspect the existing role system.

Map the workflow stages to the existing roles.

Potentially:

Reception
Designer
Accountant
Branding/Content
Printer

But DO NOT assume these are the exact internal role names.

Use the existing role architecture where possible.

For every role define:

* what orders they can see
* which orders they can open
* what fields they can edit
* what actions they can perform
* which transitions they can trigger
* which transitions they cannot trigger

The user interface should reflect these permissions.

The backend must independently enforce them.

Before implementation, design the required data model changes.

Preserve existing data whenever possible.

Do not destroy or rename existing fields without a clear migration strategy.

At minimum, conceptually determine where the system should store:

Customer requested width
Production width
Height
Calculated area
Base price per m²
Additional services
Additional service rate
Calculated totals
Assigned designer
Current workflow state
Designer file
File metadata
Designer completion time
Accountant approval
Branding/content review status
Printer state

Use the existing database naming conventions.

If there is an Order → OrderItem model already, determine which values belong to the order versus the item.

Do not duplicate financial values unnecessarily.

Treat monetary calculations carefully.

Do not introduce floating-point rounding bugs.

Use the project's existing decimal/numeric strategy.

Do not rely on JavaScript floating point for authoritative financial totals if the backend/database architecture supports a safer representation.

Define:

* area calculation
* unit price
* finishing price
* subtotal
* additional charges
* final total
* rounding rules

Make the calculation deterministic.

The same order should produce the same total regardless of which page displays it.

The frontend should display values generated by the canonical pricing engine rather than inventing its own result.

Because this is a production workflow, important transitions should be traceable.

Inspect whether the existing system already has audit logs/history.

If it does, extend it.

If it does not, determine the minimum audit mechanism needed.

Important events include:

* order created
* designer assigned
* designer file uploaded
* designer submission completed
* accountant review
* accountant approval
* branding/content review
* sent to printer
* file replacement
* important price changes

Do not overengineer this if an existing audit system already handles it.

Do not rebuild the entire application.

Follow the current design system and UI architecture.

Reception should have a clear order-entry workflow.

The receptionist should be able to immediately understand:

Requested Width
→ Production Width

and:

Area
×
Price/m²
→
Base Price

plus:

Additional Services
→
Additional Cost

→
Final Total

The UI should make the automatic rounding obvious.

Example:

Requested width:
145 cm

Production width:
150 cm

This prevents confusion when the customer asked for one size but production uses another.

Designer UI should make pending work obvious.

Designer should clearly see which orders are assigned to them.

The upload action should be tied directly to completion.

The accountant UI should clearly show the calculated price and source values.

The workflow stage should always be visible.

Do not make the user guess what stage the order is currently in.

Create explicit validation for:

* required customer/order fields
* width
* height
* supported ranges
* price per square meter
* services
* designer assignment
* required file
* valid state transitions
* role permissions

Validation must exist on the server/backend.

Frontend validation may provide better UX, but it is not the security boundary.

You MUST investigate and explicitly define handling for at least:

1. Requested width exactly matching a supported width.
2. Requested width between supported widths.
3. Requested width above maximum supported width.
4. Zero width.
5. Negative width.
6. Invalid height.
7. Height above maximum, if a 3m maximum is confirmed.
8. Price below 80.
9. Price above 120.
10. Missing designer.
11. Designer uploads no file.
12. Upload fails.
13. Designer tries to submit twice.
14. Designer tries to bypass accountant.
15. Accountant tries to bypass branding/content.
16. Branding/content tries to bypass required review.
17. File is deleted after upload.
18. File is replaced.
19. Order is edited after accountant approval.
20. Price is changed after calculation.
21. Existing historical orders.
22. Multiple items in one order, if supported.
23. Cancellation.
24. Reopening/rework.
25. Returning an order to the designer for corrections.

For anything not explicitly specified by the business rules, inspect the existing system first and document your decision before implementing.

Do not silently invent important business behavior.

Investigate whether the existing system already supports rejected/rework orders.

If it does, integrate with it.

If it does not, determine whether the implementation requires a rework mechanism.

Do not simply create arbitrary backward transitions.

A production workflow must preserve the distinction between:

normal forward progression

and

controlled rework/correction

Any backward transition must be explicit, authorized, and auditable.

Before changing the database:

Determine the current production data model.

Create safe migrations.

Do not break existing orders.

Existing orders should receive sensible defaults or migration states.

Do not destroy production data.

Do not change database behavior blindly.

If a destructive migration appears necessary, stop and explain exactly why before proceeding.

Prefer additive migrations.

This feature is business-critical.

Implement tests for the canonical business logic.

At minimum test:

Width rounding:

75 → 80
80 → 80
81 → 110
145 → 150
150 → 150
151 → 210
250 → 260
265 → 270
271 → 320
320 → 320

> 320 → rejected/manual exception

Pricing:

area × price/m²

Finishing:

area × finishing price/m²

Combined totals.

Workflow:

Reception → Designer

Designer cannot → Accountant without file

Designer + valid file → Accountant

Accountant cannot → Printer

Accountant approval → Branding/Content

Branding/Content completion → Printer

Unauthorized roles cannot trigger transitions.

Also test direct API/server-side bypass attempts.

Do not consider the feature complete until these tests pass.

Follow this sequence:

PHASE 1 — REPOSITORY UNDERSTANDING

Understand the current system completely.

PHASE 2 — BUSINESS SPECIFICATION

Translate the requirements into explicit business rules.

PHASE 3 — TECHNICAL DESIGN

Produce:

* state machine
* data model changes
* pricing architecture
* file architecture
* role/permission matrix
* API/server action changes
* migration plan
* testing plan

PHASE 4 — IMPLEMENTATION

Implement the smallest clean architecture that satisfies the specification and integrates with the existing system.

PHASE 5 — VALIDATION

Run:

* type checks
* lint
* tests
* build
* relevant integration/e2e tests

Fix issues rather than hiding them.

PHASE 6 — FINAL REVIEW

Trace the full workflow manually through the implemented code:

Reception creates order
→ assigns designer
→ designer sees it
→ designer completes design
→ designer uploads file
→ backend validates file
→ accountant receives order
→ accountant reviews
→ accountant approves
→ branding/content receives it
→ branding/content completes review
→ printer receives it

Verify that no illegal shortcut exists.

Never implement based on assumptions when the repository can answer the question.

Never create duplicate business logic.

Never calculate authoritative prices independently in multiple components.

Never enforce critical workflow rules only in React/UI.

Never allow invalid state transitions.

Never overwrite the original customer dimensions with production dimensions.

Never hard-code additional services into scattered conditions.

Never bypass the existing authorization architecture.

Never replace existing functionality merely because a new implementation seems cleaner.

Prefer extending existing patterns.

Prefer reusable domain/business functions.

Keep business logic separate from presentation.

Keep database changes backward compatible whenever possible.

Before you write implementation code, provide a concise but complete technical specification containing:

1. Current architecture summary
2. Current workflow summary
3. Proposed workflow state machine
4. State transition rules
5. Role/permission matrix
6. Width rounding algorithm
7. Dimension model
8. Pricing model
9. Additional service model
10. Supabase file lifecycle
11. Database changes
12. API/server action changes
13. UI changes
14. Validation rules
15. Audit requirements
16. Migration strategy
17. Test strategy
18. Known ambiguities
19. Risks
20. Implementation order

Then implement the approved/derived architecture.

The intended business flow is:

CUSTOMER
↓
RECEPTION

Reception enters:

* customer/order information
* requested width
* height
* price per m²
* finishing/additional services

System automatically determines:

requested width
→ nearest supported width ABOVE OR EQUAL

System calculates:

production width
→ area
→ base price
→ finishing/additional costs
→ final total

Reception MUST assign a designer.

↓
DESIGNER

Designer receives assigned order.

Designer performs the work.

Designer uploads the completed design file to Supabase.

Designer cannot advance without the required file.

↓
ACCOUNTANT

Accountant reviews:

* order
* dimensions
* calculations
* services
* total
* design file

Accountant approves.

↓
BRANDING / CONTENT REVIEW

Approved design is reviewed/prepared.

↓
PRINTER

Printer receives the production-ready order and required design file.

Treat this as a business workflow engine, not merely a set of pages.

The order's current state must represent reality.

Every transition must have:

* valid previous state
* valid next state
* authorized actor
* required data
* required file(s), where applicable
* server-side validation
* auditable result

The system should make illegal transitions impossible rather than merely inconvenient.

Before making implementation decisions that affect business behavior, inspect the existing system and explain the decision in the specification.

Do not rush into code.

Understand first.
Specify second.
Implement third.
Test fourth.
Then perform a complete workflow audit.
