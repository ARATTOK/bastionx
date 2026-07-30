# Implementation Tasks Plan — BastionLAB

## Completed Tasks (Phases 1 - 5 + Architectural Refactoring)

- [x] **Task 1: Core Database & Authentication Setup (Phase 1)**
  - Initialize Supabase client (`js/core/supabase.js`) and database schema (`servers`, `server_credentials`, `tags`, `server_tags`, `user_profiles`, `audit_logs`).
  - Build `login.html` and `js/pages/login.js` with password visibility toggle and session persistence.
  - Implement RBAC hierarchy (`superadmin`, `admin`, `readonly`) and profile auto-provisioning in `dashboard.js` and `admin.js`.

- [x] **Task 2: Dashboard & Asset Grid (Phase 2)**
  - Build `dashboard.html` with glassmorphic styling (`style.css`), topbar stats grid, and state indicators (`Normal`, `Mantenimiento`, `Crítico`).
  - Add search input (`.search-compact`), state filters, and quick view modal (`quickServerItem`).

- [x] **Task 3: Server Asset Forms & Audit Trail (Phase 3)**
  - Implement `add-server.html` and `edit-server.html` with dynamic JSONB disk builder and service configuration blocks.
  - Integrate global `auditLog()` trigger on server creation, editing, and deletion.

- [x] **Task 4: View Tabs Overhaul — Servicios & Redes (Phase 4)**
  - Implement Servicios Tab in `dashboard.html` with grouped service cards, `https://IP:PORT` external launch buttons, and masked passwords (`••••••••`) with click-to-copy.
  - Implement Redes Tab in `dashboard.html` with `/24` subnet grouping, IP copy buttons, and CSV export.
  - Build standardized `.tab-filter-bar` CSS rules ensuring vertical alignment across inputs, selects, and clear buttons.

- [x] **Task 5: Preventive Maintenance & Admin User Operations (Phase 5)**
  - Build preventive maintenance task module on `server-detail.html` with `showAddTaskModal` pop-up and custom dark datepicker (`input[type="date"]`).
  - Add dynamic countdown pills (`.cd-upcoming`, `.cd-urgent`, `.cd-overdue`) and global `.maint-alert-bar` banner on `dashboard.html`.
  - Build `admin.html` with user creation modal (`showCreateUserModal`), password reset modal (`showResetPasswordModal`), protected user deletion modal (`showDeleteUserModal`), and audit trail log viewer.

- [x] **Task 6: Clean Code Utility Module (`BastionUtils`)**
  - Created `js/core/utils.js` encapsulating `copyToClipboard`, `showToast`, `isValidIPv4`, `isValidPort`, `formatDate`, `taskSeverityClass`, `getCountdownText`, and `getCountdownClass`.
  - Refactored Alpine components to delegate helpers to `BastionUtils`.

- [x] **Task 7: Form UX & Live Field Validation**
  - Added section navigation pills (`.form-section-nav`) with smooth jump scrolling.
  - Added glassmorphic floating action footer (`.sticky-form-footer`) with live validation status badges (`✓ Campos válidos` or `⚠️ N error(es) detectado(s)`).
  - Added `.is-valid` / `.is-invalid` visual feedback site-wide.

- [x] **Task 8: Code & Asset Directory Reorganization**
  - Modularized JavaScript into `js/core/` and `js/pages/`. Deleted obsolete root JS duplicate files.
  - Moved icon assets (`favicon.svg`, `icon-180.png`, `icon-192.png`, `icon-512.png`) into `images/`.
  - Updated HTML script tags, `manifest.json`, and Service Worker (`sw.js` v4) cache paths.

---

## Roadmap Implementation Tasks (Phases 6 - 8)

### Phase 6: Automated Telemetry & Active Status Probing
- [ ] **Task 9.1: Supabase Edge Function for ICMP / TCP Probing**
  - Create Supabase Edge Function `ping-prober` to execute periodic TCP/HTTP ping against IPMI and Service IPs.
  - Update `servers.estado` automatically to `Crítico` if a server is unreachable for 3 consecutive checks.
- [ ] **Task 9.2: Webhook Alert Notifications**
  - Integrate Slack / Discord / Email Webhook dispatching when server state transitions to `Crítico`.

### Phase 7: Advanced Credential Encryption & Hardware Lifecycle
- [ ] **Task 10.1: Supabase Vault / pgcrypto AES Encryption**
  - Implement column encryption at rest for `server_credentials.password` and `servicios.password` using PostgreSQL `pgcrypto`.
- [ ] **Task 10.2: Hardware Lifecycle & Depreciation Model**
  - Add acquisition date, warranty expiration date, and automated hardware depreciation metric indicators.

### Phase 8: REST Integration & Automated Inventory Backup
- [ ] **Task 11.1: CI/CD REST Integration API**
  - Build REST API endpoint for automated server registration from Terraform / Ansible / CI pipelines.
- [ ] **Task 11.2: Inventory Backup & Restore Import Wizard**
  - Build UI snapshot wizard to import and restore JSON/CSV database snapshots.
