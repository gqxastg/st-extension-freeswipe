import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { getMessageTimeStamp } from "../../../RossAscends-mods.js";
import { isFalseBoolean, isTrueBoolean } from '../../../utils.js';
import { saveSettingsDebounced, deleteSwipe, deleteMessage, saveChatConditional, reloadCurrentChat, syncMesToSwipe, extractMessageBias } from "../../../../script.js";

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

async function registerSlashCommands() {
    try {
        const { SlashCommand } = await import('/scripts/slash-commands/SlashCommand.js');
        const { SlashCommandParser } = await import('/scripts/slash-commands/SlashCommandParser.js');
        const { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } = await import('/scripts/slash-commands/SlashCommandArgument.js');
        const { commonEnumProviders } = await import('/scripts/slash-commands/SlashCommandCommonEnumsProvider.js');

        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'aswipe',
            helpString: 'Free Swipe - Add a swipe to any message. \nUsage: /aswipe id=0 switch=true [text]',
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

                const context = getContext();
                const chat = context.chat;
                
                if (!chat || chat.length === 0) {
                    toastr.warning('No messages to add swipes to.', 'Free Swipe');
                    return '';
                }

                // 1. 解析 ID 
                let id = chat.length - 1; // 默认最后一条
                if (argId !== undefined && argId !== null && argId !== '') {
                    id = parseInt(argId, 10);
                    if (isNaN(id)) {
                        toastr.error('Message ID is invalid', 'Free Swipe');
                        return '';
                    }
                    if (id < 0) {
                        id = chat.length + id; // 支持负数索引
                    }
                    if (id < 0 || id >= chat.length) {
                        toastr.error('Message ID is out of bounds', 'Free Swipe');
                        return '';
                    }
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
    } catch (error) {
        console.error('[Free Swipe] Failed to register slash commands:', error);
        toastr.error('[Free Swipe] Failed to register slash commands.', 'Free Swipe');
    }
}

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
