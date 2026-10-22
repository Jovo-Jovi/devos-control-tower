import { expect, test } from "@playwright/test";

const PRODUCT = "DEV_OS Control Tower";
const TAGLINE = "A private ledger of what your projects report.";
const ALT = "Control Tower sign-in page: a glass card over a city skyline and the planet.";

test.use({
  extraHTTPHeaders: { "user-agent": "WhatsApp/2.23.20.0 A" },
});

function headAndRest(html: string): { head: string; rest: string } {
  const open = html.indexOf("<head");
  const openEnd = html.indexOf(">", open);
  const close = html.indexOf("</head>");
  if (open < 0 || openEnd < 0 || close < 0 || close < openEnd) throw new Error("head is missing");
  return { head: html.slice(openEnd + 1, close), rest: html.slice(close + "</head>".length) };
}

function expectTags(head: string, rest: string): string {
  expect(head).toContain('property="og:type" content="website"');
  expect(head).toContain(`property="og:site_name" content="${PRODUCT}"`);
  expect(head).toContain(`property="og:title" content="${PRODUCT}"`);
  expect(head).toContain(`property="og:description" content="${TAGLINE}"`);
  expect(head).toContain('property="og:image:width" content="1200"');
  expect(head).toContain('property="og:image:height" content="630"');
  expect(head).toContain('property="og:image:type" content="image/jpeg"');
  expect(head).toContain(`property="og:image:alt" content="${ALT}"`);
  expect(head).toContain('name="twitter:card" content="summary_large_image"');
  expect(head).toContain('name="twitter:image"');

  const image = /property="og:image" content="([^"]+)"/.exec(head);
  expect(image).not.toBeNull();
  const url = new URL(image?.[1] ?? "");
  expect(url.protocol === "http:" || url.protocol === "https:").toBe(true);
  expect(url.pathname.startsWith("/_next/static/media/")).toBe(true);

  for (const tag of [
    'property="og:type"',
    'property="og:site_name"',
    'property="og:title"',
    'property="og:description"',
    'property="og:image"',
    'name="twitter:card"',
    'name="twitter:image"',
  ]) {
    expect(rest).not.toContain(tag);
  }
  return url.pathname;
}

test("Link preview tags", async ({ context }) => {
  expect(await context.cookies()).toEqual([]);

  for (const path of ["/sign-in", "/sign-in?reason=auth_error"]) {
    const response = await context.request.get(path);
    expect(response.status()).toBe(200);
    const { head, rest } = headAndRest(await response.text());
    expectTags(head, rest);
  }
});

test("Link preview image", async ({ context }) => {
  expect(await context.cookies()).toEqual([]);
  const signIn = await context.request.get("/sign-in");
  expect(signIn.status()).toBe(200);
  const { head, rest } = headAndRest(await signIn.text());
  const pathname = expectTags(head, rest);

  const image = await context.request.get(pathname);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/jpeg");
  const body = await image.body();
  expect(body.subarray(0, 3).toString("hex")).toBe("ffd8ff");
  expect(body.length).toBeLessThanOrEqual(300_000);

  const home = await context.request.get("/", { maxRedirects: 0 });
  expect(home.status()).toBe(302);
  expect(home.headers().location ?? "").toMatch(/\/sign-in$/);
});
