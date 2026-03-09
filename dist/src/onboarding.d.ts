/**
 * 企业微信 onboarding adapter。
 *
 * 这里重点做两件事：
 * 1. 兼容旧单账号逻辑（没传 accountId 时走默认账号）。
 * 2. 在 CLI 明确指定 accountId 时，把配置写入 channels.wecom.accounts.<accountId>。
 */
import { type ChannelOnboardingAdapter } from "openclaw/plugin-sdk";
export declare const wecomOnboardingAdapter: ChannelOnboardingAdapter;
