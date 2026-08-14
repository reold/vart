# VART Project Context for Coding Agents

This file is the durable context for future LLMs and coding agents working on this repository. Read it before changing the application. The live OpenAPI document remains the source of truth whenever this file and the backend differ.

## 1. Project purpose

VART is a mobile-first school attendance SPA for teachers and school administrators. Its central workflow is taking a full attendance snapshot for one class and one of seven periods, with the next period prefilled from the most recently submitted earlier period.

This repository is the **frontend only**:

- Repository: `https://github.com/reold/vart`
- Production API: `https://vart.reold.workers.dev`
- Swagger UI: `https://vart.reold.workers.dev/docs`
- OpenAPI 3.0: `https://vart.reold.workers.dev/openapi.json`
- GitHub Pages target: `https://reold.github.io/vart/`

The backend is a Cloudflare Worker backed by D1. Its API guide says the OpenAPI specification covers all 44 operations across 38 paths and is checked against the backend router. Always fetch the current OpenAPI document before making API assumptions.

Do not run mutating test requests against the production Worker unless the user explicitly asks. In particular, do not create the first administrator, alter school records, or submit attendance merely to test connectivity.

## 2. Technology and repository layout

- SvelteKit 2 with Svelte 5 runes
- TypeScript
- Tailwind CSS 4 through `@tailwindcss/vite`
- `@sveltejs/adapter-static`
- Lucide icons from `@lucide/svelte`
- Vite
- npm is used for local validation; the existing GitHub Pages workflow uses Bun

Important files:

| File | Purpose |
|---|---|
| `src/lib/api.ts` | All browser API transport, authentication storage, and endpoint wrappers |
| `src/lib/types.ts` | Manually maintained API/domain types |
| `src/routes/+page.svelte` | App boot, auth/setup state, top-level navigation |
| `src/routes/+layout.svelte` | Global metadata and dark browser color scheme |
| `src/routes/layout.css` | Tailwind import, dark Apple palette, reusable component styles |
| `src/lib/components/Login.svelte` | Public user picker and PIN login |
| `src/lib/components/Setup.svelte` | First-super-admin setup |
| `src/lib/components/AppShell.svelte` | Desktop sidebar and mobile bottom navigation |
| `src/lib/components/Dashboard.svelte` | Teacher overview and class period progress |
| `src/lib/components/Attendance.svelte` | Class, period, draft, marking, and submission flow |
| `src/lib/components/Reports.svelte` | Class-day, student, and low-attendance reports |
| `src/lib/components/Admin.svelte` | Staff, students, classes, subjects, enrollments, and academic years |
| `vite.config.ts` | Static adapter, base path, and dev/preview host configuration |
| `.github/workflows/deploy.yml` | GitHub Pages build and deployment |

The app uses one prerendered SvelteKit page and hash-based in-app views (`#home`, `#attendance`, `#reports`, and `#admin`). This avoids deep-link fallback problems on GitHub Pages.

## 3. Development and validation

```bash
npm install
npm run dev
npm run check
npm run build
npm run preview
```

The default API is the production Worker. Override it for another deployment with:

```bash
VITE_API_URL=https://another-api.example npm run dev
```

GitHub Pages builds with:

```bash
BASE_PATH=/vart npm run build
```

Before finishing a change, run at minimum:

```bash
npm run check
npm run build
git diff --check
```

There is currently no unit or browser-test suite. Type checking and the production static build are the required baseline checks.

## 4. Deployment topology and authentication

### Current topology

Localhost and GitHub Pages call `https://vart.reold.workers.dev` **directly**. There is intentionally no Vite API proxy in this frontend. The Worker must include exact frontend origins in `ALLOWED_ORIGINS`, including:

```text
http://localhost:5173
https://reold.github.io
```

A GitHub Pages project path such as `/vart/` is not part of the origin.

### Login response

`POST /auth/login` accepts `{ user_id, pin }` and returns both an HttpOnly cookie and the same session as a bearer token:

```json
{
  "success": true,
  "user": {
    "id": "...",
    "display_name": "Head Teacher",
    "role": "super_admin"
  },
  "token": "...",
  "token_type": "Bearer",
  "expires_in": 7776000
}
```

### Transport selection implemented by the frontend

`src/lib/api.ts` selects transport by comparing the API origin with `window.location.origin`:

- **Cross-site API:** save the returned token in `sessionStorage`, send `Authorization: Bearer <token>`, and use `credentials: 'omit'`.
- **Same-origin API:** do not store the bearer token; use the HttpOnly cookie with `credentials: 'include'`.
- If browser storage is unavailable, the cross-site token falls back to memory for the current tab.
- An earlier frontend used `localStorage`; current code migrates that token into `sessionStorage` and removes the persistent copy.
- Logout calls `POST /auth/logout` before deleting the browser token so the backend session is revoked.

The bearer strategy is required for GitHub Pages → workers.dev because third-party cookies fail on Safari and iOS. Do not switch the cross-site deployment back to cookie-only auth. Do not log, render, place in a URL, or commit a bearer token. A token is equivalent to the staff member's session.

`/internal/v1/*` bearer keys are a separate machine-to-machine authentication system. Never use a user session token as an internal API key or expose an internal API key to this SPA.

### Boot flow

1. Call `GET /me`.
2. If authenticated, call `GET /app/bootstrap` and open the app.
3. If `/me` returns 401, call `GET /setup/status`.
4. Show first-time setup only when there are no users; otherwise show the public user picker from `GET /auth/users-public`.
5. Login with the selected `user_id` and six-digit PIN.

Five failed PIN attempts within 15 minutes lock that user/IP pair for 15 minutes. Do not repeatedly test random PINs.

## 5. Roles and frontend authorization

Roles are:

- `teacher`
- `teacher_admin`
- `super_admin`

The frontend hides **Manage school** from plain teachers and permits it only for `teacher_admin` and `super_admin`.

This frontend gate is deliberate. Several backend routes under `/admin/*` currently call only `requireAuth`, meaning any signed-in teacher could invoke them despite the path name. Do not expose those controls to teachers merely because the backend currently allows the request.

Only `super_admin` should be offered the option to create or assign another `super_admin`.

`GET /admin/users` may return `pin_hash` and `pin_salt`. Never add those fields to rendered UI, browser logs, telemetry, or stored frontend state. The frontend's `User` type intentionally ignores them.

## 6. Main teacher attendance flow

The normal flow is:

```text
GET  /app/bootstrap
GET  /classes/{classId}/today
GET  /classes/{classId}/suggest-next-period
GET  /classes/{classId}/periods/{periodNo}/draft
POST /attendance/submit
```

There are exactly seven periods.

### Draft behavior

A period draft copies each student's status from the most recently submitted earlier period for the same day. If there is no earlier submission, every student defaults to `present`.

`draft.summary.copied_from_period` identifies the source period or is `null`.

Students copied as already absent have `hidden_as_absent_earlier: true`. The intended UX, implemented in `Attendance.svelte`, is:

- Collapse them into an “Absent earlier” section.
- Keep them absent without making the teacher mark them again.
- Provide an “Arrived now” action that changes them to present.

### Submission behavior

Attendance submission is a **full snapshot**. Send a mark for every student, not only absences or changes:

```json
{
  "class_id": "...",
  "subject_id": "...",
  "session_date": "YYYY-MM-DD",
  "period_no": 3,
  "marks": [
    { "student_id": "...", "status": "present" },
    { "student_id": "...", "status": "absent" },
    { "student_id": "...", "status": "late", "late_minutes": 5 }
  ]
}
```

Statuses are `present`, `absent`, and `late`.

Important runtime-validator detail: although older schema text described `late_minutes` and `note` as nullable, the running validator rejected a supplied `late_minutes: null`. The frontend therefore:

- Omits `late_minutes` for present and absent marks.
- Includes `late_minutes` only for late marks.
- Normalizes late minutes to a non-negative integer.
- Omits an empty note instead of sending `note: null`.

Keep this omission behavior unless the running backend is verified to have changed.

### Editing and dates

- Today's periods can be resubmitted and overwritten.
- A new past-date session is allowed when all students were enrolled on that date.
- An existing past session cannot be resubmitted; it returns 403.
- There is no separate administrator correction endpoint.
- Student enrollment date ranges are enforced.
- The server's concept of “today” is UTC. Around midnight this differs from IST; before 05:30 IST the server is still on the previous UTC day.

## 7. Subjects and staff

A teacher may have a `default_subject_id`.

- A subject can be selected while creating staff.
- Existing staff can be edited with `PUT /admin/users/{userId}` to assign or change `default_subject_id`.
- The staff list displays the assigned default subject.
- PIN changes use the dedicated `POST /admin/users/{userId}/reset-pin` route.

The attendance register initializes its subject from the draft/default subject and permits choosing another active subject before submission. `subject_id` may be `null` when no subject is selected.

## 8. Reports and seven-period inference

Teachers often submit only some periods. Reports infer missing periods only on days where at least one period was submitted:

- The nearest submitted status is carried backward to period 1 and forward to period 7.
- Inferred values are prefixed `inferred_`.
- Days with no submissions are excluded.
- Present and late normally earn 1.0 credit; absent earns 0.0, based on backend policy rows.

Endpoints:

- `GET /admin/attendance/day` — raw submissions, no inference; used for day grids and reviewing current attendance.
- `GET /reports/class-day` — currently equivalent to the raw day endpoint.
- `GET /reports/student/{id}` — active-year report with inference.
- `GET /reports/low-attendance?threshold=75` — inferred low-attendance report; potentially slow because the backend performs roughly one query per student.

The UI renders inferred cells with a visible dashed treatment. Do not present inferred statuses as if they were directly recorded.

## 9. Administration and record lifecycle

The management UI supports:

- Staff creation, editing, default-subject assignment, PIN reset, enable/disable
- Student creation and active/inactive state
- Class creation and archive/restore
- Subject creation and archive/restore
- Date-ranged class enrollments
- Academic-year creation

Exactly one academic year must be active for attendance endpoints to work. First-admin setup creates one. Creating another year with `active: true` deactivates the others.

Student deletion fails once attendance exists. Prefer `PUT /admin/students/{id}` with `active: false`, which the UI does. This preserves historical reports.

There is no pagination. `GET /admin/students` returns the entire student set, so avoid adding frontend patterns that assume server pagination exists.

Several staff action routes are matched by path without a reliable method check in the backend. Always use the intended methods documented in OpenAPI, especially POST for reset PIN, enable, disable, and revoke sessions.

## 10. API conventions

- Dates: `YYYY-MM-DD`
- Timestamps: ISO-8601 UTC
- Stored SQLite booleans may be returned as `0` or `1`.
- Request bodies use real JSON booleans.
- Most errors: `{ "error": "message" }`
- Body validation errors: `{ "errors": ["message"] }`
- Successful writes: `{ "success": true, "<entity>_id": "...", "message": "..." }`
- Unknown paths: `404 { "error": "Not Found", "path": "..." }`
- No API pagination

All API requests should continue going through `src/lib/api.ts`; do not scatter raw `fetch` calls through components. Keep `credentials`, bearer headers, JSON parsing, and error normalization centralized.

## 11. Visual design requirements

The application is intentionally **dark-only**. Do not add a light theme or theme toggle unless the user reverses this requirement.

The design uses Apple's dark semantic palette with strong contrast for classroom use in sunlight:

- Canvas: `#000000`
- Surface: `#1c1c1e`
- Raised surface/fill: `#2c2c2e`
- Primary label: `#ffffff`
- Secondary label: `#e5e5ea`
- Tertiary label: `#aeaeb2`
- Separator: `#636366`
- Blue: `#0a84ff`
- Green: `#30d158`
- Red: `#ff453a`
- Orange: `#ff9f0a`
- Indigo: `#7d7aff`
- Purple: `#bf5af2`

Black text is used on bright blue, green, red, and orange filled controls for stronger contrast. Current representative contrast ratios range from 5.76:1 for primary buttons to 17.01:1 for primary text on surfaces.

Maintain:

- High-contrast borders and text
- Large tap targets suitable for phones
- Mobile bottom navigation and desktop sidebar
- Clearly distinguishable present/absent/late states
- Visible inferred-report styling
- Native dark form controls and metadata (`color-scheme: dark`)
- Reduced-motion support

Svelte escapes ordinary interpolated values. Do not introduce `{@html}` for student names, notes, staff names, or any other user-controlled content; bearer-token auth makes XSS a full account compromise.

## 12. Svelte and implementation pitfalls already encountered

1. In a literal Svelte attribute, `pattern="\\d{6}"` was compiled incorrectly because `{6}` was interpreted by the template parser. PIN inputs use an explicit six-digit pattern:

   ```html
   pattern="[0-9][0-9][0-9][0-9][0-9][0-9]"
   ```

2. Svelte component instances do not accept DOM `class:` directives in the same way as elements in this setup. Use a computed `class` string for Lucide component animations/rotations.

3. Stored booleans from the API are numeric. Compare active fields with `=== 1` where types specify `0 | 1`.

4. Do not send nullable optional attendance mark fields merely because a schema says nullable; preserve the omission strategy described above.

5. GitHub Pages uses `BASE_PATH=/vart`. Asset and navigation changes must continue to work from a project subpath.

## 13. Safe change checklist

Before changing API behavior:

1. Fetch `https://vart.reold.workers.dev/openapi.json`.
2. Read `https://vart.reold.workers.dev/docs` and any newly supplied `API.md` guidance.
3. Update `src/lib/types.ts` and `src/lib/api.ts` together.
4. Preserve bearer auth for cross-site deployments and cookie auth for same-origin deployments.
5. Confirm optional fields match the behavior of the running validator, not only the schema wording.
6. Do not expose secrets, PIN hashes, salts, bearer tokens, or internal API keys.
7. Run `npm run check`, `npm run build`, and `git diff --check`.
