# Freight Audit - Frontend (Angular 21)

Angular 21 standalone frontend for the Freight Audit backend.

This project contains the Angular 21 version of the Freight Audit application with authentication, protected routes, module permissions, admin screens, carrier onboarding, invoice workflows, masters, reports, and shared layout components.

## Features

- Angular 21 standalone component architecture
- Login form with reactive forms validation
- `AuthService` calls `POST /api/auth/login`
- JWT token, expiry, user info, and permissions are stored after successful login
- Saved auth data is cleared when the Angular app starts, so a fresh app start returns to `/login`
- HTTP interceptor attaches `Authorization: Bearer <token>` to API requests
- 401 responses clear the session and redirect to `/login?sessionExpired=1`
- Route guard protects authenticated pages
- Permission guard protects role/module based pages
- Dashboard with user account and permission summary
- Admin user and permission management screens
- Carrier onboarding workflow with document and compliance steps
- Invoice upload, list, detail, and workflow actions
- Master data screens for contracts and rates
- Reports module with summary, performance, and penalty views
- Shared layout with sidebar, header, modal, stepper, toast host, and logo components
- SCSS light-blue theme
- Excel export support through `xlsx`

## Project Structure

```text
src/
  environments/
    environment.ts                    # production API config
    environment.development.ts        # development API config

  app/
    app.component.ts                  # root shell
    app.config.ts                     # router, http client, interceptor providers
    app.routes.ts                     # login and protected application routes

    core/
      auth/
        auth.service.ts               # login, logout, token/session handling
        jwt.util.ts                   # JWT helper utilities
        models/
          api-response.model.ts
          login-request.model.ts
          login-response.model.ts
          permission.model.ts
      guards/
        auth.guard.ts                 # protects authenticated routes
        permission.guard.ts           # protects module permission routes
      interceptors/
        jwt.interceptor.ts            # attaches bearer token and handles 401
      services/
        permissions.service.ts        # current user permission state

    features/
      auth/
        login/                        # LoginComponent HTML, SCSS, TS
      dashboard/                      # DashboardComponent
      admin/                          # users, roles, permission matrix
      carriers/                       # carrier list and onboarding wizard
      invoices/                       # upload, list, detail, workflow dialog
      masters/                        # contracts and rates
      reports/                        # summary, performance, penalties
      transactions/                   # transaction landing page

    shared/
      components/
        modal.component.ts
        stepper.component.ts
        toast-host.component.ts
      layout/
        header.component.ts
        main-layout.component.ts
        sidebar.component.ts
      services/
        excel-export.service.ts
        toast.service.ts
      logo.component.ts
      placeholder-page.component.ts

  index.html
  main.ts
  styles.scss                        # global theme
```

## Configuration

API base URL is configured in:

```text
src/environments/environment.ts
src/environments/environment.development.ts
```

Default value:

```ts
apiBaseUrl: 'https://localhost:60578'
```

This matches the backend Swagger URL:

```text
https://localhost:60578/index.html
```

## Run

Install dependencies:

```bash
npm install
```

Start the Angular development server:

```bash
npm start
```

The app opens at:

```text
http://localhost:4200
```

Visiting `/` redirects to `/login`.

After successful login, the user is redirected to `/dashboard`.

> If the backend uses a self-signed development certificate, open `https://localhost:60578/index.html` in the browser once and accept the certificate before using the Angular app.

## Build

```bash
npm run build
```

Production output is generated in:

```text
dist/freight-audit-angular21
```

## Backend Login Contract

`POST /api/auth/login`

Request:

```json
{
  "email": "user@example.com",
  "password": "********"
}
```

Response:

```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "token": "<jwt>",
    "expiresAt": "2026-05-05T12:00:00Z",
    "user": {
      "id": "...",
      "name": "...",
      "email": "...",
      "role": "..."
    },
    "permissions": [
      {
        "moduleCode": "ADMIN",
        "moduleName": "Admin",
        "canView": true,
        "canCreate": true,
        "canEdit": true,
        "canDelete": false
      }
    ]
  }
}
```

## How Auth Flows

1. When the Angular app starts, `AuthService` clears saved auth keys from `localStorage`.
2. Visiting `/` redirects to `/login`.
3. `LoginComponent` posts credentials through `AuthService.login()`.
4. On successful login, token, expiry, user, and permissions are stored.
5. The user is redirected to `/dashboard`.
6. `jwtInterceptor` attaches `Authorization: Bearer <token>` to outgoing HTTP requests.
7. `authGuard` blocks protected routes when the user is not authenticated.
8. `permissionGuard` blocks module routes when the user does not have permission.
9. If any API call returns `401`, the interceptor logs the user out and redirects to `/login?sessionExpired=1`.

Auth keys used in `localStorage`:

```text
fa.auth.token
fa.auth.expiresAt
fa.auth.user
```

## Main Routes

```text
/login
/dashboard
/admin
/carriers
/carriers/new
/carriers/:id
/masters
/transactions
/reports
```

## Angular Version

This project targets Angular 21.

Main package versions:

```text
@angular/core              ^21.2.0
@angular/router            ^21.2.0
@angular/forms             ^21.2.0
@angular/common            ^21.2.0
typescript                 ~5.9.2
zone.js                    ~0.15.0
```
