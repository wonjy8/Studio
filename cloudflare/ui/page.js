export const page = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Studio</title><link rel="stylesheet" href="/edge-ui.css"><main><a href="/" class="brand">Studio</a><h1>Google로 시작하기</h1><p id="message" role="status" aria-live="polite">연결 상태를 확인하고 있습니다.</p><section id="content"></section></main><script type="module" src="/edge-ui.js"></script></html>`;
export const css = `:root{font:14.5px/1.6 Inter,system-ui,sans-serif;color-scheme:dark;--bg:#111113;--surface:#232327;--ink:#f0f0ed;--accent:#8bb8ff}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink)}main{max-width:880px;margin:48px auto;padding:24px}.brand{color:inherit;text-decoration:none}h1{font-size:22px;font-weight:500}h2{font-size:16px;font-weight:500}button,input,textarea,select{font:inherit;color:inherit;border:0;border-radius:9px;background:var(--surface);padding:10px;max-width:100%}button{cursor:pointer;min-height:44px}button:disabled{opacity:.5;cursor:wait}:focus-visible{outline:2px solid var(--accent);outline-offset:3px}input,textarea{width:100%}textarea{min-height:200px;resize:vertical}label{display:block;margin:16px 0 6px}nav,.actions{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}p{overflow-wrap:anywhere}li{margin:8px 0}.error{color:#ffb4ad}article{margin-top:24px}small{display:block} @media(max-width:600px){main{margin:8px auto;padding:24px}input,textarea,select{font-size:16px}}`;
export function browserClient() {
  const root = document.querySelector("#content"),
    message = document.querySelector("#message");
  const authFailed =
    new URLSearchParams(location.search).get("result") === "failed";
  let actor = null,
    bootstrap = null,
    library = null,
    current = null,
    busy = false,
    dirty = false,
    epoch = 0;
  const errors = {
    REVISION_CONFLICT:
      "다른 화면에서 수정되었습니다. 입력을 유지하고 서버 내용을 다시 확인해 주세요.",
    LOGIN_REQUIRED: "로그인이 필요합니다.",
    ACCOUNT_CHANGED: "계정이 변경되었습니다. 새로 로그인해 주세요.",
    SETUP_REQUIRED: "Drive와 Calendar 필수 권한을 완료해 주세요.",
  };
  function node(tag, text, attrs = {}) {
    const e = document.createElement(tag);
    if (text) e.textContent = text;
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }
  function notice(text, error = false) {
    message.textContent = text;
    message.className = error ? "error" : "";
  }
  function button(text, action, parent = root) {
    const b = node("button", text, { type: "button" });
    b.onclick = action;
    b.disabled = busy;
    parent.append(b);
    return b;
  }
  function setBusy(value) {
    busy = value;
    root
      .querySelectorAll("button,input,textarea,select")
      .forEach((e) => (e.disabled = value));
  }
  async function api(path, method = "GET", body) {
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const r = await fetch(path, {
        method,
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(method === "GET"
            ? {}
            : {
                "Content-Type": "application/json",
                "X-Studio-CSRF": actor?.csrfToken || bootstrap?.csrfToken || "",
              }),
          ...(actor ? { "X-Studio-Account": actor.account.id } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const data = await r.json();
      if (!r.ok) {
        const e = new Error(
          errors[data.error] ||
            "요청을 완료하지 못했습니다. 입력은 유지됩니다. (" +
              data.error +
              ")",
        );
        e.status = r.status;
        throw e;
      }
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }
  async function run(action) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (e) {
      notice(
        e.name === "AbortError"
          ? "응답이 지연되고 있습니다. 다시 시도해 주세요."
          : e.message,
        true,
      );
    } finally {
      setBusy(false);
    }
  }
  async function start(signup = false, reconnect = false) {
    if (
      dirty &&
      !confirm("저장하지 않은 입력을 남기고 로그인 화면으로 이동할까요?")
    )
      return;
    if (
      actor &&
      !reconnect &&
      !confirm(
        "다른 Google 계정으로 전환할까요? 저장하지 않은 입력은 사라집니다.",
      )
    )
      return;
    await run(async () => {
      const result = await api("/api/edge/auth/google/start", "POST", {
        mode: reconnect ? "reconnect" : "signin",
        confirmCreateAccount: signup,
        confirmAccountSwitch: Boolean(actor),
      });
      location.assign(result.url);
    });
  }
  function draw() {
    root.replaceChildren();
    if (!actor) {
      root.append(
        node(
          "p",
          "새 Cloudflare 서비스는 Google 계정으로 별도 등록합니다. 기존 NAS 계정과 데이터는 연결하거나 이전하지 않습니다.",
        ),
      );
      button("Google 로그인", () => start());
      button("새 Google 계정 등록", () => start(true));
      if (!bootstrap?.configured) {
        notice("Google 로그인 운영 설정이 아직 완료되지 않았습니다.", true);
        root.querySelectorAll("button").forEach((b) => (b.disabled = true));
      }
      return;
    }
    root.append(
      node("h2", actor.setup.ready ? "연결 준비 완료" : "필수 연결 확인"),
    );
    const list = node("ul");
    for (const [label, key] of [
      ["Google Drive", "drive"],
      ["Google Calendar", "calendar"],
    ])
      list.append(
        node(
          "li",
          label +
            ": " +
            (actor.setup[key] === "verified" ? "준비 완료" : "권한 확인 필요"),
        ),
      );
    root.append(list);
    const actions = node("div", "", { class: "actions" });
    root.append(actions);
    button(
      "권한 다시 확인",
      () =>
        run(async () => {
          await api("/api/edge/auth/verify", "POST", {});
          await load();
        }),
      actions,
    );
    button("같은 계정으로 다시 연결", () => start(false, true), actions);
    button("다른 계정으로 전환", () => start(true), actions);
    button(
      "Studio 연결 해제",
      () =>
        run(async () => {
          if (
            !confirm(
              "Studio 연결과 세션을 해제할까요? Google 자체 권한이나 파일은 삭제하지 않습니다.",
            )
          )
            return;
          await api("/api/edge/auth/disconnect", "POST", {});
          actor = null;
          library = null;
          current = null;
          dirty = false;
          await load();
        }),
      actions,
    );
    if (!actor.setup.ready) {
      root.append(
        node(
          "p",
          "Drive 파일 접근과 쓰기 가능한 Calendar 연결이 필수입니다. 일부 권한을 거절했다면 같은 계정으로 다시 연결해 주세요.",
        ),
      );
      return;
    }
    root.append(
      node(
        "p",
        "문서 내용은 Studio D1에 저장합니다. 이 화면은 아직 Drive 원본 첨부 업로드를 제공하지 않습니다. 나머지 워크스페이스는 전환 중입니다.",
      ),
    );
    button("내 문서 열기", () => run(openLibrary));
    if (library) drawLibrary();
  }
  async function openLibrary() {
    if (
      dirty &&
      !confirm("저장하지 않은 변경을 버리고 서버 문서를 다시 열까요?")
    )
      return;
    const result = await api("/api/edge/documents");
    library = result;
    current = null;
    dirty = false;
    draw();
    notice("서버에 저장된 문서를 불러왔습니다.");
  }
  function drawLibrary() {
    const section = node("article");
    root.append(section);
    section.append(node("h2", "내 문서"));
    for (const doc of library.documents)
      button(
        doc.title,
        () => {
          if (dirty && !confirm("저장하지 않은 변경을 버릴까요?")) return;
          current = structuredClone(doc);
          dirty = false;
          draw();
        },
        section,
      );
    button(
      "새 문서",
      () => {
        if (dirty && !confirm("저장하지 않은 변경을 버릴까요?")) return;
        current = {
          id: "document-" + crypto.randomUUID(),
          title: "제목 없음",
          blocks: [
            {
              id: "block-" + crypto.randomUUID(),
              type: "paragraph",
              content: [],
            },
          ],
        };
        dirty = true;
        draw();
      },
      section,
    );
    if (!current) return;
    const form = node("form");
    section.append(form);
    form.append(node("label", "문서 제목", { for: "doc-title" }));
    const title = node("input", "", {
      id: "doc-title",
      maxlength: "200",
      required: "",
    });
    title.value = current.title;
    form.append(title);
    title.oninput = () => {
      current.title = title.value;
      dirty = true;
      notice("저장하지 않은 변경이 있습니다.");
    };
    // Rich or unsupported blocks are read-only here; never flatten stored runs.
    for (const block of current.blocks) {
      const editable =
        block.type === "paragraph" &&
        block.content.every((run) =>
          Object.keys(run).every((k) => k === "text"),
        );
      form.append(
        node("label", editable ? "본문" : "기존 블록 · 읽기 전용", {
          for: block.id,
        }),
      );
      const input = node("textarea", "", { id: block.id });
      input.value = block.content.map((r) => r.text).join("");
      input.readOnly = !editable;
      form.append(input);
      input.oninput = () => {
        block.content = input.value ? [{ text: input.value }] : [];
        dirty = true;
        notice("저장하지 않은 변경이 있습니다.");
      };
    }
    const save = button("문서 저장", () => {}, form);
    save.type = "submit";
    form.onsubmit = (e) => {
      e.preventDefault();
      run(async () => {
        const sent = structuredClone(current),
          docs = structuredClone(library.documents),
          index = docs.findIndex((d) => d.id === sent.id);
        if (index < 0) docs.push(sent);
        else docs[index] = sent;
        const result = await api("/api/edge/documents", "PUT", {
          documents: docs,
          revision: library.revision,
        });
        library = result;
        dirty = false;
        draw();
        notice(
          "문서가 저장되었습니다. 다시 열어 서버 내용을 확인할 수 있습니다.",
        );
      });
    };
  }
  async function load() {
    const turn = ++epoch;
    const [b, s] = await Promise.all([
      api("/api/edge/auth/bootstrap"),
      api("/api/edge/session").catch((e) => {
        if (e.status === 401) return null;
        throw e;
      }),
    ]);
    if (turn !== epoch) return;
    bootstrap = b;
    actor = s;
    draw();
    notice(
      authFailed
        ? "Google 연결이 취소되었거나 완료되지 않았습니다. 다시 시도해 주세요."
        : s
          ? "연결 상태를 확인했습니다."
          : "Google 로그인 또는 새 등록을 선택해 주세요.",
      authFailed,
    );
  }
  window.addEventListener("beforeunload", (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      library = null;
      current = null;
      dirty = false;
      load().catch((e) => notice(e.message, true));
    }
  });
  if (location.search) {
    history.replaceState(null, "", location.pathname);
    notice("Google 연결 결과를 확인합니다.");
  }
  load().catch((e) => {
    notice(e.message, true);
    button("다시 확인", () => load().catch((e) => notice(e.message, true)));
  });
}
export const script = `(${browserClient.toString()})();`;
