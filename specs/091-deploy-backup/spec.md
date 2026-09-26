# Feature Specification: Deployment, Backup & Hardening

**Feature Branch**: `091-deploy-backup`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description (Linear PRI-20): "Deployment, Backup & Hardening. Server target
(hardware minimums, Ubuntu LTS, separate data disk for database and files); a container stack
(standalone web build, PostgreSQL, file-storage volume, worker if 053 needs one) with pinned
versions; LAN-only networking (bind to the LAN interface, local hostname, HTTPS with an internal
certificate, no inbound internet ports); secrets in a server-only `.env` validated at startup;
nightly backups of database, file objects and configuration (PRD §53); a timed restore drill onto
a fresh machine, before go-live and then quarterly; a failed or missed backup, or low disk space,
raises an Admin notification (via 053, or a narrow port if 053 is not built); an upgrade procedure
(backup → `prisma migrate deploy` → restart → smoke test → rollback) including a path to baseline
real Prisma migrations; security hardening (OS updates, firewall, database unreachable from other
LAN machines, session cookie settings, a security review); bootstrap (first Admin, seed
departments/roles, staff onboarding); and an internet-unplugged run of the full order lifecycle.
Out of scope: cloud hosting of the core app, Kubernetes or multi-server, hosting the WhatsApp
gateway (054, but its network boundary is documented here), a backup management UI." PRD §52,
§53, §54, §36 (network boundary only), §40–41 (file store), §62 criteria 22–23; constitution VII
and "Technology, Data & Security Constraints" (Secrets, Backups).

## Clarifications

### Session 2026-09-24

The owner confirmed every decision below on 2026-09-24. Each lists the rejected alternatives on
the line after it.

- Q: Which server hardware will be used? → A: Not decided yet. This spec defines a **minimum** and
  a **recommended** specification (FR-001), and hardware selection is an **open go-live item**
  for the owner (see "Open go-live items"). Nothing in this feature assumes a specific machine
  (CONFIRMED by owner 2026-09-24).
- Q: Where do backups go? → A: **All three** destinations, every night: (1) an external USB drive
  attached to the server, (2) a second PC on the shop LAN, and (3) an encrypted off-site cloud
  copy. The off-site copy is encrypted on the server before upload (the provider never sees
  readable data), and the provider is pluggable (any S3-compatible service) (CONFIRMED by owner
  2026-09-24).
- Q: How much data may be lost, and how fast must the shop be back up? → A: **RPO 24 hours**
  (nightly backups) and **RTO 4 hours** (CONFIRMED by owner 2026-09-24).
- Q: Is a UPS available? → A: **Yes.** The server shuts down gracefully when the UPS reports
  on-battery for too long or low battery, and comes back automatically when power returns
  (CONFIRMED by owner 2026-09-24).
- Q: How long are backups kept? → A: 7 daily, 4 weekly, and 12 monthly restore points on every
  destination (CONFIRMED by owner 2026-09-24).
  - Rejected: 30 daily only (no protection against a problem noticed after a month); keeping
    everything forever (the USB drive and the cloud bill grow without bound).
- Q: When does the nightly backup run? → A: 02:00 shop local time (Africa/Cairo), when the shop
  is closed. A missed or failed run must be reported by 08:00 the same morning, before staff
  arrive (CONFIRMED by owner 2026-09-24).
  - Rejected: running during working hours (slows the system while staff use it); several runs a
    day (RPO 24h is confirmed, so the extra load and complexity buy nothing the owner asked for).
- Q: What does the 4-hour RTO clock cover? → A: From the moment a replacement machine that meets
  the minimum specification is on the bench with network and power, to the moment staff can log
  in and see last night's data. It includes installing the operating system. It excludes buying
  or fetching hardware (CONFIRMED by owner 2026-09-24).
  - Rejected: excluding OS installation (hides the slowest manual step); including hardware
    procurement (outside the team's control, and it cannot be drilled).
- Q: How do staff devices reach the server by name? → A: `printex.local`, announced on the LAN by
  the server itself, with the server on a fixed (reserved) LAN address. A DNS entry on the shop
  router (`printex.lan`) is the fallback for devices that cannot resolve `.local` names
  (CONFIRMED by owner 2026-09-24).
  - Rejected: typing an IP address (breaks HTTPS certificate names, and hard for staff); a
    public domain with a public certificate (needs internet to renew and exposes the name).
- Q: How do staff browsers trust the LAN HTTPS certificate? → A: The server runs its own internal
  certificate authority. Its root certificate is installed once on every staff device during
  onboarding (CONFIRMED by owner 2026-09-24).
  - Rejected: plain HTTP on the LAN (session cookies and passwords sent in clear, contrary to PRD
    §54); a self-signed certificate per server with browser warnings clicked through (teaches
    staff to ignore warnings).
- Q: What protects the second-PC backup copy if the server itself is compromised (for example,
  ransomware)? → A: The second PC accepts new backups but does not let the server delete or
  rewrite old ones (append-only). Old restore points on that PC are cleaned up by the PC itself
  on its own schedule (CONFIRMED by owner 2026-09-24).
  - Rejected: a plain shared folder (anything that can write to it from the server can also
    destroy it); no second copy on the LAN (the owner confirmed it).
- Q: Who holds the keys needed to read the backups if the server is lost? → A: A **recovery kit**
  (the backup encryption passwords, the off-site account credentials, and the restore runbook)
  is printed, sealed, and kept by the owner away from the server, with a second sealed copy in a
  second location the owner chooses. It is re-issued whenever a secret changes (CONFIRMED by owner 2026-09-24).
  - Rejected: keys stored only on the server (a lost server means unreadable backups); keys
    stored inside the backups (circular).
- Q: How is the first Admin created, and what happens to the development seed? → A: A one-time
  bootstrap command on the server asks for the first Admin's username and a strong password. It
  refuses if an active Admin already exists. Production loads only reference data (roles and
  permissions, default departments, the Cash Customer, customer classifications). The
  development sample orders and the development Admin password are never loaded in production
  (CONFIRMED by owner 2026-09-24).
  - Rejected: running the existing development seed in production (it creates an Admin with a
    published password and sample orders); creating the first Admin through a web page (an open
    "claim this server" page is a security hole until someone uses it).
- Q: Which Admin users are told about backup and disk problems? → A: Every active user who holds
  the existing Admin configuration permission (`admin.config`). No names or role keys are
  written into the rules (constitution VI) (CONFIRMED by owner 2026-09-24).
  - Rejected: a fixed person (breaks when staff change); a new "ops" role (more setup for a shop
    whose Admin/Owner already holds `admin.config`).
- Q: How are application updates delivered to the server? → A: The project's CI builds the
  application image, and the server pulls that exact image by its content fingerprint when an
  upgrade is run. If the internet is down on upgrade day, the same image can be carried over on a
  USB stick (CONFIRMED by owner 2026-09-24).
  - Rejected: building on the server (needs the full toolchain and internet on the production
    machine, and the result is not the image CI tested); automatic updates (upgrades must happen
    only in a planned window with a fresh backup).
- Q: Does the GitHub sign-in button stay? → A: No. Production uses username-and-password sign-in
  only. The GitHub provider needs the internet and is removed from, or disabled in, production
  (CONFIRMED by owner 2026-09-24; the change touches 001, owned by Fady).
  - Rejected: keeping GitHub sign-in as an option (it fails with the internet unplugged, and it
    requires GitHub secrets on an offline server).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Stand up the shop server and create the first Admin (Priority: P1) 🎯 MVP

The engineer takes a machine that meets the minimum specification, installs Ubuntu LTS, attaches
a separate data disk, and runs one install script. The script prepares the disks and folders,
installs the pinned container stack, loads secrets from a server-only configuration file, and
starts the system behind HTTPS at `printex.local`. It refuses to start if any required secret is
missing or invalid. The engineer runs the bootstrap command once to create the first Admin and
load the reference data (roles, permissions, default departments). The Admin then signs in from a
staff PC on the LAN and follows the onboarding checklist for each staff member.

**Why this priority**: Nothing else in this feature (backups, restore, hardening) exists without a
running production server. It is also the first real production target: today the code is only
run in development and CI.

**Independent Test**: On a clean virtual machine meeting the minimum specification, run the
install script and the bootstrap command. Confirm the health check reports ready, a staff browser
on the LAN opens `https://printex.local` with a trusted certificate, the first Admin can sign in,
the seven default roles and five default departments exist, and no sample orders or development
Admin exist. Then remove one required secret and confirm the application refuses to start and
names the missing setting.

**Acceptance Scenarios**:

1. **Given** a machine with Ubuntu LTS and a separate data disk, **When** the install script runs,
   **Then** the database data, the file store, and the backup staging area all live on the data
   disk, the application starts, and the health check reports ready.
2. **Given** the install script has already run, **When** it runs again, **Then** it changes
   nothing that is already correct and reports "no changes" (idempotent).
3. **Given** the server configuration file is missing a required secret (or it is too short, or
   the public address is not `https://`), **When** the application starts, **Then** it stops
   immediately with a message naming the invalid setting, and it serves no pages.
4. **Given** a freshly installed server with no users, **When** the bootstrap command runs with a
   username and a strong password, **Then** one Admin/Owner user exists, the reference data
   exists, and the step is in the audit log. **When** it runs a second time, **Then** it refuses
   because an active Admin already exists.
5. **Given** a production server, **When** anyone looks for the development sample orders or the
   development Admin account, **Then** neither exists.
6. **Given** the data disk is not mounted at boot, **When** the server starts, **Then** the
   application and database do not start (so they never write to the operating-system disk), and
   the problem is visible to the engineer.
7. **Given** mains power fails, **When** the UPS reports low battery or has been on battery for
   the configured time, **Then** the application and database stop cleanly before the server
   powers off, and **When** power returns, **Then** the server boots and the system comes back
   without manual steps.

---

### User Story 2 - Every night, a complete backup leaves the server (Priority: P1)

Every night at 02:00 the server takes a consistent backup of the database, every stored file, and
the configuration, and sends it, encrypted, to the USB drive, to the second PC on the LAN, and to
the off-site cloud copy. Each destination keeps 7 daily, 4 weekly and 12 monthly restore points.
One destination failing does not stop the others. Nobody has to do anything by hand.

**Why this priority**: PRD §53 makes backup mandatory, and PRD §62 criterion 23 makes "backups
exist outside the primary server" a V1 acceptance criterion. The constitution requires every
persistent store to be in backup scope.

**Independent Test**: Run the nightly backup by hand on a server with seeded orders and uploaded
files. Confirm each of the three destinations has a new restore point that contains the database
dump, every file object, and the configuration. Confirm the restore point is unreadable without
the backup password. Unplug the USB drive, run it again, and confirm the LAN and off-site copies
still succeed and the USB failure is reported.

**Acceptance Scenarios**:

1. **Given** the nightly schedule, **When** 02:00 arrives, **Then** a backup starts without any
   human action and produces one restore point on each reachable destination.
2. **Given** a restore point, **When** it is inspected, **Then** it contains a database dump, the
   whole file store (every object referenced by the dump), and the server configuration
   (including the internal certificate authority), and it contains nothing readable without the
   backup password.
3. **Given** files are uploaded while the backup runs, **When** the restore point is restored,
   **Then** every file the restored database refers to is present (the database is dumped first,
   then the file store).
4. **Given** the USB drive is unplugged (or the second PC is off, or the internet is down),
   **When** the backup runs, **Then** the other destinations still receive their restore point
   and the unreachable one is recorded as failed.
5. **Given** more than 7 daily restore points exist, **When** retention runs, **Then** each
   destination keeps exactly the 7 most recent daily, 4 weekly and 12 monthly points, and older
   ones are removed (on the second PC, by the PC itself).
6. **Given** the server has been compromised and an attacker uses its backup credentials, **When**
   they try to delete or overwrite restore points on the second PC, **Then** the second PC
   refuses.
7. **Given** a backup run, **When** it finishes (success or failure), **Then** its result
   (destination, time, size added, outcome, reason) is recorded in the application.

---

### User Story 3 - Restore last night's backup onto a clean machine within 4 hours (Priority: P1)

The server has died. The engineer takes a replacement machine, installs Ubuntu LTS, opens the
sealed recovery kit, and follows the restore runbook. The runbook restores the configuration, the
database and the file store from the most recent restore point (USB, second PC, or off-site, in
that order of preference) and starts the system. Staff sign in and see everything up to last
night. The whole process is timed. It is rehearsed before go-live and then every quarter, and an
automated check restores the latest backup into a throwaway copy every week.

**Why this priority**: A backup that has never been restored is not a backup. The brief's first
acceptance criterion is "restore from last night's backup onto a clean machine within the RTO".

**Independent Test**: Take last night's restore point. On a second clean machine, follow the
runbook with a stopwatch. Confirm the system is usable in under 4 hours, the order count, Work
Item count, audit event count and file object count match the source at backup time, a sample of
restored files passes checksum verification, and existing staff can sign in with their usual
passwords.

**Acceptance Scenarios**:

1. **Given** last night's restore point and a clean machine that meets the minimum
   specification, **When** the engineer follows the restore runbook, **Then** staff can sign in
   and see last night's orders in under 4 hours from the start, including OS installation.
2. **Given** a restored system, **When** its record counts (orders, Work Items, audit events, file
   objects, users) are compared with the counts captured at backup time, **Then** they match
   exactly.
3. **Given** a restored system, **When** stored files are checked against their recorded
   checksums, **Then** every checked file matches.
4. **Given** the USB drive is also lost (for example, fire), **When** the restore runs from the
   second PC or the off-site copy, **Then** the result is the same.
5. **Given** a weekly automated verification, **When** it runs, **Then** it restores the latest
   restore point into a throwaway, isolated copy, checks record counts and a sample of file
   checksums, deletes the copy, and records a pass or fail result. A fail raises an Admin alert.
6. **Given** a quarterly drill, **When** it is completed, **Then** its date, duration, restore
   point used, source destination, and any problems found are written in the drill log, and a
   drill that exceeds 4 hours is a failed drill with a follow-up action.
7. **Given** a single stored file is found corrupted, **When** the engineer runs the single-object
   restore for that file, **Then** only that file is restored from the most recent restore point
   that holds it, its checksum is verified before it is put back, and the corrupted copy is kept
   aside, not deleted.

---

### User Story 4 - The server cannot be reached from the internet or misused from the LAN (Priority: P1)

The server accepts connections only on the shop LAN, only for HTTPS (plus a redirect from HTTP),
and remote administration only from the engineer's designated machine. The database cannot be
reached from any other machine. The router forwards no ports to the server. Operating-system
security updates install automatically. Session cookies are only sent over HTTPS and cannot be
read by page scripts. A security review of the whole system is completed before go-live.

**Why this priority**: PRD §54 and constitution VII: "The local server MUST NOT be exposed to the
public Internet." The brief's acceptance criterion is "an external port scan shows nothing open".

**Independent Test**: From outside the shop (a phone on mobile data, or a scanning service), scan
the shop's public IP address: nothing is open. From another LAN PC, scan the server: only HTTPS,
the HTTP redirect, and (from the designated admin machine only) remote administration answer. Try
to connect to the database port from another LAN PC: refused. Sign in and inspect the session
cookie: it is marked secure and HTTP-only.

**Acceptance Scenarios**:

1. **Given** the shop's public internet address, **When** an external port scan runs, **Then** it
   finds no open ports that lead to the server.
2. **Given** a staff PC on the LAN, **When** it scans the server, **Then** only HTTPS and the HTTP
   redirect answer, and the database, the application's internal port, and remote administration
   do not.
3. **Given** the engineer's designated admin machine, **When** it connects for remote
   administration, **Then** key-based login succeeds, and password login is refused.
4. **Given** any machine other than the server itself, **When** it tries to connect to the
   database, **Then** the connection is refused.
5. **Given** a signed-in user, **When** the session cookie is inspected, **Then** it is marked
   Secure and HttpOnly, and it is not sent over plain HTTP.
6. **Given** a page served by the system, **When** it loads, **Then** it loads nothing from the
   internet (all fonts, scripts and styles come from the server), and the browser is told to
   refuse content from anywhere else.
7. **Given** the security review, **When** it is completed, **Then** every finding is fixed or
   recorded as accepted by the owner before go-live.

---

### User Story 5 - A missed or failed backup, or a filling disk, alerts the Admin (Priority: P1)

If a nightly backup fails on any destination, does not run at all, or the weekly restore check
fails, or a disk is running out of space, every Admin sees an alert in the application by the
next morning, with what went wrong and what to do. The alert repeats once a day until the problem
is fixed, and it is not repeated more often than that. The Admin also sees, on an Admin page, when
each destination last received a good backup.

**Why this priority**: A silent backup failure is discovered only on the day it is needed. The
brief's acceptance criterion is "a missed backup triggers an Admin alert".

**Independent Test**: Disable the backup schedule for one night. Confirm that by 08:00 the Admin
has an alert "no backup for destination X since <time>". Fill the data disk past the warning
threshold with a test file and confirm a low-disk alert. Re-enable and run a successful backup,
and confirm the Admin page shows the new time and no new alerts are raised.

**Acceptance Scenarios**:

1. **Given** a destination has no successful backup in the last 26 hours, **When** the hourly
   check runs, **Then** a "backup missed" alert is recorded for every Admin, naming the
   destination and the time of the last good backup.
2. **Given** a backup run fails on a destination, **When** the result is reported, **Then** a
   "backup failed" alert is recorded for every Admin, with the reason.
3. **Given** the data disk or the operating-system disk falls below 15% free space (or below 5%),
   **When** the hourly check runs, **Then** a "disk space low" (or "disk space critical") alert
   is recorded.
4. **Given** an unresolved problem already alerted today, **When** the same problem is reported
   again within 20 hours, **Then** no duplicate alert is recorded.
5. **Given** the application is down when a result is reported, **When** it comes back, **Then**
   the result is delivered then (results are kept on the server until delivered), and nothing is
   lost.
6. **Given** the scheduler on the server stopped entirely, **When** an Admin opens the Admin
   backup page, **Then** it shows each destination's last good backup time and marks any older
   than 26 hours as overdue, even though no alert was reported.
7. **Given** a request to record a backup result that does not carry the server's reporting
   secret, **When** it is received, **Then** it is refused and nothing is recorded.
8. **Given** a user without the Admin configuration permission, **When** they open the Admin
   backup page, **Then** access is refused.

---

### User Story 6 - The shop keeps working with the internet unplugged (Priority: P1)

The internet line is unplugged at the router. Staff carry on: reception creates an order, a
designer is assigned and uploads the design, the Head Designer approves it, production runs and
completes it, it is collected and delivered, and payments are recorded. Everything works over the
LAN. Only the off-site backup copy (and, later, WhatsApp) waits until the internet returns.

**Why this priority**: PRD §52 and §62 criterion 22, and constitution VII. The brief's acceptance
criterion is "the full order → delivery flow works with the internet unplugged".

**Independent Test**: Unplug the router's internet connection. On two LAN devices, run the full
lifecycle end to end for one order with two Work Items. Confirm every step succeeds, timers run,
files upload and download, and the next backup still reaches the USB drive and the second PC while
the off-site copy reports "destination unavailable".

**Acceptance Scenarios**:

1. **Given** the internet is unplugged, **When** staff run the full order lifecycle (create →
   assign designer → design upload → review approve → production start/complete → collection →
   delivery), **Then** every step succeeds.
2. **Given** the internet is unplugged, **When** any page is opened, **Then** it renders fully
   (fonts and styles included) and no step waits on an internet request.
3. **Given** the internet is unplugged, **When** a staff member signs in, **Then** sign-in works
   (no internet sign-in provider is involved).
4. **Given** the internet is unplugged during the nightly backup, **When** it runs, **Then** the
   USB and second-PC copies succeed and the off-site copy is reported as failed with "destination
   unavailable", and it succeeds again on the first night after the internet returns.
5. **Given** the application is started with no route to the internet at all, **When** the
   automated offline check runs, **Then** the application starts, reports ready, and serves its
   sign-in page.

---

### User Story 7 - Upgrade safely, and roll back if something goes wrong (Priority: P2)

When a new version is released, the engineer runs one upgrade command in a planned window. It
blocks staff access with a maintenance page, takes a fresh backup, applies the database changes
with real, recorded migrations, starts the new version, and runs a smoke test. If anything fails,
the rollback puts back the previous version and the pre-upgrade database, and the shop is back as
it was. Before go-live, the project's database changes are converted from the current "push the
schema directly" practice into a proper migration history, so every future upgrade can be applied
and audited the same way.

**Why this priority**: Upgrades are rare but the riskiest thing done to a live server. It is P2
because go-live needs only the first install. The migration baseline itself is a go-live
prerequisite (FR-032) and must be agreed with the schema owner.

**Independent Test**: On a test server running release N with data, run the upgrade to release
N+1 that adds a column. Confirm the maintenance page appears, a backup was taken, the migration is
recorded as applied, the smoke test passes, and data is intact. Then run an upgrade to a
deliberately broken release and confirm the automatic rollback restores release N and the
pre-upgrade data, with no data lost.

**Acceptance Scenarios**:

1. **Given** release N running, **When** the upgrade to N+1 runs, **Then** it shows the maintenance
   page, takes a backup that must succeed before it continues, applies pending migrations, starts
   N+1, and passes the smoke test before staff access reopens.
2. **Given** the pre-upgrade backup fails, **When** the upgrade runs, **Then** it stops before
   changing anything, and release N is back in service.
3. **Given** a migration or the smoke test fails, **When** the upgrade detects it, **Then** it
   rolls back: release N and the pre-upgrade database are restored, the smoke test passes on N,
   and the failure is recorded.
4. **Given** the migration baseline is in place, **When** the migration status is checked on any
   environment, **Then** every applied change is recorded, and the schema has no drift from the
   migration history.
5. **Given** an upgrade completes, **When** the upgrade log is inspected, **Then** it records the
   previous and new release, the backup used, the migrations applied, the smoke-test result, and
   the duration.

---

### Edge Cases

- **Backup still running at 08:00** (very large first backup to the cloud): the run continues;
  the watchdog reports "backup in progress, running for N hours" rather than "missed", and a run
  over 20 hours is reported as failed and stopped.
- **Two backup runs overlap** (a manual run while the nightly one is running): the second one
  refuses to start. Two runs never write to the same destination at once.
- **USB drive full**: that destination fails with "destination full", the others continue, and
  the Admin is alerted.
- **Restore point exists but its database dump is damaged**: the weekly verification catches it;
  a manual restore uses the previous restore point, and the data loss for that restore becomes up
  to 48 hours (recorded in the drill log).
- **Clock drift while offline**: without the internet, the server clock cannot sync. The server
  keeps its own clock (drift is seconds per week) and re-syncs when the internet returns. The
  server's clock is the only one used for timestamps (constitution: UTC, server-side), so staff
  devices with a wrong clock do not affect records.
- **The internal certificate authority is lost**: every staff device would need to trust a new
  root certificate. It is therefore part of the backed-up configuration and is restored with the
  server.
- **Replacement server gets a different LAN address**: the reserved address is moved to the new
  machine on the router (runbook step), so staff bookmarks keep working.
- **Upgrade interrupted by a power cut**: the UPS shuts the server down cleanly. On boot, the
  engineer re-runs the upgrade command, which detects the half-finished upgrade and rolls back.
  It never leaves N+1 code on an N database or the reverse.
- **Result report arrives twice** (retry after a timeout): it is recorded once (each run has a
  unique id).
- **Low disk during the backup**: the database dump is written to the data disk first; if there is
  not enough space for it, the run fails early with "insufficient space" instead of filling the
  disk.
- **File uploaded but its bytes not yet complete during the backup**: 050's temporary upload area
  is excluded from backups; only complete, committed file objects are backed up.
- **A second PC running Windows**: the append-only backup receiver must run on Windows or Linux;
  the runbook covers both.
- **Backup password changed**: old restore points stay readable with the recovery kit (the backup
  tool keeps several keys), and the recovery kit is re-issued.
- **Staff device cannot resolve `printex.local`** (some Android devices): the router DNS name
  `printex.lan` is used instead; both names are on the certificate.

## Requirements *(mandatory)*

### Functional Requirements

**Server target & stack (US1)**

- **FR-001**: The deployment MUST define a minimum and a recommended server specification (CPU,
  memory, operating-system disk, separate data disk, network, UPS), and a sizing rule for the data
  disk based on expected database and file volume. Hardware selection is an owner go-live item,
  not part of this feature.
- **FR-002**: The server MUST run a current Ubuntu LTS release. The database data, the file store,
  the backup staging area and the internal certificate authority MUST live on the separate data
  disk. The application and database MUST NOT start when the data disk is not mounted.
- **FR-003**: The system MUST run as a declared container stack: the web application (a
  self-contained production build), PostgreSQL, a reverse proxy that terminates HTTPS, and
  one-shot tool jobs (migrate, bootstrap). Every image MUST be pinned to an exact version and
  content fingerprint. A background worker slot MUST be reserved (disabled) for 053 if it later
  needs one.
- **FR-004**: The install script MUST be idempotent: re-running it on a correctly installed
  server changes nothing.
- **FR-005**: The whole stack MUST start automatically at boot and restart failed services, and
  MUST stop cleanly (database shut down without crash recovery) on a normal or UPS-triggered
  shutdown.
- **FR-006**: The server MUST monitor the UPS and shut down cleanly when the UPS reports low
  battery or has been on battery longer than a configured time (default 5 minutes). The server
  MUST power back on and restart the stack when mains power returns.

**Secrets & configuration (US1)**

- **FR-007**: All secrets and environment settings MUST live in one configuration file on the
  server only, readable only by root and the service, and MUST NEVER be committed to source
  control, baked into an image, or written to logs. The repository MUST carry only an example
  file with no real values.
- **FR-008**: The application MUST validate its configuration at startup and MUST refuse to start
  (not at first request) when any required production setting is missing or invalid. Production
  MUST require: the session secret (at least 32 characters), the public HTTPS address, the
  runtime database connection, an absolute file-store path, and the backup-reporting secret (at
  least 32 characters). The migration (schema-owner) database connection MUST be required and
  validated by the migration job only, and MUST NOT be given to the running application.
  Internet-only settings (GitHub sign-in) MUST NOT be required in production.

**LAN-only networking & hardening (US4)**

- **FR-009**: The server MUST accept application traffic only on its LAN interface: HTTPS on 443
  and an HTTP→HTTPS redirect on 80. The application's internal port and the database MUST NOT be
  published on any interface. Remote administration (SSH) MUST be key-only and reachable only
  from the designated admin machine's address.
- **FR-010**: The system MUST be reachable at `https://printex.local` (and `https://printex.lan`)
  with a certificate issued by the server's internal certificate authority, which MUST keep
  working and renewing with no internet access.
- **FR-011**: The server's firewall MUST deny all inbound traffic by default, and container port
  publishing MUST NOT bypass it. The shop router MUST have no port forwarding or automatic port
  opening (UPnP) towards the server. Outbound internet access is used only for OS updates,
  pulling pinned images, the off-site backup and time sync.
- **FR-012**: The database MUST be reachable only from the application and tool containers on the
  server, and from the backup account through a local-only socket (no network listener). The application MUST connect as a dedicated non-owner, non-superuser role with only
  data-manipulation privileges (so the existing append-only REVOKEs bind). Migrations MUST run as
  a separate owner role. Backups MUST read through a separate read-only role.
- **FR-013**: Operating-system security updates MUST install automatically, with any required
  reboot scheduled outside shop hours.
- **FR-014**: In production, session cookies MUST be Secure and HttpOnly, and the application MUST
  accept requests only from its own configured origins. The 12-hour session lifetime and the
  existing lockout rules (001) are unchanged.
- **FR-015**: Every page MUST be served with security headers that forbid loading content from
  anywhere but the server itself, forbid framing, and require HTTPS for the site on the browser
  side.
- **FR-016**: A security review of the full system (application and deployment) MUST be completed
  before go-live, and every finding MUST be fixed or recorded as accepted by the owner.

**Backups (US2)**

- **FR-017**: Every night at 02:00 local time, the server MUST back up: a consistent dump of the
  whole database (including file metadata and audit log), every committed file object, and the
  server configuration (the configuration file, the stack definition, the internal certificate
  authority, and the UPS and firewall settings). The database MUST be dumped before the file store
  is captured. 050's temporary upload area MUST be excluded.
- **FR-018**: Each backup MUST be sent to three destinations: an external USB drive, a second PC
  on the LAN, and an off-site S3-compatible store. Each destination MUST be independent: one
  failing MUST NOT stop the others. Every destination MUST hold only data encrypted on the server
  before it leaves (the off-site provider and anyone holding the USB drive cannot read it).
- **FR-019**: Each destination MUST keep 7 daily, 4 weekly and 12 monthly restore points and
  remove older ones. The second PC MUST refuse deletion or overwrite requests coming from the
  server and apply retention itself.
- **FR-020**: Backups MUST run under a dedicated, unprivileged account that can read the data and
  write to the destinations but cannot change the application or the database. Only one backup
  run MAY be active at a time.
- **FR-021**: Every backup MUST record, alongside the dump, the record counts (orders, Work Items,
  audit events, file objects, users) at dump time, so a restore can be verified against them.
- **FR-022**: The backup tooling MUST provide a single-object restore (put back one stored file by
  its storage key from the most recent restore point that holds it, verifying its checksum before
  placing it, and moving any damaged copy aside rather than deleting it) and a checksum
  verification of stored files against their recorded checksums. These are the operations 050
  FR-024 depends on.

**Restore (US3)**

- **FR-023**: The restore runbook MUST take an engineer from a clean machine with Ubuntu LTS and
  the recovery kit to a working system with last night's data, choosing the USB drive, then the
  second PC, then the off-site copy. It MUST be scripted so the only manual steps are OS
  installation, attaching the backup source, and entering recovery-kit secrets.
- **FR-024**: A restore MUST be verified: record counts equal the counts captured at backup time
  (FR-021), and a sample of at least 100 file objects (or all, if fewer) match their recorded
  checksums.
- **FR-025**: A restore drill onto a clean machine MUST be run and timed before go-live and then
  every quarter. Each drill MUST be recorded in the drill log (date, duration, restore point,
  source, problems, follow-ups). A drill that takes longer than 4 hours fails.
- **FR-026**: An automated restore verification MUST run weekly: restore the latest restore point
  into a throwaway, network-isolated copy on the server, verify it per FR-024, delete it, and
  report pass or fail.
- **FR-027**: A recovery kit (backup encryption passwords, off-site credentials, second-PC access,
  runbook) MUST exist outside the server, and MUST be re-issued when any of those secrets change.

**Backup health (US5)**

- **FR-028**: The result of every backup run per destination, every weekly verification, and every
  hourly health-check finding (missed backups, disk space, UPS shutdown) MUST be recorded in the
  application as an append-only backup-health record. Reports MUST be authenticated with a
  server-only reporting secret, MUST be idempotent per run and destination, and MUST be queued on
  the server and retried when the application is unavailable.
- **FR-029**: A failed backup, a failed verification, a destination with no successful backup in
  26 hours, free space below 15% (warning) or 5% (critical) on the data or OS disk, and a UPS
  shutdown MUST each raise an internal notification to every active holder of `admin.config`,
  through the existing notification outbox (002 `notify`, delivered by 053). The same problem for
  the same destination MUST NOT raise more than one notification per 20 hours.
- **FR-030**: Admins (`admin.config`) MUST be able to see, per destination, the last successful
  backup time, the last result, and the last verification result, with anything older than 26
  hours marked overdue at read time. This is a read-only status view, not a backup management UI.
- **FR-031**: The application MUST expose a health check that reports liveness and readiness
  (database reachable, file store writable, configuration valid) without revealing any data or
  configuration values.

**Upgrade & migrations (US7)**

- **FR-032**: Before go-live, the project's database schema MUST be captured as a single baseline
  migration plus a follow-up migration holding the manual SQL (append-only REVOKEs, partial
  indexes), so that a fresh production database is created only by applying migrations. Existing
  non-production databases MUST be marked as baselined only after a zero-drift check. After the
  baseline, every schema change MUST ship as a migration. This is a decision for the owner and
  the schema owner (Fady), recorded in plan.md.
- **FR-033**: The upgrade command MUST: show a maintenance page, stop the application, take a
  backup that must succeed to continue, record the current release, apply pending migrations as
  the owner role, start the new release, and run the smoke test before reopening.
- **FR-034**: If a migration or the smoke test fails, the upgrade MUST roll back to the previous
  release and the pre-upgrade database, re-run the smoke test, and record the failure. No data
  written after the backup can exist, because the application is stopped for the whole window.
- **FR-035**: The automated smoke test MUST check readiness, that the sign-in page is served over
  HTTPS, that the application's database role can read orders, and that the database migration
  status is up to date. Before staff access reopens, the engineer MUST sign in as an Admin and
  open the orders list (no stored staff credential is kept on the server for testing).
- **FR-036**: Every upgrade MUST write an upgrade log entry (previous and new release fingerprint,
  backup id, migrations applied, smoke result, duration, outcome).

**Bootstrap & onboarding (US1)**

- **FR-037**: A one-time bootstrap command MUST create the first Admin/Owner with a username and a
  password of at least 12 characters, refuse when an active Admin/Owner exists, load only
  production reference data (roles and permissions, default departments, Cash Customer, customer
  classifications), and write an audit event. Development sample data and the development Admin
  MUST NOT be loadable in production.
- **FR-038**: A staff onboarding checklist MUST cover: installing the internal root certificate on
  the device, the bookmark, the Admin creating the user with roles and departments, handing over
  the initial password, and a first sign-in check.

**Offline operation (US6)**

- **FR-039**: The core system MUST need no internet connection at runtime: no internet sign-in
  provider, no externally hosted fonts, scripts or styles, and no outbound call on any core path.
- **FR-040**: An automated offline check MUST start the application with no route to the internet
  and confirm it becomes ready and serves its sign-in page. A manual offline lifecycle drill
  (US6) MUST be run before go-live with the internet unplugged at the router.

**Integration boundary (054, documentation only)**

- **FR-041**: The WhatsApp gateway (054) network boundary MUST be documented: the gateway is
  hosted outside the shop; the local server only ever opens outbound, authenticated, encrypted
  connections to it; the gateway never connects into the shop; and a gateway outage never blocks
  a core workflow. This feature does not host or build the gateway.

### Key Entities

- **Backup Health Record** (new, application data): one append-only record per backup run per
  destination, per weekly verification, or per health-check finding. It holds the run id, kind
  (backup, verification, health check), destination (USB, LAN PC, off-site, or none), outcome
  (succeeded, failed, missed, warning, critical), start and finish time, bytes added, restore
  point id, reason, disk free space, and when it was received.
- **Restore Point** (outside the application): one encrypted snapshot on one destination holding
  the database dump, record counts, file store and configuration.
- **Recovery Kit** (physical): the sealed printout holding the secrets needed to read the backups
  and the restore runbook.
- **Drill Log** (document): one entry per restore drill.
- **Upgrade Log** (server file): one entry per upgrade.
- **Notification Event** (existing, 002): receives backup and disk alerts.
- **Audit Event** (existing, 001): receives the bootstrap step and the receipt of each backup-health
  record.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the go-live restore drill and every quarterly drill, the system is usable on a
  clean machine from last night's backup in under 4 hours, with record counts matching exactly.
- **SC-002**: At any moment, each destination holds a restore point no older than 24 hours, or an
  Admin has been alerted about it.
- **SC-003**: A missed or failed backup is alerted to every Admin within 2 hours of the end of the
  backup window, and always before 08:00.
- **SC-004**: An external port scan of the shop's public address finds zero open ports leading to
  the server, and a LAN scan from a staff PC finds only HTTPS and the HTTP redirect.
- **SC-005**: With the internet unplugged, 100% of the steps of the full order lifecycle succeed
  on the first attempt.
- **SC-006**: 100% of weekly automated restore verifications either pass or raise an Admin alert.
- **SC-007**: Zero secrets appear in the repository, in any image, or in any log.
- **SC-008**: A failed upgrade returns the shop to the previous release with zero data loss in
  under 60 minutes.
- **SC-009**: A new staff device can be onboarded (certificate, bookmark, first sign-in) in under
  10 minutes.

## Assumptions

- The shop LAN has a router the owner controls (for the address reservation, the DNS fallback
  name, and turning off port forwarding and UPnP), and the second PC is on the same LAN and on at
  night (or wakes for the backup).
- The off-site provider is chosen by the owner at go-live; any S3-compatible provider works. The
  owner pays for it.
- 053 (internal notifications) delivers `NotificationEvent` rows. Until 053 is built, alerts are
  recorded in the outbox and shown on the Admin backup page (FR-030), which on its own satisfies
  the "missed backup triggers an Admin alert" acceptance criterion.
- 050's production file store stays on the local disk under the configured file-store path, with
  immutable, content-addressed objects and a separate temporary upload area.
- Features built by go-live determine the lifecycle steps of the offline drill (for example, if
  pricing (051) is built, pricing is part of the drill).
- The development and CI environments (including the remote development database) are unchanged
  by this feature, apart from the new CI checks.

## Open go-live items (owner)

1. Select and buy server hardware meeting at least the minimum specification (FR-001), a data
   disk, a UPS supported by the UPS monitor, and an external USB backup drive.
2. Choose the off-site S3-compatible provider and create the account and bucket.
3. Designate the second PC for LAN backups and the admin machine for remote administration.
4. Reserve the server's LAN address and add the `printex.lan` name on the router; confirm port
   forwarding and UPnP are off.
5. Receive, check and store the sealed recovery kit (two locations).
6. ~~Confirm the clarification assumptions~~ (done: all confirmed by owner 2026-09-24).
7. Sign off the go-live restore drill, offline drill, external port scan, and security review.
