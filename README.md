# Free Swipe for SillyTavern

A simple SillyTavern extension that adds a `/aswipe` slash command. 

SillyTavern's default `/addswipe` command only supports adding swipes to the very last message, and does not support user messages. **Free Swipe** solves this by allowing you to add a swipe to **any** message in the chat history, including user messages.

⚠️ **IMPORTANT:** Because SillyTavern's default UI does not support swiping on past messages, you will not be able to see or switch between the swipes you add to older messages using the default UI. Therefore, it is **highly recommended** to use this extension alongside **[Deep-Swipe](https://github.com/Rurijian/Deep-Swipe)**.

## Features

* **Any Message:** Add swipes to any message in the chat history, not just the last one.
* **User Messages:** Fully supports adding swipes to User messages.
* **Flexible Targeting:** Supports negative message IDs (e.g., `-1` for the last message, `-2` for the second to last).
* **Auto-Switch:** Optional `switch` parameter to immediately switch to the newly created swipe.

## Installation

Install directly via SillyTavern's built-in extension installer:
1. Open SillyTavern and go to the **Extensions** menu (block icon).
2. Click **Install Extension**.
3. Paste the URL of this GitHub repository and click Install.

## Usage

Use the `/aswipe` (or `/as`) slash command in the chat input box.

**Syntax:**
`/aswipe switch=<true/false> [message_id] [text]`

**Parameters:**
* `switch` (Optional): `true` or `false`. If `true`, immediately switches the message to display the new swipe. This is a named parameter and must be written as `switch=true` or `switch=false`.
* `[message_id]` (Optional): The ID of the message. Leave empty for the last message. Supports negative numbers (e.g., `-2` for the second to last message). **Note:** If you want to provide `[text]`, you *must* provide the `[message_id]` first.
* `[text]` (Optional): The text content of the new swipe. Defaults to an empty string if not provided.

**Examples:**
* `/aswipe` - Adds an empty swipe to the last message.
* `/aswipe -2` - Adds an empty swipe to the second-to-last message. (Useful if you want to scroll up and edit it manually later).
* `/aswipe switch=true -2` - Adds an empty swipe to the second-to-last message and immediately switches to it.
* `/aswipe -2 This is a new swipe` - Adds a swipe with the text "This is a new swipe" to the second-to-last message.
* `/aswipe switch=true 5 A new branch` - Adds a swipe with text to the message with ID 5 and switches to it.

## Prerequisites

* SillyTavern (latest version recommended).
* [Deep-Swipe](https://github.com/Rurijian/Deep-Swipe) (Highly recommended for UI support on past messages).

## License

MIT License.
