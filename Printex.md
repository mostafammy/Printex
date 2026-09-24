# MASTER PROJECT UNDERSTANDING

---

## 1. Project Overview

### 1.1 Business Identity & Location
**Printex** is an established commercial, advertising, and packaging print manufacturing facility operating in **Basyoun (Gharbia Governorate, Egypt)** `[TRANSCRIPT: 59:00, p. 59; 83:00, p. 83]`. The facility houses multi-tier production lines:
* **Sheet-fed Digital Printing** (commercial stationery, flyers, brochures, custom stickers) `[TRANSCRIPT: 15:00, p. 15; 22:00, p. 22]`.
* **Large Format / Outdoor Roll-to-Roll Printing** (Banner, Light Banner, Flex, Vinyl, Scotch, Matte Banner, Backlit/Posisur) `[TRANSCRIPT: 19:00, p. 19; 45:00, p. 45]`.
* **Laser Cutting & Engraving** (acrylics, wood) `[TRANSCRIPT: 22:00, p. 22; 41:00, p. 41]`.
* **Screen Printing (سلك سكرين)** `[TRANSCRIPT: 22:00, p. 22]`.
* **Post-Press & Finishing Operations** (Thermal/Matte Lamination, Creasing/Scoring, Stapling, Booklet Binding, Gluing, Trimming) `[TRANSCRIPT: 63:00, p. 63; 77:00, p. 77]`.
* **Outsourced Offset & Packaging** (folding cartons, restaurant packaging outsourced to production facilities in **Tanta**) `[TRANSCRIPT: 19:00, p. 19]`.

### 1.2 Core Operational Breakdown & Root Problems
Printex currently suffers from operational chaos (`كعبلة`), lack of cross-departmental visibility, and severe financial leakage:
1. **Unlinked Manual Records:** Financial accounting runs on an obsolete, manual legacy application that only tracks flat balances and vendor debits without opening formal invoices or linking to production stages `[TRANSCRIPT: 00:00, p. 1]`.
2. **File Loss via Loose Windows Folders:** Jobs are managed as loose OS folders across local PCs. Folders are routinely deleted (`Shift+Delete`) or misfiled, resulting in completed print jobs leaving the factory without being billed or recorded in accounts `[TRANSCRIPT: 03:10, p. 3; 49:00, p. 49]`.
3. **WhatsApp Chaos:** Customer communications rely on a single WhatsApp Business phone number mirrored across 6 separate PC workstations. Messages are opened, marked read, and neglected; customer files get buried in chat histories; and no one knows who responded to whom `[TRANSCRIPT: 06:00, p. 6; 61:00, p. 61; 64:00, p. 64]`.
4. **Delayed Pricing & Unbilled Jobs:** Because bespoke manufacturing jobs rely solely on the Owner or a trusted manager for quoting, jobs are frequently printed and delivered to customers before being priced or billed to avoid factory idling `[TRANSCRIPT: 09:00, p. 9]`.
5. **No Production Visibility:** Front-desk reception cannot tell customers where their jobs are (in design, printing, finishing, or ready for pickup) without physically walking across the plant `[TRANSCRIPT: 38:00, p. 38; 57:36, p. 57]`.

### 1.3 The Solution
A unified, on-premises **Print Shop Floor & Workflow ERP System** deployed on Printex's internal Local Area Network (LAN) `[TRANSCRIPT: 31:00, p. 31; ADDITIONAL CONTEXT]`. The system integrates five specialized sub-systems (Reception, Design Studio, Production Floor, Delivery/Warehouse, and Accounting) with an overarching Executive Management layer `[ADDITIONAL CONTEXT]`. It enforces strict order tracking, automates quoting via an imposition calculator, introduces a pre-press quality gate (Head Designer), manages daily cash drawer balances, tracks customer debt, and enables zero-cost WhatsApp status dispatching `[TRANSCRIPT + ADDITIONAL CONTEXT]`.

---

## 2. What the Client Actually Wants

The client explicitly seeks a pragmatic, high-speed shop-floor management platform built around manufacturing realities, not corporate bureaucracy:

* **Speed Over Bureaucracy ("مش عايز روتين ولا أبقى حكومة"):** Order entry must take seconds. Front-desk staff must not fill out endless forms while customers wait `[TRANSCRIPT: 05:00, p. 5]`.
* **Zero Lost Jobs ("الشغلانة ما تسقطش مننا"):** Every order entering Printex must receive an immutable digital ticket that cannot be deleted or lost between Reception, Design, Print, and Warehouse `[TRANSCRIPT: 57:00, p. 57]`.
* **Instant Front-Desk Quoting:** Non-designer receptionists must be able to calculate sheet yields, raw paper requirements, and prices for standard jobs instantly using an integrated imposition calculator without interrupting designers `[TRANSCRIPT: 73:00, p. 73–75]`.
* **Intelligent Designer Queue & Quality Gate:** Incoming artwork must be routed to designers based on real-time workload queues, but **no job may enter the print floor without digital inspection and sign-off by the Head Designer** to eliminate costly misprints `[TRANSCRIPT: 14:00, p. 14; 34:00, p. 34; ADDITIONAL CONTEXT]`.
* **Departmental Work Order Splitting:** A single customer ticket containing mixed items (e.g., banner + stickers + laser cut) must split automatically into dedicated sub-tasks on machine floor screens, then re-converge at the warehouse delivery desk for final packaging and collection `[TRANSCRIPT: 16:00, p. 16; 17:00, p. 17]`.
* **Debt Visibility & Leak-Proof Auditing:** Immediate red-flag alerts on existing customer balances upon phone number lookup, preventing indebted clients from placing new jobs unnoticed `[TRANSCRIPT: 26:00, p. 26]`.
* **Zero Recurring Third-Party Costs:** Absolute rejection of recurring SaaS fees, cloud database hosting, and paid Meta WhatsApp Business API charges `[TRANSCRIPT: 25:00, p. 25; 31:00, p. 31; 60:00, p. 60]`.

---

## 3. Users & Roles

```
                      ┌────────────────────────────────────────────────────────┐
                      │              Super Admin / Factory Owner               │
                      │               (Mohamed Printex / Owner)                │
                      │        Full Visibility, Custom Pricing, Audits         │
                      └───────────┬────────────────────────────────┬───────────┘
                                  │                                │
                   ┌──────────────┴──────────────┐                 │
                   ▼                             ▼                 ▼
          ┌─────────────────┐           ┌─────────────────┐┌───────────────┐
          │ Reception Team  │           │ Accounting Team ││Delivery Desk │
          │  (Front Desk)   │           │ (Data Entry &   ││ (Warehouse /  │
          │Ahmed Mohsen & Co│           │ Cash Register)  ││  12 Workers)  │
          └────────┬────────┘           └─────────────────┘└───────▲───────┘
                   │                                               │
                   ▼                                               │
          ┌─────────────────┐                                      │
          │  Head Designer  │ (Quality Review & Floor Approval)    │
          │Abdo / Damnhoury │                                      │
          └────────┬────────┘                                      │
                   │                                               │
                   ▼                                               │
          ┌─────────────────┐                                      │
          │ Graphic Designer│                                      │
          │ (Queue Workers) │                                      │
          └────────┬────────┘                                      │
                   │                                               │
                   ▼                                               │
          ┌────────────────────────────────────────────────────────┴───────┐
          │                  Print Production Operators                    │
          │    (Digital Station, Outdoor Station, Laser Station, etc.)     │
          └────────────────────────────────────────────────────────────────┘
```

### Operational Hierarchy
Based on the explicit structural definition provided in the additional notes and corroborated by the transcript `[ADDITIONAL CONTEXT; TRANSCRIPT: 07:00, p. 7; 14:00, p. 14; 41:00, p. 41]`:
$$\text{Management (الإدارة)} > \text{Accounting (الحسابات)} > \text{Reception (الاستقبال)} > \text{Production Floor \& Designers (المطبعة والمصممون)}$$

---

### 3.1 Super Admin / Factory Owner (Owner Mohamed & GM Mohamed El-Damnhoury)
* **Who they are:** Business owners and senior general managers `[TRANSCRIPT: 09:00, p. 9; 41:00, p. 41]`.
* **What they can do:**
  * View unrestricted factory-wide metrics, open orders, and production bottlenecks in real time `[TRANSCRIPT: 14:00, p. 14; 57:36, p. 57]`.
  * Set master price lists for standard materials, sheets, and printing click charges `[TRANSCRIPT: 20:00, p. 20]`.
  * Quote bespoke manufacturing jobs (unpriced orders flagged by reception) `[TRANSCRIPT: 08:00, p. 8; 09:00, p. 9]`.
  * Override pricing or grant client-specific discount tiers `[TRANSCRIPT: 08:00, p. 8; 12:00, p. 12]`.
  * Audit daily cash drawer intake, ledger balances, and customer debt lists `[TRANSCRIPT: 71:00, p. 71; 72:00, p. 72]`.
  * Inspect immutable Git-style audit logs for order revisions or cancellations `[TRANSCRIPT: 52:00, p. 52]`.
* **What they cannot do:** No system restrictions apply.
* **Their Journey:** Logs into the Executive Dashboard to monitor floor bottlenecks, clears the queue of unpriced custom jobs, reviews the end-of-day cash drawer tally with accounting, and exports debt aging reports `[TRANSCRIPT: 09:00, p. 9; 72:00, p. 72]`.
* **Permissions:** `SUPER_ADMIN` `[TRANSCRIPT: 14:00, p. 14]`.

---

### 3.2 Reception / Front Desk (Ahmed Mohsen & Reception Team)
* **Who they are:** Front-counter customer service and initial order dispatchers `[TRANSCRIPT: 36:00, p. 36]`.
* **What they can do:**
  * Search and register clients strictly by **Mobile Phone Number** `[TRANSCRIPT: 29:00, p. 29]`.
  * View customer outstanding balances immediately upon selection `[TRANSCRIPT: 26:00, p. 26]`.
  * Create Master Work Orders (أوامر شغل) and record line items across categories `[TRANSCRIPT: 14:00, p. 14]`.
  * Run the Imposition / Montage Quick Calculator to quote standard digital jobs `[TRANSCRIPT: 73:00, p. 73–75]`.
  * Route jobs to designers via workload queues, express bypass, or reprint bypass `[ADDITIONAL CONTEXT; TRANSCRIPT: 14:00, p. 14]`.
  * Collect physical cash deposits into the reception drawer and record payments `[TRANSCRIPT: 51:00, p. 51]`.
  * Track order locations (Design, Print, Warehouse, Shipped) to answer customer inquiries `[TRANSCRIPT: 38:00, p. 38]`.
  * Trigger pre-filled WhatsApp readiness notifications via one-click `wa.me` URLs `[TRANSCRIPT: 61:00, p. 61; 64:00, p. 64]`.
* **What they cannot do:**
  * Cannot delete work orders or modify prices outside authorized discount matrices `[TRANSCRIPT: 52:00, p. 52]`.
  * Cannot release artwork directly to printing machines (must route through pre-press) `[TRANSCRIPT: 34:00, p. 34]`.
* **Their Journey:** Customer arrives or messages $\rightarrow$ Reception looks up phone $\rightarrow$ Enters order specs / calculates imposition $\rightarrow$ Collects deposit $\rightarrow$ Routes to designer queue $\rightarrow$ Monitors status $\rightarrow$ Clicks WhatsApp button when order is ready `[TRANSCRIPT: 14:00, p. 14; 64:00, p. 64; ADDITIONAL CONTEXT]`.
* **Permissions:** `RECEPTION_OPERATOR` `[TRANSCRIPT: 36:00, p. 36]`.

---

### 3.3 Head Designer (رئيس المصممين — Abdo / Damnhoury)
* **Who they are:** Senior pre-press technical leads acting as the factory quality gate `[TRANSCRIPT: 34:00, p. 34; 36:00, p. 36]`.
* **What they can do:**
  * Inspect all design files, bleeds, dimensions, and color profiles prior to printing `[TRANSCRIPT: 34:00, p. 34]`.
  * Grant digital "Pre-Press Approval" to release jobs to machine print queues `[TRANSCRIPT: 34:00, p. 34; 38:00, p. 38]`.
  * Reject designs back to assigned graphic designers with technical correction notes `[TRANSCRIPT: 34:00, p. 34]`.
  * Reassign complex jobs (e.g., historical dies/stamps / اسطمبات قديمة) to senior designers `[TRANSCRIPT: 37:00, p. 37]`.
* **What they cannot do:** Cannot alter billing prices, collect cash, or delete order logs `[TRANSCRIPT: 51:00, p. 51]`.
* **Their Journey:** Opens the Pre-Press Review queue $\rightarrow$ Verifies artwork against order dimensions $\rightarrow$ Clicks "Approve for Production" $\rightarrow$ Ticket splits to respective machine floor terminals `[TRANSCRIPT: 34:00, p. 34; 38:00, p. 38]`.
* **Permissions:** `HEAD_DESIGNER` `[TRANSCRIPT: 34:00, p. 34]`.

---

### 3.4 Graphic Designers (المصممون)
* **Who they are:** Creative workstation operators executing layout, file prep, and client adjustments `[TRANSCRIPT: 14:00, p. 14]`.
* **What they can do:**
  * View their assigned job queue and start/stop the active pre-press timer `[TRANSCRIPT: 14:00, p. 14; 15:00, p. 15]`.
  * Save high-resolution files (.AI, .PSD, .TIFF) directly into the server's shared network path `[TRANSCRIPT: 78:00, p. 78; ADDITIONAL CONTEXT]`.
  * Upload lightweight screen previews (JPG/PDF < 1MB) to the ticket for web viewing `[ADDITIONAL CONTEXT]`.
  * Submit completed pre-press tickets to the Head Designer queue for sign-off `[TRANSCRIPT: 38:00, p. 38]`.
* **What they cannot do:**
  * Cannot send jobs directly to print machines without Head Designer approval `[TRANSCRIPT: 34:00, p. 34]`.
  * Cannot view client financial ledgers, company revenue, or cash drawer balances `[TRANSCRIPT: 33:00, p. 33; 51:00, p. 51]`.
  * Cannot delete job tickets or loose desktop folders `[TRANSCRIPT: 52:00, p. 52; 78:00, p. 78]`.
* **Their Journey:** Sees assigned ticket in queue $\rightarrow$ Clicks "Start Work" $\rightarrow$ Prepares artwork in Adobe tools $\rightarrow$ Saves master file to network share $\rightarrow$ Attaches thumbnail to ticket $\rightarrow$ Clicks "Submit for Head Designer Review" `[TRANSCRIPT: 15:00, p. 15; 38:00, p. 38; ADDITIONAL CONTEXT]`.
* **Permissions:** `GRAPHIC_DESIGNER` `[TRANSCRIPT: 33:00, p. 33]`.

---

### 3.5 Print Machine Operators (فنيو الماكينات)
* **Who they are:** Factory floor technicians operating Digital presses, Outdoor banner printers, Laser cutters, and Finishing tools `[TRANSCRIPT: 44:00, p. 44; 46:00, p. 46]`.
* **What they can do:**
  * View simplified kiosk screens filtered strictly by their assigned machine type `[TRANSCRIPT: 46:00, p. 46]`.
  * Access the shared network file path of pre-press approved artwork `[TRANSCRIPT: 44:00, p. 44; 77:00, p. 77]`.
  * Click "Start Printing" (starts machine run timer) and "Print Complete" `[TRANSCRIPT: 15:00, p. 15; 42:00, p. 42]`.
  * Physically route finished goods to the downstairs Delivery/Warehouse desk `[TRANSCRIPT: 47:00, p. 47]`.
* **What they cannot do:**
  * Cannot see customer billing prices, debt balances, or client contact details `[TRANSCRIPT: 18:00, p. 18]`.
  * Cannot open or execute unapproved artwork `[TRANSCRIPT: 34:00, p. 34]`.
* **Their Journey:** Checks machine kiosk $\rightarrow$ Sees approved job $\rightarrow$ Opens file from network link $\rightarrow$ Prints substrate $\rightarrow$ Marks "Print Complete" $\rightarrow$ Hands physical output to delivery desk `[TRANSCRIPT: 42:00, p. 42; 47:00, p. 47]`.
* **Permissions:** `MACHINE_OPERATOR` `[TRANSCRIPT: 42:00, p. 42; 46:00, p. 46]`.

---

### 3.6 Delivery Desk / Warehouse Team (استقبال المخزن / التسليم — 12 فرداً)
* **Who they are:** 12 dedicated warehouse workers managing downstream assembly, count verification, and customer handovers `[TRANSCRIPT: 17:00, p. 17; 18:00, p. 18]`.
* **What they can do:**
  * Search completed orders by Ticket ID, Customer Name, or Date `[TRANSCRIPT: 18:00, p. 18]`.
  * Collate multi-item jobs arriving from different machines (e.g., banner + stickers + laser) into one package `[TRANSCRIPT: 16:00, p. 16; 17:00, p. 17]`.
  * Verify physical piece counts and record defect/shortage counts (عجز / تالف) (e.g. 98 delivered out of 100) `[TRANSCRIPT: 49:00, p. 49; 50:00, p. 50]`.
  * Mark orders as "Delivered / Handed Over" to customer `[TRANSCRIPT: 50:00, p. 50]`.
* **What they cannot do:** Cannot edit design files, approve pre-press, or alter base product pricing `[TRANSCRIPT: 51:00, p. 51]`.
* **Their Journey:** Receives printed items from production floors $\rightarrow$ Assembles multi-item packages $\rightarrow$ Customer arrives for pickup $\rightarrow$ Counts items and logs any shortages $\rightarrow$ Marks ticket "Delivered" `[TRANSCRIPT: 17:00, p. 17; 50:00, p. 50]`.
* **Permissions:** `WAREHOUSE_DISPATCH` `[TRANSCRIPT: 17:00, p. 17]`.

---

### 3.7 Accounting Staff (نورا، محمد عاطف، عم حافظ)
* **Who they are:** Financial controllers and bookkeepers `[TRANSCRIPT: 39:00, p. 39; 72:00, p. 72]`.
* **What they can do:**
  * Perform financial data entry for completed and locked work orders `[TRANSCRIPT: 41:00, p. 41]`.
  * Reconcile daily physical cash drawer collections against system shift reports `[TRANSCRIPT: 51:00, p. 51; 72:00, p. 72]`.
  * Record operational expenses (rent, transportation, electricity, spare parts) `[TRANSCRIPT: 72:00, p. 72]`.
  * Generate customer debt statements (كشف حساب عميل) and export to Excel `[TRANSCRIPT: 69:00, p. 69; 71:00, p. 71]`.
* **What they cannot do:**
  * **Cannot price manufacturing jobs** (Owner explicitly prohibited accountants from setting production prices) `[TRANSCRIPT: 41:00, p. 41; 68:00, p. 68]`.
  * Cannot alter artwork or modify production queue statuses `[TRANSCRIPT: 51:00, p. 51]`.
* **Their Journey:** Audits posted work orders $\rightarrow$ Matches physical cash received from Reception drawer $\rightarrow$ Records daily expense vouchers $\rightarrow$ Generates debt reports for management `[TRANSCRIPT: 41:00, p. 41; 51:00, p. 51; 72:00, p. 72]`.
* **Permissions:** `ACCOUNTING_USER` `[TRANSCRIPT: 41:00, p. 41]`.

---

### 3.8 End Customers / Clients (العملاء)
* **Who they are:** External retail buyers, factory owners, advertising agents, and corporate accounts `[TRANSCRIPT: 02:00, p. 2; 08:00, p. 8]`.
* **What they can do:** Receive automated WhatsApp notification texts and scan public QR receipt links `[TRANSCRIPT: 58:00, p. 58; 64:00, p. 64]`.
* **What they cannot do:** **No account logins, no passwords, no customer web portals** (explicitly rejected to prevent confusion) `[TRANSCRIPT: 58:00, p. 58]`.
* **Permissions:** `NONE` (Zero internal system access).

---

## 4. Complete User Journeys

```
                               ┌───────────────────────────┐
                               │     Customer Intake       │
                               │   (Phone Number Search)   │
                               └─────────────┬─────────────┘
                                             │
                      ┌──────────────────────┴──────────────────────┐
                      ▼                                             ▼
          ┌──────────────────────┐                      ┌──────────────────────┐
          │     Existing CRM     │                      │      New Client      │
          │  Debt Alert Checked  │                      │   Fast Registration  │
          └───────────┬──────────┘                      └───────────┬──────────┘
                      │                                             │
                      └──────────────────────┬──────────────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │   Job Ticket Creation     │
                               │  (Imposition / Specs /    │
                               │   Deposit into Drawer)    │
                               └─────────────┬─────────────┘
                                             │
               ┌─────────────────────────────┼─────────────────────────────┐
               ▼                             ▼                             ▼
    [Track 1: Standard]             [Track 2: Express]            [Track 3: Reprint]
    ┌──────────────────────┐       ┌──────────────────────┐       ┌──────────────────────┐
    │  Workload Queue Assignment   │  Bypasses Queue to   │       │ Skips Design Entirely│
    │  (Designer A, B, or C)       │  Available Designer  │       │ (Pulls from Archive) │
    └──────────┬───────────┘       └──────────┬───────────┘       └──────────┬───────────┘
               │                              │                              │
               └──────────────────────┬───────┴──────────────────────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │   Head Designer Review    │
                        │ (Mandatory Quality Gate)  │
                        └─────────────┬─────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │ Machine Floor Queues      │
                        │ (Digital / Outdoor/ Laser)│
                        └─────────────┬─────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │ Downstairs Warehouse      │
                        │ (Collation, Count Check,  │
                        │  Deficit / Spoilage Log)  │
                        └─────────────┬─────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │ Handover & WhatsApp Alert │
                        │ (Balance Collected & Sent)│
                        └───────────────────────────┘
```

---

### Journey 1: Standard Walk-in / New Customer (Full Production Lifecycle)
1. **Intake & Identification:** Customer approaches Reception. Receptionist asks for Mobile Phone Number `[TRANSCRIPT: 29:00, p. 29]`. Receptionist types number into system:
   * *System checks CRM:* If existing, profile loads with name, order history, and outstanding debt balance `[TRANSCRIPT: 26:00, p. 26]`. If debt exists, an unblock warning appears. If new, receptionist inputs Name and Phone (National ID is **not** requested) `[TRANSCRIPT: 29:00, p. 29]`.
2. **Order Specs & Quoting:** Customer requests 1,000 custom 10x10 cm stickers and an outdoor banner `[TRANSCRIPT: 15:00, p. 15; 73:00, p. 73]`.
   * *Stickers:* Receptionist clicks the "Montage Calculator" modal, enters 10x10 cm, 2mm gap, standard digital quarter-sheet (ربع). System outputs: 12 items/sheet, 84 sheets required, +2 setup buffer sheets = 86 sheets. System auto-applies fixed digital sheet rate `[TRANSCRIPT: 74:00, p. 74; 75:00, p. 75]`.
   * *Banner:* System auto-fetches standard rate (e.g. 100 EGP/sqm for retail end-users) `[TRANSCRIPT: 20:00, p. 20]`.
3. **Deposit & Drawer Credit:** Receptionist quotes total price, collects 50% cash deposit, puts physical cash into the reception desk drawer, logs cash entry in system, and clicks "Generate Order" `[TRANSCRIPT: 51:00, p. 51]`.
4. **Automated Ticket Decomposition:** System generates Master Ticket `#10840` and splits it into two child tasks:
   * `Task #10840-A`: Digital Print (Stickers) `[TRANSCRIPT: 16:00, p. 16]`.
   * `Task #10840-B`: Outdoor Banner `[TRANSCRIPT: 16:00, p. 16]`.
5. **Queue Assignment:** Receptionist views the Designer Queue indicator (Designer 1: 18 jobs; Designer 2: 9 jobs; Designer 3: 4 jobs) and assigns the ticket to Designer 3 `[TRANSCRIPT: 14:00, p. 14; ADDITIONAL CONTEXT]`.
6. **Pre-Press Design Phase:** Designer 3's terminal alerts them. Designer clicks "Start Task" (system starts pre-press timer) `[TRANSCRIPT: 14:00, p. 14; 15:00, p. 15]`. Designer preps vector artwork, saves master `.AI` file to `\\PRINTEX-SERVER\Jobs\10840\`, uploads a 300KB JPG preview to the ticket, and clicks "Submit for Approval" `[TRANSCRIPT: 78:00, p. 78; ADDITIONAL CONTEXT]`.
7. **Head Designer Quality Gate:** Head Designer inspects specs, bleed margins, and dimensions on their screen. They approve the job. System pushes child tasks to respective machine screens `[TRANSCRIPT: 34:00, p. 34; 38:00, p. 38]`.
8. **Print Floor Execution:**
   * Digital operator opens `Task #10840-A`, prints 86 sheets on the digital press, and clicks "Print Complete" `[TRANSCRIPT: 42:00, p. 42; 46:00, p. 46]`.
   * Outdoor operator opens `Task #10840-B`, prints banner on roll-to-roll machine, and clicks "Print Complete" `[TRANSCRIPT: 46:00, p. 46]`.
9. **Finishing & Post-Press:** Stickers move to rotary cutting/lamination station. Operators finish cuts and transfer items downstairs `[TRANSCRIPT: 77:00, p. 77]`.
10. **Warehouse Assembly & Shortage Check:** Downstairs warehouse workers receive both items, place them together under Ticket `#10840`, verify item counts, and mark package "Ready at Warehouse" `[TRANSCRIPT: 16:00, p. 16; 17:00, p. 17; 50:00, p. 50]`.
11. **Customer Notification:** Reception screen displays a green "Notify on WhatsApp" button. Receptionist clicks it. WhatsApp Web opens with pre-filled text (`"طلبك رقم 10840 جاهز للاستلام بالمطبعة"`). Receptionist hits send `[TRANSCRIPT: 61:00, p. 61; 64:00, p. 64]`.
12. **Handover & Cash Settlement:** Customer arrives downstairs. Warehouse staff inspects items, collects remaining balance in cash, marks ticket "Delivered", and hands cash to Reception/Accounting `[TRANSCRIPT: 17:00, p. 17; 50:00, p. 50]`.

---

### Journey 2: Express / Fast-Track Client (Queue Bypass)
*Incorporated from Notebook Notes `[ADDITIONAL CONTEXT; TRANSCRIPT: 03:00, p. 3]`.*
1. **Intake:** Customer enters requiring a tiny, immediate job (e.g., printing 50 urgent business cards or a minor document edit while waiting) `[ADDITIONAL CONTEXT; TRANSCRIPT: 03:00, p. 3]`.
2. **Bypass Flag:** Receptionist toggles order as **"Express / Fast-Track" (شغل سريع / فوري)** `[ADDITIONAL CONTEXT]`.
3. **Queue Jump:** The system bypasses the FIFO designer queue and routes the ticket directly to a designated on-duty express designer workstation `[ADDITIONAL CONTEXT]`.
4. **Immediate Execution:** Designer executes file immediately while customer waits, bypassing standard delay cycles `[TRANSCRIPT: 03:00, p. 3; ADDITIONAL CONTEXT]`.
5. **Expedited Gate & Run:** Head Designer conducts rapid visual verification $\rightarrow$ Sent directly to digital machine $\rightarrow$ Printed and handed to customer within minutes `[TRANSCRIPT: 34:00, p. 34; ADDITIONAL CONTEXT]`.

---

### Journey 3: Repeat Customer / Exact Reprint (Zero-Design Track)
*Incorporated from Notebook Notes `[ADDITIONAL CONTEXT; TRANSCRIPT: 05:00, p. 5]`.*
1. **Intake:** Regular customer calls or WhatsApps Reception: *"Print me another 5,000 copies of my old box sticker"* `[TRANSCRIPT: 05:00, p. 5]`.
2. **CRM History Search:** Receptionist looks up customer phone number, navigates to past order history, and locates original archived Job Ticket `[TRANSCRIPT: 26:00, p. 26; ADDITIONAL CONTEXT]`.
3. **Trigger "Exact Reprint" (إعادة طباعة):** Receptionist clicks "Re-order / Reprint" `[ADDITIONAL CONTEXT]`.
4. **Bypass Pre-Press Stage:** Because artwork is already approved and archived on the server path, the system **completely skips the Designer Queue** `[ADDITIONAL CONTEXT]`.
5. **Head Designer Verification:** Order routes to Head Designer purely for quantity/plate verification $\rightarrow$ Released straight to production machine floors `[TRANSCRIPT: 34:00, p. 34; ADDITIONAL CONTEXT]`.

---

### Journey 4: Custom Manufacturing / Owner Pricing Pipeline
1. **Intake of Bespoke Job:** Customer requests complex folding box packaging, high-spec restaurant cartons, or specialized acrylic structures `[TRANSCRIPT: 08:00, p. 8; 70:00, p. 70]`.
2. **No Fixed Price Available:** Receptionist inputs specifications, materials, and quantities, but checks the box: **"Requires Management Quotation" (تسعير إدارة)** `[TRANSCRIPT: 08:00, p. 8; 09:00, p. 9]`.
3. **Owner Dashboard Alert:** An urgent notification appears on Owner Mohamed's and GM Damnhoury's dashboard: *"Unpriced Order Pending Quotation"* `[TRANSCRIPT: 09:00, p. 9; 68:00, p. 68]`.
4. **Asynchronous Production Release:** To prevent shop-floor bottlenecks under tight deadlines, the Owner can click "Authorize Production Prior to Pricing". Design and printing proceed immediately while raw material costs are verified `[TRANSCRIPT: 09:00, p. 9; 10:00, p. 10]`.
5. **Quote Calculation:** Owner calculates bespoke pricing based on current ton paper prices (e.g. 45k vs 50k EGP/ton) and customer relationship history `[TRANSCRIPT: 08:00, p. 8]`.
6. **Price Ingestion & Financial Lock:** Owner submits the final price into the system. The ticket updates and locks before the order reaches the delivery desk `[TRANSCRIPT: 09:00, p. 9; 52:00, p. 52]`.

---

### Journey 5: In-Flight Modification & Spoilage Cancellation
*Based on the Heba El-Sweify case study `[TRANSCRIPT: 48:00, p. 48]`.*
1. **Initial Order:** Customer places order for 110 books. Production begins.
2. **Machine Breakdown & Verbal Changes:** Press stalls. Customer calls and alters order: *"Make them 30 and 60 books"*. Later, customer cancels the 30/30 split and demands 50 copies across 5 different titles `[TRANSCRIPT: 48:00, p. 48]`.
3. **System Revision Control:**
   * Receptionist searches Ticket ID and clicks "Request Modification / Hold" `[TRANSCRIPT: 52:00, p. 52]`.
   * System instantly freezes the job on machine floor screens to prevent operators from running obsolete plates `[TRANSCRIPT: 48:00, p. 48]`.
   * Operator logs sheets already printed/spoiled under the frozen ticket.
   * System generates a versioned Child Revision (`Rev-1`). Cancelled items maintain their accrued scrap material costs on the invoice so Printex recovers paper losses `[TRANSCRIPT: 48:00, p. 48; 52:00, p. 52]`.

---

### Journey 6: Defect & Shortage Delivery Reconciliation
*Based on the 98 vs 100 books delivery case study `[TRANSCRIPT: 49:00, p. 49; 50:00, p. 50]`.*
1. **Order Target:** Client orders 100 finished booklets.
2. **Finishing Spoilage:** During trimming and binding, 2 booklets are ruined. 98 intact booklets arrive at the delivery desk `[TRANSCRIPT: 49:00, p. 49]`.
3. **Delivery Desk Inspection:** Warehouse staff counts 98 units against Ticket count of 100 `[TRANSCRIPT: 50:00, p. 50]`.
4. **Resolution Selection:** Delivery operator selects one of two explicit options:
   * *Option A (Direct Invoice Markdown):* Operator enters "Delivered: 98". System recalculates total price to charge for 98 books only, closing the ticket clean `[TRANSCRIPT: 50:00, p. 50]`.
   * *Option B (Carry-Forward Deficit Credit / تعويض في الأوردر القادم):* Client pays for full 100 books. System logs a 2-unit deficit credit under the client's CRM profile, automatically adding +2 units to their next print run `[TRANSCRIPT: 50:00, p. 50]`.

---

### Journey 7: Client-Supplied Raw Materials ("عهدة عميل")
*Explicitly discussed on Page 75 `[TRANSCRIPT: 75:00, p. 75]`.*
1. **Intake:** Client supplies their own paper reams/substrates, contracting Printex purely for machine presswork and ink `[TRANSCRIPT: 75:00, p. 75]`.
2. **Ticket Generation:** Receptionist checks the box: **"Client Custody / Raw Material Supplied by Client" (عهدة للعميل)** `[TRANSCRIPT: 22:00, p. 22; 75:00, p. 75]`.
3. **Automated Cost Deduction:** System zeroes out standard raw paper sheet charges (e.g. deducting 3 EGP per sheet) and charges purely for click runs, setup, and ink (e.g. 5 EGP print charge) `[TRANSCRIPT: 76:00, p. 76]`.
4. **Scrap Logging:** Production logs intake sheets and actual scrap allowance (`هالك`) directly on the ticket `[TRANSCRIPT: 76:00, p. 76]`.

---

### Journey 8: Daily Cash Drawer Shift Closeout & Audit
1. **End-of-Shift Trigger:** Shift concludes at Reception desk `[TRANSCRIPT: 51:00, p. 51]`.
2. **Drawer Reconciliation:** Receptionist opens "Cash Drawer Closeout". System displays expected cash total based on recorded deposits and settlements `[TRANSCRIPT: 51:00, p. 51; 72:00, p. 72]`.
3. **Physical Count Handover:** Receptionist counts physical drawer cash, enters actual amount, and flags any discrepancy `[TRANSCRIPT: 51:00, p. 51]`.
4. **Accountant Verification:** Accountant (Nora / Mohamed Atef) verifies cash count, signs off digitally, transfers cash to the central company safe, and locks the shift ledger `[TRANSCRIPT: 51:00, p. 51; 72:00, p. 72]`.

---

## 5. Functional Requirements

### FR-01: Client Profile & Debt CRM
* **Purpose:** Maintain historical customer records, delivery addresses, debt balances, and custom pricing tiers `[TRANSCRIPT: 13:00, p. 13; 26:00, p. 26]`.
* **User:** Reception, Accounting, Admin.
* **Trigger:** Customer arrives at desk, calls, or messages on WhatsApp `[TRANSCRIPT: 29:00, p. 29]`.
* **Flow:** Search phone $\rightarrow$ System loads record $\rightarrow$ Highlights debt if present $\rightarrow$ Select for order `[TRANSCRIPT: 26:00, p. 26]`.
* **Inputs:** Mobile Phone Number (mandatory primary lookup key), Client/Company Name, Shipping Address, Account Notes `[TRANSCRIPT: 13:00, p. 13; 29:00, p. 29]`.
* **Outputs:** Customer Card, Outstanding Debt Warning (in red), Historical Orders list `[TRANSCRIPT: 26:00, p. 26]`.
* **Business Rules:**
  * National ID is **not** required (clients refuse to disclose it) `[TRANSCRIPT: 29:00, p. 29]`.
  * If an existing phone number is entered under a new name, system alerts operator of name duplication `[TRANSCRIPT: 29:00, p. 29]`.
  * Support an aggregated "Cash Client" (عميل نقدي) account for one-time walk-ins `[TRANSCRIPT: 28:00, p. 28]`.
* **Edge Cases:** Multiple contacts belonging to one corporate entity.
* **Dependencies:** None.
* **Status:** `CONFIRMED BY CLIENT` `[TRANSCRIPT: 26:00, p. 26; 29:00, p. 29]`.

---

### FR-02: Imposition & Montage Quick Calculator (حاسبة المونتاج)
* **Purpose:** Enable non-designer receptionists to calculate sheet yields, raw paper requirements, and quotes instantly `[TRANSCRIPT: 73:00, p. 73–75]`.
* **User:** Reception, Graphic Designers.
* **Trigger:** Customer brings a print-ready file (e.g., 10x10 cm sticker) requiring a quote `[TRANSCRIPT: 73:00, p. 73]`.
* **Flow:** Open modal $\rightarrow$ Enter dimensions & quantity $\rightarrow$ System calculates layout $\rightarrow$ Auto-fills work order line item `[TRANSCRIPT: 74:00, p. 74]`.
* **Inputs:** Item Width (cm), Item Height (cm), Gap/Bleed (mm, default 2–3mm), Target Finished Quantity, Parent Sheet Size (default: Digital Quarter-Sheet / ربع) `[TRANSCRIPT: 74:00, p. 74; 75:00, p. 75]`.
* **Outputs:** Items per Sheet, Total Sheets Required, Spoilage Buffer Sheets, Total Raw Cost `[TRANSCRIPT: 74:00, p. 74; 75:00, p. 75]`.
* **Business Rules:**
  $$\text{Items/Sheet} = \lfloor \frac{\text{Sheet Width}}{\text{Item Width} + \text{Gap}} \rfloor \times \lfloor \frac{\text{Sheet Height}}{\text{Item Height} + \text{Gap}} \rfloor$$
  $$\text{Total Sheets} = \lceil \frac{\text{Quantity}}{\text{Items/Sheet}} \rceil + \text{Setup Spoilage Buffer (+1 to 2 sheets)}$$
* **Conditions:** Standard rectangular layouts calculate automatically. Irregular die-cut shapes flag for designer review `[TRANSCRIPT: 74:00, p. 74]`.
* **Dependencies:** Master Price Matrix.
* **Status:** `CONFIRMED BY CLIENT` `[TRANSCRIPT: 73:00, p. 73–75]`.

---

### FR-03: Multi-Category Work Order (أمر الشغل) Generator
* **Purpose:** Digitize job ticketing, split mixed orders into departmental child tasks, and prevent unbilled jobs `[TRANSCRIPT: 14:00, p. 14; 16:00, p. 16]`.
* **User:** Reception (creates), Designers/Printers (execute), Warehouse (assembles).
* **Trigger:** Customer confirms print request `[TRANSCRIPT: 05:00, p. 5]`.
* **Flow:** Select Customer $\rightarrow$ Add Line Items $\rightarrow$ Calculate Prices $\rightarrow$ Record Deposit $\rightarrow$ Dispatch `[TRANSCRIPT: 14:00, p. 14; 51:00, p. 51]`.
* **Inputs:** Customer ID, Delivery Target Date/Time, Item Name, Production Department (Digital, Outdoor, Laser, Screen, Finishing), Substrate/Weight (e.g. 90g paper, Banner 160g), Finished Dimensions, Target Quantity, Client Paper toggle (`عهدة`), Special Notes `[TRANSCRIPT: 14:00, p. 14; 22:00, p. 22; 70:00, p. 70]`.
* **Outputs:** Master Order ID (auto-sequenced), Child Sub-task IDs, Barcode/QR print receipt `[TRANSCRIPT: 16:00, p. 16; 21:00, p. 21; 58:00, p. 58]`.
* **Business Rules:**
  * Master ticket remains open until all child tasks are marked "Print Complete" and assembled `[TRANSCRIPT: 16:00, p. 16; 17:00, p. 17]`.
  * Silent hard-deletion of orders is strictly blocked `[TRANSCRIPT: 52:00, p. 52]`.
* **Dependencies:** Client CRM, Pricing Engine.
* **Status:** `CONFIRMED BY CLIENT` `[TRANSCRIPT: 14:00, p. 14; 16:00, p. 16; 21:00, p. 21]`.

---

### FR-04: Designer Workload Queue & Dispatcher
* **Purpose:** Balance design tasks among graphic designers and prevent bottlenecks `[TRANSCRIPT: 14:00, p. 14; ADDITIONAL CONTEXT]`.
* **User:** Reception (assigns), Head Designer (reassigns), Designers (execute).
* **Trigger:** Order submitted at Reception `[TRANSCRIPT: 14:00, p. 14]`.
* **Flow:** System displays open job counter per designer $\rightarrow$ Receptionist selects designer $\rightarrow$ Task appears on designer's screen `[TRANSCRIPT: 14:00, p. 14]`.
* **Inputs:** Selected Designer ID, Priority Flag (Normal, High, Express Bypass) `[TRANSCRIPT: 14:00, p. 14; ADDITIONAL CONTEXT]`.
* **Outputs:** Workstation notification, personal task queue update `[TRANSCRIPT: 14:00, p. 14]`.
* **Business Rules:**
  * Express jobs bypass FIFO queue and land on designated express workstations `[ADDITIONAL CONTEXT]`.
  * Exact reprints bypass design queue completely `[ADDITIONAL CONTEXT]`.
* **Dependencies:** Work Order Module.
* **Status:** `CONFIRMED BY CLIENT` `[TRANSCRIPT: 14:00, p. 14; ADDITIONAL CONTEXT]`.

---

### FR-05: Pre-Press Quality Gate & Head Designer Approval
* **Purpose:** Eliminate misprints and scrap waste by enforcing a mandatory sign-off before files reach machines `[TRANSCRIPT: 34:00, p. 34]`.
* **User:** Head Designer (Abdo / Damnhoury).
* **Trigger:** Graphic designer clicks "Submit for Review" `[TRANSCRIPT: 34:00, p. 34; 38:00, p. 38]`.
* **Flow:** Job appears in Review Queue $\rightarrow$ Head Designer checks specs/bleeds $\rightarrow$ Clicks "Approve for Production" $\rightarrow$ Released to machine screens `[TRANSCRIPT: 34:00, p. 34; 38:00, p. 38]`.
* **Inputs:** Approval decision (Approve / Reject with revision notes) `[TRANSCRIPT: 34:00, p. 34]`.
* **Outputs:** Task status changed to "Approved for Print"; unlocked on machine floor kiosks `[TRANSCRIPT: 34:00, p. 34]`.
* **Business Rules:** Machine operators cannot open, view, or execute files that have not received Head Designer digital sign-off `[TRANSCRIPT: 34:00, p. 34]`.
* **Dependencies:** Design Queue Module.
* **Status:** `CONFIRMED BY CLIENT` `[TRANSCRIPT: 34:00, p. 34; 38:00, p. 38]`.

---

### FR-06: Production Floor Kiosk Interfaces
* **Purpose:** Provide machine operators with uncluttered, machine-specific print lists `[TRANSCRIPT: 44:00, p. 44; 46:00, p. 46]`.
* **User:** Machine Operators (Digital, Outdoor, Laser, Screen).
* **Trigger:** Pre-press approval granted `[TRANSCRIPT: 34:00, p. 34]`.
* **Flow:** Operator checks screen $\rightarrow$ Clicks "Start Run" $\rightarrow$ Prints substrate $\rightarrow$ Clicks "Complete" $\rightarrow$ Sends to Delivery Desk `[TRANSCRIPT: 42:00, p. 42; 47:00, p. 47]`.
* **Inputs:** Job action buttons ("Start Print", "Print Complete", "Report Defect") `[TRANSCRIPT: 42:00, p. 42]`.
* **Outputs:** Production status update, timestamps logged `[TRANSCRIPT: 15:00, p. 15]`.
* **Business Rules:**
  * Operators only see tasks assigned to their specific machine line `[TRANSCRIPT: 46:00, p. 46]`.
  * Pricing, invoice totals, and customer debt are strictly hidden from floor screens `[TRANSCRIPT: 18:00, p. 18]`.
* **Dependencies:** Head Designer Approval Gate.
* **Status:** `CONFIRMED BY CLIENT` `[TRANSCRIPT: 44:00, p. 44; 46:00, p. 46]`.

---

### FR-07: Warehouse Handover & Defect Reconciliation
* **Purpose:** Collate multi-item orders, verify delivered counts, and log spoilage/shortages `[TRANSCRIPT: 17:00, p. 17; 49:00, p. 49; 50:00, p. 50]`.
* **User:** Downstairs Warehouse / Delivery Team (12 workers) `[TRANSCRIPT: 17:00, p. 17]`.
* **Trigger:** Printed items arrive from production lines `[TRANSCRIPT: 47:00, p. 47]`.
* **Flow:** Search Ticket $\rightarrow$ Collate items $\rightarrow$ Verify counts $\rightarrow$ Log shortages if any $\rightarrow$ Mark "Delivered" `[TRANSCRIPT: 18:00, p. 18; 50:00, p. 50]`.
* **Inputs:** Ticket ID, Delivered Quantity Count, Defect/Shortage Count, Shortage Action (Markdown vs Future Credit) `[TRANSCRIPT: 50:00, p. 50]`.
* **Outputs:** Order marked "Delivered", final financial balance updated `[TRANSCRIPT: 50:00, p. 50]`.
* **Business Rules:**
  * If delivered count < ticket count, system forces selection: Markdown invoice or log future customer credit `[TRANSCRIPT: 50:00, p. 50]`.
* **Dependencies:** Production Floor Completion.
* **Status:** `CONFIRMED BY CLIENT` `[TRANSCRIPT: 17:00, p. 17; 50:00, p. 50]`.

---

### FR-08: Zero-Cost WhatsApp Status Dispatcher
* **Purpose:** Send instant customer readiness notifications via WhatsApp without paying Meta API fees or risking phone bans `[TRANSCRIPT: 60:00, p. 60; 61:00, p. 61; 64:00, p. 64]`.
* **User:** Reception, Delivery Desk.
* **Trigger:** Order status changes to "Ready for Pickup" or "Out for Delivery" `[TRANSCRIPT: 61:00, p. 61; 64:00, p. 64]`.
* **Flow:** System displays WhatsApp button $\rightarrow$ User clicks $\rightarrow$ Browser launches `wa.me` with pre-filled message $\rightarrow$ User clicks Send in WhatsApp `[TRANSCRIPT: 61:00, p. 61; 64:00, p. 64]`.
* **Inputs:** Customer Phone Number, Order ID, Customer Name, Pre-configured Status Template `[TRANSCRIPT: 64:00, p. 64]`.
* **Outputs:** Chat opened in WhatsApp Web/Desktop; audit log records user and timestamp `[TRANSCRIPT: 64:00, p. 64; 65:00, p. 65]`.
* **Business Rules:**
  * Must use standard web protocol URL string: `https://wa.me/[Phone]?text=[EncodedMessage]`.
  * Zero third-party API dependencies or subscription costs `[TRANSCRIPT: 60:00, p. 60]`.
* **Dependencies:** Work Order Status Engine.
* **Status:** `CONFIRMED BY CLIENT` `[TRANSCRIPT: 60:00, p. 60; 61:00, p. 61; 64:00, p. 64]`.

---

### FR-09: Cash Drawer (الدرج) & Treasury Shift Reconciler
* **Purpose:** Prevent cash leakage at front desk by tracking physical drawer cash against recorded shift intake `[TRANSCRIPT: 51:00, p. 51; 72:00, p. 72]`.
* **User:** Reception (cashier), Accounting, Owner.
* **Trigger:** Shift conclusion or daily handover to accounting `[TRANSCRIPT: 51:00, p. 51]`.
* **Flow:** Cashier clicks Close Shift $\rightarrow$ System displays calculated cash intake $\rightarrow$ Cashier enters physical cash count $\rightarrow$ Discrepancy calculated $\rightarrow$ Accountant confirms handover `[TRANSCRIPT: 51:00, p. 51; 72:00, p. 72]`.
* **Inputs:** Cash received (deposits, settlements), Cash paid out (petty cash vouchers), Counted physical cash `[TRANSCRIPT: 51:00, p. 51; 72:00, p. 72]`.
* **Outputs:** Daily Cash Register Summary Report (تقرير حركة الخزنة والدرج) `[TRANSCRIPT: 72:00, p. 72]`.
* **Business Rules:** All cash entries must tie to an Order ID, Customer ID, and logged-in user ID `[TRANSCRIPT: 65:00, p. 65]`.
* **Dependencies:** Work Order Module.
* **Status:** `CONFIRMED BY CLIENT` `[TRANSCRIPT: 51:00, p. 51; 72:00, p. 72]`.

---

### FR-10: Anti-Tampering Audit Log (Git-Style History)
* **Purpose:** Eliminate silent folder deletion and unauthorized record tampering `[TRANSCRIPT: 49:00, p. 49; 52:00, p. 52]`.
* **User:** System (automated), Super Admin (reviews).
* **Trigger:** Any update, price override, quantity edit, or cancellation attempt `[TRANSCRIPT: 52:00, p. 52]`.
* **Flow:** User modifies data $\rightarrow$ System requires reason code $\rightarrow$ Creates immutable versioned record `[TRANSCRIPT: 52:00, p. 52]`.
* **Inputs:** User ID, Timestamp, Old Value, New Value, Mandatory Change Reason `[TRANSCRIPT: 52:00, p. 52]`.
* **Outputs:** Immutable audit log stream on admin dashboard `[TRANSCRIPT: 52:00, p. 52]`.
* **Business Rules:** Hard deletion (`DELETE` queries) is permanently disabled across the database schema `[TRANSCRIPT: 52:00, p. 52]`.
* **Dependencies:** All system entities.
* **Status:** `CONFIRMED BY CLIENT` `[TRANSCRIPT: 52:00, p. 52]`.

---

## 6. Admin / Dashboard Requirements

### 6.1 Executive Production Pipeline
* Live Kanban/pipeline board showing active job counts across all plant nodes:
  * In Reception / Quoting.
  * In Design Queue (broken down per designer).
  * In Head Designer Quality Review.
  * In Machine Production Floor (Digital, Outdoor, Laser, Screen).
  * In Finishing & Post-Press.
  * Ready for Pickup at Downstairs Warehouse.
* **Overdue Alerts:** Jobs remaining in any stage past a defined SLA threshold (e.g. in design > 2 hours) highlight in blinking red on the Owner's screen `[TRANSCRIPT: 57:36, p. 57]`.

### 6.2 Management Custom Quoting Inbox
* Dedicated filter for all work orders flagged as "Requires Management Quotation" `[TRANSCRIPT: 08:00, p. 8; 09:00, p. 9]`.
* Allows Owner Mohamed or GM Damnhoury to input prices, approve production bypass, and push prices directly into open tickets `[TRANSCRIPT: 09:00, p. 9]`.

### 6.3 Financial & Operational Reports (One-Click Excel Export)
* **Customer Debt Aging List (قائمة مديونيات العملاء):** Detailed statement of all open customer debit balances `[TRANSCRIPT: 71:00, p. 71]`.
* **Daily Cash Register & Shift Statement:** Reconciled cash receipts vs petty expenses `[TRANSCRIPT: 72:00, p. 72]`.
* **WIP & Bottleneck Report:** Volume of work currently held in each department `[TRANSCRIPT: 71:00, p. 71]`.
* **Defect & Spoilage Report:** Shortage records and scrap percentages logged during delivery `[TRANSCRIPT: 50:00, p. 50]`.
* All reporting tables must include an **"Export to Excel" (.xlsx)** button `[TRANSCRIPT: 71:00, p. 71]`.

### 6.4 Active User Presence Monitor
* Displays list of users currently logged in, their terminal IP, and login timestamp `[TRANSCRIPT: 66:00, p. 66]`.
* Intended to track receptionists, designers, and department heads `[TRANSCRIPT: 66:00, p. 66]`.

---

## 7. Business Logic

### 7.1 Outdoor / Banner Production Yield & Scrap Loading Formula
* **Roll Master Specifications:** Standard roll measures **3.20 meters width by 50 meters length** (Total Gross Area = **160 square meters**) `[TRANSCRIPT: 19:00, p. 19; 20:00, p. 20]`.
* **Physical Layout Gaps:** When printing 1-meter wide banners side-by-side on a 3.20m roll, exactly 3 banners fit across the width ($3 \times 1.0\text{m} = 3.0\text{m}$), leaving a permanent 20 cm edge waste `[TRANSCRIPT: 20:00, p. 20]`.
* **Net Billable Yield:** A 160 sqm raw roll yields only **140 square meters of net billable print** `[TRANSCRIPT: 20:00, p. 20]`.
* **Scrap Cost Loading Rule:** The cost of the unprinted 20 sqm gap must be loaded onto the selling price of the billable square meters upfront:
  $$\text{Effective Base Rate/sqm} = \frac{\text{Total Cost of 160 sqm Roll} + \text{Ink Run Cost}}{\text{140 sqm Net Billable Yield}} \times (1 + \text{Target Margin})$$
* **Established Rates:** Printex charges **80 EGP/sqm for commercial/trade clients** and **100 EGP/sqm for retail end-users** `[TRANSCRIPT: 20:00, p. 20]`.

### 7.2 Digital Sheet Costing Formula
* Unit cost per sheet for standard digital presswork:
  $$\text{Total Sheet Cost} = \text{Press Click/Printing Charge (e.g., 5 EGP)} + \text{Paper Substrate (e.g., 3 EGP)} + \text{Spoilage Markup / هالك (e.g., 1 EGP)} = 9\text{ EGP/sheet}$$
  `[TRANSCRIPT: 76:00, p. 76]`.
* **Client-Supplied Paper (`عهدة عميل`):**
  If client supplies their own paper, the substrate charge is waived:
  $$\text{Client Paper Sheet Cost} = \text{Press Click Charge (5 EGP)} + \text{Handling/Ink buffer}$$
  `[TRANSCRIPT: 75:00, p. 75; 76:00, p. 76]`.

### 7.3 Imposition & Sheet Allocation Formula
* To calculate required sheets for digital presswork (e.g., 10x10 cm items on digital quarter-sheet):
  $$\text{Pieces Across Width} = \lfloor \frac{\text{Sheet Width}}{\text{Item Width} + \text{Gap}} \rfloor = 3$$
  $$\text{Pieces Across Height} = \lfloor \frac{\text{Sheet Height}}{\text{Item Height} + \text{Gap}} \rfloor = 4$$
  $$\text{Yield Per Sheet} = 3 \times 4 = 12\text{ pieces per sheet}$$
  $$\text{Net Required Sheets} = \lceil \frac{\text{Order Quantity (e.g. 1000)}}{12} \rceil = 84\text{ sheets}$$
  $$\text{Total Sheets with Setup Buffer} = 84 + 1\text{ to }2\text{ buffer sheets} = 85\text{ to }86\text{ sheets}$$
  `[TRANSCRIPT: 74:00, p. 74; 75:00, p. 75]`.

### 7.4 Price Discrimination & Relationship Policies
* **Dynamic Cost Fluidity:** Paper market prices fluctuate wildly (e.g., 45,000 EGP/ton one week, 50,000 EGP/ton the next) `[TRANSCRIPT: 08:00, p. 8]`. The master pricing table must support global updates without modifying past invoiced orders.
* **Customer-Specific Margin Subsidies:** The Owner explicitly adjusts pricing per customer (e.g., lowering margins on one job to win a major account, compensating by charging higher margins on another) `[TRANSCRIPT: 08:00, p. 8]`. The system must support custom price overrides on individual client CRM profiles `[TRANSCRIPT: 12:00, p. 12]`.

### 7.5 Debt Enforcement at Intake
* If an existing client has an outstanding debit balance, the system displays the amount in red upon phone lookup `[TRANSCRIPT: 26:00, p. 26]`.
* Front-desk staff are empowered to collect past debts prior to accepting new production deposits `[TRANSCRIPT: 26:00, p. 26]`.

---

## 8. Technical Requirements

### 8.1 Server Architecture & Network Infrastructure
* **Deployment Model:** On-premises web application hosted on Printex's internal Local Area Network (LAN) server `[TRANSCRIPT: 31:00, p. 31; ADDITIONAL CONTEXT]`.
* **Zero Cloud Dependence:** Floor operations, ticket generation, and machine views must function 100% locally without an active public internet connection `[TRANSCRIPT: 27:00, p. 27; 31:00, p. 31]`.
* **Database Architecture:**
  * Primary database runs on the local server `[TRANSCRIPT: 11:00, p. 11; ADDITIONAL CONTEXT]`.
  * Asynchronous scheduled database backup dumped to an isolated secondary local hard drive, with periodic offsite snapshots `[TRANSCRIPT: 32:00, p. 32]`.
* **Remote Management Access:** Secure encrypted tunnel or existing AnyDesk protocol to allow Owner Mohamed and Developers to access the system remotely from home `[TRANSCRIPT: 55:00, p. 55; 56:00, p. 56]`.

### 8.2 Artwork File Management Architecture
*Addressing the user's explicit question on file linking `[ADDITIONAL CONTEXT]` in light of high-resolution file bottlenecks `[TRANSCRIPT: 54:00, p. 54]`.*

```
┌────────────────────────────────────────────────────────┐
│               Shared Local Storage (SMB)               │
│          (\\PRINTEX-SERVER\PrintJobs\2026\)            │
└───────┬────────────────────────────────────────▲───────┘
        │ 1. System auto-creates folder          │ 2. Designer saves
        ▼                                        │    master .AI/.TIFF
┌─────────────────┐                     ┌────────┴────────┐
│   Reception /   │                     │ Graphic Designer│
│ ERP Application │                     │ Exports Specs & │
│ (Order #10840)  │                     │ <1MB Preview    │
└───────┬─────────┘                     └────────┬────────┘
        │                                        │
        │ 3. Attaches lightweight preview        │
        │    and links shared network path       │
        ▼                                        ▼
┌────────────────────────────────────────────────────────┐
│                   Unified System Ticket                │
│ • Preview: [Lightweight JPG/Thumbnail]                 │
│ • Network Link: \\PRINTEX-SERVER\PrintJobs\10840\      │
│ • Specs: 10x10 cm | 86 Sheets | Matte Sticker          │
└────────────────────────────────────────────────────────┘
```

* **No Database Blobs:** Storing raw Adobe Illustrator (`.AI`) or Photoshop (`.PSD`) files (100MB to 1.5GB+) directly in the database will crash network bandwidth and exhaust storage `[TRANSCRIPT: 54:00, p. 54; ADDITIONAL CONTEXT]`.
* **Hybrid Storage Pattern:**
  1. **Automated Folder Creation:** When Order `#10840` is created, the system background service automatically provisions a folder on the shared server: `\\PRINTEX-SERVER\PrintJobs\10840_ClientName\` `[ADDITIONAL CONTEXT]`.
  2. **Workstation File Storage:** Designers save their high-resolution production files directly into that shared Windows network folder via LAN `[TRANSCRIPT: 78:00, p. 78; ADDITIONAL CONTEXT]`.
  3. **Web Ticket Attachment:** In the ERP web app, the designer uploads only a **compressed screen preview (JPG/PDF < 1MB)** for Head Designer visual inspection, while the system records the network UNC path `[ADDITIONAL CONTEXT]`.
  4. **Machine Floor Access:** Machine operators view the thumbnail and click "Open Print File" to launch the raw file across the local network directly into machine RIP software `[TRANSCRIPT: 44:00, p. 44; 77:00, p. 77; ADDITIONAL CONTEXT]`.

---

## 9. Integrations & External Services

| Integration / Service | Evaluated Role | Client Decision & Final Resolution | Traceability |
| :--- | :--- | :--- | :--- |
| **Meta WhatsApp Business API** | Automated cloud notifications | **REJECTED.** Excluded due to recurring message fees, 24-hour window timeouts, template approval friction, and customer block risks. | `[TRANSCRIPT: 58:00, p. 58; 60:00, p. 60]` |
| **WhatsApp Web (`wa.me`)** | Semi-automated customer alerts | **CONFIRMED.** One-click URL protocol executing directly in browser/WhatsApp Web for zero cost. | `[TRANSCRIPT: 61:00, p. 61; 64:00, p. 64]` |
| **OpenAI / AI Models** | Automated layout / estimation | **REJECTED / POSTPONED.** Dev 2 proposed GPT-4o mini ($5 budget); Owner joked about replacing designers. Rejected for core logic to avoid non-deterministic calculations. | `[TRANSCRIPT: 21:00, p. 21; 24:00, p. 24; 25:00, p. 25; 75:00, p. 75]` |
| **Third-Party ERPs (Print Booster, Daftra, IBS)** | Existing software benchmarks | **BENCHMARK ONLY.** Owner demonstrated "Print Booster" to illustrate imposition calculator and order status concepts. No data integration. | `[TRANSCRIPT: 21:00, p. 21; 30:00, p. 30; 73:00, p. 73]` |
| **AnyDesk** | Remote workstation access | **MAINTAINED.** Kept as operational fallback for external server access. | `[TRANSCRIPT: 55:00, p. 55]` |

---

## 10. Data / Information Requirements

### 10.1 Core Data Entities & Attributes

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│            Customer             │       │            WorkOrder            │
├─────────────────────────────────┤       ├─────────────────────────────────┤
│ id (PK)                         │1     *│ id (PK)                         │
│ phone_number (Unique, Indexed)  ├───────┤ order_number (Auto-seq)         │
│ customer_name                   │       │ customer_id (FK)                │
│ company_name                    │       │ status                          │
│ address                         │       │ priority_tier                   │
│ current_debt_balance            │       │ is_reprint                      │
│ special_pricing_tier            │       │ total_amount                    │
│ created_at                      │       │ deposit_paid                    │
└─────────────────────────────────┘       │ remaining_balance               │
                                          │ management_quote_pending        │
                                          │ created_by (User FK)            │
                                          │ created_at                      │
                                          └───────────────┬─────────────────┘
                                                          │ 1
                                                          │
                                                          │ *
                                          ┌───────────────┴─────────────────┐
                                          │          OrderItemTask          │
                                          ├─────────────────────────────────┤
                                          │ id (PK)                         │
                                          │ work_order_id (FK)              │
                                          │ department                      │
                                          │ assigned_designer_id (FK)       │
                                          │ item_name                       │
                                          │ substrate                       │
                                          │ width_cm, height_cm             │
                                          │ quantity_ordered                │
                                          │ quantity_delivered              │
                                          │ defect_quantity                 │
                                          │ is_client_custody_paper         │
                                          │ network_file_path               │
                                          │ preview_thumbnail_url           │
                                          │ head_designer_approved_by (FK)  │
                                          │ status                          │
                                          └─────────────────────────────────┘
```

* **Customer Entity:** `id`, `phone_number` (Indexed), `customer_name`, `company_name`, `address`, `current_debt_balance`, `special_pricing_tier`, `created_at`.
* **WorkOrder Entity:** `id`, `order_number` (Sequenced), `customer_id` (FK), `status` (Quoting, Design, PrePressReview, Production, Finishing, ReadyWarehouse, Delivered, Cancelled), `priority_tier` (Normal, High, ExpressBypass), `is_reprint` (Boolean), `total_amount`, `deposit_paid`, `remaining_balance`, `management_quote_pending` (Boolean), `created_by` (User FK), `created_at`.
* **OrderItemTask Entity:** `id`, `work_order_id` (FK), `department` (Digital, Outdoor, Laser, Screen, Outsourced), `assigned_designer_id` (FK), `item_name`, `substrate`, `width_cm`, `height_cm`, `quantity_ordered`, `quantity_delivered`, `defect_quantity`, `is_client_custody_paper` (Boolean), `network_file_path`, `preview_thumbnail_url`, `head_designer_approved_by` (FK), `head_designer_approved_at`, `status`.
* **CashTransaction Entity:** `id`, `work_order_id` (FK, Nullable), `cashier_user_id` (FK), `amount`, `transaction_type` (Deposit, FinalSettlement, PettyExpense, DebtPayment), `expense_category`, `shift_id` (FK), `created_at`.
* **AuditLog Entity:** `id`, `entity_name`, `entity_id`, `action` (Create, Update, StatusChange, PriceOverride, Void), `changed_by` (User FK), `old_values` (JSON), `new_values` (JSON), `change_reason`, `timestamp`.

---

## 11. UI / UX / Design Requirements

* **Native Arabic RTL Design:** Built ground-up for right-to-left layout alignment with clear Arabic typography `[TRANSCRIPT: 53:00, p. 53]`.
* **Anti-Clutter Principle:**
  * The Owner explicitly criticized the interface of the commercial demo software ("Print Booster") because all production services, finishing, and pricing options were crammed into a single overwhelming screen `[TRANSCRIPT: 77:00, p. 77]`.
  * Screens must be cleanly isolated: Receptionists see quoting and intake; Designers see queues; Floor operators see only their machine list `[TRANSCRIPT: 46:00, p. 46; 77:00, p. 77]`.
* **High-Speed Keyboard Navigation:** Rapid field hopping and Enter-key submission for Reception desks to minimize mouse reliance during customer rush hours `[TRANSCRIPT: 05:00, p. 5]`.
* **Action-Oriented Status Buttons:** Large, prominent color-coded buttons:
  * Green: `[إرسال واتساب للعميل - Notify via WhatsApp]`.
  * Blue: `[اعتماد رئيس المصممين - Head Designer Approval]`.
  * Orange: `[بدء الطباعة - Start Print]`.
  * Purple: `[تم الانتهاء ونقل للمخزن - Print Done -> Move to Delivery]`.
* **Integrated Modal Calculators:** Imposition tools pop up inside the order form, immediately writing computed sheet numbers into form fields upon closing `[TRANSCRIPT: 73:00, p. 73]`.

---

## 12. Notifications / Communication

### WhatsApp Click-to-Chat URI Architecture
* Eliminates the 6-PC WhatsApp Business chaos by generating pre-filled direct links from within the ERP ticket `[TRANSCRIPT: 06:00, p. 6; 61:00, p. 61; 64:00, p. 64]`:
  $$\text{Target URL} = \text{https://wa.me/20[CustomerPhone]?text=[\text{URL-Encoded Template}]}$$
* **Dynamic Template Tokens:**
  * `[Customer_Name]`
  * `[Order_Number]`
  * `[Ready_Items_Summary]`
  * `[Remaining_Balance_Due]`
* **Sample System Output:**
  ```text
  أهلاً بك يا أستاذ/ أحمد مونس،
  يسعدنا إبلاغك بأن طلبك رقم #10840 (بنر واستيكرات) جاهز للاستلام الآن بمقر برينتكس.
  المبلغ المتبقي للتحصيل: 250 جنيه.
  شكراً لتعاملك معنا!
  ```
* **Audit Tracking:** When an employee clicks the WhatsApp button, the ERP records an audit entry: `[User X triggered WhatsApp notification for Order Y at Timestamp Z]` `[TRANSCRIPT: 65:00, p. 65]`.

---

## 13. Payments & Financial Logic

### 13.1 Daily Cash Drawer (الدرج) Shift Lifecycle
* All cash collected from customer deposits and final settlements is physically kept in the front-desk cash drawer `[TRANSCRIPT: 51:00, p. 51]`.
* The system enforces a **Two-Tier Financial Shift**:
  1. **Cashier Intake:** Front-desk receptionists accept cash, instantly logging it against the customer's order ticket.
  2. **End-of-Shift Reconciliation:** Physical drawer cash is counted and cross-checked against system totals, then handed over to Accounting (Nora / Mohamed Atef) `[TRANSCRIPT: 51:00, p. 51; 72:00, p. 72]`.

### 13.2 Customer Debit & Credit Accounting
* **Cash Walk-Ins:** Paid in full prior to or upon delivery; no open debt permitted `[TRANSCRIPT: 28:00, p. 28]`.
* **Account / Commercial Clients:** Permitted to carry debit balances up to management-approved credit limits. New jobs post directly to their ledger statement `[TRANSCRIPT: 26:00, p. 26; 71:00, p. 71]`.
* **Deficit Credit Balance:** Shortages upon delivery (e.g., ruined books) can be logged as a customer credit to offset future orders `[TRANSCRIPT: 50:00, p. 50]`.

---

## 14. Decisions Made

| # | Topic | Final Decision | Stakeholders | Traceability |
| :-: | :--- | :--- | :--- | :--- |
| **D-01** | **Inventory Management** | **EXCLUDED FROM PHASE 1.** Raw material stocks (ink, paper, spare parts) will remain on an external spreadsheet. | Owner, Dev 1, Dev 2 | `[TRANSCRIPT: 23:00, p. 23; 72:00, p. 72]` |
| **D-02** | **Staff Payroll Module** | **POSTPONED.** Employee wages, commissions, and payroll are excluded from Phase 1 scope. | Owner, Dev 1 | `[TRANSCRIPT: 14:00, p. 14]` |
| **D-03** | **Customer Portal / Logins** | **REJECTED.** No web accounts or credentials for clients. Direct WhatsApp and QR receipt links only. | Owner, Dev 1, Dev 2 | `[TRANSCRIPT: 58:00, p. 58]` |
| **D-04** | **WhatsApp Integration** | **CLICK-TO-CHAT PROTOCOL.** Official paid Cloud API rejected; replaced by zero-cost `wa.me` URL links. | Owner, Dev 1 | `[TRANSCRIPT: 60:00, p. 60; 61:00, p. 61]` |
| **D-05** | **Customer Identifier** | **MOBILE PHONE NUMBER.** National ID rejected due to customer pushback. Phone is primary key. | Owner, Dev 1, Dev 2 | `[TRANSCRIPT: 29:00, p. 29]` |
| **D-06** | **Pre-Press Gatekeeper** | **MANDATORY HEAD DESIGNER APPROVAL.** No file enters production without Head Designer sign-off. | Owner, Dev 1, Dev 2 | `[TRANSCRIPT: 34:00, p. 34; 38:00, p. 38]` |
| **D-07** | **Accounting Pricing Role** | **ACCOUNTING DOES NOT SET PRICES.** Pricing is automated via matrix or set by Management. Accounting does data entry. | Owner, Dev 1, Dev 2 | `[TRANSCRIPT: 41:00, p. 41; 68:00, p. 68]` |
| **D-08** | **Designer File Management** | **HYBRID NETWORK STORAGE.** System auto-creates server folders; ERP stores network paths and <1MB JPG previews. | Dev 1, Dev 2 | `[TRANSCRIPT: 54:00, p. 54; ADDITIONAL CONTEXT]` |
| **D-09** | **Fast-Track Queue Bypasses** | **FOUR-TRACK ROUTING.** System supports Standard Queue, Express Bypass, Reprint Bypass, and Custom Quote pipelines. | Dev 1, Dev 2 | `[ADDITIONAL CONTEXT]` |

---

## 15. Requirements That Changed

### 1. Warehouse Raw Material Inventory Tracking
* **Earlier in Meeting `[TRANSCRIPT: 22:00, p. 22; 23:00, p. 23]`:** Developers discussed tracking paper reams, ink milliliters, and lamination rolls in the ERP.
* **Later Discussion `[TRANSCRIPT: 23:00, p. 23; 72:00, p. 72]`:** Owner realized exact daily inventory counts would impose impossible data-entry friction: *"الدقة عمرها ما هتيجي... المخزن ده خلينا نمسكه نبعده عن السيستم خالص، نخلي أمين مخزن والداتا تتمسك بشيت لوحدها"*.
* **Final Requirement:** Raw inventory tracking is completely stripped from Phase 1 scope.

### 2. WhatsApp Notification Mechanism
* **Earlier in Meeting `[TRANSCRIPT: 14:00, p. 14; 58:00, p. 58]`:** Discussion centered around integrating the official Meta WhatsApp Business API.
* **Later Discussion `[TRANSCRIPT: 59:00, p. 59; 60:00, p. 60]`:** Owner objected to recurring API conversation costs, 24-hour window timeouts, and meta-block risks.
* **Final Requirement:** Replaced with zero-cost pre-filled WhatsApp Web/Desktop URL scheme (`wa.me`) triggered by staff buttons `[TRANSCRIPT: 61:00, p. 61; 64:00, p. 64]`.

### 3. End-User Customer Web Portal
* **Earlier in Meeting `[TRANSCRIPT: 58:00, p. 58]`:** Dev 2 suggested creating a customer dashboard with email and password logins.
* **Later Discussion `[TRANSCRIPT: 58:00, p. 58; 59:00, p. 59]`:** Dev 1 and Owner rejected this, noting that in Basyoun, clients have straightforward technical literacy and will be confused by credentials: *"كتير على العملاء هنا هيتلخبطوا... هتمشي العميل بإيميل وباسورد هيقول لك اعمل بيهم إيه؟"*.
* **Final Requirement:** Zero client accounts. Tracking is communicated via direct WhatsApp messages or a simple open tracking link.

---

## 16. Contradictions & Resolved Ambiguities

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ CONFLICT 1: Physical Delivery Location (Reception vs Downstairs Delivery Desk)         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Transcript: Print shop delivers to a downstairs delivery warehouse staffed by 12     │
│   workers who sort multi-item jobs and handle customer handovers [17:00, 18:00, 50:00].│
│ • Additional Notes: Stated that the print shop delivers to Reception.                 │
│                                                                                        │
│ RECONCILIATION:                                                                        │
│ Physical delivery and goods collation occur at the Downstairs Warehouse Desk (where    │
│ physical space permits sorting). Front-desk Reception handles the digital              │
│ notification (WhatsApp trigger) and upfront order intake.                              │
│ STATUS: Resolved by reconciliation [TRANSCRIPT + ADDITIONAL CONTEXT].                  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ CONFLICT 2: Role of Accounting in Pricing                                              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Transcript: Owner explicitly stated accountants DO NOT set prices; standard items    │
│   use fixed price lists, while bespoke jobs are priced by Management [41:00, 68:00].   │
│ • Additional Notes: Stated that data is handed to accounting to verify pricing.       │
│                                                                                        │
│ RECONCILIATION:                                                                        │
│ Accounting verifies that completed tickets adhere to established price books and       │
│ checks the mathematical accuracy of entries, but has NO authority to set or negotiate │
│ manufacturing prices. Management retains exclusive pricing authority.                  │
│ STATUS: Resolved by clarification [TRANSCRIPT + ADDITIONAL CONTEXT].                   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ CONFLICT 3: "Cash Client" Aggregation vs Debt Tracking                                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Transcript: Owner requested a single pooled "Cash Client" (عميل نقدي) account [28:00]│
│   while simultaneously demanding debt tracking across unique phone numbers [29:00].    │
│                                                                                        │
│ RECONCILIATION:                                                                        │
│ The system supports a generic "Cash Account" in the financial ledger, but REQUIRES     │
│ capturing a mobile phone number on every ticket. If a repeat phone number is entered,  │
│ the system surfaces past history, ensuring repeat walk-ins do not bypass debt audits. │
│ STATUS: Resolved by architectural design [TRANSCRIPT + ADDITIONAL CONTEXT].            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 17. Open Questions

### Critical Priority (Blocks Database & Architecture Design)
1. **Server Operating System & Hardware Specs:**
   * *Question:* What are the exact OS (Windows Server vs Ubuntu) and hardware specs (RAM, CPU, storage array) of the existing local shop server?
   * *Why it matters:* Dictates whether the backend runs in a native Docker environment, Windows Service, or Node/PostgreSQL stack `[TRANSCRIPT: 31:00, p. 31]`.
2. **Local Network Shared Storage Protocol:**
   * *Question:* Is the shared artwork storage accessible via standard Windows Network Share (SMB) across all designer and printer workstations with uniform drive mappings (e.g. `Z:\PrintJobs`)?
   * *Why it matters:* Required to configure the system service that auto-generates job folders upon order intake `[ADDITIONAL CONTEXT]`.
3. **Hard Delivery Block on Unpriced Jobs:**
   * *Question:* If a bespoke job is flagged for Management Quotation, should the system physically block the delivery desk from marking it "Delivered" until the Owner inputs the price?
   * *Why it matters:* In the meeting, the Owner noted that jobs often leave unpriced under pressure `[TRANSCRIPT: 09:00, p. 9]`. A hard system block will prevent unbilled revenue leakage but may introduce operational friction if the Owner is unreachable.

### Important Priority (Blocks Business Logic Implementation)
4. **Deficit / Shortage Default Billing Policy:**
   * *Question:* When a delivery shortage occurs (e.g., 98 delivered vs 100 ordered), should the system default to automatically discounting the current invoice, or default to crediting the customer's profile for the next order? `[TRANSCRIPT: 50:00, p. 50]`.
   * *Why it matters:* Dictates the automated accounting adjustment routine.
5. **Existing Excel Price Book Ingestion:**
   * *Question:* When will the current Excel price matrix (standard cards, booklets, vinyl, banner) be supplied to the dev team to populate master tables? `[TRANSCRIPT: 20:00, p. 20]`.
   * *Why it matters:* Required to seed the database for the Imposition Calculator and order intake form.

### Minor Priority (Can be finalized during UI prototyping)
6. **Physical Receipt Printing Standard:**
   * *Question:* Will the front desk print 80mm thermal receipts or A5 paper job orders with QR codes for walk-in clients? `[TRANSCRIPT: 58:00, p. 58]`.
   * *Why it matters:* Governs print styling and driver integration.

---

## 18. Future / Optional Features (Explicitly Postponed)

1. **Multi-Branch Data & Account Isolation (فرع تاني):**
   * Isolating customers and financial ledgers for a secondary Printex branch `[TRANSCRIPT: 57:00, p. 57]`.
2. **Automated Inventory & Material Consumption Tracking:**
   * Auto-deducting square meters of vinyl, paper sheets, and ink milliliters from warehouse stock `[TRANSCRIPT: 23:00, p. 23]`.
3. **AI-Assisted Dynamic Quoting & Graphic Processing:**
   * Integrating LLMs for automated estimation or artwork generation `[TRANSCRIPT: 21:00, p. 21; 25:00, p. 25]`.
4. **Staff Attendance & Payroll Integration (المرتبات والأجور):**
   * Biometric or software timecards calculating monthly employee salaries and commissions `[TRANSCRIPT: 13:00, p. 13; 14:00, p. 14]`.
5. **Supplier Accounts & Vendor Debt Ledgers (حسابات الموردين):**
   * Managing credit lines and raw material purchases from paper mills and ink distributors `[TRANSCRIPT: 71:00, p. 71; 72:00, p. 72]`.

---

## 19. Client Priorities

1. **Anti-Bureaucratic Speed ("مش عايز أبقى حكومة") `[TRANSCRIPT: 05:00, p. 5]`:**
   The Owner's overriding mandate. Creating an order, performing an imposition calculation, and taking a deposit must take seconds. Staff must never be slowed down by complex multi-tab interfaces.
2. **Total Prevention of Order Leakage `[TRANSCRIPT: 57:00, p. 57]`:**
   Eliminating the scenario where an order enters the shop, gets printed, and leaves the door without a digital record, invoice, or payment.
3. **Zero Recurring Third-Party Subscriptions `[TRANSCRIPT: 25:00, p. 25; 60:00, p. 60]`:**
   Strict refusal of recurring software fees. The system must operate independently on local hardware with zero external API expenses.
4. **Auditable Financial Integrity `[TRANSCRIPT: 49:00, p. 49; 52:00, p. 52]`:**
   Eliminating `Shift+Delete` folder loss, unmonitored cash drawer discrepancies, and unauthorized order alterations.

---

## 20. Things the Client Explicitly Does NOT Want

* **NO Customer Accounts or Portal Logins:** No emails, passwords, or login portals for end customers `[TRANSCRIPT: 58:00, p. 58]`.
* **NO Paid Meta WhatsApp Business Cloud API:** No recurring API fees, template approvals, or 24-hour conversation cutoffs `[TRANSCRIPT: 60:00, p. 60]`.
* **NO Mandatory National ID Field:** Do not demand national identity card numbers from customers `[TRANSCRIPT: 29:00, p. 29]`.
* **NO Cloud Database Dependence:** The shop must never halt production if the external internet connection drops `[TRANSCRIPT: 27:00, p. 27; 31:00, p. 31]`.
* **NO Direct Printing Without Head Designer Approval:** Ordinary graphic designers are strictly barred from releasing jobs directly to print machines `[TRANSCRIPT: 34:00, p. 34]`.
* **NO Raw Heavy File Uploads into the Database:** No multi-hundred-megabyte Adobe files stored inside database BLOB fields `[TRANSCRIPT: 54:00, p. 54; ADDITIONAL CONTEXT]`.
* **NO Accountant-Driven Production Pricing:** Accounting staff must never calculate or negotiate manufacturing prices `[TRANSCRIPT: 41:00, p. 41; 68:00, p. 68]`.
* **NO Phase 1 Warehouse Inventory Tracking:** No complex tracking of ink milliliters, lamination rolls, or vehicle spare parts `[TRANSCRIPT: 23:00, p. 23]`.
* **NO Hard Deletion of Work Orders:** Direct deletion of order records is permanently blocked `[TRANSCRIPT: 52:00, p. 52]`.

---

## 21. Complete Requirements Checklist

### System Infrastructure & Network
- [ ] System deployed on Printex Local Area Network (LAN) on-premises server `[TRANSCRIPT: 31:00, p. 31]`.
- [ ] 100% operational offline capability across all shop floor kiosks and workstations `[TRANSCRIPT: 27:00, p. 27]`.
- [ ] Native Arabic Right-to-Left (RTL) interface across all sub-systems `[TRANSCRIPT: 53:00, p. 53]`.
- [ ] Background service auto-provisions shared network folders (`\\PRINTEX-SERVER\PrintJobs\[ID]`) `[ADDITIONAL CONTEXT]`.
- [ ] Secure remote access capability (tunnel / AnyDesk) for Owner and Developers `[TRANSCRIPT: 55:00, p. 55]`.
- [ ] Automated scheduled database backup routine to secondary detached drive `[TRANSCRIPT: 32:00, p. 32]`.

### Customer CRM & Debt Tracking
- [ ] Client search and account creation anchored strictly on Mobile Phone Number `[TRANSCRIPT: 29:00, p. 29]`.
- [ ] Prominent red-flag display of outstanding customer debt upon phone lookup `[TRANSCRIPT: 26:00, p. 26]`.
- [ ] Support for an aggregated generic "Cash Client" (عميل نقدي) account for walk-ins `[TRANSCRIPT: 28:00, p. 28]`.
- [ ] Client profile stores custom negotiated pricing tiers (e.g., 90 EGP banner rate) `[TRANSCRIPT: 12:00, p. 12]`.
- [ ] One-click export of Customer Account Statements (كشف حساب) to Microsoft Excel `[TRANSCRIPT: 71:00, p. 71]`.

### Order Intake & Imposition Calculation
- [ ] Rapid Work Order creation modal with auto-sequenced Ticket ID `[TRANSCRIPT: 05:00, p. 5; 21:00, p. 21]`.
- [ ] Integrated Montage / Imposition Calculator for digital sheet-fed jobs `[TRANSCRIPT: 73:00, p. 73–75]`.
- [ ] Calculator computes items per sheet, total sheets required, and setup spoilage buffer `[TRANSCRIPT: 74:00, p. 74; 75:00, p. 75]`.
- [ ] Unified ticket supports multi-category child tasks (Digital, Outdoor, Laser, Screen) `[TRANSCRIPT: 16:00, p. 16]`.
- [ ] Checkbox toggle for "Client-Supplied Paper / Material" (`عهدة عميل`) waiving substrate costs `[TRANSCRIPT: 22:00, p. 22; 75:00, p. 75]`.
- [ ] "Requires Management Quotation" flag for custom manufacturing jobs `[TRANSCRIPT: 08:00, p. 8; 09:00, p. 9]`.

### Queue Routing & Pre-Press Quality Gate
- [ ] Visual designer workload tracker displaying active task counts per designer `[TRANSCRIPT: 14:00, p. 14]`.
- [ ] **Four-Track Order Routing:**
  - [ ] Standard Workload Queue assignment `[TRANSCRIPT: 14:00, p. 14]`.
  - [ ] Express / Fast-Track Queue Bypass `[ADDITIONAL CONTEXT]`.
  - [ ] Exact Reprint Bypass (skips design stage completely) `[ADDITIONAL CONTEXT]`.
  - [ ] Management Quotation Pipeline `[TRANSCRIPT: 09:00, p. 9]`.
- [ ] Designer pre-press timer tracking active artwork preparation time `[TRANSCRIPT: 15:00, p. 15]`.
- [ ] Designer ticket field to link shared network path and upload compressed preview (<1MB) `[ADDITIONAL CONTEXT]`.
- [ ] **Mandatory Head Designer Approval Gate:** Blocks file release to machines until Head Designer signs off `[TRANSCRIPT: 34:00, p. 34; 38:00, p. 38]`.

### Production Floor Kiosks
- [ ] Machine floor screens filtered strictly by production category:
  - [ ] Digital Press Terminal `[TRANSCRIPT: 45:00, p. 45]`.
  - [ ] Outdoor Banner / Large Format Terminal `[TRANSCRIPT: 45:00, p. 45]`.
  - [ ] Laser Cutting Terminal `[TRANSCRIPT: 22:00, p. 22]`.
  - [ ] Screen Printing Terminal `[TRANSCRIPT: 22:00, p. 22]`.
  - [ ] Post-Press / Finishing Terminal `[TRANSCRIPT: 77:00, p. 77]`.
- [ ] Machine operators can mark runs as "Started" and "Completed" `[TRANSCRIPT: 15:00, p. 15; 42:00, p. 42]`.
- [ ] Strict hiding of accounting data and client prices from production operators `[TRANSCRIPT: 18:00, p. 18]`.

### Warehouse Collation & Delivery Handover
- [ ] Downstairs Warehouse Delivery screen for the 12 customer-facing delivery workers `[TRANSCRIPT: 17:00, p. 17; 18:00, p. 18]`.
- [ ] Multi-item assembly interface grouping child tasks under Master Customer Ticket `[TRANSCRIPT: 16:00, p. 16; 17:00, p. 17]`.
- [ ] Delivery count verification with logging for defect/shortage counts `[TRANSCRIPT: 49:00, p. 49; 50:00, p. 50]`.
- [ ] Shortage reconciliation choice: Markdown current bill vs Log future customer credit `[TRANSCRIPT: 50:00, p. 50]`.
- [ ] Mark order as "Delivered / Handed Over" to finalize production lifecycle `[TRANSCRIPT: 50:00, p. 50]`.

### WhatsApp Notifications & Communications
- [ ] One-click WhatsApp readiness button on Reception and Warehouse screens `[TRANSCRIPT: 61:00, p. 61; 64:00, p. 64]`.
- [ ] Button generates dynamic `wa.me` URL with pre-filled Order ID, Name, and Status `[TRANSCRIPT: 64:00, p. 64]`.
- [ ] Launches directly into WhatsApp Web/Desktop with zero API fees `[TRANSCRIPT: 60:00, p. 60; 64:00, p. 64]`.
- [ ] System logs user ID and timestamp whenever a WhatsApp notification is triggered `[TRANSCRIPT: 65:00, p. 65]`.
- [ ] Optional QR code on printed paper receipt linking to public status page `[TRANSCRIPT: 58:00, p. 58]`.

### Cash Drawer, Accounting & Financial Control
- [ ] Reception cash drawer deposit logging for every new work order `[TRANSCRIPT: 51:00, p. 51]`.
- [ ] Daily Treasury Closeout Report (تقرير حركة الخزنة والدرج) for Accounting `[TRANSCRIPT: 72:00, p. 72]`.
- [ ] Daily petty cash and operational expense logging (rent, fuel, spare parts) `[TRANSCRIPT: 72:00, p. 72]`.
- [ ] Outstanding Debt Aging Report (قائمة المديونيات) with one-click Excel export `[TRANSCRIPT: 71:00, p. 71]`.
- [ ] Git-style immutable audit trail logging user, timestamp, and reasons for all edits `[TRANSCRIPT: 52:00, p. 52]`.
- [ ] Permanent database-level block on hard deletion of work orders `[TRANSCRIPT: 52:00, p. 52]`.