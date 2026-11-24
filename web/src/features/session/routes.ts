import { lazyRouteComponent } from "@tanstack/react-router";

export {
  meQuery,
  myBooksQuery,
  setupQuery,
} from "@/features/session/model/session-queries";
export {
  hasUnsuffixedBookKeys,
  moveUnsuffixedBookKeys,
} from "@/features/session/model/book-keys";
export { rememberDeviceUser } from "@/features/session/model/device-user";

export const InvitePage = lazyRouteComponent(
  () => import("@/features/session/pages/invite-page"),
  "InvitePage",
);

export const LoginPage = lazyRouteComponent(
  () => import("@/features/session/pages/login-page"),
  "LoginPage",
);

export const SetupPage = lazyRouteComponent(
  () => import("@/features/session/pages/setup-page"),
  "SetupPage",
);
