/**
 * 企业微信多账号配置工具。
 *
 * 设计目标：
 * 1. 兼容旧版单账号配置（channels.wecom.botId / secret / ...）。
 * 2. 支持新版多账号配置（channels.wecom.accounts.<accountId>.*）。
 * 3. 尽量把“账号级字段”和“渠道级共享字段”分清楚，避免路由/安全策略在多账号场景下串掉。
 */
import type { OpenClawConfig } from "openclaw/plugin-sdk";
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
export declare const DefaultWsUrl = "wss://openws.work.weixin.qq.com";
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
 * 列出所有配置过的账号 ID。
 *
 * 规则：
 * - 如果已存在 accounts，返回 accounts 的 key。
 * - 若存在旧版顶层单账号配置，也把 default 视为一个可用账号。
 * - 如果什么都没有配置，仍返回 [default]，与 OpenClaw 多数渠道的兼容行为一致。
 */
export declare function listWeComAccountIds(cfg: OpenClawConfig): string[];
/**
 * 解析默认账号。
 *
 * 优先级：
 * 1. channels.wecom.defaultAccount
 * 2. 如果存在 default 账号，则用 default
 * 3. 否则取排序后的第一个账号
 */
export declare function resolveDefaultWeComAccountId(cfg: OpenClawConfig): string;
/**
 * 解析企业微信账户配置。
 *
 * 支持：
 * - 显式传入 accountId
 * - 省略 accountId 时按 defaultAccount / default / fallback 选择
 */
export declare function resolveWeComAccount(cfg: OpenClawConfig, accountId?: string | null): ResolvedWeComAccount;
/**
 * 写入 / 更新指定账号配置。
 *
 * 行为约定：
 * - 写 default 账号时，统一写入 accounts.default，而不是继续堆在顶层。
 * - 同时会保留 root.defaultAccount / 其他 shared 字段。
 * - 若历史上顶层仍残留旧单账号字段，会一并迁入 accounts.default，避免丢失旧值。
 */
export declare function setWeComAccount(cfg: OpenClawConfig, accountId: string, account: Partial<WeComConfig>): OpenClawConfig;
/**
 * 删除指定账号配置。
 */
export declare function deleteWeComAccount(cfg: OpenClawConfig, accountId: string): OpenClawConfig;
/**
 * 设置默认出站账号。
 */
export declare function setDefaultWeComAccount(cfg: OpenClawConfig, accountId: string): OpenClawConfig;
