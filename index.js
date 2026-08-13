import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { getMessageTimeStamp } from "../../../RossAscends-mods.js";
import { ToolManager } from '../../../tool-calling.js';
import { isFalseBoolean, isTrueBoolean, stringToRange } from '../../../utils.js';
import { IGNORE_SYMBOL } from '../../../constants.js';
import { 
    saveSettingsDebounced,
    deleteSwipe,
    deleteMessage,
    saveChatConditional,
    reloadCurrentChat,
    syncMesToSwipe,
    extractMessageBias,
    messageEdit,
    updateMessageBlock,
    eventSource, 
    event_types, 
    main_api, 
    stopGeneration,
} from "../../../../script.js";

const extensionName = "st-extension-freeswipe";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionSettings = extension_settings[extensionName];
const defaultSettings = {};

async function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }

    // Updating settings in the UI
    $("#freeswipe_setting").prop("checked", extension_settings[extensionName].freeswipe_setting).trigger("input");
}

/**
 * Tries to parse a string as JSON, returning the original string if parsing fails.
 * @param {string} str The string to try to parse
 * @returns {object|string} Parsed JSON or the original string
 */
function tryParse(str) {
    try {
        return JSON.parse(str);
    } catch {
        return str;
    }
}
/**
 * Groups tool names by count.
 * @param {string[]} toolNames Tool names
 * @returns {string} Grouped tool names
 */
function groupToolNames(toolNames) {
    const toolCounts = toolNames.reduce((acc, name) => {
        acc[name] = (acc[name] || 0) + 1;
        return acc;
    }, {});
    return Object.entries(toolCounts).map(([name, count]) => count > 1 ? `${name} (${count})` : name).join(', ');
}
/**
 * Formats a message with tool invocations.
 * @param {ToolInvocation[]} invocations Tool invocations.
 * @returns {string} Formatted message with tool invocations.
 */
function formatToolInvocationMessage(invocations) {
    if (!Array.isArray(invocations) || invocations.length === 0) return '';

    const data = structuredClone(invocations);
    const detailsElement = document.createElement('details');
    const summaryElement = document.createElement('summary');
    const preElement = document.createElement('pre');
    const codeElement = document.createElement('code');
    codeElement.classList.add('language-json');
    data.forEach(i => {
        i.parameters = tryParse(i.parameters);
        i.result = tryParse(i.result);
    });
    codeElement.textContent = JSON.stringify(data, null, 2);
    const toolNames = data.map(i => i.displayName || i.name);
    summaryElement.textContent = `Tool calls: ${groupToolNames(toolNames)}`;
    preElement.append(codeElement);
    detailsElement.append(summaryElement, preElement);
    
    return detailsElement.outerHTML;
}
/**
 * @returns {number}
 */
function calcId(chat, id) {
    if (id === undefined || id === null || id === '') {
        return chat.length - 1; // 默认最后一条
    }
    id = parseInt(id, 10);
    if (isNaN(id)) {
        return NaN; // Message ID is invalid
    }
    if (id < 0) {
        id = chat.length + id;
    }
    if (id < 0 || id >= chat.length) {
        return NaN; // Message ID is out of bounds
    }
    return id;
}
/**
 * @returns {array}
 */
function getAllToolMessageIds(chat) {
    const toolMessages = [];
    for (let i = 0; i < chat.length; i++) {
        const invocations = chat[i]?.extra?.tool_invocations;
        if (Array.isArray(invocations) && invocations.length > 0) {
            toolMessages.push(i);
        }
    }
    return toolMessages;
}

async function registerSlashCommands() {
    try {
        const { SlashCommand } = await import('/scripts/slash-commands/SlashCommand.js');
        const { SlashCommandParser } = await import('/scripts/slash-commands/SlashCommandParser.js');
        const { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } = await import('/scripts/slash-commands/SlashCommandArgument.js');
        const { commonEnumProviders } = await import('/scripts/slash-commands/SlashCommandCommonEnumsProvider.js');

        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'aswipe',
            helpString: 'Free Swipe - Add a swipe to any message. \nUsage: /aswipe [switch=true/false] [message_id] [text]',
            returns: 'string',
            aliases: ['as'],
            namedArgumentList: [
                SlashCommandNamedArgument.fromProps({
                    name: 'switch',
                    description: 'switch to the new swipe directly',
                    typeList: [ARGUMENT_TYPE.BOOLEAN],
                    enumList: commonEnumProviders.boolean()(),
                }),
            ],
            splitUnnamedArgument: true,
            splitUnnamedArgumentCount: 2,
            unnamedArgumentList: [
                new SlashCommandArgument('message id (leave empty for the last message)', [ARGUMENT_TYPE.NUMBER], false),
                new SlashCommandArgument('swipe text', [ARGUMENT_TYPE.STRING], false),
            ],
            callback: async (args, argId, argText) => {
                // Handle splitUnnamedArgument - argId might be an array with both values
                if (Array.isArray(argId) && argId.length >= 2) {
                    argText = argId[1];
                    argId = argId[0];
                } else if (Array.isArray(argId) && argId.length === 1) {
                    argId = argId[0];
                }

                const chat = getContext()?.chat;
                if (!chat || chat.length === 0) {
                    toastr.warning('No messages to add swipes to.', 'Free Swipe');
                    return '';
                }

                // 1. 解析 ID 
                let id = calcId(chat, argId);
                if (isNaN(id)) {
                    toastr.error('Message ID is invalid or out of bounds.', 'Free Swipe');
                    return '';
                }

                const targetMessage = chat[id];
                const swipeText = argText ?? '';
                if (!targetMessage) {
                    toastr.warning('No messages to add swipes to.', 'Free Swipe');
                    return '';
                }

                // 2. 初始化 swipe 结构（兼容老聊天记录）
                if (!Array.isArray(targetMessage.swipes)) {
                    targetMessage.swipes = [targetMessage.mes];
                    targetMessage.swipe_info = [{}];
                    targetMessage.swipe_id = 0;
                }
                if (!Array.isArray(targetMessage.swipe_info)) {
                    targetMessage.swipe_info = targetMessage.swipes.map(() => ({}));
                }

                // 3. 准备底层数据并插入新 Swipe
                const timeStamp = typeof getMessageTimeStamp === 'function' ? getMessageTimeStamp() : Date.now();
                const biasStr = typeof extractMessageBias === 'function' ? extractMessageBias(swipeText) : '';
                
                targetMessage.swipes.push(swipeText);
                targetMessage.swipe_info.push({
                    send_date: timeStamp,
                    gen_started: null,
                    gen_finished: null,
                    extra: {
                        bias: biasStr,
                        gen_id: Date.now(),
                        api: 'manual',
                        model: 'slash command (freeswipe)',
                    },
                });

                const newSwipeId = targetMessage.swipes.length - 1;

                // 4. 处理 switch=true
                if (isTrueBoolean(args.switch)) {
                    // 同步输入框防止丢字，只在操作最后一条消息时有意义
                    if (id === chat.length - 1 && typeof syncMesToSwipe === 'function') {
                        syncMesToSwipe();
                    }
                    targetMessage.swipe_id = newSwipeId;
                    targetMessage.mes = targetMessage.swipes[newSwipeId];
                    targetMessage.extra = structuredClone(targetMessage.swipe_info[newSwipeId]?.extra ?? targetMessage.extra ?? {});
                }

                // 5. 保存并刷新 UI
                await saveChatConditional();
                await reloadCurrentChat();

                return String(newSwipeId);
            },
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'editmessage',
            helpString: 'Free Swipe - Opens the message editor for the specified message.',
            aliases: ['em', 'editmsg'],
            unnamedArgumentList: [
                new SlashCommandArgument('message id (leave empty for the last message)', [ARGUMENT_TYPE.NUMBER], false),
            ],
            callback: async (args, argId) => {
                const chat = getContext()?.chat;
                if (!chat || chat.length === 0) {
                    toastr.warning('No messages to edit.', 'Free Swipe');
                    return;
                }

                let id = calcId(chat, argId);
                if (isNaN(id)) {
                    toastr.error('Message ID is invalid or out of bounds.', 'Free Swipe');
                    return '';
                }
                if (!chat[id]) {
                    toastr.warning('No messages to edit.', 'Free Swipe');
                    return '';
                }

                await messageEdit(id);
                return '';
            },
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'updatetoolmessage',
            helpString: 'Free Swipe - Updates the specified tool message from its actual JSON.\nUsage: /updatetmsg [save=true/false] [message_id | all | ni (e.g. 0i, -1i)] [code]',
            returns: 'string',
            aliases: ['ut', 'updatetmsg'],
            namedArgumentList: [
                SlashCommandNamedArgument.fromProps({
                    name: 'save',
                    description: 'Whether to save the chat after updating the message',
                    typeList: [ARGUMENT_TYPE.BOOLEAN],
                    defaultValue: 'true',
                    enumList: commonEnumProviders.boolean()(),
                }),
            ],
            splitUnnamedArgument: true,
            splitUnnamedArgumentCount: 2,
            unnamedArgumentList: [
                new SlashCommandArgument('message id (leave empty for the last message, "all" for all tool messages, "ni" for n-th tool message)', [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.NUMBER], false),
                new SlashCommandArgument('code for the message', [ARGUMENT_TYPE.STRING], false),
            ],
            callback: async (args, argId, argText) => {
                if (Array.isArray(argId) && argId.length >= 2) {
                    argText = argId[1];
                    argId = argId[0];
                } else if (Array.isArray(argId) && argId.length === 1) {
                    argId = argId[0];
                }

                const chat = getContext()?.chat;
                if (!chat || chat.length === 0) {
                    toastr.warning('No messages to update.', 'Free Swipe');
                    return '';
                }

                let messagesToUpdate = [];
                const strArgId = String(argId ?? '').trim().toLowerCase();

                if (strArgId === 'all') {
                    messagesToUpdate = getAllToolMessageIds(chat);
                    if (messagesToUpdate.length === 0) {
                        toastr.warning('No tool messages to update.', 'Free Swipe');
                        return '';
                    }
                } else {
                    let id;
                    if (strArgId.endsWith('i') && strArgId.length > 1) {
                        const toolMessageIds = getAllToolMessageIds(chat);
                        if (toolMessageIds.length === 0) {
                            toastr.warning('No tool messages to update.', 'Free Swipe');
                            return '';
                        }
                        id = calcId(toolMessageIds, strArgId);
                        if (isNaN(id)) {
                            toastr.error('Message ID is invalid or out of bounds.', 'Free Swipe');
                            return '';
                        }
                        id = toolMessageIds[id];
                    } else {
                        id = calcId(chat, strArgId);
                        if (isNaN(id)) {
                            toastr.error('Message ID is invalid or out of bounds.', 'Free Swipe');
                            return '';
                        }
                    }
                    const invocations = chat[id]?.extra?.tool_invocations;
                    if (!Array.isArray(invocations) || invocations.length === 0) {
                        toastr.error('Selected message is not a valid tool message.', 'Free Swipe');
                        return '';
                    }
                    messagesToUpdate.push(id);
                }

                let result = '', fallback = false, func;
                const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                for (const id of messagesToUpdate) {
                    if (argText) {
                        try {
                            if (fallback) {
                                result = await func.call(chat[id]);
                            } else {
                                try {
                                    func ??= new AsyncFunction(`return (${argText})`);
                                    result = await func.call(chat[id]);
                                } catch (e) {
                                    fallback = true;
                                    func = new AsyncFunction(argText);
                                    result = await func.call(chat[id]);
                                }
                            }
                        } catch (error) {
                            console.error('[Free Swipe] Eval error:', error);
                            toastr.error(`Eval error: ${error.message}`, 'Free Swipe');
                            return '';
                        }
                    }
                    const invocations = chat[id].extra.tool_invocations;
                    chat[id].mes = formatToolInvocationMessage(invocations);
                    updateMessageBlock(id, chat[id]);
                }

                if (isTrueBoolean(args.save ?? 'true')) {
                    await saveChatConditional();
                }
                if (messagesToUpdate.length > 1) {
                    toastr.success(`Updated ${messagesToUpdate.length} tool messages.`, 'Free Swipe');
                } else {
                    toastr.success('Tool message updated successfully.', 'Free Swipe');
                }

                if (result === undefined) return '';
                if (typeof result === 'object') {
                    try {
                        return JSON.stringify(result);
                    } catch {
                        return String(result);
                    }
                }
                return String(result);
            },
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'evalmessage',
            helpString: 'Free Swipe - DANGEROUS: Evaluates JavaScript code in the context of a message object (this = message).\nUsage: /evalmessage [save=true/false] [message_id] [code]',
            returns: 'string',
            aliases: ['evalmsg', 'evalm'],
            namedArgumentList: [
                SlashCommandNamedArgument.fromProps({
                    name: 'save',
                    description: 'Whether to save the chat after evaluating the message',
                    typeList: [ARGUMENT_TYPE.BOOLEAN],
                    defaultValue: 'true',
                    enumList: commonEnumProviders.boolean()(),
                }),
            ],
            splitUnnamedArgument: true,
            splitUnnamedArgumentCount: 2,
            unnamedArgumentList: [
                new SlashCommandArgument('message id (leave empty for the last message)', [ARGUMENT_TYPE.NUMBER], false),
                new SlashCommandArgument('code', [ARGUMENT_TYPE.STRING], true),
            ],
            callback: async (args, argId, argText) => {
                if (Array.isArray(argId) && argId.length >= 2) {
                    argText = argId[1];
                    argId = argId[0];
                } else if (Array.isArray(argId) && argId.length === 1) {
                    argText = argId[0];
                    argId = undefined;
                } else if (!argText) {
                    argText = argId;
                    argId = undefined;
                }

                const chat = getContext()?.chat;
                if (!chat || chat.length === 0) {
                    toastr.warning('No messages to evaluate.', 'Free Swipe');
                    return '';
                }

                let id = calcId(chat, argId);
                if (isNaN(id)) {
                    toastr.error('Message ID is invalid or out of bounds.', 'Free Swipe');
                    return '';
                }
                if (!chat[id]) {
                    toastr.warning('No messages to evaluate.', 'Free Swipe');
                    return '';
                }

                if (!argText) {
                    toastr.warning('No code provided to evaluate.', 'Free Swipe');
                    return '';
                }

                let result;
                try {
                    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                    // 尝试作为表达式执行 (自动 return)
                    try {
                        const func = new AsyncFunction(`return (${argText})`);
                        result = await func.call(chat[id]);
                    } catch (e) {
                        // 如果作为表达式失败，则作为普通语句执行
                        const func = new AsyncFunction(argText);
                        result = await func.call(chat[id]);
                    }

                    // 尝试更新 UI 并保存
                    updateMessageBlock(id, chat[id]);
                    if (isTrueBoolean(args.save ?? 'true')) {
                        await saveChatConditional();
                    }
                    toastr.success('Message evaluated successfully.', 'Free Swipe');
                    
                    // 格式化返回值
                    if (result === undefined) return '';
                    if (typeof result === 'object') {
                        try {
                            return JSON.stringify(result);
                        } catch {
                            return String(result);
                        }
                    }
                    return String(result);
                } catch (error) {
                    console.error('[Free Swipe] Eval error:', error);
                    toastr.error(`Eval error: ${error.message}`, 'Free Swipe');
                }
                return '';
            },
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'ignoremessage',
            helpString: 'Free Swipe - Ignores or unignores a chat message from the prompt.',
            returns: 'string',
            aliases: ['igmsg', 'ig'],
            namedArgumentList: [
                SlashCommandNamedArgument.fromProps({
                    name: 'value',
                    description: 'Whether to ignore (true) or unignore (false) the message. If not provided, it will toggle the current state.',
                    typeList: [ARGUMENT_TYPE.BOOLEAN],
                    enumList: commonEnumProviders.boolean()(),
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'save',
                    description: 'Whether to save the chat after ignoring or unignoring the message',
                    typeList: [ARGUMENT_TYPE.BOOLEAN],
                    defaultValue: 'true',
                    enumList: commonEnumProviders.boolean()(),
                }),
            ],
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: `message index (starts with 0) or range, defaults to the last message index if not provided`,
                    typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.RANGE],
                    isRequired: false,
                    enumProvider: commonEnumProviders.messages(),
                }),
            ],
            callback: async (args, argId) => {
                const chat = getContext()?.chat;
                if (!chat || chat.length === 0) {
                    toastr.warning('No messages to ignore.', 'Free Swipe');
                    return '';
                }

                const strArgId = String(argId ?? '').trim().toLowerCase();
                let start, end;
                if (!strArgId) {
                    start = end = chat.length - 1;
                } else if (strArgId.startsWith('-') || !strArgId.includes('-')) {
                    start = end = calcId(chat, strArgId);
                    if (isNaN(start)) {
                        toastr.error('Message ID is invalid or out of bounds.', 'Free Swipe');
                        return '';
                    }
                } else {
                    const range = stringToRange(strArgId, 0, chat.length - 1);
                    if (!range) {
                        toastr.error('Invalid range provided.', 'Free Swipe');
                        return '';
                    }
                    start = range.start;
                    end = range.end;
                }

                let value = (args.value !== null && args.value !== undefined) ? isTrueBoolean(args.value) : null;
                if (value === null) {
                    let allHidden = true;
                    for (let messageId = start; messageId <= end; messageId++) {
                        const msg = chat[messageId];
                        if (!msg) continue;
                        if (!msg.extra?.freeswipe_is_hidden) {
                            allHidden = false;
                            break;
                        }
                    }
                    value = allHidden ? false : true;
                }

                let count = 0;
                for (let messageId = start; messageId <= end; messageId++) {
                    const msg = chat[messageId];
                    if (!msg) continue;
                    if (value) {
                        if (msg.extra?.freeswipe_is_hidden) continue;
                        msg.extra ||= {};
                        msg.extra.freeswipe_is_hidden = true;
                    } else {
                        if (!msg.extra?.freeswipe_is_hidden) continue;
                        delete msg.extra.freeswipe_is_hidden;
                    }
                    count++;
                }

                applyIgnoreSymbols(chat, start, end);
                if (isTrueBoolean(args.save ?? 'true')) {
                    await saveChatConditional();
                }

                if (count > 1) {
                    toastr.success(`Updated ${count} messages.`, 'Free Swipe');
                } else if (count === 1) {
                    toastr.success('Message updated successfully.', 'Free Swipe');
                } else {
                    toastr.info('No messages to update.', 'Free Swipe');
                }
                return '';
            },
        }));
    } catch (error) {
        console.error('[Free Swipe] Failed to register slash commands:', error);
        toastr.error('Failed to register slash commands.', 'Free Swipe');
    }
}

function isChatCompletion() {
    return main_api === 'openai';
}
function applyIgnoreSymbols(chat = getContext()?.chat, start = 0, end) {
    // console.debug('[Free Swipe]', chat, 'range', start, end);
    if (!chat || !chat.length) return;
    end = end ?? (chat.length - 1);

    for (let messageId = start; messageId <= end; messageId++) {
        const msg = chat[messageId];
        if (!msg) continue;
        let result;
        if (!msg.extra) {
            result = false;
        } else {
            if (msg.extra.freeswipe_is_hidden) {
                msg.extra[IGNORE_SYMBOL] = true;
                result = true;
            } else {
                delete msg.extra[IGNORE_SYMBOL];
                result = false;
                // if (Object.keys(msg.extra).length === 0) delete msg.extra;
            }
        }

        const messageBlock = $(`.mes[mesid="${messageId}"]`);
        // console.debug('[Free Swipe]', messageBlock, 'applyIgnoreSymbols', result);
        if (!messageBlock.length) continue;
        if (result) {
            messageBlock.attr('freeswipe_is_hidden', String(result));
        } else {
            messageBlock.removeAttr('freeswipe_is_hidden');
        }
    }
}
eventSource.on(event_types.CHAT_CHANGED, async (chatName) => {
    // toastr.info(`Chat changed. Current chat: ${chatName}`, 'Free Swipe');
    try {
        applyIgnoreSymbols();
    } catch (error) {
        console.error('[Free Swipe] Error applying ignore symbols:', error);
        toastr.error('Error applying ignore symbols.', 'Free Swipe');
    }
});

jQuery(async () => {
    /*
    const settingsHtml = await $.get(`${extensionFolderPath}/config.html`);
    $("#extensions_settings").append(settingsHtml);
    $("#my_button").on("click", onButtonClick);
    $("#freeswipe_setting").on("input", onFreeswipeInput);
    */

    // loadSettings();
    await registerSlashCommands();
});
