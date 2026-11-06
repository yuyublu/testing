/*
 * sandbox-containment probe  (security research / self-test)
 * 목적: raw 프리뷰 내부(샌드박스 오리진)에서 실행되는 스크립트가
 *       부모(proxy)·top(app.slack.com)·호스트 메시지 채널에
 *       "어디까지 닿는지"를 측정한다. 데이터 반출 없음 — 결과는 화면에만 출력.
 * 사용: VM + 던져도 되는 Slack 워크스페이스에서만. 결과는 HackerOne 보고용.
 */
(function () {
  "use strict";
  var out = [];
  function log(k, v) { out.push([k, String(v)]); render(); }

  // ── 1. 나는 어디서 도는가 ──────────────────────────────
  log("location.href", location.href);
  log("origin", location.origin);
  try { log("document.cookie(len)", document.cookie.length); }
  catch (e) { log("document.cookie", "THROW " + e.name); }
  try { log("localStorage", typeof localStorage); }
  catch (e) { log("localStorage", "THROW " + e.name); }
  try { log("ancestorOrigins", JSON.stringify(Array.prototype.slice.call(location.ancestorOrigins || []))); }
  catch (e) { log("ancestorOrigins", "n/a"); }
  log("self === top?", window.self === window.top);
  log("parent === top?", window.parent === window.top);

  // ── 2. 조상 창에 접근되나 (same-origin이면 읽힘, cross-origin이면 throw) ──
  function probeWin(name, w) {
    try { log(name + ".location.href", w.location.href + "  [READABLE]"); }
    catch (e) { log(name + ".location", "cross-origin blocked (" + e.name + ")"); }
    try { log(name + ".document", w.document ? "ACCESSIBLE" : "null"); }
    catch (e) { log(name + ".document", "cross-origin blocked (" + e.name + ")"); }
  }
  probeWin("parent(proxy)", window.parent);
  probeWin("top", window.top);

  // ── 3. parent(proxy)가 same-origin이면 그 DOM에서 뭘 보나 ──
  try {
    var pd = window.parent.document;
    var cfg = pd.getElementById("mcp-proxy-config");
    log("proxy config", cfg ? cfg.textContent.replace(/\s+/g, " ").slice(0, 200) : "none");
    var ifr = pd.querySelector("iframe");
    log("my iframe sandbox", ifr ? ifr.getAttribute("sandbox") : "n/a");
    log("my iframe src/srcdoc", ifr ? (ifr.src || (ifr.srcdoc ? "[srcdoc]" : "?")) : "n/a");
    // 쓰기 시도(틈 측정): 속성 변경이 되돌려지는지
    try { pd.body.setAttribute("data-probe", "1"); log("proxy body attr write", "OK (not reverted?)"); }
    catch (e) { log("proxy body attr write", "THROW " + e.name); }
  } catch (e) {
    log("proxy DOM", "cross-origin blocked (" + e.name + ")");
  }

  // ── 4. 호스트/proxy가 우리에게 보내는 메시지 수신(수동) ──
  window.addEventListener("message", function (e) {
    var who = e.source === window.parent ? "parent" : (e.source === window.top ? "top" : "other");
    log("<< msg from " + e.origin + " [" + who + "]", JSON.stringify(e.data).slice(0, 300));
  }, false);

  // ── 5. 능동 프로브 (안전한 것만). P()를 통과하는 메시지를 proxy로 보내
  //        호스트가 응답/행동하는지 관찰한다. 반출·파괴 동작 없음. ──
  function send(target, label, msg) {
    try { target.postMessage(msg, "*"); log(">> " + label, JSON.stringify(msg).slice(0, 200)); }
    catch (e) { log(">> " + label + " THREW", e.name); }
  }
  // (a) b표 메서드 — 핸드셰이크/무해 프로브
  send(window.parent, "ping -> proxy", { jsonrpc: "2.0", id: 1, method: "ping", params: {} });
  send(window.parent, "request-display-mode -> proxy", { jsonrpc: "2.0", id: 2, method: "ui/request-display-mode", params: { mode: "inline" } });
  // (b) 이 인스턴스는 allow_surface_comments=1 → surface-comment 타입 통과
  send(window.parent, "surface-comment/ready -> proxy", { type: "slack/surface-comment/ready" });
  // (c) proxy 중계를 건너뛰고 top에 직접 — 호스트 source검사 뚫리는지
  send(window.top, "ping -> top(direct)", { jsonrpc: "2.0", id: 3, method: "ping", params: {} });

  // ── ⚠️ 아래는 "호스트가 눈에 보이는 행동"을 할 수 있어 기본 비활성.
  //    탈출/월권 여부를 확인할 때만, VM에서 한 줄씩 켜서 관찰할 것. ──
  // send(window.parent, "ui/open-link -> proxy", { jsonrpc:"2.0", id:4, method:"ui/open-link", params:{ url:"https://example.com/PROBE-"+Date.now() } });
  // send(window.parent, "ui/message -> proxy",   { jsonrpc:"2.0", id:5, method:"ui/message",   params:{ text:"PROBE "+Date.now() } });
  // send(window.parent, "ui/notifications/x",     { method:"ui/notifications/probe", params:{} }); // 와일드카드 네임스페이스

  // ── 6. 결과를 화면에 그린다 (반출 X) ──
  function esc(s) { return s.replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function render() {
    var rows = out.map(function (kv) {
      return "<tr><td style='color:#8ab;padding:2px 10px;vertical-align:top;white-space:nowrap'>" +
        esc(kv[0]) + "</td><td style='padding:2px 10px;word-break:break-all'>" + esc(kv[1]) + "</td></tr>";
    }).join("");
    var el = document.getElementById("__probe");
    if (!el) {
      el = document.createElement("div");
      el.id = "__probe";
      el.style.cssText = "position:fixed;inset:0;background:#0b0e14;color:#e6e6e6;overflow:auto;z-index:2147483647;padding:12px;font:12px/1.5 monospace";
      (document.body || document.documentElement).appendChild(el);
    }
    el.innerHTML = "<div style='font-weight:700;margin-bottom:8px'>sandbox-containment probe</div><table style='border-collapse:collapse'>" + rows + "</table>";
  }
  render();
  setTimeout(render, 1500);
})();
