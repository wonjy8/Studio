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
  let failSave = false,
    startStatus = null,
    switchOnSession = false,
    bCookies = null,
    holdDocument = false,
    releaseDocument,
    documentEntered;
  const puts = [];
  page.on("dialog", (dialog) => dialog.accept());
  await context.route("**/*", async (route) => {
    const req = route.request();
    if (new URL(req.url()).origin === "https://accounts.google.com") {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "Mock Google login",
      });
      return;
    }
    assert.equal(
      new URL(req.url()).origin,
      f.env.APP_ORIGIN,
      "no external network",
    );
    const reqHeaders = req.headers();
    if (
      switchOnSession &&
      new URL(req.url()).pathname === "/api/edge/session"
    ) {
      switchOnSession = false;
      await context.addCookies(bCookies);
      reqHeaders.cookie = bCookies
        .map((c) => c.name + "=" + c.value)
        .join("; ");
    }
    if (req.method() === "PUT")
      puts.push({ headers: reqHeaders, body: JSON.parse(req.postData()) });
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
        headers: reqHeaders,
        ...(req.postData() ? { body: req.postData() } : {}),
      }),
      f.env,
    );
    if (new URL(req.url()).pathname === "/api/edge/auth/google/start")
      startStatus = r.status;
    const headers = Object.fromEntries(r.headers);
    delete headers["set-cookie"];
    const cookies = r.headers.getSetCookie();
    if (cookies.length) headers["set-cookie"] = cookies.join("\n");
    const responseBody = await r.text();
    if (
      holdDocument &&
      req.method() === "GET" &&
      new URL(req.url()).pathname === "/api/edge/documents"
    ) {
      holdDocument = false;
      documentEntered();
      await new Promise((resolve) => (releaseDocument = resolve));
    }
    await route.fulfill({ status: r.status, headers, body: responseBody });
  });
  await page.goto(f.env.APP_ORIGIN);
  await page.getByRole("button", { name: "새 Google 계정 등록" }).waitFor();
  assert.match(await page.locator("main").innerText(), /기존 NAS/);
  await f.finish(await f.begin());
  const aCookies = [...f.jar].map(([name, value]) => ({
    name,
    value,
    url: f.env.APP_ORIGIN,
    secure: true,
    httpOnly: true,
    sameSite: "Lax",
  }));
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
  console.log("QA initial save complete");
  // Actual signed-in reconnect and account-switch buttons must use login CSRF.
  await page.getByRole("button", { name: "같은 계정으로 다시 연결" }).click();
  await page.waitForURL("https://accounts.google.com/**", {
    waitUntil: "commit",
    timeout: 10000,
  });
  assert.equal(startStatus, 200);
  console.log("QA start", startStatus);
  await page.goto(f.env.APP_ORIGIN);
  await page.getByRole("button", { name: "다른 계정으로 전환" }).click();
  await page.waitForURL("https://accounts.google.com/**", {
    waitUntil: "commit",
    timeout: 10000,
  });
  assert.equal(startStatus, 200);
  console.log("QA start", startStatus);
  await page.goto(f.env.APP_ORIGIN);
  f.flags.driveDenied = true;
  await page.getByRole("button", { name: "권한 다시 확인" }).click();
  await page.getByRole("heading", { name: "필수 연결 확인" }).waitFor();
  await page.getByRole("button", { name: "같은 계정으로 다시 연결" }).click();
  await page.waitForURL("https://accounts.google.com/**", {
    waitUntil: "commit",
    timeout: 10000,
  });
  assert.equal(startStatus, 200);
  console.log("QA start", startStatus);
  f.flags.driveDenied = false;
  await f.protectedPost("/api/edge/auth/verify");
  await page.goto(f.env.APP_ORIGIN);
  await page.getByRole("button", { name: "내 문서 열기" }).click();
  await page.getByRole("button", { name: "격리 문서", exact: true }).click();
  await page.getByLabel("본문", { exact: true }).fill("A 비공개 초안");
  await page.evaluate(
    () => (window.detachedForm = document.querySelector("form")),
  );
  // B has the same document revision as A, making revision checks alone insufficient.
  f.flags.subject = "second-account";
  assert.equal(
    (await f.finish(await f.begin({ confirmAccountSwitch: true }))).status,
    200,
  );
  const bSession = await f.session();
  const bDoc = {
    id: "document-b",
    title: "B문서",
    blocks: [
      { id: "block-b", type: "paragraph", content: [{ text: "B 원본" }] },
    ],
  };
  assert.equal(
    (
      await f.call("/api/edge/documents", {
        method: "PUT",
        headers: { "X-Studio-CSRF": bSession.csrfToken },
        data: { documents: [bDoc], revision: 0 },
      })
    ).status,
    200,
  );
  bCookies = [...f.jar].map(([name, value]) => ({
    name,
    value,
    url: f.env.APP_ORIGIN,
    secure: true,
    httpOnly: true,
    sameSite: "Lax",
  }));
  switchOnSession = true;
  await page.getByRole("button", { name: "권한 다시 확인" }).click();
  await page.waitForFunction(() => !document.querySelector("form"));
  assert.ok(
    !(await page.locator("main").innerText()).includes("A 비공개 초안"),
  );
  const before = puts.length;
  await page.waitForFunction(() =>
    [...document.querySelectorAll("button")].some((b) => !b.disabled),
  );
  await page.evaluate(() =>
    window.detachedForm.onsubmit(new Event("submit", { cancelable: true })),
  );
  await page.locator("#message.error").waitFor();
  assert.equal(puts.length, before);
  const bResult = await (await f.call("/api/edge/documents")).json();
  assert.deepEqual(bResult.documents, [bDoc]);
  // A document response already in flight must not reappear after a B session refresh.
  await context.addCookies(aCookies);
  await page.goto(f.env.APP_ORIGIN);
  const enteredDocument = new Promise((resolve) => (documentEntered = resolve));
  holdDocument = true;
  await page.getByRole("button", { name: "내 문서 열기" }).click();
  await enteredDocument;
  await context.addCookies(bCookies);
  await page.evaluate(() => {
    const event = new Event("pageshow");
    Object.defineProperty(event, "persisted", { value: true });
    window.dispatchEvent(event);
  });
  await page.waitForFunction(() =>
    document.querySelector("#message").textContent.includes("연결 상태"),
  );
  releaseDocument();
  await page.locator("#message.error").waitFor();
  assert.equal(
    await page.getByRole("button", { name: "격리 문서", exact: true }).count(),
    0,
  );
  const configured = f.env.GOOGLE_CLIENT_SECRET;
  delete f.env.GOOGLE_CLIENT_SECRET;
  await context.clearCookies();
  await page.goto(f.env.APP_ORIGIN);
  await page.waitForFunction(() =>
    document.querySelector("#message").textContent.includes("운영 설정"),
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Google 로그인", exact: true })
      .isDisabled(),
    true,
  );
  f.env.GOOGLE_CLIENT_SECRET = configured;
  console.log(
    "PASS browser guest/setup, actual signed-in and partial reconnect/switch CSRF, two-account same-revision draft isolation, detached-form rejection, configuration notice, D1 save/failure/reopen, multiline and 320px; all external requests mocked",
  );
} finally {
  await browser.close();
  for (const fn of cleanup) await fn();
}
