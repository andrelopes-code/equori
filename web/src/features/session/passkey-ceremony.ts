import type { components } from "@/api/schema.gen";
import { decodeBase64url, encodeBase64url } from "@/features/session/base64url";

export type PasskeyOptions = components["schemas"]["PasskeyOptions"];
export type PasskeyRequest = NonNullable<
  components["schemas"]["SecondFactorChallenge"]["passkey"]
>;
export type PasskeyCredential = Omit<
  components["schemas"]["PasskeyInput"],
  "name"
>;
export type PasskeyAssertion = NonNullable<
  components["schemas"]["SecondFactorInput"]["passkey"]
>;

const algorithms = [-7, -8, -257];
const timeout = 120000;

// Thrown when the browser refuses, cancels or returns no usable credential.
export class PasskeyCeremonyError extends Error {}

// HA45: WebAuthn exists only in a secure context.
export function passkeysAvailable(): boolean {
  return window.isSecureContext && "PublicKeyCredential" in window;
}

export async function createPasskeyCredential(
  options: PasskeyOptions,
): Promise<PasskeyCredential> {
  const credential = await ceremony(() =>
    navigator.credentials.create({
      publicKey: {
        challenge: decodeBase64url(options.challenge),
        rp: { name: "equori" },
        user: {
          id: decodeBase64url(options.user_id),
          name: options.user_name,
          displayName: options.user_name,
        },
        pubKeyCredParams: algorithms.map((alg) => ({
          type: "public-key" as const,
          alg,
        })),
        excludeCredentials: options.exclude_credentials.map(descriptor),
        attestation: "none",
        authenticatorSelection: {
          residentKey: "discouraged",
          userVerification: "preferred",
        },
        timeout,
      },
    }),
  );
  if (credential === null) {
    throw new PasskeyCeremonyError("no credential");
  }
  const response = (credential as PublicKeyCredential)
    .response as AuthenticatorAttestationResponse;
  const publicKey = response.getPublicKey();
  if (publicKey === null) {
    throw new PasskeyCeremonyError("no public key");
  }

  return {
    client_data_json: encodeBase64url(response.clientDataJSON),
    authenticator_data: encodeBase64url(response.getAuthenticatorData()),
    public_key: encodeBase64url(publicKey),
    algorithm: response.getPublicKeyAlgorithm(),
  };
}

export async function getPasskeyAssertion(
  request: PasskeyRequest,
): Promise<PasskeyAssertion> {
  const credential = await ceremony(() =>
    navigator.credentials.get({
      publicKey: {
        challenge: decodeBase64url(request.challenge),
        allowCredentials: request.allow_credentials.map(descriptor),
        userVerification: "preferred",
        timeout,
      },
    }),
  );
  if (credential === null) {
    throw new PasskeyCeremonyError("no credential");
  }
  const { rawId, response: raw } = credential as PublicKeyCredential;
  const response = raw as AuthenticatorAssertionResponse;

  return {
    credential_id: encodeBase64url(rawId),
    client_data_json: encodeBase64url(response.clientDataJSON),
    authenticator_data: encodeBase64url(response.authenticatorData),
    signature: encodeBase64url(response.signature),
  };
}

function descriptor(id: string): PublicKeyCredentialDescriptor {
  return { type: "public-key", id: decodeBase64url(id) };
}

async function ceremony(
  call: () => Promise<Credential | null>,
): Promise<Credential | null> {
  try {
    return await call();
  } catch (error) {
    throw new PasskeyCeremonyError("the browser refused", { cause: error });
  }
}
