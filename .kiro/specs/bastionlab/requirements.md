# Software Requirements Specification (SRS) — BastionLAB

## System Purpose & Scope
BastionLAB is an agile, zero-build infrastructure inventory, credentials, network subnets, and preventive maintenance management system designed for physical and virtual lab environments. This document outlines the formal requirements (EARS format) covering implemented capabilities (Phases 1-5), recent architecture refactoring & form validation enhancements, and upcoming roadmap features (Phases 6-8).

---

### Requirement 1: Authentication & Role-Based Access Control (RBAC)

#### 1.1 Authentication & Session Management
- **WHEN** a user provides valid Supabase credentials on `login.html`, the system **SHALL** authenticate the session, retrieve user profile metadata, and redirect to `dashboard.html`.
- **WHEN** an unauthenticated session attempts to access protected routes (`dashboard.html`, `server-detail.html`, `admin.html`, `add-server.html`, `edit-server.html`), the system **SHALL** immediately redirect to `login.html`.

#### 1.2 User Profile Auto-Provisioning & RBAC Hierarchy
- **WHEN** a user logs in for the first time without an entry in `user_profiles`, the system **SHALL** automatically provision a profile row with default role `superadmin` to prevent lockout.
- **WHILE** logged in with role `readonly`, the system **SHALL** restrict mutations (create/edit/delete servers, tasks, tags, users) and hide sensitive credential fields.
- **WHILE** logged in with role `admin` or `superadmin`, the system **SHALL** allow full server, service credential, task management, and mutation audit logging.
- **WHILE** logged in with role `superadmin`, the system **SHALL** grant exclusive access to `admin.html` for user creation, role assignment, password resets, and user deletion.

---

### Requirement 2: Server Inventory & Hardware Asset Tracking

#### 2.1 Server Asset Lifecycle & Section Navigation
- **WHEN** a user accesses `add-server.html` or `edit-server.html`, the system **SHALL** render sticky section navigation pills (`.form-section-nav`) allowing smooth jump scrolling to `#sec-general`, `#sec-tags`, `#sec-disks`, `#sec-services`, and `#sec-creds`.
- **WHEN** a user submits server forms, the system **SHALL** validate hostname, IP address, state (`Normal`, `Mantenimiento`, `Crítico`), hardware attributes (CPU, RAM, Disks RAID array, Location, Manufacturer, Model, Serial, OS), and record changes in `audit_logs`.
- **WHEN** displaying servers on `dashboard.html`, the system **SHALL** render card grids with status dots, hardware summaries, disk bay lists, tag badges, and interactive search/filter controls.

#### 2.2 Live Form Validation & Sticky Action Footer
- **WHILE** editing inputs on forms (`add-server.html`, `edit-server.html`, `login.html`, `admin.html`, `server-detail.html`), the system **SHALL** apply real-time `.is-valid` or `.is-invalid` CSS feedback classes based on `BastionUtils.isValidIPv4` and `BastionUtils.isValidPort`.
- **WHILE** viewing server forms, the system **SHALL** render a glassmorphic sticky footer (`.sticky-form-footer`) displaying a dynamic validation status badge (`✓ Campos válidos` or `⚠️ N error(es) detectado(s)`) and action buttons.

#### 2.3 Server Ficha Técnica & Quick View
- **WHEN** clicking a server card on `dashboard.html`, the system **SHALL** display the Quick View Modal with hardware capacity, service list, and quick detail navigation.
- **WHEN** navigating to `server-detail.html?id=<ID>`, the system **SHALL** fetch complete technical details, hardware configurations, assigned tags, task history, and bitácora trail.

---

### Requirement 3: Multi-Service Catalog & Direct IP:Port Access

#### 3.1 Service Catalog Registration
- **WHEN** defining services in server forms, the system **SHALL** allow storing Service Name, Port, IP array, Description, and optional Service Credentials (User & Password).

#### 3.2 Direct IP:Port Redirection & Password Masking
- **WHEN** displaying services on `dashboard.html` (Servicios Tab) or `server-detail.html`, the system **SHALL** generate direct launch links formatted as `https://<IP>:<PORT>` opening in a new browser tab.
- **WHEN** rendering service or server passwords, the system **SHALL** mask the string visually as `••••••••`.
- **WHEN** a user clicks on the masked password string `••••••••` or its copy badge, the system **SHALL** copy the plain text password to the clipboard via `BastionUtils.copyToClipboard`, issue a success Toast notification ("Contraseña copiada al portapapeles"), and **SHALL NEVER** reveal plain text on the UI.

---

### Requirement 4: Network Subnet Mapping & Interactive Column Filters

#### 4.1 IP Infrastructure Aggregation
- **WHEN** accessing the Redes Tab on `dashboard.html`, the system **SHALL** extract all IPMI IPs, Service IPs, and Service-specific IPs, grouping them into `/24` subnets (e.g. `192.168.1.0/24`).

#### 4.2 Interactive Column Filtering
- **WHEN** typing or selecting options in the `.tab-filter-bar` on Redes or Servicios tabs, the system **SHALL** perform real-time client-side filtering by IP substring, Type (IPMI, Servicio, Custom), Hostname, Status (`Activo`, `Mantenimiento`, `Inactivo`), or Service Port.
- **WHEN** filters are active, the system **SHALL** display the "Limpiar filtros" button and update filtered counts in real time.

---

### Requirement 5: Modular Code Architecture & Shared Utilities

#### 5.1 Shared Utility Module (`BastionUtils`)
- **WHEN** performing data formatting, clipboard actions, Toast dispatching, or IPv4/Port validation across Alpine components, the system **SHALL** delegate operations to the unified `window.BastionUtils` module in `js/core/utils.js`.

#### 5.2 Folder Organization (`js/core/` and `js/pages/`)
- **WHEN** loading frontend JavaScript assets, the system **SHALL** import core infrastructure scripts from `js/core/` (`supabase.js`, `toast.js`, `utils.js`, `audit.js`) and page controllers from `js/pages/` (`login.js`, `dashboard.js`, `server-detail.js`, `add-server.js`, `edit-server.js`, `admin.js`, `tags.js`, `report.js`, `labels.js`).

#### 5.3 Asset Management & Offline PWA Service Worker
- **WHEN** loading brand assets and icons, the system **SHALL** fetch images from `images/` (`favicon.svg`, `icon-180.png`, `icon-192.png`, `icon-512.png`).
- **WHEN** operating offline, the system **SHALL** serve cached application assets via the Service Worker (`sw.js` version `bastionx-v4`).

---

### Requirement 6: Preventive Maintenance & Task Countdown Module

#### 6.1 Maintenance Scheduling Modal
- **WHEN** an authorized user clicks "+ Agendar Tarea / Mantenimiento" on `server-detail.html`, the system **SHALL** display the pop-up modal (`showAddTaskModal`) with inputs for Title, Description, Priority (`Normal`, `Configuración`, `Crítica`), and a dark-themed datepicker (`input[type="date"]`).

#### 6.2 Dynamic Countdown Pills & Alert Banner
- **WHILE** a task has a target date (`fecha_limite`) and is uncompleted, the system **SHALL** calculate remaining days via `BastionUtils.getCountdownText` and render dynamic pills:
  - `En X días` (`.cd-upcoming`) when remaining days > 3.
  - `Mañana` or `Hoy` (`.cd-urgent`) when remaining days <= 3.
  - `Vencido (Xd)` (`.cd-overdue`) when remaining days < 0.
- **WHILE** urgent or overdue tasks exist across all servers, `dashboard.html` **SHALL** display the global `.maint-alert-bar` banner listing active alerts.

#### 6.3 Task Execution & Evidence Logging
- **WHEN** completing a task, the system **SHALL** prompt for completion evidence/notes in `showCompleteModal`, store `completed_at`, update task state, and record an audit log entry in `server_task_logs`.

---

### Requirement 7: Superadmin User Administration & Audit Trail

#### 7.1 User Provisioning & Password Management
- **WHEN** a Superadmin opens `admin.html`, the system **SHALL** load user statistics, user profile table, and global audit log entries.
- **WHEN** creating a new user via `showCreateUserModal`, the system **SHALL** execute `sb.auth.signUp`, insert `user_profiles` with specified role, and log `user.created`.
- **WHEN** resetting a password via `showResetPasswordModal`, the system **SHALL** process the password update and log `user.password_reset`.

#### 7.2 Protected User Deletion
- **WHEN** attempting to delete a user via `showDeleteUserModal`, the system **SHALL** restrict deletion if `target.id === active_user.id` (preventing Superadmin self-deletion lock), remove `user_profiles` row upon confirmation, and log `user.deleted`.

---

### Requirement 8: Future Phase — Automated Infrastructure Telemetry (Phase 6)

#### 8.1 Active Status Probing
- **WHERE** an automated telemetry daemon or Supabase Edge Function is enabled, the system **SHALL** periodically execute ICMP / TCP port health checks against server IPMI & Service IPs and update server status (`Normal`, `Crítico`) automatically.

---

### Requirement 9: Future Phase — Encrypted Vault & Service Key Store (Phase 7)

#### 9.1 Encryption at Rest for Sensitive Passwords
- **WHERE** credentials are stored in database columns or JSONB (`server_credentials`, `servicios`), the system **SHALL** encrypt sensitive values using AES-256-GCM / Supabase Vault prior to database write, decrypting only in-memory during authorized user requests.

---

### Requirement 10: Future Phase — REST API & Automated Inventory Backup (Phase 8)

#### 10.1 REST Integration Endpoint & JSON/CSV Snapshot
- **WHEN** invoked by external CI/CD pipelines or backup scripts, the system **SHALL** provide authenticated REST API endpoints to register servers programmatically and export full database state snapshots in JSON and CSV formats.
