# BASTIONX LAB — Agent Guide

## Architecture
- **Stack:** Static HTML, Pico CSS (v2 dark), Alpine.js 3, Supabase JS (UMD), Iconify.
- **Supabase:** Project `unaadjavtrsogkzcbmev` (`js/supabase.js`).
- **Icons:** Use ONLY [Iconify](https://icon-sets.iconify.design/) via `<iconify-icon>`. **NO emojis**.

## Core Constraints & Conventions
- **No build tools.** No `package.json`, no bundler.
- **Alpine.js:** Define components via `alpine:init`. **CRITICAL:** Every HTML page must include `<style>[x-cloak] { display: none !important; }</style>` in `<head>`.
- **Navigation:**
    - Links in `x-data` must use `@click.prevent="window.location.href='...'"` instead of `<a href>`.
    - Use `gotoServer(id)` to navigate detail: `window.location.href = 'server-detail.html?id=' + id`.
- **UX/UI:** Glassmorphism dark theme (`style.css`).
- **Data Integrity:** Use `auditLog(serverId, userId, accion, cambios, descripcion)` for all server mutations.
- **Feedback:** Replace `alert()` with `Alpine.store('toast')`.

## UX Pattern: Search Field (NSSearchField Style)
- **Class:** `.search-compact` (Pill-shaped, 34px height).
- **Structure:** `iconify-icon` (lupa), `input`, `button` (clear 'X', visible only with text).
- **Alignment:** Always enforce `flex` centering.

## Database Tables
- `servers`, `server_credentials`, `server_tags`, `tags`, `server_tasks`, `server_task_logs`, `user_profiles`, `audit_logs`.

## Pages Index
- `dashboard.html`: Main grid, 4 views, command palette.
- `server-detail.html`: Detail, tasks, bitácora.
- `add-server.html` / `edit-server.html`: Forms.
