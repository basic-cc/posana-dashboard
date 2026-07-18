# Posana Sales Dashboard

A sales CRM for Posana, a protein bar company, built to track and manage the wholesale sales pipeline of independent stores (coffee shops, gyms, delis, grocers, and similar) across New York City and San Francisco. It centers on an interactive map of every lead, backed by a filterable list, per-lead detail and editing, and lightweight team administration.

## Overview

Posana's sales associates knock on doors and cold-call independent stores to get Posana protein bars stocked on shelves. This dashboard replaces a spreadsheet-based tracking process with a shared, real-time view of the pipeline: where every prospective store is located, who owns the relationship, what stage it's at, and how to reach them.

The app is built with Next.js (App Router) and Supabase (Postgres, Auth, and Row Level Security), and is deployed on Vercel.

## Core features

### Map view

- All leads are plotted on a Leaflet map (OpenStreetMap tiles in light mode, a CARTO dark basemap in dark mode), clustered at low zoom and expanding into individual color-coded pins as you zoom in.
- Pin color encodes lead status (not contacted, in contact, samples shipped, actively selling, declined).
- A city switch flies the map between preset NYC and SF views.
- Clicking a pin opens a popup summary and selects the lead, which opens its detail panel.

### Store list

- A persistent, toggleable list panel next to the map shows every lead currently matching the active filters, kept in sync with what's plotted on the map.
- Each row shows status, neighborhood, store type, and assigned associate, with a locate button that flies the map to that lead's coordinates and opens its detail panel.
- Chain grouping: stores that share an exact name (for example, multiple locations of the same chain) automatically collapse into a single expandable group showing a location count and a strip of status dots. Groups can also be assigned manually — any lead can be added to a named chain group independent of its store name, and inline controls let you assign, reassign, or remove a lead from a chain group.

### Filtering

A shared filter bar drives both the map and the store list simultaneously:

- Free-text search (store name, address, neighborhood)
- City (NYC / SF / all)
- Assigned sales associate
- Neighborhood (derived from the current lead data)
- Status (multi-select)
- Store type (multi-select)

### Lead detail and editing

- Selecting a lead opens a slide-in detail panel showing store type, chain type (local vs. corporate), point of contact, address, last contacted date, notes, and assigned associate.
- Inline editing is available to the lead's assigned associate or any admin; other users see a read-only view.
- Admins can delete leads and reassign them to a different associate.

### Adding leads

- New leads can be added through a modal covering all lead fields.
- Addresses are geocoded on save via the OpenStreetMap Nominatim API, populating latitude/longitude automatically so the new lead appears on the map immediately.

### Data export

- The current filtered set of leads can be exported as CSV (for spreadsheets) or KML (for Google Earth / Google My Maps), from the navbar.

### Admin panel

- Visible only to admins. Lists current team members and their roles, and can provision new associate accounts (creates a Supabase auth user with a temporary password).

### Appearance

- A navbar toggle switches the entire app between light and dark mode, persisted in local storage and applied before first paint to avoid a flash of the wrong theme. Dark mode also swaps the map's basemap and restyles the Leaflet popups and controls.
- The store list panel can be shown or hidden independently via a navbar toggle, giving the map more room when it isn't needed.

## Permissions model

Authentication and row-level access are enforced by Supabase:

- All authenticated users can read every lead and every team member's profile.
- An associate can only edit leads assigned to them; admins can edit and delete any lead.
- Only admins can delete leads or provision new team member accounts.
- Unauthenticated visitors are redirected to `/login`; authenticated users hitting `/login` are redirected to `/dashboard`. This redirect logic runs in Next.js Proxy (this Next.js version's renamed middleware layer) so it happens before any page renders.

## Data model

Two tables, both under Supabase Row Level Security (see `supabase-schema.sql` for the full definition, including policies, indexes, and triggers):

**`profiles`** — one row per team member, extending `auth.users`.
- `id`, `name`, `role` (`admin` or `associate`)
- Auto-created via a database trigger whenever a new `auth.users` row is created.

**`leads`** — one row per prospective or active store.
- `store_name`, `address`, `lat`/`lng`
- `store_type` (coffee shop, gym/fitness, smoothie shop, local deli, specialty grocer, other)
- `chain_type` (local vs. corporate chain)
- `status` (not contacted, in contact, samples shipped, actively selling, declined)
- `sales_associate_id` (references `profiles`)
- `contact_name`, `contact_phone`, `contact_email`
- `neighborhood`, `chain_group` (manual chain-grouping label), `notes`
- `last_contacted_date`, `city` (`nyc` or `sf`)
- `created_at` / `updated_at` (the latter auto-maintained by a trigger)

## Tech stack

- **Framework:** Next.js 16 (App Router, Turbopack), React 19, TypeScript
- **Styling:** Tailwind CSS v4 (CSS-based configuration, class-based dark mode via a custom variant), with the Manrope typeface loaded through `next/font`
- **Backend:** Supabase — Postgres database, Auth, and Row Level Security; accessed via `@supabase/ssr` (server, middleware/proxy, and client helpers live in `utils/supabase/`)
- **Map:** Leaflet, React Leaflet, and `react-leaflet-cluster` for marker clustering
- **Geocoding:** OpenStreetMap Nominatim (used when adding leads and by the data-import scripts)
- **Hosting:** Vercel

## Project structure

```
app/
  page.tsx              Redirects to /dashboard
  layout.tsx             Root layout: font loading, theme-init script
  globals.css             Tailwind entry point, theme tokens, dark mode, custom checkbox/button styling
  login/page.tsx           Login screen
  dashboard/
    page.tsx                Server component: auth check, loads the current user's profile
    DashboardClient.tsx       Main client-side dashboard: state, data fetching, navbar, layout, CSV/KML export, admin panel

components/
  MapView.tsx              Leaflet map, clustering, marker styling, fly-to behavior, dark tile switching
  StoreList.tsx            Store list panel, chain grouping and manual chain assignment
  FilterBar.tsx             Filter sidebar
  LeadPanel.tsx             Lead detail / inline edit panel
  AddLeadModal.tsx          New lead form with geocoding
  ThemeToggle.tsx            Light/dark mode toggle button
  types.ts                  Shared TypeScript types and constants (Lead, Profile, Filters, status/store-type labels and colors)

hooks/
  useIsDarkMode.ts          SSR-safe hook for reading the current theme via useSyncExternalStore

utils/supabase/
  client.ts                 Browser Supabase client
  server.ts                  Server component Supabase client (cookie-based)
  middleware.ts               Supabase client used by the Proxy for auth redirects

scripts/                   One-off/maintenance Python scripts for populating the database from the source
                            tracking spreadsheet (import, re-import, geocoding of missing addresses,
                            associate assignment) — not part of the deployed application

proxy.ts                   Next.js Proxy: redirects unauthenticated users to /login and vice versa
supabase-schema.sql        Full database schema: tables, RLS policies, triggers, indexes
```

## Getting started

### Prerequisites

- Node.js and npm
- A Supabase project

### Environment variables

Create a `.env.local` file in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_SECRET_KEY=your-supabase-secret-key
SUPABASE_TEMP_PASSWORD=temporary-password-used-when-creating-associate-accounts
```

### Database setup

Run `supabase-schema.sql` in the Supabase SQL Editor to create the `profiles` and `leads` tables, their RLS policies, and supporting indexes and triggers.

### Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other scripts

```bash
npm run build   # production build
npm run start   # run the production build
npm run lint     # ESLint
```

## Deployment

The app is deployed on Vercel, linked to this repository's GitHub remote. Pushing to `main` triggers a new deployment through Vercel's Git integration. The same environment variables listed above must be configured in the Vercel project settings.
