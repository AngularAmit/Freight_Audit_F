import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

import { SidebarComponent } from './sidebar.component';
import { HeaderComponent } from './header.component';
import { ToastHostComponent } from '../components/toast-host.component';
import { PermissionsService } from '../../core/services/permissions.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, HeaderComponent, ToastHostComponent],
  template: `
    <div class="layout">
      <app-sidebar></app-sidebar>
      <div class="main">
        <app-header></app-header>
        <main class="content">
          <router-outlet></router-outlet>
        </main>
      </div>
      <app-toast-host></app-toast-host>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .layout {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 248px 1fr;
      background: var(--color-bg);
    }

    .main {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .content {
      flex: 1;
      padding: 28px;
      max-width: 1280px;
      width: 100%;
      margin: 0 auto;
    }

    @media (max-width: 980px) {
      .layout { grid-template-columns: 1fr; }
    }
    @media (max-width: 640px) {
      .content { padding: 18px 16px; }
    }
  `]
})
export class MainLayoutComponent implements OnInit {
  private readonly permissions = inject(PermissionsService);

  ngOnInit(): void {
    this.permissions.refresh().subscribe();
  }
}
