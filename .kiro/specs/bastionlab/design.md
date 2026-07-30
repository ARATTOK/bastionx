# Software Design Description (SDD) — BastionLAB

## 1. System Overview & Architecture

BastionLAB is designed as a zero-build, ultra-lightweight Single Page Application (SPA) architecture built on top of HTML5, Alpine.js 3, Pico CSS v2, and Supabase UMD client libraries.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        BASTIONLAB FRONTEND SPA                          │
│                                                                         │
│  ┌────────────────┐   ┌────────────────┐   ┌─────────────────────────┐  │
│  │ dashboard.html │   │ server-detail.html │ admin.html / tags.html  │  │
│  └───────┬────────┘   └───────┬────────┘   └────────────┬────────────┘  │
│          │                    │                         │               │
│          └────────────────────┼─────────────────────────┘               │
│                               │                                         │
│                      ┌────────┴────────┐                                │
│                      │  js/pages/*.js  │ (Page Alpine Controllers)     │
│                      └────────┬────────┘                                │
│                               │                                         │
│                      ┌────────┴────────┐                                │
│                      │  js/core/*.js   │ (Utils, Supabase, Toast, Audit)│
│                      └────────┬────────┘                                │
└───────────────────────────────┼─────────────────────────────────────────┘
                                │ Supabase JS Client (UMD v2)
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           SUPABASE BACKEND                              │
│                                                                         │
│  ┌─────────────────────────┐           ┌─────────────────────────────┐  │
│  │  Supabase Auth Engine   │           │ PostgreSQL Database         │  │
│  │  (Email/Pass Sessions)  │           │ (unaadjavtrsogkzcbmev)      │  │
│  └─────────────────────────┘           └──────────────┬──────────────┘  │
│                                                       │                 │
│      ┌──────────────────┬──────────────────┬──────────┴────────┐        │
│      │ servers          │ server_creds     │ user_profiles     │        │
│      │ server_tasks     │ server_task_logs │ audit_logs        │        │
│      │ tags             │ server_tags      │                   │        │
│      └──────────────────┴──────────────────┴───────────────────┘        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure & File Organization

The project codebase is organized cleanly into modular subdirectories:

```
bastionx/
├── css/
│   └── style.css           # Glassmorphic dark design system & utilities
├── images/
│   ├── favicon.svg         # SVG favicon
│   ├── icon-180.png        # Apple touch icon
│   ├── icon-192.png        # PWA 192x192 icon
│   └── icon-512.png        # PWA 512x512 icon
├── js/
│   ├── core/               # Shared Infrastructure & Utilities
│   │   ├── supabase.js     # Supabase DB Client Init
│   │   ├── toast.js        # Alpine Toast Store
│   │   ├── utils.js        # Shared Utility & Validation Module (BastionUtils)
│   │   └── audit.js        # Audit Logger Helper
│   └── pages/              # Page Component Controllers
│       ├── login.js        # Login View Logic
│       ├── dashboard.js    # Main Dashboard Logic
│       ├── server-detail.js# Server Technical Sheet Logic
│       ├── add-server.js   # Add Server Form Logic
│       ├── edit-server.js  # Edit Server Form Logic
│       ├── admin.js        # Superadmin Control Panel Logic
│       ├── tags.js         # Tags Management Logic
│       ├── report.js       # Reports Generator Logic
│       └── labels.js       # Labels Print Logic
├── *.html                  # Root HTML views
├── manifest.json           # PWA Manifest
└── sw.js                   # Service Worker Cache (bastionx-v4)
```

---

## 3. Database Schema Design (PostgreSQL / Supabase)

### 3.1 Schema Definition
1. **`servers`**: Core inventory table.
   - `id` (uuid, PK): Server unique identifier.
   - `hostname` (text, non-null): Server hostname.
   - `ip` (text): Primary IP address.
   - `estado` (text): Status (`Normal`, `Mantenimiento`, `Crítico`).
   - `ubicacion` (text): Rack / Datacenter physical location.
   - `fabricante`, `modelo`, `numero_serie` (text): Hardware metadata.
   - `procesador`, `ram` (text): Compute specs.
   - `sistema_operativo` (text): Installed OS.
   - `discos` (jsonb): Array of disk objects `[{ raid: "RAID1", discos: [{ bay: 0, tipo: "SSD", tamano: "1TB" }] }]`.
   - `servicios` (jsonb): Array of service objects `[{ nombre: "PostgreSQL", puerto: "5432", ips: ["192.168.1.50"], usuario: "admin", password: "..." }]`.
   - `notas` (text): Free-text notes.
   - `created_at`, `updated_at` (timestamptz).

2. **`server_credentials`**: Bóveda Segura table.
   - `id` (uuid, PK), `server_id` (uuid, FK -> servers.id).
   - `ipmi` (text): IPMI IP address.
   - `ip_servicio` (text): Dedicated service IP address.
   - `usuario` (text): IPMI username.
   - `password` (text): Access password.

3. **`server_tasks`**: Preventive maintenance tasks.
   - `id` (uuid, PK), `server_id` (uuid, FK -> servers.id).
   - `titulo` (text), `descripcion` (text).
   - `criticidad` (text): `normal`, `configuracion`, `critica`.
   - `fecha_limite` (date): Maintenance deadline.
   - `completada` (boolean), `completed_at` (timestamptz).
   - `created_by` (uuid), `created_at` (timestamptz).

4. **`server_task_logs`**: Maintenance evidence log.
   - `id` (uuid, PK), `task_id` (uuid, FK -> server_tasks.id), `server_id` (uuid).
   - `accion` (text): `creada`, `completada`, `reabierta`.
   - `notas` (text): Evidence text/notes entered by technician.
   - `created_by` (uuid), `created_at` (timestamptz).

5. **`user_profiles`**: Application RBAC profile table.
   - `id` (uuid, PK, references auth.users.id).
   - `email` (text): User email.
   - `role` (text): `superadmin`, `admin`, `readonly`.
   - `created_at` (timestamptz).

6. **`audit_logs`**: System audit trail.
   - `id` (uuid, PK), `server_id` (uuid, nullable), `user_id` (uuid).
   - `accion` (text): Event code (e.g. `server.creada`, `credential.revealed`, `user.created`).
   - `cambios` (jsonb): JSON payload of mutated attributes.
   - `descripcion` (text): Human-readable event explanation.
   - `created_at` (timestamptz).

---

## 4. UI/UX Design System & Form UX Overhaul

1. **Glassmorphism Dark Palette**:
   - Background: `#0f0f15`, Glass panels: `rgba(255,255,255,0.03)` with `backdrop-filter: blur(12px)`.
   - Accent colors: Primary Violet `#6c5ce7`, Success Green `#2ecc71`, Warning Amber `#f39c12`, Danger Red `#e74c3c`.

2. **Form Section Navigation & Sticky Footer**:
   - **Section Nav (`.form-section-nav`):** Section jump pills anchored by smooth scrolling (`scrollIntoView({ behavior: 'smooth' })`).
   - **Sticky Action Footer (`.sticky-form-footer`):** Glassmorphic footer floating at screen bottom containing live validation status badges (`✓ Campos válidos` or `⚠️ N error(es) detectado(s)`).
   - **Live Field Validation (`.is-valid` / `.is-invalid`):** Dynamic feedback powered by `BastionUtils.isValidIPv4` and `BastionUtils.isValidPort`.

3. **Unified Tab Filter Bar (`.tab-filter-bar`)**:
   - Enforces uniform height `height: 34px !important`, zero margins, `display: inline-flex; align-items: center;`.
   - Inputs and select dropdowns styled consistently across `Servicios` and `Redes` tabs.

4. **Password Security UX Policy**:
   - Plain text passwords are **NEVER rendered in raw HTML** for non-revealing actions.
   - Password elements render fixed dots `••••••••`.
   - On click, `BastionUtils.copyToClipboard(...)` fires silently and presents a Toast: "Contraseña copiada al portapapeles".

---

## 5. Architectural Improvements & Technical Debt Resolution

- **[COMPLETED] Frontend Code Deduplication (`js/core/utils.js`)**:
  - Extracted `copyToClipboard`, `formatDate`, `taskSeverityClass`, `getCountdownText`, `getCountdownClass`, `isValidIPv4`, and `isValidPort` into a single module `window.BastionUtils`.
- **[COMPLETED] Modular Code Organization**:
  - Reorganized `js/` into `js/core/` and `js/pages/`. Deleted obsolete root JS duplicates.
- **[COMPLETED] Asset Organization**:
  - Moved icons to `images/`, updated `manifest.json`, HTML heads, and `sw.js` (v4).
- **[COMPLETED] Form UX & Validation**:
  - Added section navigation, sticky footer, and live input validation feedback.

---

## 6. Future Development Phases & Roadmap

```
  Phase 1-5 (COMPLETED)           Phase 6 (NEAR-TERM)            Phase 7 (MID-TERM)            Phase 8 (LONG-TERM)
┌───────────────────────┐      ┌─────────────────────┐       ┌──────────────────────┐      ┌───────────────────────┐
│ - Core Inventory CRUD │      │ - ICMP / TCP Health │       │ - Supabase Vault AES │      │ - REST CI/CD API      │
│ - Service Catalog     │ ────►│   Probing Daemon    │ ─────►│   Credential Encryption────►│ - Backup / Restore    │
│ - Network Subnets Tab │      │ - Auto Server State │       │ - Hardware Lifecycle │      │   Snapshot Import     │
│ - Preventive Tasks    │      │   Status Updates    │       │   Depreciation Model │      │ - Mobile PWA Offline  │
│ - RBAC & Admin Panel  │      │ - Email / Slack Alert       │                      │      │   Cache Mode          │
└───────────────────────┘      └─────────────────────┘       └──────────────────────┘      └───────────────────────┘
```

1. **Phase 6: Infrastructure Health & Telemetry Probing**:
   - Automated periodic ping / port checks for registered IPs.
   - Dynamic alert dispatching to Slack / Webhooks on server downtime.

2. **Phase 7: Advanced Vault Encryption & Asset Lifecycle**:
   - AES-256 password vault encryption at rest.
   - Hardware warranty tracking and lifecycle depreciation metrics.

3. **Phase 8: REST Integration & Automated Inventory Backup**:
   - CI/CD automated server registration via REST endpoints.
   - Full database JSON/CSV import/export migration wizard.
   - Service Worker offline PWA caching for lab technicians.
