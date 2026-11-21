import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { AddRecordComponent } from './pages/add-record/add-record';
import { HistoryComponent } from './pages/history/history';
import { CalendarComponent } from './pages/calendar/calendar';
import { ReportsComponent } from './pages/reports/reports';
import { SettingsComponent } from './pages/settings/settings';

export const routes: Routes = [
  { path: '', component: DashboardComponent, pathMatch: 'full' },
  { path: 'add', component: AddRecordComponent },
  { path: 'history', component: HistoryComponent },
  { path: 'calendar', component: CalendarComponent },
  { path: 'reports', component: ReportsComponent },
  { path: 'settings', component: SettingsComponent },
  { path: '**', redirectTo: '' }
];
