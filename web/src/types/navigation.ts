export interface NavItem {
  icon: React.ReactNode;
  id: string;
  tooltip: string | undefined;
  path: string;
  requiresAuth?: boolean;
}
