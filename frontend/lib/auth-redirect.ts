import { DASHBOARD_ROUTES, PRODUCT_ROUTES } from '@/lib/routes';

export function postAuthRedirect(user: { isSuperAdmin?: boolean }): string {
  return user.isSuperAdmin ? DASHBOARD_ROUTES.HOME : PRODUCT_ROUTES.CHAT;
}
