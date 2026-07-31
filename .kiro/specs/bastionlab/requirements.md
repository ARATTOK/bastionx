# Software Requirements Specification (SRS) — BastionLAB

## System Purpose & Scope
BastionLAB is an agile, zero-build infrastructure inventory, credentials, network subnets, and preventive maintenance management system designed for physical and virtual lab environments. This document outlines the formal requirements (EARS format) covering implemented capabilities (Phases 1-5), minimalist Control Hub landing, dedicated module pages, granular RBAC access controls, external IPMI/Service launches in new browser tabs (`target="_blank"`), and advanced filtering capabilities (v1.7.0).

---

### Requirement 1: Authentication & Role-Based Access Control (RBAC)

#### 1.1 Authentication & Session Management
- **WHEN** a user provides valid Supabase credentials on `login.html`, the system **SHALL** authenticate the session, retrieve user profile metadata, and redirect to `dashboard.html`.
- **WHEN** an unauthenticated session attempts to access protected routes (`dashboard.html`, `servers.html`, `services.html`, `networks.html`, `infrastructure.html`, `server-detail.html`, `admin.html`, `add-server.html`, `edit-server.html`), the system **SHALL** immediately redirect to `login.html`.

#### 1.2 User Profile Auto-Provisioning & RBAC Hierarchy
- **WHEN** a user logs in for the first time without an entry in `user_profiles`, the system **SHALL** automatically provision a profile row with default role `superadmin` to prevent lockout.
- **WHILE** logged in with role `readonly`, the system **SHALL** restrict mutations (create/edit/delete servers, tasks, tags, users) and hide sensitive credential fields.
- **WHILE** logged in with role `admin` or `superadmin`, the system **SHALL** allow full server, service credential, task management, and mutation audit logging.
- **WHILE** logged in with role `superadmin`, the system **SHALL** grant exclusive access to `admin.html` for user creation, role assignment, password resets, user deletion, and granular RBAC permissions configuration.

---

### Requirement 2: Clean Minimalist Control Hub & Dedicated Module Pages

#### 2.1 Minimalist Control Hub Landing (`dashboard.html`)
- **WHEN** an authenticated user lands on `dashboard.html`, the system **SHALL** render a clean Control Hub displaying the Hardware Infrastructure Capacity Summary (RAM, CPU GHz, Storage TB, Registered Nodes) and 4 main module launch cards (**Servidores**, **Servicios**, **Redes**, **Infraestructura**).
- **WHEN** a user clicks on any KPI counter card in `dashboard.html`, the system **SHALL** navigate directly to the corresponding module page (`servers.html`, `services.html`, `networks.html`, `infrastructure.html`).

#### 2.2 Dedicated Module Pages & Advanced Filtering
- **WHEN** a user navigates to `servers.html`, the system **SHALL** provide search filtering, status filtering, location filtering, and view mode toggle (Bento Grid vs Minimalist Table).
- **WHEN** a user navigates to `services.html`, the system **SHALL** categorize services by type (Database, Web, Cache, Infrastructure) and provide direct launch buttons formatted as `https://<IP>:<PORT>` with `target="_blank"`.
- **WHEN** a user navigates to `networks.html`, the system **SHALL** group IPs by subnet `/24`, provide IP type filters (`IPMI Gestor`, `Servicio`, `IP Principal`), CSV export button, and direct IPMI console launch buttons formatted as `https://<IPMI_IP>` with `target="_blank"`.

---

### Requirement 3: Multi-Service Catalog & Direct IP:Port Access

#### 3.1 Service Catalog Registration & Presets
- **WHEN** defining services in `add-server.html` or `edit-server.html`, the system **SHALL** provide 1-click service presets (PostgreSQL 5432, Redis 6379, Nginx 80/443, SSH 22) to accelerate data entry.

#### 3.2 External Redirection in New Browser Tabs (`target="_blank"`)
- **WHEN** an authorized user clicks a Service Launch button (`https://<IP>:<PORT>`) or an IPMI Web Console Launch button (`https://<IPMI_IP>`), the system **SHALL** initiate redirection with `target="_blank"` and rel `noopener noreferrer` to open the target interface in a new browser tab without destroying the active BastionLAB session.

---

#### 4.1 Strict Iconify Requirement (Zero Emojis)
- **WHEN** rendering visual indicators, action badges, navigation buttons, and status icons across all application views, the system **SHALL** render `<iconify-icon>` web components exclusively and **SHALL NEVER** include raw Unicode emoji characters.

---

### Requirement 5: Role Simulator Dropdown (Superadmin — `dashboard.html`)

#### 5.1 Custom Alpine.js Dropdown Component
- **WHILE** logged in as `superadmin` on `dashboard.html`, the system **SHALL** render a custom role-simulator pill/trigger button (NOT a native `<select>`) displaying the currently active simulated role or "Superadmin" if no simulation is active.
- **WHEN** the superadmin clicks the role-simulator trigger, the system **SHALL** reveal a floating dropdown panel (`position: absolute`, `border-radius: 12px`, `backdrop-filter: blur(12px)`, `box-shadow: 0 8px 32px rgba(0,0,0,0.5)`) containing options for **Superadmin (Real)**, **Admin**, and **Readonly** roles.
- **WHEN** a role option is selected, the system **SHALL** close the dropdown, update the active simulated role in the trigger label, and call `simulateRole()` to persist the simulated view.
- **WHEN** clicking outside the dropdown panel, the system **SHALL** close the panel (Alpine `@click.outside`).
- **WHEN** pressing `Escape`, the system **SHALL** close the panel (Alpine `@keydown.escape.window`).

#### 5.2 Role Option Appearance
- **WHEN** rendering each role option inside the dropdown, the system **SHALL** display:
  - A colored dot to the left (superadmin=`#6c5ce7`, admin=`#2ecc71`, readonly=`#aaa`).
  - The role name in bold (`font-weight: 700`).
  - A short description in `color: #666`, `font-size: 0.62rem`.
  - A `lucide:check` icon on the right **only** when the option is currently selected.
- **WHEN** hovering over any option, the system **SHALL** apply `background: rgba(255,255,255,0.04)` highlight.

#### 5.3 Simulation Active Banner
- **WHILE** a simulation role is active, the system **SHALL** display a sticky 28px-height banner at the top of `dashboard.html` with `background: rgba(243,156,18,0.15)` and a `lucide:eye` icon animating with a CSS opacity pulse (`animation: 1s ease-in-out infinite`).
- The banner **SHALL** include a "Restablecer" button to exit simulation mode without reloading the page.

---

### Requirement 6: Dashboard KPI Cards with Progress Bars

#### 6.1 KPI Card Accessibility and Navigation
- **WHEN** rendered, each KPI card **SHALL** include `role="link"`, `tabindex="0"`, and `aria-label` attributes so keyboard users can navigate and activate them.
- **WHEN** a user presses Enter on a KPI card, the system **SHALL** navigate to the corresponding module page.

#### 6.2 Visual Progress Bars
- **WHEN** rendering each KPI card, the system **SHALL** display a 3px-height accent-colored progress bar at the bottom of the card, with `width` bound to a computed percentage derived from the KPI value (capped at 100%) to provide a visual sense of scale.
- **WHEN** a KPI value is zero, the system **SHALL** still render the bar at 0% width (no data state).

#### 6.3 Dynamic Border Accent
- **WHEN** a KPI card has a non-zero value, the system **SHALL** apply a colored border accent (`border-color: rgba(<color>, 0.3)`) matching the KPI's accent color to visually distinguish populated data from empty slots.

---

### Requirement 7: Dashboard Visual Hierarchy — KPI Row vs Module Row

#### 7.1 KPI Summary Row (Compact / Supporting)
- The KPI counter row **SHALL** use compact cards (`padding: 0.75rem`, `border-radius: 10px`) with a 28×28px icon, a `1.1rem` number, and a `0.58rem` uppercase label so it reads as a **data summary**, not a primary navigation element.
- The KPI grid **SHALL** use `grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))` to pack more counters in a single row.
- Progress bars in KPI cards **SHALL** be `2px` in height to remain subtle and non-distracting.

#### 7.2 Module Navigation Row (Protagonist)
- The module card row **SHALL** use larger cards (`padding: 1.6rem 1.4rem`, `border-radius: 18px`) with a 60×60px icon and `font-size: 1.75rem` to establish clear visual dominance.
- Module card `h3` **SHALL** be `1.2rem` with `font-weight: 800`.
- Module cards **SHALL** animate with `transition: border-color 0.2s` on hover and receive a colored border matching the module's accent color via `onmouseenter` / `onmouseleave`.

#### 7.3 Section Divider Label
- Between the KPI row and the module row, the system **SHALL** render a `.hub-section-divider` element: an `iconify-icon` + text label (`Módulos`) with `font-size: 0.6rem`, `color: #555`, `letter-spacing: 0.1em`, followed by a full-width `1px solid rgba(255,255,255,0.05)` line, created via a CSS `::after` pseudo-element.

#### 7.4 Service Worker Cache Invalidation
- **WHEN** layout or CSS changes are deployed, the Service Worker cache version constant in `sw.js` **SHALL** be incremented (e.g., `bastionx-v7`) so existing clients receive updated assets upon next visit.

---

### Requirement 8: Breadcrumb Navigation Tracking

#### 8.1 Structure and Styling
- The system **SHALL** render a persistent `.bx-breadcrumb` bar located below the topbar and before main content across detail and edit pages.
- The breadcrumb bar **SHALL** have a maximum height of `32px`, `background: rgba(255,255,255,0.025)`, `border-bottom: 1px solid rgba(255,255,255,0.05)`, and `padding: 0 1.5rem`.
- Segment links and text **SHALL** use `font-size: 0.68rem` and `color: #555`.
- The active current page segment **SHALL** use `color: #ccc`, `font-weight: 600`, and be rendered as `<span aria-current="page">`.
- Separators between segments **SHALL** use `<iconify-icon icon="lucide:chevron-right">` with `width/height: 10px` and `color: #333`.

#### 8.2 Dynamic Data & Session History
- The server hostname segment **SHALL** dynamically react to Alpine form state (`form.hostname || server.hostname`).
- Navigation history **SHALL** read from `sessionStorage` key `"bastion_nav_history"` if present, or fallback to standard hierarchical trail: `Dashboard → Servidores → [hostname] → Editar`.

---

### Requirement 9: Server Status Visual Segmented Selector

#### 9.1 Segmented Pill Control
- **WHEN** editing a server's operational status on `edit-server.html`, the system **SHALL** replace native `<select>` dropdowns with a visual segmented pill group (`.status-pill-group`, `role="radiogroup"`).
- Each status option **SHALL** be rendered as a button (`.status-pill`) containing an `<iconify-icon>`, status name (`.sp-name`), and short operational description (`.sp-desc`).

#### 9.2 Status Color Tokens and Micro-animations
- The status options **SHALL** enforce the following visual tokens:
  - **Activo**: `lucide:check-circle`, `#2ecc71`, "En producción, operativo"
  - **Mantenimiento**: `lucide:wrench`, `#f39c12`, "Fuera de línea planeado"
  - **Inactivo**: `lucide:pause-circle`, `#aaa`, "Detenido, sin tráfico"
  - **Falla**: `lucide:alert-octagon`, `#e74c3c`, "Requiere atención urgente"
  - **Retirado**: `lucide:archive`, `#636e72`, "Dado de baja definitiva"
- **WHEN** a status pill is selected (`.status-pill.active`), the system **SHALL** trigger a tactile scale micro-animation (`scale 1 → 1.04 → 1`, 150ms duration) and apply a 2px colored glow/border matching the state token color.
- Below the pill group, the system **SHALL** display a dynamic context hint (`.status-pill-hint`) with `lucide:info` icon explaining the real-world operational consequence of the chosen state.

---

### Requirement 10: Global Breadcrumb Navigation Component
- The system **SHALL** render the `.bx-breadcrumb` bar across all application pages (`dashboard.html`, `servers.html`, `admin.html`, `networks.html`, `infrastructure.html`, `server-detail.html`, `edit-server.html`, `add-server.html`, `services.html`, `tags.html`, `report.html`, `labels.html`) located below the topbar and before main content.
- Segment links and text **SHALL** use `font-size: 0.68rem` and `color: #555`. The current page segment **SHALL** use `color: #ccc`, `font-weight: 600`, and `<span aria-current="page">`. Separators **SHALL** use `<iconify-icon icon="lucide:chevron-right">` with `width/height: 10px` and `color: #333`.

---

### Requirement 11: Dashboard Layout Refinements & Glassmorphic Admin Button
- **WHEN** rendering `.hub-kpi-grid` on `dashboard.html`, the system **SHALL** enforce `grid-template-columns: repeat(auto-fit, minmax(130px, 1fr))` for fluid horizontal distribution across viewport widths.
- **WHEN** rendered, the Admin button (`.admin-link-btn`) **SHALL** feature a glassmorphism style (`background: rgba(108, 92, 247, 0.12)`, `border: 1px solid rgba(108, 92, 247, 0.3)`, `color: #a29bfe`, `border-radius: 8px`), an icon `<iconify-icon icon="lucide:shield-check">`, and a glowing LED indicator (`.admin-led`, `4px × 4px`, `#6c5ce7`, box-shadow).

---

### Requirement 12: Servers Inventory View — Segmented Control, SSH User & Dynamic Filters
- **WHEN** switching views on `servers.html`, the system **SHALL** render a custom segmented control (`background: rgba(255,255,255,0.03)`, `border-radius: 8px`, `padding: 2px`) eliminating default PicoCSS button styling.
- **WHEN** rendering server cards and table rows, the system **SHALL** display the SSH auth user (`lucide:user` icon) alongside Hostname, IP, and Port.
- **WHEN**Superadmin creates or deletes service types in `admin.html`, the system **SHALL** persist tags and dynamically update filter pills in `servers.html`.

---

### Requirement 13: Subnet Management, IP Auto-Assignment & Duplicate Validation
- **WHEN** Superadmin manages subnets in `admin.html`, the system **SHALL** persist CIDRs and VLANs to populate interface selection dropdowns in `edit-server.html`.
- **WHEN** the user clicks "Autoasignar IP disponible" (`lucide:wand-2`) in `edit-server.html`, the system **SHALL** calculate the first unallocated IP within the selected CIDR range and populate the input field.
- **WHEN** an IP entered manually is already assigned to another server or service within the subnet, the system **SHALL** highlight the field in red, render a warning banner (`lucide:alert-triangle`), and prevent form submission.

---

### Requirement 14: Interactive Server Rack Diagram in Infrastructure View
- **WHEN** rendering `infrastructure.html`, the system **SHALL** generate an interactive 42U Server Rack diagram simulating physical U1-U42 positioning.
- **WHEN** hovering over an occupied rack unit, the system **SHALL** display a tooltip with Hostname, Model, Status, and IP address.
- **WHEN** clicking an occupied rack unit, the system **SHALL** navigate directly to `server-detail.html?id=[id]`.

---

### Requirement 15: Modular Administration Architecture & Dedicated Management Pages
- **WHEN** Superadmin accesses `admin.html`, the system **SHALL** render a **Central Administration Hub** displaying glassmorphism cards for module selection (`admin-users.html`, `admin-services.html`, `admin-subnets.html`, `admin-audit.html`) along with global summary stats.
- **WHEN** navigating to dedicated administration subpages, each view **SHALL** enforce persistent breadcrumb navigation matching the exact flow:
  - `admin-users.html`: `Dashboard → Administrador → Usuarios & RBAC`
  - `admin-services.html`: `Dashboard → Administrador → Tipos de Servicio`
  - `admin-subnets.html`: `Dashboard → Administrador → Subredes & VLANs`
  - `admin-audit.html`: `Dashboard → Administrador → Logs de Auditoría`
- All subpages **SHALL** maintain dark-glass minimal aesthetics (`--glass-bg`, `--glass-border`, `#6c5ce7` accent), strict iconify `<iconify-icon>` usage, zero emojis, and separate JS controller isolation in `js/pages/`.

