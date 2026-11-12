/*
 * sandbox-containment probe
 * raw 프리뷰 내부에서 실행되는 스크립트가
 * parent(proxy)/top(app.slack.com)/호스트 메시지 채널에 어디까지 닿는지를 측정
 */
(function () {
  "use strict";
  var out = [];
  function log(k, v) { out.push([k, String(v)]); render(); }

  // 1. whoami
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

  // 2. parent window에 대한 접근성
  function probeWin(name, w) {
    try { log(name + ".location.href", w.location.href + "  [READABLE]"); }
    catch (e) { log(name + ".location", "cross-origin blocked (" + e.name + ")"); }
    try { log(name + ".document", w.document ? "ACCESSIBLE" : "null"); }
    catch (e) { log(name + ".document", "cross-origin blocked (" + e.name + ")"); }
  }
  probeWin("parent(proxy)", window.parent);
  probeWin("top", window.top);

  // 3. parent(proxy)가 same-origin이면 그 DOM에서 뭘 볼 수 있는지
  try {
    var pd = window.parent.document;
    var cfg = pd.getElementById("mcp-proxy-config");
    log("proxy config", cfg ? cfg.textContent.replace(/\s+/g, " ").slice(0, 200) : "none");
    var ifr = pd.querySelector("iframe");
    log("my iframe sandbox", ifr ? ifr.getAttribute("sandbox") : "n/a");
    log("my iframe src/srcdoc", ifr ? (ifr.src || (ifr.srcdoc ? "[srcdoc]" : "?")) : "n/a");
    // 속성 변경이 되돌려지는지
    try { pd.body.setAttribute("data-probe", "1"); log("proxy body attr write", "OK (not reverted?)"); }
    catch (e) { log("proxy body attr write", "THROW " + e.name); }
  } catch (e) {
    log("proxy DOM", "cross-origin blocked (" + e.name + ")");
  }

  // 4. 호스트/proxy가 보내는 메시지 수신
  window.addEventListener("message", function (e) {
    var who = e.source === window.parent ? "parent" : (e.source === window.top ? "top" : "other");
    log("<< msg from " + e.origin + " [" + who + "]", JSON.stringify(e.data).slice(0, 300));
  }, false);

  // 5. P()를 통과하는 메시지를 proxy로 보내 호스트가 응답/행동하는지 관찰
  function send(target, label, msg) {
    try { target.postMessage(msg, "*"); log(">> " + label, JSON.stringify(msg).slice(0, 200)); }
    catch (e) { log(">> " + label + " THREW", e.name); }
  }
  // (a) methods in b
  send(window.parent, "ping -> proxy", { jsonrpc: "2.0", id: 1, method: "ping", params: {} });
  send(window.parent, "request-display-mode -> proxy", { jsonrpc: "2.0", id: 2, method: "ui/request-display-mode", params: { mode: "inline" } });
  // (b) allow_surface_comments=1 -> surface-comment 타입 통과
  send(window.parent, "surface-comment/ready -> proxy", { type: "slack/surface-comment/ready" });
  // (c) proxy 건너뛰고 top에 직접 요청
  send(window.top, "ping -> top(direct)", { jsonrpc: "2.0", id: 3, method: "ping", params: {} });

  // 6. 결과를 화면에
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