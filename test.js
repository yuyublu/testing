window.parent.postMessage({
  type: "slack/surface-link",
  action: {
    type:     "button",
    actionId: "open_google",        // data-slack-action
    blockId:  "links",              // data-slack-block
    label:    "구글 열기"            // 버튼 textContent (readState가 label에 채움)
    // value 없음  ← data-slack-value를 안 줬으니 생략
    // url   없음  ← 브리지에 url 필드 자체가 없음 ★
  },
  state: {},                        // 입력 요소 없음(버튼은 state 제외) → 빈 객체
  // pendingToken: "<생성된 토큰>"
}, "https://app.slack.com");   // TARGET = window.parent = 프록시