# Project Management System — Spec

## What we're building

A Trello-style project management web app. Users sign up, create projects, add tasks to those projects, assign tasks to people, and move tasks across a kanban board (To Do → In Progress → Done).

**Stack:**
- Frontend: Next.js (App Router, TypeScript, Tailwind CSS)
- Backend: Express.js (Node)
- Database: PostgreSQL (local), accessed via Prisma ORM
- Auth: JWT stored in an HTTP cookie, verified via middleware on the frontend and `requireAuth` on the backend

---

## Core data model

- **User** — id, name, email, password hash
- **Project** — id, title, owner (a User)
- **Task** — id, title, status, priority, belongs to a Project, optionally assigned to a User

---

## Must-have features (MVP)

- [ ] **Signup** — create an account with name, email, password
- [ ] **Login** — authenticate and receive a session token
- [ ] **Route protection** — logged-out users can't reach `/dashboard`; logged-in users can't sit on `/login`
- [ ] **Dashboard** — after login, show a list of the user's projects + a "Create project" action
- [ ] **Create project** — name a new project, becomes owned by the logged-in user
- [ ] **View a single project** — kanban board with three columns: To Do, In Progress, Done
- [ ] **Create task** — add a task to a project with a title, priority, optional assignee
- [ ] **Move a task between columns** — update its status (drag-and-drop, or a simple dropdown/button if time is short)
- [ ] **Edit/delete a task**
- [ ] **Assign a task to a user**

## Nice-to-have (only if time allows, in priority order)

- [ ] Due dates on tasks
- [ ] Task comments/activity log
- [ ] Multiple views of the same data (list view in addition to board view)
- [ ] Labels/tags on tasks

## Explicitly out of scope for this build

- Notifications (email/push)
- Granular permissions (who can see/edit what)
- Reporting/analytics (burndown charts, velocity)
- Third-party integrations (Slack, GitHub, calendar sync)
- Real-time multi-user sync
- Trello-style "Planner" calendar view

---

## Color palette

| Role | Hex | Use for |
|---|---|---|
| Primary | `#3ec170` | Primary buttons, active nav item, links, brand mark |
| Primary hover / light | `#65cd8c` | Hover states, light tinted backgrounds (selected card, active column header) |
| Secondary | `#3ec1b1` | Secondary buttons, alternate tags/labels, less-important accents |
| Tertiary (sparing use) | `#4ec13e` | Third label/tag color only — close in hue to Primary, avoid using alone on buttons |
| Accent (rare, high-attention) | `#c13e8f` | Reserved for things that must pop: notification badges, "urgent" priority tag, unread indicators |

**Usage principle:** keep ~80% of the UI in neutral white/gray (backgrounds, body text, borders). Let color show up only on labels, buttons, and status indicators — not on every surface — so the palette reads as intentional rather than busy.

---

## Navigation flow

```
Login/Signup → Dashboard (list of projects, create new) → Single Project (kanban board)
```

Logged-in users always land on the Dashboard, never directly on a specific board — this avoids the app "guessing" which project to show.