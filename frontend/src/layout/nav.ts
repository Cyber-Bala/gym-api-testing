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
  ShieldCheck,
  Sparkles,
  LayoutGrid,
  DoorOpen,
} from 'lucide-react';
import type { SessionUser, UserRole } from '../context/AuthContext';

export type AppView =
  | 'home'
  | 'book'
  | 'memberships'
  | 'my_access'
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
  | 'admin_management'
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
  {
    id: 'book',
    label: 'Book a slot',
    shortLabel: 'Book',
    icon: Calendar,
    roles: ['student', 'trainer', 'staff', 'admin', 'super_admin'],
  },
  {
    id: 'memberships',
    label: 'Gym passes',
    shortLabel: 'Passes',
    icon: CreditCard,
    roles: ['student', 'admin', 'super_admin'],
  },
  {
    id: 'my_access',
    label: 'My Entry & Exit',
    shortLabel: 'Access',
    icon: DoorOpen,
    roles: ['student', 'staff'],
  },
  {
    id: 'floor_management',
    label: 'Gym floor',
    shortLabel: 'Floor',
    icon: Users,
    roles: ['trainer', 'admin', 'super_admin'],
  },
  {
    id: 'trainer_shifts',
    label: 'Trainer shifts',
    shortLabel: 'Shifts',
    icon: Award,
    roles: ['trainer', 'admin', 'super_admin'],
  },
  {
    id: 'live_attendance',
    label: 'Who’s inside',
    shortLabel: 'Live',
    icon: Activity,
    roles: ['trainer', 'admin', 'super_admin'],
  },
  {
    id: 'students',
    label: 'Students',
    shortLabel: 'Students',
    icon: GraduationCap,
    roles: ['admin', 'super_admin'],
  },
  {
    id: 'authorized_persons',
    label: 'Guests',
    shortLabel: 'Guests',
    icon: Shield,
    roles: ['admin', 'super_admin'],
  },
  {
    id: 'violations',
    label: 'Violations',
    shortLabel: 'Violations',
    icon: ShieldAlert,
    roles: ['admin', 'super_admin'],
  },
  {
    id: 'conflicts',
    label: 'Access issues',
    shortLabel: 'Issues',
    icon: ShieldAlert,
    roles: ['admin', 'super_admin'],
  },
  {
    id: 'biometrics',
    label: 'Entry devices',
    shortLabel: 'Devices',
    icon: Cpu,
    roles: ['admin', 'super_admin'],
  },
  {
    id: 'reports',
    label: 'Reports',
    shortLabel: 'Reports',
    icon: FileSpreadsheet,
    roles: ['admin', 'super_admin'],
  },
  {
    id: 'analytics',
    label: 'Insights',
    shortLabel: 'Insights',
    icon: TrendingUp,
    roles: ['admin', 'super_admin'],
  },
  {
    id: 'lifecycle',
    label: 'Records archive',
    shortLabel: 'Archive',
    icon: Archive,
    roles: ['super_admin'],
  },
  {
    id: 'admin_management',
    label: 'Admin Directory',
    shortLabel: 'Admins',
    icon: ShieldCheck,
    roles: ['super_admin'],
  },
  {
    id: 'uat_demo',
    label: 'Demo console',
    shortLabel: 'Demo',
    icon: Sparkles,
    roles: ['super_admin'],
  },
];

export function canSee(item: NavItem, user?: SessionUser | null): boolean {
  if (!user) {
    return item.roles === 'all';
  }

  // Hosteller students have inclusive gym access and do not require passes
  if (item.id === 'memberships' && user.studentDetails?.residency === 'hosteller') {
    return false;
  }

  if (item.roles === 'all') return true;
  if (item.roles === 'signed-in') return Boolean(user);
  return Boolean(user.role && item.roles.includes(user.role));
}

export function visibleNav(user?: SessionUser | null): NavItem[] {
  const isStudent = user?.role === 'student';
  return NAV_ITEMS.filter((item) => canSee(item, user)).map((item) => {
    if (item.id === 'book') {
      return {
        ...item,
        label: isStudent ? 'Book a slot' : 'Slot Bookings',
        shortLabel: isStudent ? 'Book' : 'Bookings',
      };
    }
    return item;
  });
}

export const MOBILE_PRIMARY: Record<string, AppView[]> = {
  student: ['home', 'book', 'memberships'],
  trainer: ['home', 'floor_management', 'trainer_shifts', 'live_attendance'],
  staff: ['home', 'book', 'my_access'],
  authorized_person: ['home'],
  admin: ['home', 'live_attendance', 'floor_management', 'students'],
  super_admin: ['home', 'live_attendance', 'floor_management', 'analytics'],
  guest: ['home'],
};

export function getMobilePrimary(user?: SessionUser | null): AppView[] {
  if (!user) return ['home'];
  if (user.role === 'student') {
    if (user.studentDetails?.residency === 'hosteller') {
      return ['home', 'book', 'my_access'];
    }
    return ['home', 'book', 'memberships', 'my_access'];
  }
  return MOBILE_PRIMARY[user.role] ?? ['home'];
}

