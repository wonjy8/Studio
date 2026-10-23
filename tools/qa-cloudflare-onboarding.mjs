import assert from "node:assert/strict";
import { googleEdgeFixture } from "../tests/helpers/google-edge-fixture.js";
const { chromium } = await import(
  process.env.STUDIO_PLAYWRIGHT_MODULE ||
    "/tmp/studio-pages-qa/node_modules/playwright/index.mjs"
);
const cleanup = [];
const f = await googleEdgeFixture({ after: (fn) => cleanup.push(fn) });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(),
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  let failSave = false;
  await context.route("**/*", async (route) => {
    const req = route.request();
    assert.equal(
      new URL(req.url()).origin,
      f.env.APP_ORIGIN,
      "no external network",
    );
    if (failSave && req.method() === "PUT") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "EDGE_STORAGE_UNAVAILABLE" }),
      });
      return;
    }
    const r = await f.worker.fetch(
      new Request(req.url(), {
        method: req.method(),
        headers: req.headers(),
        ...(req.postData() ? { body: req.postData() } : {}),
      }),
      f.env,
    );
    const headers = Object.fromEntries(r.headers);
    delete headers["set-cookie"];
    const cookies = r.headers.getSetCookie();
    if (cookies.length) headers["set-cookie"] = cookies.join("\n");
    await route.fulfill({ status: r.status, headers, body: await r.text() });
  });
  await page.goto(f.env.APP_ORIGIN);
  await page.getByRole("button", { name: "새 Google 계정 등록" }).waitFor();
  assert.match(await page.locator("main").innerText(), /기존 NAS/);
  await f.finish(await f.begin());
  await context.addCookies(
    [...f.jar].map(([name, value]) => ({
      name,
      value,
      url: f.env.APP_ORIGIN,
      secure: true,
      httpOnly: true,
      sameSite: "Lax",
    })),
  );
  await page.reload();
  await page.getByRole("button", { name: "내 문서 열기" }).click();
  await page.getByRole("button", { name: "새 문서", exact: true }).click();
  await page.getByLabel("문서 제목").fill("격리 문서");
  await page.getByLabel("본문", { exact: true }).fill("첫째 줄\n한글 문서");
  failSave = true;
  await page.getByRole("button", { name: "문서 저장" }).click();
  await page.locator("#message.error").waitFor();
  assert.equal(
    await page.getByLabel("본문", { exact: true }).inputValue(),
    "첫째 줄\n한글 문서",
  );
  failSave = false;
  await page.getByRole("button", { name: "문서 저장" }).click();
  await page.waitForFunction(() =>
    document.querySelector("#message").textContent.includes("문서가 저장"),
  );
  await page.reload();
  await page.getByRole("button", { name: "내 문서 열기" }).click();
  await page.getByRole("button", { name: "격리 문서", exact: true }).click();
  assert.equal(
    await page.getByLabel("본문", { exact: true }).inputValue(),
    "첫째 줄\n한글 문서",
  );
  await page.setViewportSize({ width: 320, height: 700 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: "/tmp/cloudflare-onboarding-mobile.png",
    fullPage: true,
  });
  f.flags.driveDenied = true;
  await page.getByRole("button", { name: "권한 다시 확인" }).click();
  await page.getByRole("heading", { name: "필수 연결 확인" }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "내 문서 열기" }).count(),
    0,
  );
  console.log(
    "PASS browser guest/setup, real fixture session, D1 document save/failure/reopen, multiline and 320px layout; no external requests",
  );
} finally {
  await browser.close();
  for (const fn of cleanup) await fn();
}
