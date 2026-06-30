import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login'
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
    data: { title: 'Sign in' }
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        data: { title: 'Dashboard', subtitle: 'Overview of your AI-powered freight audit workspace' }
      },
      {
        path: 'admin',
        canActivate: [permissionGuard('ADMIN')],
        loadComponent: () =>
          import('./features/admin/admin.component').then((m) => m.AdminComponent),
        data: { title: 'Admin', subtitle: 'Users, roles & platform configuration' }
      },
      {
        path: 'carriers',
        canActivate: [permissionGuard('CARRIER')],
        loadComponent: () =>
          import('./features/carriers/carriers.component').then((m) => m.CarriersComponent),
        data: { title: 'Carrier Onboarding', subtitle: 'Carriers, documents & compliance' },
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () =>
              import('./features/carriers/components/carrier-list.component').then((m) => m.CarrierListComponent),
            data: { title: 'Carrier Onboarding', subtitle: 'Carriers, documents & compliance' }
          },
          {
            path: 'new',
            loadComponent: () =>
              import('./features/carriers/components/carrier-wizard.component').then((m) => m.CarrierWizardComponent),
            data: { title: 'Carrier Onboarding', subtitle: 'Onboard a new carrier' }
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/carriers/components/carrier-wizard.component').then((m) => m.CarrierWizardComponent),
            data: { title: 'Carrier Onboarding', subtitle: 'Review documents, compliance & approval' }
          }
        ]
      },
      {
        path: 'audit-upload',
        loadComponent: () =>
          import('./features/audit-upload/audit-upload.component').then((m) => m.AuditUploadComponent),
        data: { title: 'Audit Upload', subtitle: 'Upload and maintain carrier audit documents' }
      },
      {
        path: 'masters',
        canActivate: [permissionGuard('MASTER')],
        loadComponent: () =>
          import('./features/masters/masters.component').then((m) => m.MastersComponent),
        data: { title: 'Master', subtitle: 'Rate masters, accessorials & reference data' }
      },
      {
        path: 'transactions',
        canActivate: [permissionGuard('TRANSACTION')],
        loadComponent: () =>
          import('./features/transactions/transactions.component').then((m) => m.TransactionsComponent),
        data: { title: 'Transactions', subtitle: 'Invoices & audit results' }
      },
      {
        path: 'reports',
        canActivate: [permissionGuard('REPORT')],
        loadComponent: () =>
          import('./features/reports/reports.component').then((m) => m.ReportsComponent),
        data: { title: 'Reports', subtitle: 'Performance, savings & compliance reports' }
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
