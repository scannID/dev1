# Property Management — How It Works (Plain English)

This doc explains the full life of a property in the system, from first setup all the way through to a tenant paying their rent. Written for landlords, property managers, and tenants — no technical background needed.

---

## Before You Begin — What You'll Need

Before setting up your first property, have these ready:

**For the property:**
- Property name and address
- Owner's full name
- Owner's MoMo phone number (this is the number that receives all rent payments)
- The currency you collect in (defaults to UGX)
- Your late fee setting (optional — see Late Fees section)

**For each unit:**
- A label or number for each unit (e.g. "A3", "Flat 5", "Shop 2")
- The floor or location if relevant
- The monthly rent amount for each unit
- The deposit amount (optional)
- Which day of the month rent is due (e.g. the 5th)
- How many grace days after the due date before a charge becomes overdue (can be 0)

**For each tenant:**
- Full name
- Phone number
- Email (optional)
- Move-in / lease start date
- Lease term in months (default is 12)

**To register:** Sign up directly on the platform — no invitation needed. You create your own account, log in, and start adding properties right away. [PROPOSED DEFAULT — confirm or change]

---

## The Big Picture

Think of the system as having two sides:

- **The landlord/manager side** — a dashboard where you set up properties, add units, add tenants, track who's paid, and download QR codes.
- **The tenant side** — a simple payment page (reached by scanning a QR code) where tenants see their balance and pay rent via mobile money (MoMo).

---

## Step 1 — Manager Registers

A property manager signs up directly on the platform — no invitation or approval needed. The system creates their account and gives them a login. After signing in, they land on their personal dashboard showing all the properties they manage.

---

## Step 2 — Create a Property

The manager creates a **Property** — this is the top-level container (e.g. "Sunset Apartments", "Kampala Plaza Block B").

When a property is created, the system automatically:
- Assigns it a unique ID
- Generates a **building-entrance QR code** — a scannable code that can be printed and stuck at the entrance. When anyone scans it, they see a list of all units and can pick theirs to pay rent.

Each property has settings like:
- Owner's name and MoMo number (the phone number that receives all rent payments)
- Currency (defaults to UGX)
- Whether tenants are allowed to pay a partial amount (and what the minimum is)
- Late fee configuration (see Late Fees section)
- Timezone (defaults to Africa/Kampala)

---

## Step 3 — Add Units

Under each property, the manager adds **Units** — individual rooms, flats, offices, or stalls.

Each unit has:
- A number/label (e.g. "A3", "Flat 5", "Ground Floor Office")
- A floor/location description
- A **monthly rent amount** (set at the unit level — each unit can differ)
- A **deposit amount** (optional — stored for your records, see Deposits section below)
- A **due day** — which day of the month rent is due (e.g. the 5th)
- A **grace period** — how many days after the due date before the charge becomes "Overdue"

Each unit also gets its own **door-sticker QR code** — when scanned, it skips the unit-selection step and takes the tenant straight to their payment form.

---

## Step 4 — Add a Tenant

When a tenant moves in, the manager adds them to a specific unit. This does several things at once:

1. **Creates the Tenant record** — name, phone, email, move-in date, and a unique **personal pay link** (a token that can be shared as a QR code or URL directly with that tenant).

2. **Creates a Lease** — the authoritative agreement:
   - **Activation date** — when rent cycles begin (defaults to today if not set)
   - **Term** — how many months the lease runs (default 12)
   - **Lease end date** — automatically calculated as activation + term months
   - **Monthly amount snapshot** — the rent amount is frozen at the time of activation. If the manager later changes the unit price, it doesn't affect the active lease.

3. **Generates the first rent charges** — the system immediately works out all rent cycles from the activation date up to today and creates charge records for each of them. If the activation date is in the future, the lease is set to "Pending" and the charges are created on the activation day by an automated daily job.

> If a unit already has an active tenant when you add a new one, the old tenant is automatically deactivated.

---

## Step 5 — Charges Are Created Automatically

A **Charge** is a bill for one month's rent. Each charge has:
- Which tenant and unit it's for
- The period it covers (e.g. "2026-11" = November 2026)
- The amount owed
- A due date
- A status: `UNPAID → PARTIAL → PAID` (or `OVERDUE` or `WAIVED`)

Charges are created in two ways:

**Automatically by the system:**
- Every day at 6:30am, the system checks all active leases and generates charges for any new cycles that have started.
- On the 1st of every month at 6:00am, there's a backstop check — any tenant without a charge for the current month gets one created.

**Manually by the manager:**
- Managers can also manually generate a charge for any period at any time from the dashboard.

The system prevents duplicate charges — it will never create two charges for the same tenant and same period.

**Does the tenant get a notification when a new charge is created?**
Not yet. The reminder system only notifies tenants when a charge is coming up soon (3 days before) or already overdue — not at the moment of creation. [NOT BUILT YET: a "new charge created" notification to the tenant when a monthly charge is generated]

---

## Step 6 — Tenant Scans QR and Pays

There are three QR code / link types:

| QR Type | What happens when scanned |
|---|---|
| **Property (building entrance) QR** | Shows a list of all units, tenant picks theirs |
| **Unit QR (door sticker)** | Goes straight to the payment form for that unit |
| **Tenant personal link** | Everything pre-filled — name, balance, history |

When the tenant opens their pay page, the system looks up:
- Their current balance (how much is owed this month)
- Whether they've already paid partially
- Their lease start date and end date
- How many days until/since the due date
- The platform fee that will be added to their payment

The tenant enters their MoMo phone number, optionally adjusts the amount (if partial payments are allowed), and taps Pay.

---

## Step 7 — How Payment Works

When the tenant submits a payment, this is what happens:

1. The system checks all the rules server-side: is the amount valid? Is it within the outstanding balance? Does it meet the minimum if one is set? Is partial payment allowed?

2. A platform fee (set in the admin console) is added on top of the rent amount. The tenant pays rent + fee; the owner receives the full rent amount. [NOT BUILT YET: fee deduction from tenant is designed but the admin fee configuration and the deduction logic in the rent payment flow are not yet wired up]

3. A **Pending payment record** is created.

4. The system sends a MoMo push request to the tenant's phone — a prompt pops up on their phone asking them to approve the payment.

5. The tenant's app polls the system every 5 seconds to see if the payment went through.

6. When the MoMo network confirms the payment:
   - The payment is marked **Completed**
   - The charge status is updated (PAID if fully covered, PARTIAL if not)
   - A **WhatsApp receipt** is sent to the tenant
   - A **collection alert** is sent to the property owner

If the payment fails, it's marked Failed and the tenant is shown an error.

---

## Alternative: Manager Records a Payment Manually

If a tenant pays by cash, bank deposit, or MoMo transfer outside the app, the manager can record it manually from the dashboard. They pick the charge, enter the amount and payment method, and the system:
- Records the payment as Completed immediately
- Updates the charge status
- Logs who recorded it (for audit trail)

Managers can also override a charge status directly — for example, marking a charge as **Waived** (with a required note explaining why).

**Do manually recorded payments generate a receipt?**
No. The WhatsApp receipt is only sent automatically for tenant-initiated MoMo payments through the pay page. When a manager records a cash or bank payment manually, no receipt is sent — the manager must inform the tenant separately. [NOT BUILT YET: WhatsApp/SMS receipt to tenant when a manager records a manual payment]

---

## Step 8 — Overdue Tracking

Every day at 8:00am, the system scans all unpaid and partially-paid charges. If today's date has passed the due date plus the grace period, the charge is automatically flipped to **Overdue**.

If the property has a **late fee** configured, the late fee amount is added to the outstanding balance at this point (see Late Fees section below).

The system also generates reminder notifications:
- **3 days before** the due date → "upcoming rent" reminder
- **1, 3, and 7 days after** the due date → overdue chasers

> **Important:** These reminders are logged inside the system today but are not yet actually delivered to tenants' phones. Message delivery (WhatsApp or SMS) is being built separately. [NOT BUILT YET: actual delivery of reminder and overdue chaser messages to tenants]

---

## Step 9 — Lease Lifecycle

A lease moves through these states:

```
PENDING → ACTIVE → EXPIRED
```

- **Pending**: activation date is in the future
- **Active**: currently running (today is between activation date and lease end)
- **Expired**: the lease end date has passed

Every day at 6:30am, the system:
- Activates any Pending leases whose start date has arrived
- Expires any Active leases whose end date has passed

At most one Active lease can exist per unit at a time — the system enforces this.

---

## Money and Fees

### Platform Fee (MoMo Transaction Charge)

When a tenant pays through the app, a small platform fee is added on top of their rent amount. The tenant pays **rent + fee**. The owner receives the full rent amount — the fee is not deducted from what the owner gets.

**Example:**
> Rent is UGX 500,000. The platform fee is UGX 2,000 (rate set in admin console). The tenant is charged UGX 502,000 total. The owner's MoMo wallet receives UGX 500,000.

The exact fee rate is configured by the platform admin in the admin console under the Properties settings tab. Property managers can see the current rate on their dashboard but cannot change it.

[NOT BUILT YET: the fee deduction from the tenant's payment and the admin console fee configuration for rent are not yet wired up. The admin console Properties tab is being built to include this.]

### How Fast Money Reaches the Owner

Rent payments go directly to the **owner's MoMo number** that was set on the property. The system does not hold money — it triggers a push payment from the tenant to the owner's number. Once MoMo confirms the payment, the money is in the owner's MoMo wallet. Typical settlement on MTN and Airtel is instant to near-instant once confirmed.

If the payment is confirmed by MoMo but the money seems delayed, the tenant and manager should both contact MoMo customer support with the **transaction reference number** (shown on the payment receipt and visible in the dashboard). The system's record will already show "Completed" — the dispute is handled with the MoMo network directly.

### Late Fees

Property owners can configure a late fee on each property. When a charge becomes Overdue (past due date + grace period), the late fee is automatically added to the outstanding balance.

**How late fees work:**
- The property owner sets the late fee when creating or editing a property
- It can be a **flat amount** (e.g. UGX 10,000 per overdue period) or a **percentage** of the rent (e.g. 5%)
- The fee is applied once when the charge flips to Overdue — it is not a recurring daily charge
- The tenant sees the updated total on their pay page

**Example:**
> Rent is UGX 500,000, due on the 5th, grace period 3 days. The tenant does not pay by the 8th. On the morning of the 9th, the charge becomes Overdue and a UGX 25,000 late fee (5%) is added. The tenant's balance is now UGX 525,000.

[NOT BUILT YET: the late fee field on the property and the automatic fee addition when a charge becomes overdue are not yet built. This is confirmed as a planned feature.]

### Supported Payment Networks

The system supports both **MTN MoMo** and **Airtel Money**. Tenants can pay from either network — they simply enter their phone number and the system routes to the right network.

[NOT BUILT YET: the live MTN MoMo and Airtel Money API integrations are not yet plugged in. Payments currently run in test/stub mode. The connections need to be activated with real API credentials before going live.]

---

## Deposits

### How a Deposit Is Set

When the manager adds a unit, they can enter a deposit amount. This number is stored on the unit record and is visible on the manager's dashboard — e.g. UGX 1,000,000 deposit for a unit charging UGX 500,000/month.

### How a Deposit Is Paid

Deposits are not collected through the system's payment flow today. Deposit collection happens outside the platform (cash, bank transfer, etc.). The deposit amount on the unit is a reference figure for the manager's records.

[NOT BUILT YET: a dedicated deposit charge/payment flow so tenants can pay their deposit through the app.]

### Tracking and Returning a Deposit

Because deposit payments are not recorded in the system, there is no deposit balance or refund record in the platform today. The manager tracks and handles deposit deductions outside the system.

**Proposed approach until this is built:** The manager records the deposit receipt as a note in the tenant record, handles any deductions at move-out outside the system, and manually records a final "deposit return" payment if they want it tracked. [PROPOSED DEFAULT — confirm or change]

---

## Advance Payments

Tenants can pay ahead for the **next period** before the current one starts. On the pay page, there is a "pay ahead" option. When used, the system finds or creates a charge for the next period and processes payment against that.

**How far ahead can a tenant pay?**
Up to **3 months in advance** — one month at a time. A tenant can pay January, then immediately pay February ahead, then March ahead, but each payment is a separate transaction. [PROPOSED DEFAULT — confirm or change]

Paying more than the outstanding balance for a single charge is not allowed.

---

## Tenant Life Cycle

### Moving Out

When a tenant leaves, the manager does the following from the dashboard:

1. **Deactivate the tenant** — click Deactivate on the tenant record. This immediately flags the tenant as inactive.
2. The tenant's personal pay link stops working the moment they are deactivated.
3. The unit shows as **Vacant** in the dashboard.
4. Any unpaid charges remain on the record. They do not disappear automatically.

**Settling up before deactivating:**
Before deactivating a tenant, the manager should:
- Record any final cash payments against outstanding charges
- Mark any forgiven balances as Waived (with a note)
- Handle deposit deduction or return outside the system (see Deposits section)

**Early termination (leaving before the lease end):**
Deactivating the tenant stops the pay link and prevents new charges from being generated. There is no automatic early termination fee — the manager handles any penalty agreement outside the system for now. [PROPOSED DEFAULT — confirm or change]

### Lease Renewal

When a lease expires, the system sets its status to **Expired**. The tenant stays active — they can still scan their QR — but the system stops generating new monthly charges because it only creates charges within the lease term.

To renew the lease, the manager currently needs to **deactivate the old tenant and add them again** as a new tenant with a new start date and term. This creates a fresh lease snapshotting the current unit rent amount (so any rent increase takes effect here).

[NOT BUILT YET: a "renew lease" button that extends the existing lease without creating a new tenant record.]

**Will the manager be reminded?**
The days remaining on each lease are visible on the property dashboard. There is no automated alert yet. [NOT BUILT YET: a notification to the manager when a lease is within 30 days of expiring]

### Rent Increases

The rent amount on a lease is frozen for its full term. To apply an increase:
1. Update the unit's monthly amount in the dashboard.
2. When the current lease expires, re-add the tenant. The new lease snapshots the updated price.

A rent increase always takes effect at the start of the new lease term, never mid-lease.

### Shared Units — Couples, Roommates, or Business Partners

The system allows **one active tenant per unit** at a time. For shared situations, register one person as the primary tenant (the main account holder). Other occupants can pay using that tenant's personal pay link — the MoMo number entered at payment time can be any phone number, so anyone in the household can initiate the payment. The receipt will show the primary tenant's name. [PROPOSED DEFAULT — confirm or change]

---

## When Things Go Wrong

### Failed or Stuck Payments

If a tenant's MoMo money was deducted but the system shows "Failed" or "Pending" after a few minutes:

1. **Do not pay again immediately** — a double payment could create a second charge against the same period.
2. Note the **transaction reference** shown on the pay page after submitting.
3. Contact the manager with the reference number.
4. The manager checks the charge on the dashboard. If MoMo confirms the money moved, the manager records the payment manually using the transaction reference as a note.
5. If the money was deducted but never confirmed, contact **MoMo customer support** (MTN or Airtel) directly with the reference number.

The system cannot force a payment to complete — that authority rests with the network.

### Correcting a Manager Mistake

**Wrong amount recorded:** There is no edit or delete on a recorded payment. Corrections:
- Record an additional payment for any shortfall
- Mark the charge as Waived (with a note) if the amount needs to be written off

Money that has already moved via MoMo cannot be reversed from within the platform — a reversal is handled with MoMo directly.

[NOT BUILT YET: ability to void or reverse a payment record. Today, corrections use charge status overrides.]

### Wrong Unit — Tenant Paid the Right Property but Wrong Unit

If a tenant scanned the building entrance QR and selected the wrong unit:
- The payment lands on the wrong unit's charge.
- The correct unit's charge stays unpaid.
- The manager marks the wrong unit's charge as Waived (with a note) and records a correcting payment on the right unit.

**Prevention:** Use unit-level QR codes (door stickers) so tenants land directly on their own unit without a selection step.

### Lost Phone or Changed MoMo Number

The MoMo number is entered fresh each time on the pay page — it is not stored on the tenant profile. A new number just means entering it next time. Nothing needs to change in the system.

If the tenant lost their personal pay link (QR printout), the manager **regenerates their pay token** from the dashboard. The old link stops working and the manager shares the new one.

---

## Communication — Who Gets Notified and How

### Notifications Table

| Event | Tenant | Owner | Manager | Channel |
|---|---|---|---|---|
| Rent payment confirmed (MoMo) | ✅ Receipt | ✅ Collection alert | ❌ | WhatsApp |
| Rent due in 3 days | ✅ Reminder | ❌ | ❌ | WhatsApp (not yet delivered — see note) |
| Charge 1 day overdue | ✅ Chaser | ✅ Alert | ❌ | WhatsApp (not yet delivered) |
| Charge 3 days overdue | ✅ Chaser | ✅ Alert | ❌ | WhatsApp (not yet delivered) |
| Charge 7 days overdue | ✅ Chaser | ✅ Alert | ❌ | WhatsApp (not yet delivered) |
| Manual payment recorded by manager | ❌ | ❌ | ❌ | Not sent |
| New monthly charge created | ❌ | ❌ | ❌ | Not sent |
| Lease expiring soon (30 days) | ❌ | ❌ | ❌ | Not sent |

Owners receive overdue alerts so they stay informed even when a separate manager is running day-to-day operations. [PROPOSED DEFAULT — confirm or change]

> **Note on "not yet delivered":** Reminder and overdue messages are written into the system's database today, ready to send. The WhatsApp delivery connection is not yet switched on. When it is activated, the content is already in place.

**Receipt (sent to tenant after successful MoMo payment):**
```
✅ Rent paid — Sunset Apartments
Unit A3
Period: 2026-11
Amount: UGX 500,000
Ref: RENT-20261105-ABC1
Thank you!
```

**Collection alert (sent to property owner):**
```
🏠 Rent received — Sunset Apartments
Tenant: John Ssali, Unit A3
Period: 2026-11
Amount: UGX 500,000
Ref: RENT-20261105-ABC1
```

[NOT BUILT YET: SMS fallback for tenants or owners without WhatsApp; email notifications for any rent event]

---

## People and Roles

### Role Permissions Table

| Action | Owner | Manager | Owner/Manager |
|---|---|---|---|
| View portfolio and dashboard | ✅ | ✅ | ✅ |
| Create and edit property settings | ❌ | ✅ | ✅ |
| Add and edit units | ❌ | ✅ | ✅ |
| Add and deactivate tenants | ❌ | ✅ | ✅ |
| Generate and manage charges | ❌ | ✅ | ✅ |
| Record manual payments | ❌ | ✅ | ✅ |
| Override charge status (Waive, etc.) | ❌ | ✅ | ✅ |
| Download QR codes | ✅ | ✅ | ✅ |
| Download CSV export | ✅ | ✅ | ✅ |
| View maintenance requests | ✅ | ✅ | ✅ |
| Update maintenance request status | ❌ | ✅ | ✅ |
| Grant access to other managers | ❌ | ✅ | ✅ |
| View tenant phone numbers | ❌ | ✅ | ✅ |
| View payment history | ✅ | ✅ | ✅ |
| Receive rent collection WhatsApp alerts | ✅ | ❌ | ✅ |
| Receive overdue WhatsApp alerts | ✅ | ❌ | ✅ |

**Owner** — the person who owns the property and receives the money. Read-only dashboard access; receives payment and overdue alerts.
**Manager** — day-to-day operations: units, tenants, charges. Full write access. Does not receive payment alerts.
**Owner/Manager** — both combined. The account that creates a property gets this role automatically.

### What Happens When a Manager Leaves

There is no self-service "remove access" button on the manager dashboard today. Removing a manager requires contacting platform support. [NOT BUILT YET: self-service access removal for property owners]

In the meantime, regenerate the property and unit QR tokens from the dashboard — this invalidates any codes the former manager downloaded. The manager's login is blocked by revoking their account at the platform admin level.

### Tenant Privacy

| Data | Who can see it |
|---|---|
| Tenant name | Manager, Owner/Manager |
| Tenant phone number | Manager, Owner/Manager |
| Payment history | Manager, Owner, Owner/Manager |
| Lease dates | Manager, Owner/Manager |
| Other tenants in the property | Nobody — tenants only see their own page |

Tenants have no login account. They access their own pay page through a private personal link. If that link is compromised, the manager can regenerate it immediately — the old link stops working at once.

---

## Reporting and Other Charges

### What Reports Exist Today

| Report | Where to find it | What it shows |
|---|---|---|
| **Property dashboard** | Dashboard → select property | Current period summary: units, paid count, overdue count, total collected |
| **Portfolio overview** | Dashboard home | All properties: occupancy, overdue count, collected this month |
| **CSV export** | Dashboard → property → Export | All charges for a chosen month — one row per tenant, with amount, paid, outstanding, status |

A platform admin view of all properties across all managers is accessible from the admin console Properties tab (being built).

[NOT BUILT YET: monthly PDF income statement; cumulative arrears report; year-to-date income summary]

### Utilities and Other Charges (Water, Electricity, Service Charge, Garbage)

The system currently handles **rent charges only** — one charge per tenant per period. There is no separate charge type for water, electricity, service fees, or garbage.

[NOT BUILT YET: multiple charge types per period. All non-rent billing happens outside the system today.]

**Workaround:** Some managers build utility costs into the monthly rent amount and adjust the unit price when bills change. This works but loses the breakdown between rent and utilities on reports.

---

## Dashboard Features for Managers

From the dashboard, managers can:

- View a **portfolio overview** of all their properties (occupancy, overdue count, total collected this month)
- See a **per-property dashboard** showing each unit's current charge status at a glance
- **Download QR codes** — individually per unit (PNG or SVG), or as a bulk PDF of all units in the property
- **Export to CSV** — all charges for any period
- **Manage access** — invite other managers (by email) and assign them roles:
  - **Owner** — receives money and alerts, read-only view
  - **Manager** — day-to-day operations (units, tenants, charges)
  - **Owner/Manager** — both
- **Regenerate QR tokens** — invalidates any previously printed QR codes and door stickers
- View and update **maintenance requests** submitted by tenants

---

## Tenant Maintenance Requests

From the tenant pay page, tenants can submit maintenance requests (e.g. "broken window", "no water"). They can also see the status of their previous requests. The manager sees all requests on the dashboard and can update the status (Open → In Progress → Resolved → Closed).

---

## QR Token Security

There are three levels of QR tokens in the system:

- **Property token** — building entrance; invalidated by regenerating the property token
- **Unit token** — door sticker; invalidated per-unit
- **Tenant personal token** — private pay link; invalidated when the tenant is deactivated or when the manager regenerates it

Regenerating a token makes all previously printed/shared codes stop working immediately.

---

## Cost of Using the Platform

The platform charges a small per-transaction fee, added on top of the tenant's rent payment. The fee is set by the platform admin and is not charged to the property owner or manager separately. There are no monthly subscription fees or per-unit charges for using the platform.

**Who sees the fee?**
- Tenants see the total amount including the fee before they confirm payment.
- Property managers can see the current fee rate in the admin console Properties tab.
- Property owners do not pay any fee — they receive the full rent amount.

[PROPOSED DEFAULT — confirm or change]

---

## Language Support

The tenant pay page is currently in **English only**. There is no option to switch to Luganda or any other language.

[NOT BUILT YET: Luganda or other local language support on the tenant pay page]

---

## Getting Help

**For property managers:**
Contact platform support via WhatsApp at [SUPPORT NUMBER — add before launch]. The support team is available Monday to Friday, 8am–6pm East Africa Time. [PROPOSED DEFAULT — confirm or change]

**For tenants:**
If you have a problem paying, contact your landlord or property manager directly. Their contact details should be posted at the property. If the payment went through on your phone but the system shows a problem, give the manager your transaction reference number — they can resolve it from the dashboard.

[NOT BUILT YET: a visible support contact link on the tenant pay page]

---

## Summary Flow

```
Manager registers (self-service)
   └─► Creates property (gets building QR, sets late fee)
         └─► Adds units (each gets a door QR, sets monthly amount)
               └─► Adds tenant to unit
                     └─► Lease is created (rent amount locked in)
                           └─► Charges are auto-generated each month
                                 └─► Tenant scans QR → sees balance + platform fee
                                       └─► Pays via MoMo (rent + fee)
                                             └─► Owner receives full rent amount
                                                   └─► WhatsApp receipts sent to tenant + owner
```

---

---

## Appendix A — Proposed Defaults (confirm or change)

These are reasonable defaults proposed for undecided items. None are built yet — they are here so you can confirm, adjust, or reject each one before it gets built.

| # | Topic | Proposed default |
|---|---|---|
| 1 | Manager registration | Self-service on the website — no approval or invitation needed |
| 2 | Advance payment limit | Up to 3 months ahead, one month per transaction |
| 3 | Deposit tracking | Not tracked in-system today; manager uses notes. A dedicated flow is a future feature. |
| 4 | Early termination fee | No automatic fee — manager handles any penalty outside the system |
| 5 | Shared units | One named tenant per unit; others can pay using that tenant's personal link |
| 6 | Owner overdue alerts | Owner receives overdue chasers at day 1, 3, and 7 (same days as tenant) |
| 7 | Manager overdue alerts | Managers do not receive overdue alerts (they see the dashboard instead) |
| 8 | Platform pricing | Per-transaction fee only, added to tenant payment. No subscription or per-unit fee. |
| 9 | Support contact | WhatsApp number for managers; tenants are directed to their landlord |
| 10 | Support hours | Monday to Friday, 8am–6pm EAT |

---

## Appendix B — [NOT BUILT YET] Items

Confirmed by reading the code — these features are missing or are stubs only.

1. **Live MTN MoMo and Airtel Money API integrations** — Code stubs exist for both but neither has a working connection. Payments run in test/stub mode only.
2. **Platform fee deduction from tenant payment** — The fee model is decided (fee added to tenant, owner receives full amount) but the deduction logic and admin console fee configuration for rent are not yet implemented.
3. **Late fee field on property + automatic application on overdue** — Decided (owner sets it per property) but not yet built.
4. **WhatsApp/SMS reminder and overdue message delivery** — Messages are written to the database but the delivery worker is not switched on. Nothing is actually sent to phones today.
5. **WhatsApp receipt for manually recorded payments** — Only MoMo self-service payments trigger a receipt. Manual cash/bank payments recorded by managers send nothing.
6. **"New charge created" notification to tenant** — Tenants are not notified when a monthly charge is generated.
7. **Lease renewal button** — To renew, the manager must deactivate and re-add the tenant as new. No dedicated renewal flow exists.
8. **Manager/owner notification when lease is expiring (30-day warning)** — Not built. Days remaining is visible on the dashboard only.
9. **Self-service access removal from manager dashboard** — Removing a manager requires platform admin action.
10. **Multiple charge types (utilities, service charges, one-off items)** — Only one charge type exists: monthly rent.
11. **Deposit payment/tracking flow** — Deposit amount is stored on the unit but there is no deposit charge, payment, or refund record.
12. **Void/reverse a payment record** — No delete or reverse. Corrections use charge status overrides.
13. **Monthly PDF income statement or arrears summary report** — Only CSV export exists.
14. **Luganda / local language support on the tenant pay page** — English only.
15. **Support contact link visible on the tenant pay page** — Not shown to tenants.
16. **Admin console Properties tab** — Being built. Will show all properties across all managers, fee configuration, and property-level reporting for the platform admin.

---

## Appendix C — Corrections to the Original Doc

Items that were incorrect or incomplete in the first version. No content was removed.

1. **WhatsApp receipts** — Only sent for tenant-initiated MoMo payments. Manual payments recorded by managers do not trigger a receipt.
2. **Overdue reminders** — Described as working. In reality, messages are logged to the database but not delivered. The current implementation writes to server logs only.
3. **Deposits** — The deposit amount on a unit is a display figure only. No payment flow exists.
4. **Lease renewal** — No renewal button exists. Manager must re-add the tenant as new.
5. **Charge creation notification** — No notification is sent when a new monthly charge is created.
6. **Platform fee** — Original doc did not mention fees at all. Clarified: a per-transaction fee is added to the tenant's payment; the owner receives the full rent amount.
7. **Late fees** — Original doc did not mention late fees. Clarified: owners will be able to set a flat or percentage late fee per property (not yet built).
