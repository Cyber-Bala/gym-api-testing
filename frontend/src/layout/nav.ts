import type { LucideIcon } from 'lucide-react';
import {
  Calendar,
  CreditCard,
  GraduationCap,
  Shield,
  Activity,
  Users,
  Cpu,
  ShieldAlert,
  FileSpreadsheet,
  Archive,
  Award,
  TrendingUp,
  HeartPulse,
  Sparkles,
  LayoutGrid,
} from 'lucide-react';
import type { UserRole } from '../context/AuthContext';

export type AppView =
  | 'home'
  | 'book'
  | 'memberships'
  | 'students'
  | 'authorized_persons'
  | 'live_attendance'
  | 'floor_management'
  | 'biometrics'
  | 'violations'
  | 'conflicts'
  | 'reports'
  | 'lifecycle'
  | 'trainer_shifts'
  | 'analytics'
  | 'health'
  | 'uat_demo';

export interface NavItem {
  id: AppView;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  roles: UserRole[] | 'all' | 'signed-in';
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', shortLabel: 'Home', icon: LayoutGrid, roles: 'all' },
  { id: 'book', label: 'Book a slot', shortLabel: 'Book', icon: Calendar, roles: 'all' },
  { id: 'memberships', label: 'Gym passes', shortLabel: 'Passes', icon: CreditCard, roles: 'all' },
  {
    id: 'live_attendance',
    label: 'Who’s inside',
    shortLabel: 'Live',
    icon: Activity,
    roles: ['admin', 'super_admin', 'trainer'],
  },
  {
    id: 'floor_management',
    label: 'Gym floor',
    shortLabel: 'Floor',
    icon: Users,
    roles: ['admin', 'super_admin', 'trainer'],
  },
  {
    id: 'students',
    label: 'Students',
    shortLabel: 'Students',
    icon: GraduationCap,
    roles: ['admin', 'super_admin', 'trainer'],
  },
  {
    id: 'authorized_persons',
    label: 'Guests',
    shortLabel: 'Guests',
    icon: Shield,
    roles: ['admin', 'super_admin', 'trainer'],
  },
  {
    id: 'violations',
    label: 'Violations',
    shortLabel: 'Violations',
    icon: ShieldAlert,
    roles: ['admin', 'super_admin', 'trainer'],
  },
  {
    id: 'conflicts',
    label: 'Access issues',
    shortLabel: 'Issues',
    icon: ShieldAlert,
    roles: ['admin', 'super_admin', 'trainer'],
  },
  {
    id: 'biometrics',
    label: 'Entry devices',
    shortLabel: 'Devices',
    icon: Cpu,
    roles: ['admin', 'super_admin', 'trainer'],
  },
  {
    id: 'trainer_shifts',
    label: 'Trainer shifts',
    shortLabel: 'Shifts',
    icon: Award,
    roles: ['admin', 'super_admin', 'trainer'],
  },
  {
    id: 'reports',
    label: 'Reports',
    shortLabel: 'Reports',
    icon: FileSpreadsheet,
    roles: ['admin', 'super_admin', 'trainer'],
  },
  {
    id: 'analytics',
    label: 'Insights',
    shortLabel: 'Insights',
    icon: TrendingUp,
    roles: ['admin', 'super_admin', 'trainer'],
  },
  {
    id: 'lifecycle',
    label: 'Records archive',
    shortLabel: 'Archive',
    icon: Archive,
    roles: ['admin', 'super_admin'],
  },
  { id: 'health', label: 'System status', shortLabel: 'Status', icon: HeartPulse, roles: 'signed-in' },
  {
    id: 'uat_demo',
    label: 'Demo console',
    shortLabel: 'Demo',
    icon: Sparkles,
    roles: 'signed-in',
  },
];

export function canSee(item: NavItem, role?: UserRole | null): boolean {
  if (item.roles === 'all') return true;
  if (item.roles === 'signed-in') return Boolean(role);
  return Boolean(role && item.roles.includes(role));
}

export function visibleNav(role?: UserRole | null): NavItem[] {
  return NAV_ITEMS.filter((item) => canSee(item, role));
}

export const MOBILE_PRIMARY: Record<string, AppView[]> = {
  student: ['book', 'memberships', 'home'],
  staff: ['home', 'memberships', 'health'],
  authorized_person: ['home', 'health'],
  trainer: ['book', 'floor_management', 'live_attendance', 'trainer_shifts'],
  admin: ['book', 'floor_management', 'students', 'reports'],
  super_admin: ['book', 'floor_management', 'students', 'reports'],
  guest: ['home', 'book', 'memberships'],
};
