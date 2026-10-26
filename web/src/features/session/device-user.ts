// P4a of ADR 022: the session cookie is HttpOnly and no API answer is stored, so the device keeps
// its own record of who queues offline. Storage may refuse access; the device then has no user.
const key = "equori.device.user";

export interface DeviceUser {
  id: number;
  email: string;
}

function isDeviceUser(v: unknown): v is DeviceUser {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Record<string, unknown>).id === "number" &&
    typeof (v as Record<string, unknown>).email === "string"
  );
}

export function rememberDeviceUser(user: DeviceUser): void {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ id: user.id, email: user.email }),
    );
  } catch {
    // The device keeps no user; the offline screen then offers no queue.
  }
}

export function readDeviceUser(): DeviceUser | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const v: unknown = JSON.parse(raw);
    return isDeviceUser(v) ? { id: v.id, email: v.email } : null;
  } catch {
    return null;
  }
}

export function forgetDeviceUser(): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to forget when storage is refused.
  }
}
