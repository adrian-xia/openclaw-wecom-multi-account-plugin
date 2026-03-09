/**
 * 企业微信 onboarding adapter。
 *
 * 这里重点做两件事：
 * 1. 兼容旧单账号逻辑（没传 accountId 时走默认账号）。
 * 2. 在 CLI 明确指定 accountId 时，把配置写入 channels.wecom.accounts.<accountId>。
 */

import {
  addWildcardAllowFrom,
  DEFAULT_ACCOUNT_ID,
  type ChannelOnboardingAdapter,
  type ChannelOnboardingDmPolicy,
  type OpenClawConfig,
  type WizardPrompter,
} from "openclaw/plugin-sdk";
import type { ResolvedWeComAccount } from "./utils.js";
import {
  resolveDefaultWeComAccountId,
  resolveWeComAccount,
  setDefaultWeComAccount,
  setWeComAccount,
} from "./utils.js";
import { CHANNEL_ID } from "./const.js";

const channel = CHANNEL_ID;

function normalizeWizardAccountId(accountId?: string | null): string {
  const trimmed = String(accountId ?? "").trim();
  return trimmed || DEFAULT_ACCOUNT_ID;
}

/**
 * 企业微信设置帮助说明
 */
async function noteWeComSetupHelp(prompter: WizardPrompter): Promise<void> {
  await prompter.note(
    [
      "企业微信机器人需要以下配置信息：",
      "1. Bot ID: 企业微信机器人 id",
      "2. Secret: 企业微信机器人密钥",
    ].join("\n"),
    "企业微信设置",
  );
}

/**
 * 提示输入 Bot ID
 */
async function promptBotId(
  prompter: WizardPrompter,
  account: ResolvedWeComAccount | null,
): Promise<string> {
  return String(
    await prompter.text({
      message: "企业微信机器人 Bot ID",
      initialValue: account?.botId ?? "",
      validate: (value) => (value?.trim() ? undefined : "Required"),
    }),
  ).trim();
}

/**
 * 提示输入 Secret
 */
async function promptSecret(
  prompter: WizardPrompter,
  account: ResolvedWeComAccount | null,
): Promise<string> {
  return String(
    await prompter.text({
      message: "企业微信机器人 Secret",
      initialValue: account?.secret ?? "",
      validate: (value) => (value?.trim() ? undefined : "Required"),
    }),
  ).trim();
}

/**
 * 按账号设置 dmPolicy。
 */
function setWeComDmPolicy(
  cfg: OpenClawConfig,
  accountId: string,
  dmPolicy: "pairing" | "allowlist" | "open" | "disabled",
): OpenClawConfig {
  const account = resolveWeComAccount(cfg, accountId);
  const existingAllowFrom = account.config.allowFrom ?? [];
  const allowFrom =
    dmPolicy === "open"
      ? addWildcardAllowFrom(existingAllowFrom.map((x) => String(x)))
      : existingAllowFrom.map((x) => String(x));

  return setWeComAccount(cfg, accountId, {
    dmPolicy,
    allowFrom,
  });
}

const dmPolicy: ChannelOnboardingDmPolicy = {
  label: "企业微信",
  channel,
  policyKey: `channels.${CHANNEL_ID}.dmPolicy`,
  allowFromKey: `channels.${CHANNEL_ID}.allowFrom`,
  getCurrent: (cfg) => {
    const account = resolveWeComAccount(cfg);
    return account.config.dmPolicy ?? "pairing";
  },
  setPolicy: (cfg, policy) => {
    const accountId = resolveDefaultWeComAccountId(cfg);
    return setWeComDmPolicy(cfg, accountId, policy);
  },
  promptAllowFrom: async ({ cfg, prompter }) => {
    const accountId = resolveDefaultWeComAccountId(cfg);
    const account = resolveWeComAccount(cfg, accountId);
    const existingAllowFrom = account.config.allowFrom ?? [];

    const entry = await prompter.text({
      message: "企业微信允许来源（用户ID或群组ID，每行一个，推荐用于安全控制）",
      placeholder: "user123 或 group456",
      initialValue: existingAllowFrom[0] ? String(existingAllowFrom[0]) : undefined,
    });

    const allowFrom = String(entry ?? "")
      .split(/[\n,;]+/g)
      .map((s) => s.trim())
      .filter(Boolean);

    return setWeComAccount(cfg, accountId, { allowFrom });
  },
};

export const wecomOnboardingAdapter: ChannelOnboardingAdapter = {
  channel,
  getStatus: async (params) => {
    const { cfg, accountId } = params as { cfg: OpenClawConfig; accountId?: string };
    const resolvedAccountId = normalizeWizardAccountId(accountId);
    const account = resolveWeComAccount(cfg, resolvedAccountId);
    const configured = Boolean(account.botId?.trim() && account.secret?.trim());

    return {
      channel,
      configured,
      statusLines: [
        `企业微信[${resolvedAccountId}]: ${configured ? "已配置" : "需要 Bot ID 和 Secret"}`,
      ],
      selectionHint: configured ? "已配置" : "需要设置",
    };
  },
  configure: async (params) => {
    const { cfg, prompter, accountId } = params as {
      cfg: OpenClawConfig;
      prompter: WizardPrompter;
      accountId?: string;
    };
    const resolvedAccountId = normalizeWizardAccountId(accountId);
    const account = resolveWeComAccount(cfg, resolvedAccountId);

    if (!account.botId?.trim() || !account.secret?.trim()) {
      await noteWeComSetupHelp(prompter);
    }

    const botId = await promptBotId(prompter, account);
    const secret = await promptSecret(prompter, account);

    let nextCfg = setWeComAccount(cfg, resolvedAccountId, {
      botId,
      secret,
      enabled: true,
      dmPolicy: account.config.dmPolicy ?? "pairing",
      allowFrom: account.config.allowFrom ?? [],
      groupPolicy: account.config.groupPolicy,
      groupAllowFrom: account.config.groupAllowFrom,
      groups: account.config.groups,
      websocketUrl: account.config.websocketUrl,
      sendThinkingMessage: account.config.sendThinkingMessage,
      name: account.config.name,
    });

    // 对默认账号/第一次新增账号的场景，把 defaultAccount 指向当前账号，
    // 让后续未显式指定 accountId 的出站行为更可预测。
    nextCfg = setDefaultWeComAccount(nextCfg, resolvedAccountId);

    return { cfg: nextCfg };
  },
  dmPolicy,
  disable: (cfg) => {
    const accountId = resolveDefaultWeComAccountId(cfg);
    return setWeComAccount(cfg, accountId, { enabled: false });
  },
};
