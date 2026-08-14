# VART frontend

A mobile-first school attendance frontend for the [VART Worker API](https://vart.reold.workers.dev/docs). Built with SvelteKit 5, Tailwind CSS 4, TypeScript and the static adapter.

## Included flows

- First-run administrator setup
- Tap-your-name login with a six-digit PIN
- Teacher dashboard with seven-period class progress
- Copy-previous-period attendance, including the collapsed “absent earlier” flow
- Full-snapshot attendance submission with present, absent and late marks
- Class-day, per-student and low-attendance reports
- Role-gated management for staff, students, classes, subjects, enrollments and academic years
- Responsive desktop sidebar and mobile tab bar

The UI intentionally hides administration from plain teachers even though some current `/admin/*` handlers only require authentication. It never renders or logs the PIN hash/salt fields returned by the staff endpoint.

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. The browser calls `https://vart.reold.workers.dev` directly; Vite does not proxy or rewrite API requests.

To target a different Worker deployment:

```bash
VITE_API_URL=https://another-worker.example npm run dev
```

Useful checks:

```bash
npm run check
npm run build
npm run preview
```

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_URL` | Browser-facing API origin in development and production | `https://vart.reold.workers.dev` |
| `BASE_PATH` | SvelteKit asset base, such as `/vart` on GitHub Pages | empty |

See `.env.example` for a starting point.

## GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds the static app at `/vart` and points it at the deployed Worker.

There is one backend requirement for authenticated requests from GitHub Pages: the frontend origin must be in the Worker’s `ALLOWED_ORIGINS`, and the session cookie must be cross-site compatible (`SameSite=None; Secure`). The API currently documents `SameSite=Lax`; browsers will not attach that cookie to fetches from `reold.github.io`, even when CORS is configured correctly. Frontend code cannot bypass an HttpOnly SameSite cookie.

Because localhost and GitHub Pages now call the Worker directly, the Worker must allow each frontend origin through `ALLOWED_ORIGINS`. Authenticated cross-site requests also require the session cookie to use `SameSite=None; Secure`; with the currently documented `SameSite=Lax` setting, public endpoints work cross-origin but browsers will not attach the authenticated session cookie.

## API behavior represented in the UI

- Attendance submission always sends a mark for every rostered student.
- Existing attendance for today can be reviewed and overwritten.
- Dates use the server’s UTC day.
- Inferred report statuses are visually faded and outlined.
- Raw day reports are clearly identified as non-inferred.
- Student records are deactivated instead of deleted to preserve attendance history.
- Only administrator roles can access school management screens.
