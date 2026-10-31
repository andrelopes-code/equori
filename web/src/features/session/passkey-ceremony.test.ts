import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PasskeyCeremonyError,
  createPasskeyCredential,
  getPasskeyAssertion,
  passkeysAvailable,
} from "@/features/session/passkey-ceremony";

const buffer = (...bytes: number[]) => new Uint8Array(bytes).buffer;

const options = {
  challenge: "AQID",
  user_id: "AQ",
  user_name: "ana@example.com",
  exclude_credentials: ["AQIDBA"],
};

function stubCredentials(methods: { create?: unknown; get?: unknown }) {
  Object.defineProperty(navigator, "credentials", {
    value: methods,
    configurable: true,
  });
}

function setSecure(value: boolean) {
  Object.defineProperty(window, "isSecureContext", {
    value,
    configurable: true,
  });
}

function attestation(publicKey: ArrayBuffer | null) {
  return {
    response: {
      clientDataJSON: buffer(1),
      getAuthenticatorData: () => buffer(2),
      getPublicKey: () => publicKey,
      getPublicKeyAlgorithm: () => -7,
    },
  };
}

describe("passkeysAvailable", () => {
  beforeEach(() => {
    vi.stubGlobal("PublicKeyCredential", vi.fn());
    setSecure(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setSecure(true);
  });

  it("is true in a secure context with PublicKeyCredential", () => {
    expect(passkeysAvailable()).toBe(true);
  });

  it("is false outside a secure context", () => {
    setSecure(false);

    expect(passkeysAvailable()).toBe(false);
  });

  it("is false without PublicKeyCredential", () => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, "PublicKeyCredential");

    expect(passkeysAvailable()).toBe(false);
  });
});

describe("createPasskeyCredential", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "credentials");
  });

  it("returns the credential in base64url", async () => {
    const create = vi.fn().mockResolvedValue(attestation(buffer(3)));
    stubCredentials({ create });

    const credential = await createPasskeyCredential(options);

    expect(credential).toEqual({
      client_data_json: "AQ",
      authenticator_data: "Ag",
      public_key: "Aw",
      algorithm: -7,
    });
    const [{ publicKey }] = create.mock.calls[0] as [
      { publicKey: PublicKeyCredentialCreationOptions },
    ];
    expect([...new Uint8Array(publicKey.challenge as ArrayBuffer)]).toEqual([
      1, 2, 3,
    ]);
    expect(publicKey.pubKeyCredParams.map((p) => p.alg)).toEqual([
      -7, -8, -257,
    ]);
    expect(publicKey.attestation).toBe("none");
  });

  it("rejects when the public key is null", async () => {
    stubCredentials({ create: vi.fn().mockResolvedValue(attestation(null)) });

    await expect(createPasskeyCredential(options)).rejects.toBeInstanceOf(
      PasskeyCeremonyError,
    );
  });

  it("rejects when the browser refuses", async () => {
    stubCredentials({
      create: vi
        .fn()
        .mockRejectedValue(new DOMException("", "NotAllowedError")),
    });

    await expect(createPasskeyCredential(options)).rejects.toBeInstanceOf(
      PasskeyCeremonyError,
    );
  });
});

describe("getPasskeyAssertion", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "credentials");
  });

  it("returns the assertion in base64url", async () => {
    const get = vi.fn().mockResolvedValue({
      rawId: buffer(4),
      response: {
        clientDataJSON: buffer(1),
        authenticatorData: buffer(2),
        signature: buffer(5),
      },
    });
    stubCredentials({ get });

    const assertion = await getPasskeyAssertion({
      challenge: "AQID",
      allow_credentials: ["AQIDBA"],
    });

    expect(assertion).toEqual({
      credential_id: "BA",
      client_data_json: "AQ",
      authenticator_data: "Ag",
      signature: "BQ",
    });
    const [{ publicKey }] = get.mock.calls[0] as [
      { publicKey: PublicKeyCredentialRequestOptions },
    ];
    expect(publicKey.allowCredentials).toHaveLength(1);
    expect([
      ...new Uint8Array(publicKey.allowCredentials?.[0]?.id as ArrayBuffer),
    ]).toEqual([1, 2, 3, 4]);
  });
});
