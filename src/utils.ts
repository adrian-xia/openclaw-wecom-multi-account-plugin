/**
 * 企业微信多账号配置工具。
 *
 * 设计目标：
 * 1. 兼容旧版单账号配置（channels.wecom.botId / secret / ...）。
 * 2. 支持新版多账号配置（channels.wecom.accounts.<accountId>.*）。
 * 3. 尽量把“账号级字段”和“渠道级共享字段”分清楚，避免路由/安全策略在多账号场景下串掉。
 */

import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk";
import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { CHANNEL_ID } from "./const.js";

// ============================================================================
// 配置类型定义
// ============================================================================

/**
 * 单个群组的细粒度配置。
 */
export interface WeComGroupConfig {
  /** 群组内发送者白名单（仅列表中的成员消息会被处理） */
  allowFrom?: Array<string | number>;
}

/**
 * 单个企业微信账号的账号级配置。
 *
 * 这些字段在新版配置里会出现在：
 *   channels.wecom.accounts.<accountId>
 *
 * 同时为了兼容旧版，也允许出现在：
 *   channels.wecom
 */
export interface WeComConfig {
  enabled?: boolean;
  websocketUrl?: string;
  botId?: string;
  secret?: string;
  name?: string;
  allowFrom?: Array<string | number>;
  dmPolicy?: "open" | "allowlist" | "pairing" | "disabled";
  /** 群组访问策略：open / allowlist / disabled */
  groupPolicy?: "open" | "allowlist" | "disabled";
  /** 群组白名单（仅 groupPolicy="allowlist" 时生效） */
  groupAllowFrom?: Array<string | number>;
  /** 每个群组的详细配置（如群组内发送者白名单） */
  groups?: Record<string, WeComGroupConfig>;
  /** 是否发送“思考中”消息，默认 true */
  sendThinkingMessage?: boolean;
}

/**
 * 渠道根配置。
 *
 * - 旧版：所有账号级字段直接平铺在 channels.wecom 下。
 * - 新版：账号级字段放在 channels.wecom.accounts 下；根级只保留 shared 字段 / defaultAccount。
 */
export interface WeComRootConfig extends WeComConfig {
  defaultAccount?: string;
  accounts?: Record<string, WeComConfig>;
}

export const DefaultWsUrl = "wss://openws.work.weixin.qq.com";

export interface ResolvedWeComAccount {
  accountId: string;
  /** 账号是如何被选中的：显式传入 / defaultAccount / fallback */
  selectionSource: "explicit" | "explicit-default" | "mapped-default" | "fallback";
  name: string;
  enabled: boolean;
  websocketUrl: string;
  botId: string;
  secret: string;
  sendThinkingMessage: boolean;
  config: WeComConfig;
}

/**
 * 这些字段在旧版单账号配置里是账号级字段。
 * 当我们迁移到多账号模型时，需要把它们搬进 accounts.default。
 */
const ACCOUNT_LEVEL_KEYS = [
  "enabled",
  "websocketUrl",
  "botId",
  "secret",
  "name",
  "allowFrom",
  "dmPolicy",
  "groupPolicy",
  "groupAllowFrom",
  "groups",
  "sendThinkingMessage",
] as const;

function getWeComRootConfig(cfg: OpenClawConfig): WeComRootConfig {
  return ((cfg.channels?.[CHANNEL_ID] ?? {}) as WeComRootConfig) ?? {};
}

/**
 * 归一化 accountId。
 * 保持实现简单：空值回落到 default，其他值做 trim。
 */
function normalizeAccountId(accountId?: string | null): string {
  const trimmed = String(accountId ?? "").trim();
  return trimmed || DEFAULT_ACCOUNT_ID;
}

/**
 * 返回旧版单账号配置中携带的“账号级字段”。
 *
 * 这一步非常关键：
 * - 如果用户尚未迁移到 accounts 结构，我们仍然要把顶层 botId/secret 视为 default 账号。
 * - 如果已经存在 accounts，同时顶层还残留旧字段，那么 default 账号应该优先吃这些旧字段，
 *   这样和 OpenClaw 官方“添加第二个账号时把旧顶层值迁入 accounts.default”的迁移思路一致。
 */
function getLegacyTopLevelAccountConfig(root: WeComRootConfig): WeComConfig {
  const legacy: WeComConfig = {};
  for (const key of ACCOUNT_LEVEL_KEYS) {
    const value = root[key];
    if (value !== undefined) {
      legacy[key] = value as never;
    }
  }
  return legacy;
}

/**
 * 列出所有配置过的账号 ID。
 *
 * 规则：
 * - 如果已存在 accounts，返回 accounts 的 key。
 * - 若存在旧版顶层单账号配置，也把 default 视为一个可用账号。
 * - 如果什么都没有配置，仍返回 [default]，与 OpenClaw 多数渠道的兼容行为一致。
 */
export function listWeComAccountIds(cfg: OpenClawConfig): string[] {
  const root = getWeComRootConfig(cfg);
  const ids = new Set<string>();

  const accounts = root.accounts;
  if (accounts && typeof accounts === "object") {
    for (const accountId of Object.keys(accounts)) {
      const normalized = normalizeAccountId(accountId);
      if (normalized) {
        ids.add(normalized);
      }
    }
  }

  const legacy = getLegacyTopLevelAccountConfig(root);
  const hasLegacyAccountFields = ACCOUNT_LEVEL_KEYS.some((key) => legacy[key] !== undefined);
  if (hasLegacyAccountFields) {
    ids.add(DEFAULT_ACCOUNT_ID);
  }

  if (ids.size === 0) {
    ids.add(DEFAULT_ACCOUNT_ID);
  }

  return [...ids].sort((a, b) => a.localeCompare(b));
}

/**
 * 解析默认账号。
 *
 * 优先级：
 * 1. channels.wecom.defaultAccount
 * 2. 如果存在 default 账号，则用 default
 * 3. 否则取排序后的第一个账号
 */
export function resolveDefaultWeComAccountId(cfg: OpenClawConfig): string {
  const root = getWeComRootConfig(cfg);
  const preferred = root.defaultAccount?.trim();
  if (preferred) {
    return normalizeAccountId(preferred);
  }

  const ids = listWeComAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }

  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

/**
 * 读取某个账号的账号级配置，不做默认值填充。
 */
function getAccountOverride(root: WeComRootConfig, accountId: string): WeComConfig | undefined {
  const accounts = root.accounts;
  if (!accounts || typeof accounts !== "object") {
    return undefined;
  }
  return accounts[accountId];
}

/**
 * 合并出指定账号的最终配置。
 *
 * 合并规则：
 * - 根级旧版字段视为 default 账号的初始值
 * - accounts.<accountId> 覆盖其上的同名字段
 * - 非 default 账号不会继承 default 的 botId/secret，避免串账号
 */
function mergeWeComAccountConfig(root: WeComRootConfig, accountId: string): WeComConfig {
  const legacyDefault = getLegacyTopLevelAccountConfig(root);
  const accountOverride = getAccountOverride(root, accountId) ?? {};

  if (accountId === DEFAULT_ACCOUNT_ID) {
    return {
      ...legacyDefault,
      ...accountOverride,
    };
  }

  return {
    ...accountOverride,
  };
}

/**
 * 解析企业微信账户配置。
 *
 * 支持：
 * - 显式传入 accountId
 * - 省略 accountId 时按 defaultAccount / default / fallback 选择
 */
export function resolveWeComAccount(
  cfg: OpenClawConfig,
  accountId?: string | null,
): ResolvedWeComAccount {
  const hasExplicitAccountId = typeof accountId === "string" && accountId.trim() !== "";
  const resolvedAccountId = hasExplicitAccountId
    ? normalizeAccountId(accountId)
    : resolveDefaultWeComAccountId(cfg);
  const selectionSource: ResolvedWeComAccount["selectionSource"] = hasExplicitAccountId
    ? "explicit"
    : getWeComRootConfig(cfg).defaultAccount?.trim()
      ? "explicit-default"
      : resolvedAccountId === DEFAULT_ACCOUNT_ID
        ? "mapped-default"
        : "fallback";

  const merged = mergeWeComAccountConfig(getWeComRootConfig(cfg), resolvedAccountId);

  return {
    accountId: resolvedAccountId,
    selectionSource,
    name: merged.name ?? (resolvedAccountId === DEFAULT_ACCOUNT_ID ? "企业微信" : `企业微信 (${resolvedAccountId})`),
    enabled: merged.enabled ?? false,
    websocketUrl: merged.websocketUrl || DefaultWsUrl,
    botId: merged.botId ?? "",
    secret: merged.secret ?? "",
    sendThinkingMessage: merged.sendThinkingMessage ?? true,
    config: merged,
  };
}

/**
 * 写入 / 更新指定账号配置。
 *
 * 行为约定：
 * - 写 default 账号时，统一写入 accounts.default，而不是继续堆在顶层。
 * - 同时会保留 root.defaultAccount / 其他 shared 字段。
 * - 若历史上顶层仍残留旧单账号字段，会一并迁入 accounts.default，避免丢失旧值。
 */
export function setWeComAccount(
  cfg: OpenClawConfig,
  accountId: string,
  account: Partial<WeComConfig>,
): OpenClawConfig {
  const normalizedAccountId = normalizeAccountId(accountId);
  const root = getWeComRootConfig(cfg);
  const legacyDefault = getLegacyTopLevelAccountConfig(root);
  const existingAccount = getAccountOverride(root, normalizedAccountId) ?? {};

  const mergedAccount: WeComConfig = {
    ...(normalizedAccountId === DEFAULT_ACCOUNT_ID ? legacyDefault : {}),
    ...existingAccount,
    ...account,
  };

  const nextRoot: WeComRootConfig = {
    ...root,
    accounts: {
      ...(root.accounts ?? {}),
      [normalizedAccountId]: mergedAccount,
    },
  };

  // 把旧顶层账号字段清掉，避免“顶层 + accounts.default”双写导致将来读取歧义。
  for (const key of ACCOUNT_LEVEL_KEYS) {
    delete nextRoot[key];
  }

  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      [CHANNEL_ID]: nextRoot,
    },
  };
}

/**
 * 删除指定账号配置。
 */
export function deleteWeComAccount(cfg: OpenClawConfig, accountId: string): OpenClawConfig {
  const normalizedAccountId = normalizeAccountId(accountId);
  const root = getWeComRootConfig(cfg);
  const nextAccounts = { ...(root.accounts ?? {}) };
  delete nextAccounts[normalizedAccountId];

  const nextRoot: WeComRootConfig = {
    ...root,
    accounts: nextAccounts,
  };

  // 清理旧版顶层 default 账号遗留字段。
  if (normalizedAccountId === DEFAULT_ACCOUNT_ID) {
    for (const key of ACCOUNT_LEVEL_KEYS) {
      delete nextRoot[key];
    }
  }

  // 如果 accounts 为空，就把它去掉，保持配置整洁。
  if (Object.keys(nextAccounts).length === 0) {
    delete nextRoot.accounts;
  }

  // 如果 defaultAccount 指向了刚被删除的账号，则回退到 default 或第一个可用账号。
  if (nextRoot.defaultAccount && normalizeAccountId(nextRoot.defaultAccount) === normalizedAccountId) {
    const remainingIds = Object.keys(nextAccounts);
    nextRoot.defaultAccount = remainingIds.includes(DEFAULT_ACCOUNT_ID)
      ? DEFAULT_ACCOUNT_ID
      : remainingIds[0] ?? DEFAULT_ACCOUNT_ID;
  }

  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      [CHANNEL_ID]: nextRoot,
    },
  };
}

/**
 * 设置默认出站账号。
 */
export function setDefaultWeComAccount(cfg: OpenClawConfig, accountId: string): OpenClawConfig {
  const root = getWeComRootConfig(cfg);
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      [CHANNEL_ID]: {
        ...root,
        defaultAccount: normalizeAccountId(accountId),
      },
    },
  };
}
