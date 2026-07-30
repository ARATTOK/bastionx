# Software Design Description (SDD) — BastionLAB

## 1. System Overview & Architecture

BastionLAB is designed as a zero-build, ultra-lightweight Single Page Application (SPA) architecture built on top of HTML5, Alpine.js 3, Pico CSS v2, and Supabase UMD client libraries.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        BASTIONLAB FRONTEND SPA                          │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     dashboard.html (Control Hub)                  │  │
│  │   ┌─────────────┐  ┌─────────────┐  ┌───────────┐  ┌───────────┐  │  │
│  │   │ Servidores  │  │  Servicios  │  │   Redes   │  │   Infra   │  │  │
│  │   └──────┬──────┘  └──────┬──────┘  └─────┬─────┘  └─────┬─────┘  │  │
│  └──────────┼────────────────┼───────────────┼──────────────┼────────┘  │
│             │                │               │              │           │
│             └────────────────┼───────────────┴──────────────┘           │
│                              │                                          │
│                     ┌────────┴────────┐                                 │
│                     │  js/pages/*.js  │ (Page Alpine Controllers)      │
│                     └────────┬────────┘                                 │
│                              │                                          │
│                     ┌────────┴────────┐                                 │
│                     │  js/core/*.js   │ (Utils, Supabase, Toast, Audit) │
│                     └────────┬────────┘                                 │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │ Supabase JS Client (UMD v2)
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           SUPABASE BACKEND                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Granular RBAC Permissions & Admin Management Architecture

### 2.1 Role Access Matrix
- **`superadmin`**: Acceso total irrestricto a todos los módulos + administración exclusiva de usuarios, reseteos de claves, auditoría global y módulo de gestión de permisos granulares (`admin.html`) y etiquetas (`tags.html`).
- **`admin`**: Acceso a Servidores, Servicios, Redes e Infraestructura. Consulta y copiado de contraseñas de servicios/servidores (con registro automático en `audit_logs`).
- **`readonly`**: Acceso de consulta a los 4 módulos. Bloqueo estricto de botones de mutación (crear/editar/eliminar) y enmascaramiento visual de contraseñas (`••••••••`) sin posibilidad de copiar.

### 2.2 Dynamic Permissions Configuration
- En `admin.html`, el Superadmin administra la matriz de permisos `rolePermissions` almacenada en base de datos/`localStorage` para controlar dinámicamente las capacidades de los roles `admin` y `readonly`.

---

## 3. UI/UX Design System (Zero Emojis, 100% Iconify)

1. **Dashboard Hub Landing Grid**:
   - Tarjetas de lanzamiento con iconos `<iconify-icon>`, efecto glassmorphism, resplandor en hover e indicadores de conteo en tiempo real.
   - Barra superior de navegación entre módulos (`.module-nav-bar`).

2. **Strict Iconify Policy**:
   - Eliminación total de emojis Unicode en HTML/JS. Reemplazo exclusivo por elementos `<iconify-icon>`.
