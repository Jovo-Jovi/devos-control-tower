import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from "jose";

export const issuer = "https://token.actions.githubusercontent.com";

export const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks`));

export type OidcVerdict =
  | { ok: true; repository: string; repositoryOwnerId: string }
  | { ok: false; reason: "expired" | "bad_issuer" | "bad_audience" | "bad_signature" | "unavailable" };

const NETWORK_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ENETDOWN",
  "ENETUNREACH",
  "EHOSTDOWN",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
]);

function claimText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isInteger(value)) return String(value);
  return "";
}

function isNetwork(error: unknown, depth = 0): boolean {
  if (depth > 3 || typeof error !== "object" || error === null) return false;
  if (error instanceof TypeError) return true;
  if ("name" in error && error.name === "TimeoutError") return true;
  if ("code" in error && typeof error.code === "string" && NETWORK_CODES.has(error.code)) return true;
  if ("cause" in error) return isNetwork(error.cause, depth + 1);
  return false;
}

function failureReason(error: unknown): Extract<OidcVerdict, { ok: false }>["reason"] {
  if (error instanceof errors.JWTExpired) return "expired";
  if (error instanceof errors.JWKSTimeout) return "unavailable";
  if (error instanceof errors.JWTClaimValidationFailed) {
    if (error.claim === "exp" || error.claim === "nbf" || error.claim === "iat") return "expired";
    if (error.claim === "iss") return "bad_issuer";
    if (error.claim === "aud") return "bad_audience";
    return "bad_signature";
  }
  if (isNetwork(error)) return "unavailable";
  return "bad_signature";
}

export async function verifyGithubOidc(
  token: string,
  options: { audience: string; jwks: JWTVerifyGetKey },
): Promise<OidcVerdict> {
  try {
    const { payload } = await jwtVerify(token, options.jwks, {
      issuer,
      audience: options.audience,
      algorithms: ["RS256"],
    });
    return {
      ok: true,
      repository: claimText(payload.repository),
      repositoryOwnerId: claimText(payload.repository_owner_id),
    };
  } catch (error) {
    return { ok: false, reason: failureReason(error) };
  }
}
