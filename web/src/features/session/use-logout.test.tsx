import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";

import {
  readDeviceUser,
  rememberDeviceUser,
} from "@/features/session/device-user";
import { useLogout } from "@/features/session/use-logout";
import { fakeApi } from "@/testing/fake-api";
import { renderWithRouter } from "@/testing/render-app";

function LogoutProbe() {
  const { logout } = useLogout();
  return (
    <button type="button" onClick={logout}>
      {"logout"}
    </button>
  );
}

beforeEach(() => {
  localStorage.clear();
});

it("forgets the device user on logout", async () => {
  rememberDeviceUser({ id: 7, email: "owner@equori.test" });
  renderWithRouter(<LogoutProbe />, {
    path: "/",
    fetch: fakeApi({
      "DELETE /api/v1/session": () => new Response(null, { status: 204 }),
    }),
  });
  await userEvent.click(screen.getByRole("button", { name: "logout" }));
  await waitFor(() => {
    expect(readDeviceUser()).toBeNull();
  });
});
