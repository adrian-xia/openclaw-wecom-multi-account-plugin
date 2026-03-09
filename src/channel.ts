import {
  DEFAULT_ACCOUNT_ID,
  formatPairingApproveHint,
  type ChannelPlugin,
  type ChannelStatusIssue,
  type OpenClawConfig,
} from "openclaw/plugin-sdk";

import { getWeComRuntime } from "./runtime.js";
import { monitorWeComProvider } from "./monitor.js";
import { getWeComWebSocket } from "./state-manager.js";
import { wecomOnboardingAdapter } from "./onboarding.js";
import type { WeComConfig, ResolvedWeComAccount, WeComRootConfig } from "./utils.js";
import {
  deleteWeComAccount,
  listWeComAccountIds,
  resolveDefaultWeComAccountId,
  resolveWeComAccount,
  setWeComAccount,
} from "./utils.js";
import { CHANNEL_ID, TEXT_CHUNK_LIMIT } from "./const.js";

/**
 * 使用 SDK 的 sendMessage 主动发送企业微信消息。
 *
 * 注意：
 * - 这里依赖 accountId 去定位正确的 WSClient。
 * - 多账号支持的关键之一，就是 outbound 不能再默认只找 default 账号。
 */
async function sendWeComMessage({
  to,
  content,
  accountId,
}: {
  to: string;
  content: string;
  accountId?: string;
}): Promise<{ channel: string; messageId: string; chatId: string }> {
  const resolvedAccountId = accountId ?? DEFAULT_ACCOUNT_ID;

  // to 允许两种格式：
  // 1. "wecom:<chatId>"
  // 2. 直接传 chatId
  const channelPrefix = new RegExp(`^${CHANNEL_ID}:`, "i");
  const chatId = to.replace(channelPrefix, "");

  const wsClient = getWeComWebSocket(resolvedAccountId);
  if (!wsClient) {
    throw new Error(`WSClient not connected for account ${resolvedAccountId}`);
  }

  const result = await wsClient.sendMessage(chatId, {
    msgtype: "markdown",
    markdown: { content },
  });

  const messageId = result?.headers?.req_id ?? `wecom-${Date.now()}`;
  return {
    channel: CHANNEL_ID,
    messageId,
    chatId,
  };
}

const meta = {
  id: CHANNEL_ID,
  label: "企业微信",
  selectionLabel: "企业微信 (WeCom)",
  detailLabel: "企业微信智能机器人",
  docsPath: `/channels/${CHANNEL_ID}`,
  docsLabel: CHANNEL_ID,
  blurb: "企业微信智能机器人接入插件",
  systemImage: "message.fill",
};

/**
 * 根据账号维度返回安全策略配置路径。
 *
 * 这样 CLI / doctor / pairing 提示里给到的路径会落在真正的账号位置上，
 * 不会在多账号场景下还指向 channels.wecom.dmPolicy 这种“单账号旧路径”。
 */
function buildAccountConfigBasePath(accountId: string): string {
  return `channels.${CHANNEL_ID}.accounts.${accountId}.`;
}

function isAccountConfigured(account: ResolvedWeComAccount): boolean {
  return Boolean(account.botId?.trim() && account.secret?.trim());
}

export const wecomPlugin: ChannelPlugin<ResolvedWeComAccount> = {
  id: CHANNEL_ID,
  meta: {
    ...meta,
    quickstartAllowFrom: true,
  },
  pairing: {
    idLabel: "wecomUserId",
    normalizeAllowEntry: (entry) => entry.replace(new RegExp(`^(${CHANNEL_ID}|user):`, "i"), "").trim(),
    notifyApproval: async (params) => {
      const { cfg, id } = params as { cfg: OpenClawConfig; id: string; accountId?: string };
      // 当前插件保留最小实现：仅记录日志，不主动回推批准消息。
      // 这里保留 accountId 以便后续需要时能精确从对应账号发通知。
      console.log(`[WeCom] Pairing approved for user=${id}, account=${resolveDefaultWeComAccountId(cfg)}`);
    },
  },
  onboarding: wecomOnboardingAdapter,
  capabilities: {
    chatTypes: ["direct", "group"],
    reactions: false,
    threads: false,
    media: true,
    nativeCommands: false,
    blockStreaming: true,
  },
  reload: { configPrefixes: [`channels.${CHANNEL_ID}`] },
  config: {
    /**
     * 列出所有账号 ID。
     *
     * 兼容规则：
     * - 若仍使用旧单账号配置，则返回 ["default"]。
     * - 若使用新版 accounts 结构，则返回全部账号。
     */
    listAccountIds: (cfg) => listWeComAccountIds(cfg),

    /**
     * 按账号解析配置。
     */
    resolveAccount: (cfg, accountId) => resolveWeComAccount(cfg, accountId),

    /**
     * 默认账号：优先 channels.wecom.defaultAccount。
     */
    defaultAccountId: (cfg) => resolveDefaultWeComAccountId(cfg),

    /**
     * 启用/禁用指定账号。
     *
     * 注意这里不再改根级 channels.wecom.enabled，
     * 因为多账号模式下 enabled 应该是账号级状态。
     */
    setAccountEnabled: ({ cfg, accountId, enabled }) => {
      const resolvedAccountId = accountId ?? resolveDefaultWeComAccountId(cfg);
      return setWeComAccount(cfg, resolvedAccountId, { enabled });
    },

    /**
     * 删除指定账号配置。
     */
    deleteAccount: ({ cfg, accountId }) => {
      const resolvedAccountId = accountId ?? resolveDefaultWeComAccountId(cfg);
      return deleteWeComAccount(cfg, resolvedAccountId);
    },

    isConfigured: (account) => isAccountConfigured(account),

    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: isAccountConfigured(account),
      botId: account.botId,
      websocketUrl: account.websocketUrl,
    }),

    /**
     * allowFrom 也是账号级的；不同 bot 不应共享同一份 allowlist。
     */
    resolveAllowFrom: ({ cfg, accountId }) => {
      const account = resolveWeComAccount(cfg, accountId);
      return (account.config.allowFrom ?? []).map((entry) => String(entry));
    },

    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean),
  },
  security: {
    resolveDmPolicy: ({ account }) => {
      const basePath = buildAccountConfigBasePath(account.accountId);
      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: `${basePath}allowFrom`,
        approveHint: formatPairingApproveHint(CHANNEL_ID),
        normalizeEntry: (raw) => raw.replace(new RegExp(`^${CHANNEL_ID}:`, "i"), "").trim(),
      };
    },
    collectWarnings: ({ account, cfg }) => {
      const warnings: string[] = [];
      const basePath = buildAccountConfigBasePath(account.accountId);

      const dmPolicy = account.config.dmPolicy ?? "pairing";
      if (dmPolicy === "open") {
        const hasWildcard = (account.config.allowFrom ?? []).some(
          (entry) => String(entry).trim() === "*",
        );
        if (!hasWildcard) {
          warnings.push(
            `- 企业微信账号 ${account.accountId}：dmPolicy=\"open\" 但 allowFrom 未包含 \"*\"。建议设置 ${basePath}allowFrom=["*"]，或改回 dmPolicy=\"pairing\"。`,
          );
        }
      }

      const defaultGroupPolicy = cfg.channels?.defaults?.groupPolicy;
      const groupPolicy = account.config.groupPolicy ?? defaultGroupPolicy ?? "open";
      if (groupPolicy === "open") {
        warnings.push(
          `- 企业微信账号 ${account.accountId}：groupPolicy=\"open\" 允许所有群组触发。若需隔离，请设置 ${basePath}groupPolicy=\"allowlist\" 并配置 ${basePath}groupAllowFrom。`,
        );
      }

      return warnings;
    },
  },
  messaging: {
    normalizeTarget: (target) => {
      const trimmed = target.trim();
      if (!trimmed) return undefined;
      return trimmed;
    },
    targetResolver: {
      looksLikeId: (id) => Boolean(id?.trim()),
      hint: "<userId|groupId>",
    },
  },
  directory: {
    self: async () => null,
    listPeers: async () => [],
    listGroups: async () => [],
  },
  outbound: {
    deliveryMode: "direct",
    chunker: (text, limit) => getWeComRuntime().channel.text.chunkMarkdownText(text, limit),
    textChunkLimit: TEXT_CHUNK_LIMIT,
    sendText: async ({ to, text, accountId }) => {
      return sendWeComMessage({
        to,
        content: text,
        accountId: accountId ?? undefined,
      });
    },
    sendMedia: async ({ to, text, mediaUrl, accountId }) => {
      // 当前仍维持“附件降级为文本链接”的行为。
      // 多账号改造的重点是确保降级文本从正确账号发出。
      const content = `Sending attachments is not supported yet\n${text ? `${text}\n${mediaUrl}` : (mediaUrl ?? "")}`;
      return sendWeComMessage({
        to,
        content,
        accountId: accountId ?? undefined,
      });
    },
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    collectStatusIssues: (accounts): ChannelStatusIssue[] =>
      accounts.flatMap((entry) => {
        const accountId = String(entry.accountId ?? DEFAULT_ACCOUNT_ID);
        const enabled = entry.enabled !== false;
        const configured = entry.configured === true;
        if (!enabled) {
          return [];
        }
        const issues: ChannelStatusIssue[] = [];
        if (!configured) {
          issues.push({
            channel: CHANNEL_ID,
            accountId,
            kind: "config",
            message: "企业微信机器人 ID 或 Secret 未配置",
            fix: `Run: openclaw channels add wecom --account ${accountId} --bot-id <id> --secret <secret>`,
          });
        }
        return issues;
      }),
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
    }),
    probeAccount: async () => ({ ok: true, status: 200 }),
    buildAccountSnapshot: ({ account, runtime }) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: isAccountConfigured(account),
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
    }),
  },
  gateway: {
    startAccount: async (ctx) => {
      return monitorWeComProvider({
        account: ctx.account,
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
      });
    },
    /**
     * 只登出指定账号，不影响其他账号。
     */
    logoutAccount: async ({ cfg, accountId }) => {
      const resolvedAccountId = accountId ?? resolveDefaultWeComAccountId(cfg);
      const nextCfg = deleteWeComAccount(cfg, resolvedAccountId) as OpenClawConfig;
      await getWeComRuntime().config.writeConfigFile(nextCfg);

      const resolved = resolveWeComAccount(nextCfg, resolvedAccountId);
      const loggedOut = !resolved.botId && !resolved.secret;
      return { cleared: true, envToken: false, loggedOut };
    },
  },
};
