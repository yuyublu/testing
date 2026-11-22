window.parent.postMessage(
  {
    type: "slack/surface-link",
    action: {
      type: "static_select",
      actionId: "yes_no",
      blockId: "confirm",
      selectedOption: { text: "Yes", value: "yes" } // readState: optionFrom = {text:<option>.textContent, value:<option>.value}
    },
    state: {
      confirm: {
        yes_no: {
          type: "static_select",
          selected_option: { // stateEntryFor + bkOption
            text: { type: "plain_text", text: "Yes", emoji: true },
            value: "yes"
          }
        }
      }
    },
    pendingToken: undefined
  },
  "https://app.slack.com" // TARGET = host
);