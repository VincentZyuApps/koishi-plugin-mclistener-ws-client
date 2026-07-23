import assert from 'node:assert/strict';
import { MessageHandler } from '../src/message';
import { PluginConfig } from '../src/types';

function createConfig(overrides: Partial<PluginConfig> = {}): PluginConfig {
  return {
    verboseConsoleOutput: false,
    enableServerToPlatformPlayerJoin: false,
    enableServerToPlatformPlayerLeave: false,
    enableServerToPlatformPlayerChat: true,
    playerChatMessageTemplate: '%PLAYER%: %CONTENT%',
    enableQQMarkdownPlayerChat: true,
    qqMarkdownPlayerChatTemplate: '%CONTENT%',
    enableAddDateTimePrefix: false,
    enableServerChatPrefixAllowlist: true,
    serverChatAllowedPrefixes: ['!', '!!', ''],
    stripServerChatPrefix: true,
    enableServerChatPrefixBlocklist: false,
    serverChatBlockedPrefixes: [],
    enableServerChatSenderBlocklist: false,
    serverChatBlockedSenders: [],
    enablePlatformChatPrefixAllowlist: true,
    platformChatAllowedPrefixes: ['!', '!!', ''],
    stripPlatformChatPrefix: true,
    normalizePlatformChatWhitespace: true,
    ...overrides,
  } as PluginConfig;
}

function createHandler(overrides: Partial<PluginConfig> = {}): MessageHandler {
  return new MessageHandler({} as never, createConfig(overrides));
}

const serverMessage = JSON.stringify({
  type: 'player_chat',
  player_name: 'Steve',
  content: '!! hello',
});

const strippedServerMessage = createHandler().handleServerMessage(serverMessage);
assert.equal(strippedServerMessage?.text, 'Steve: hello');
assert.equal(strippedServerMessage?.markdown, 'hello');

const preservedServerMessage = createHandler({
  stripServerChatPrefix: false,
}).handleServerMessage(serverMessage);
assert.equal(preservedServerMessage?.text, 'Steve: !! hello');

const blockedServerMessage = createHandler({
  enableServerChatPrefixBlocklist: true,
  serverChatBlockedPrefixes: ['!!'],
}).handleServerMessage(serverMessage);
assert.equal(blockedServerMessage, null);

const platformSession = {
  platform: 'qq',
  channelId: 'group',
  author: { nickname: 'Alex' },
  content: '!! hello',
};

const strippedPlatformMessage = createHandler().createPlatformToServerMessage(platformSession);
assert.equal(strippedPlatformMessage?.message, 'hello');

const preservedPlatformMessage = createHandler({
  stripPlatformChatPrefix: false,
}).createPlatformToServerMessage(platformSession);
assert.equal(preservedPlatformMessage?.message, '!! hello');

const emptyPrefixOnlyMessage = createHandler({
  platformChatAllowedPrefixes: [''],
}).createPlatformToServerMessage({
  ...platformSession,
  content: 'hello',
});
assert.equal(emptyPrefixOnlyMessage, null);

console.log('prefix behavior tests passed');
