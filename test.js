window.parent.postMessage({
  jsonrpc: "2.0",
  id: 1,
  method: "ui/open-link",
  params: { url: "https://www.google.com" }
}, "*");