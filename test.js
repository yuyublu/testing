// 상수: S="slack/app-ui", 유효 surface=["app_home","work_object"], kind "link.open"
// 1) 먼저 hello로 채널 수립 + link.open capability 획득:
window.parent.postMessage({
  type: "slack/app-ui", version: 1, surface: "work_object",
  kind: "hello", payload: { capabilities: ["link.open"] }
}, "https://app.slack.com");
// 2) 그다음 link.open:
window.parent.postMessage({
  type: "slack/app-ui", version: 1, surface: "work_object",
  kind: "link.open", id: "1", payload: { url: "https://www.google.com" }
}, "https://app.slack.com");