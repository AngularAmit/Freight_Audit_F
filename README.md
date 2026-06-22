# Freight Audit - Angular 21 Frontend

This is a separate Angular 21 version of the Freight Audit frontend. The original project in the parent folder is left unchanged.

## Stack

- Angular 21 standalone components
- TypeScript 5.9
- RxJS 7.8
- SCSS global theme
- Feature-first structure under `src/app/features`

## Structure

```text
src/
  app/
    core/          # auth, guards, interceptors, shared services
    features/      # admin, auth, carriers, dashboard, invoices, masters, reports
    shared/        # layout, UI components, shared services
  environments/    # API base URL config
```

## Run

```bash
npm install
npm start
```

The app serves at `http://localhost:4200`.

## Build

```bash
npm run build
```

API base URL is configured in `src/environments/environment*.ts`.
