/**
 * 企业微信渠道内部类型定义。
 *
 * 这份文件主要用于：
 * - 补齐 monitor / state-manager 的共享类型
 * - 让 recovered source 能正常构建
 */

import type { OpenClawConfig, RuntimeEnv } from "openclaw/plugin-sdk";
import type { ResolvedWeComAccount } from "./utils.js";
import { WeComCommand } from "./const.js";

export type WeComMonitorOptions = {
  account: ResolvedWeComAccount;
  config: OpenClawConfig;
  runtime: RuntimeEnv;
  abortSignal?: AbortSignal;
};

export interface MessageState {
  accumulatedText: string;
  /** 同一条流式回复复用同一个 streamId */
  streamId?: string;
}

export interface WeComRequest {
  cmd: string;
  headers: {
    req_id: string;
  };
  body: any;
}

export interface WeComResponse {
  headers: {
    req_id: string;
  };
  errcode: number;
  errmsg: string;
}

export interface WeComSubscribeRequest extends WeComRequest {
  cmd: WeComCommand.SUBSCRIBE;
  body: {
    secret: string;
    bot_id: string;
  };
}

export interface WeComCallbackMessage {
  cmd: WeComCommand.AIBOT_CALLBACK;
  headers: {
    req_id: string;
  };
  body: {
    msgid: string;
    aibotid: string;
    chatid: string;
    chattype: "single" | "group";
    from: {
      userid: string;
    };
    response_url: string;
    msgtype: "text" | "image" | "voice" | "video" | "file" | "stream" | "mixed";
    text?: {
      content: string;
    };
    image?: {
      url?: string;
      base64?: string;
      md5?: string;
    };
    mixed?: {
      msg_item: Array<{
        msgtype: "text" | "image";
        text?: { content: string };
        image?: { url?: string; base64?: string; md5?: string };
      }>;
    };
    quote?: {
      msgtype: string;
      text?: { content: string };
      image?: { url?: string; aeskey?: string };
      file?: { url?: string; aeskey?: string };
    };
    stream?: {
      id: string;
    };
  };
}

export interface WeComResponseMessage extends WeComRequest {
  cmd: WeComCommand.AIBOT_RESPONSE;
  body: {
    msgtype: "stream" | "text" | "markdown";
    stream?: {
      id: string;
      finish: boolean;
      content: string;
      msg_item?: Array<{
        msgtype: "image" | "file";
        image?: {
          base64: string;
          md5: string;
        };
      }>;
      feedback?: {
        id: string;
      };
    };
    text?: {
      content: string;
    };
    markdown?: {
      content: string;
    };
  };
}
