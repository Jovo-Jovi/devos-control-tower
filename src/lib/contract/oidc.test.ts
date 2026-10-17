import { createLocalJWKSet, errors, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { issuer, verifyGithubOidc } from "./oidc";

const AUDIENCE = "http://localhost:3999";
const REPOSITORY = "fixture-org/fixture-repo";
const OWNER = "424242";

let localJwks: JWTVerifyGetKey;
let privateKey: CryptoKey;
let otherPrivateKey: CryptoKey;

async function sign(options?: {
  key?: CryptoKey | Uint8Array;
  alg?: string;
  iss?: string;
  aud?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const builder = new SignJWT({
    repository: REPOSITORY,
    repository_owner_id: OWNER,
  })
    .setProtectedHeader({ alg: options?.alg ?? "RS256" })
    .setIssuer(options?.iss ?? issuer)
    .setAudience(options?.aud ?? AUDIENCE)
    .setIssuedAt(options?.iat ?? now - 30)
    .setExpirationTime(options?.exp ?? now + 600);
  if (options?.nbf !== undefined) builder.setNotBefore(options.nbf);
  return builder.sign(options?.key ?? privateKey);
}

describe("U-T02-2 verifyGithubOidc", () => {
  beforeAll(async () => {
    const keys = await generateKeyPair("RS256");
    privateKey = keys.privateKey;
    const other = await generateKeyPair("RS256");
    otherPrivateKey = other.privateKey;
    const publicJwk = await exportJWK(keys.publicKey);
    publicJwk.alg = "RS256";
    localJwks = createLocalJWKSet({ keys: [publicJwk] });
  });

  it("accepts a valid token and returns both claims", async () => {
    const verdict = await verifyGithubOidc(await sign(), { audience: AUDIENCE, jwks: localJwks });
    expect(verdict).toEqual({ ok: true, repository: REPOSITORY, repositoryOwnerId: OWNER });
  });

  it("returns expired when the token is expired", async () => {
    const now = Math.floor(Date.now() / 1000);
    const verdict = await verifyGithubOidc(await sign({ iat: now - 120, exp: now - 60 }), {
      audience: AUDIENCE,
      jwks: localJwks,
    });
    expect(verdict).toEqual({ ok: false, reason: "expired" });
  });

  it("returns expired when nbf is in the future", async () => {
    const now = Math.floor(Date.now() / 1000);
    const verdict = await verifyGithubOidc(await sign({ nbf: now + 600, exp: now + 1200 }), {
      audience: AUDIENCE,
      jwks: localJwks,
    });
    expect(verdict).toEqual({ ok: false, reason: "expired" });
  });

  it("returns bad_issuer for the wrong issuer", async () => {
    const verdict = await verifyGithubOidc(await sign({ iss: "http://localhost:3998" }), {
      audience: AUDIENCE,
      jwks: localJwks,
    });
    expect(verdict).toEqual({ ok: false, reason: "bad_issuer" });
  });

  it("returns bad_audience for the wrong audience", async () => {
    const verdict = await verifyGithubOidc(await sign({ aud: "http://localhost:3997" }), {
      audience: AUDIENCE,
      jwks: localJwks,
    });
    expect(verdict).toEqual({ ok: false, reason: "bad_audience" });
  });

  it("returns bad_signature when another key signed the token", async () => {
    const verdict = await verifyGithubOidc(await sign({ key: otherPrivateKey }), {
      audience: AUDIENCE,
      jwks: localJwks,
    });
    expect(verdict).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("returns bad_signature for a malformed token", async () => {
    const verdict = await verifyGithubOidc("not-a-jwt", { audience: AUDIENCE, jwks: localJwks });
    expect(verdict).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("returns bad_signature for HS256", async () => {
    const verdict = await verifyGithubOidc(
      await sign({ alg: "HS256", key: new TextEncoder().encode("local-test-secret") }),
      { audience: AUDIENCE, jwks: localJwks },
    );
    expect(verdict).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("returns unavailable when the key set times out", async () => {
    const timingOut: JWTVerifyGetKey = () => {
      throw new errors.JWKSTimeout();
    };
    const verdict = await verifyGithubOidc(await sign(), { audience: AUDIENCE, jwks: timingOut });
    expect(verdict).toEqual({ ok: false, reason: "unavailable" });
  });

  it("returns unavailable when the key set cannot be fetched", async () => {
    const offline: JWTVerifyGetKey = () => {
      throw new TypeError("fetch failed");
    };
    const verdict = await verifyGithubOidc(await sign(), { audience: AUDIENCE, jwks: offline });
    expect(verdict).toEqual({ ok: false, reason: "unavailable" });
  });
});
