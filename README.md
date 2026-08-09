# Free Swipe for SillyTavern

A simple SillyTavern extension that adds several utility slash commands, including `/aswipe`, `/editmessage`, `/updatetoolmessage`, and `/evalmessage`.

SillyTavern's default `/addswipe` command only supports adding swipes to the very last message, and does not support user messages. **Free Swipe** solves this by allowing you to add a swipe to **any** message in the chat history, including user messages. It also provides advanced tools for manipulating message states and tool invocations.

⚠️ **IMPORTANT:** Because SillyTavern's default UI does not support swiping on past messages, you will not be able to see or switch between the swipes you add to older messages using the default UI. Therefore, it is **highly recommended** to use this extension alongside **[Deep-Swipe](https://github.com/Rurijian/Deep-Swipe)**.

## Features

* **Any Message Swiping:** Add swipes to any message in the chat history, not just the last one.
* **User Messages:** Fully supports adding swipes to User messages.
* **Flexible Targeting:** Supports negative message IDs (e.g., `-1` for the last message, `-2` for the second to last).
* **Advanced Message Editing:** Force open the editor for any message, including hidden/system messages (like tool calls), allowing you to move them around.
* **Tool Message Management:** Refresh tool message UI from their underlying JSON data, supporting batch updates and specific tool message indexing.
* **Developer Tools:** Evaluate raw JavaScript directly on message objects for complex macros and state manipulation.

## Installation

Install directly via SillyTavern's built-in extension installer:
1. Open SillyTavern and go to the **Extensions** menu (block icon).
2. Click **Install Extension**.
3. Paste the URL of this GitHub repository and click Install.

## Usage

### `/aswipe` (Aliases: `/as`)
Add a swipe to any message.

**Syntax:**
`/aswipe switch=<true/false> [message_id] [text]`

**Parameters:**
* `switch` (Optional): `true` or `false`. If `true`, immediately switches the message to display the new swipe. This is a named parameter and must be written as `switch=true` or `switch=false`.
* `[message_id]` (Optional): The ID of the message. Leave empty for the last message. Supports negative numbers (e.g., `-2` for the second to last message). **Note:** If you want to provide `[text]`, you *must* provide the `[message_id]` first.
* `[text]` (Optional): The text content of the new swipe. Defaults to an empty string if not provided.

**Examples:**
* `/aswipe` - Adds an empty swipe to the last message.
* `/aswipe -2` - Adds an empty swipe to the second-to-last message.
* `/aswipe switch=true -2` - Adds an empty swipe to the second-to-last message and immediately switches to it.
* `/aswipe -2 "This is a new swipe"` - Adds a swipe with the text "This is a new swipe" to the second-to-last message.

---

### `/editmessage` (Aliases: `/em`, `/editmsg`)
Opens the message editor for the specified message. 

This is particularly useful for messages with `"isSmallSys": true` (which are typically tool call messages). By forcing them into edit mode, you can easily move them up or down in the chat UI.

**Syntax:**
`/editmessage [message_id]`

---

### `/updatetoolmessage` (Aliases: `/ut`, `/updatetmsg`)
Updates the displayed text of a tool message based on its actual underlying JSON (`extra.tool_invocations`). Useful when the JSON content has been modified but the frontend UI hasn't refreshed.

**Syntax:**
`/updatetoolmessage [save=true/false] [message_id | all | ni]`

**Parameters:**
* `save` (Optional): `true` or `false`. Whether to save the chat after updating. Defaults to `true`.
* `[message_id]` (Optional): The ID of the message. Supports standard IDs, negative IDs, `all` (updates all tool messages in the chat), or `ni` format (e.g., `0i` for the first tool message, `-1i` for the last tool message).

**Examples:**
* `/updatetmsg all` - Refreshes all tool messages in the current chat.
* `/updatetmsg -1i` - Refreshes the very last tool message in the chat.

---

### `/evalmessage` (Aliases: `/evalmsg`, `/evalm`)
⚠️ **DANGEROUS (Developer Tool):** Evaluates JavaScript code in the context of a message object (`this` refers to the message object).

**Syntax:**
`/evalmessage [save=true/false] [message_id] [code]`

**Example Use Case (Macro):**
You can pipe this with `/updatetoolmessage` to modify a tool message's JSON and immediately refresh the UI:
`/evalmsg save=false -2 "this.extra.tool_invocations[0].result = 'test'" | /updatetmsg -2`

## Prerequisites

* SillyTavern (latest version recommended).
* [Deep-Swipe](https://github.com/Rurijian/Deep-Swipe) (Highly recommended for UI support on past messages).

## License

MIT License.
