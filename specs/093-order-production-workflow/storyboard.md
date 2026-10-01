# Storyboard: How a Job Moves Through Printex (Plain Language)

For shop staff and stakeholders. No technical terms.

## The four stages

```
CUSTOMER  →  RECEPTION  →  DESIGNER  →  ACCOUNTANT  →  PRINTER
```

There are only these four stages. An order moves forward one stage at a time. **Nobody can skip ahead** — not reception, not the designer, not the accountant, not anyone else. The system refuses it, not just the screen.

---

## Stage 1 — Reception

The receptionist takes the customer's request and writes it into the system:

- What the customer asked for (**requested width**, e.g. 145 cm)
- The **height** (up to 50 metres)
- The **price per square metre** the customer agreed to (80 to 120 EGP)
- Any **extra services**, for example **Sulfan (سلوفان) at 90 EGP per m²**

Then the system does the maths by itself:

| Requested width | Production width the shop actually uses |
|---|---|
| 75 cm | 80 cm |
| 80 cm | 80 cm |
| 81 cm | 110 cm |
| 145 cm | 150 cm |
| 150 cm | 150 cm |
| 151 cm | 210 cm |
| 250 cm | 260 cm |
| 265 cm | 270 cm |
| 271 cm | 320 cm |
| 320 cm | 320 cm |

We only print on these fixed widths: **80, 110, 150, 210, 260, 270, 320 cm**. The system always rounds **up**, never down, so the printed banner is never smaller than the customer asked for.

**Both numbers are saved separately.** The customer's 145 cm is never overwritten by the 150 cm we print on. We keep the real request and our production choice side by side.

**Worked example** — customer wants 145 cm wide × 2 m tall:

- Production width: 150 cm = 1.5 m
- Area: 1.5 m × 2 m = **3 m²**
- Printing: 3 m² × 100 EGP = **300 EGP**
- Sulfan: 3 m² × 90 EGP = **270 EGP**
- **Total: 570 EGP**

The receptionist never types the total. The system calculates it.

**Two things reception cannot do:**
1. Ask for a width bigger than 320 cm — the system stops it and sends a request to a manager. It never silently gives 320 cm.
2. Send the job onward **without assigning a designer.** No designer, no move. Reception must name the designer first.

---

## Stage 2 — Designer

The assigned designer sees the job in their own list. Nobody else's jobs appear there.

They do the design, then **upload the finished file**.

**The designer cannot move the job forward by pressing "Next" or "Done" alone.** The job only leaves the designer when a real file has been successfully uploaded. No file, no progress — the system refuses it. That single rule is what stops the shop from printing something that was never designed.

---

## Stage 3 — Accountant

The accountant sees the job with everything needed to check the money:

- Customer details
- What the customer requested vs. what we will print
- The area
- The price per m² that was agreed
- Extra services like Sulfan
- The total
- The designer's file

If anything is missing — a dimension, a price, the file — the accountant **cannot** approve. The system names exactly what is missing.

**When the accountant approves, the job goes straight to the printer.** There is no extra review or branding step for this type of work.

---

## Stage 4 — Printer

The printer sees only jobs the accountant approved, and only jobs for their own department. Each job shows:

- Production width and height
- Area
- Extra services (e.g. Sulfan)
- The design file to print from

Jobs still sitting in reception, design, or with the accountant are **not visible** to the printer and cannot be opened by asking directly.

---

## What can never happen

| Attempted shortcut | Result |
|---|---|
| Send a job forward with no designer assigned | Blocked |
| Designer finishes with no file uploaded | Blocked |
| Designer sends a job straight to the printer | Blocked |
| Job jumps from design to printer with no accountant approval | Blocked |
| Anyone other than the accountant approves the job | Blocked |
| Reception or designer creates a job directly inside a later queue | Blocked |
| System picks 320 cm for a 330 cm request without asking | Never happens |

These rules live in the system itself, not in the screens. Even a direct technical attempt cannot get around them.

---

## If something is wrong

Nobody quietly drags a job backwards. Wrong design, wrong price, wrong details? The staff member **sends it back with a written reason**, and:

- the reason and who sent it are recorded permanently,
- the responsible person is notified,
- the job re-enters the correct stage properly.

After the accountant approves, changing the order needs an approved change request, and the price is recalculated — old prices are never silently rewritten.

---

## What we keep as a permanent record

Every order keeps its own history: who created it, who was assigned, which file was uploaded and which version, who approved what and when, every price and rate used, every send-back, and every cancellation. Prices are frozen onto the job when it is created, so a price list change tomorrow never alters what a customer was charged yesterday.