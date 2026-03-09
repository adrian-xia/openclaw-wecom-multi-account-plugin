# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个 OpenClaw 企业微信（WeCom）多账号插件，基于原有单账号插件扩展而来，支持同时接入多个企业微信机器人账号。

## 构建和开发命令

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化自动构建）
npm run dev

# 生产构建
npm run build

# 清理构建产物
npm run clean

# 发布到 npm
npm run publish:release
```

## 核心架构

### 多账号配置模型

插件支持两种配置方式：

1. **新版多账号配置**（推荐）：
```json
{
  "channels": {
    "wecom_multi": {
      "defaultAccount": "main",
      "accounts": {
        "main": { "botId": "...", "secret": "...", "enabled": true },
        "dev": { "botId": "...", "secret": "...", "enabled": true }
      }
    }
  }
}
```

2. **旧版单账号配置**（向后兼容）：
```json
{
  "channels": {
    "wecom_multi": {
      "botId": "...",
      "secret": "...",
      "enabled": true
    }
  }
}
```

旧版配置会被自动映射为 `default` 账号。

### 关键模块职责

- **src/utils.ts**: 多账号配置解析和管理核心逻辑
  - `resolveWeComAccount()`: 解析指定账号配置，处理默认账号回退
  - `listWeComAccountIds()`: 列出所有配置的账号
  - `setWeComAccount()`: 写入账号配置，自动迁移旧版配置到 `accounts.default`
  - `deleteWeComAccount()`: 删除账号配置

- **src/channel.ts**: OpenClaw 插件接口实现
  - 实现 `ChannelPlugin` 接口
  - 按账号维度隔离安全策略（dmPolicy、groupPolicy、allowFrom）
  - outbound 消息发送时根据 `accountId` 选择正确的 WSClient

- **src/state-manager.ts**: 全局状态管理
  - 按 `accountId` 隔离 WSClient 实例
  - 消息状态管理（带 TTL 自动清理，防止内存泄漏）
  - ReqId 持久化存储（支持重启后恢复）

- **src/monitor.ts**: WebSocket 连接监控
  - 建立和维护 WebSocket 连接
  - 消息接收和路由
  - 协调消息解析、策略检查、媒体下载、回复发送

- **src/message-parser.ts**: 消息内容解析
  - 支持 text、image、mixed、quote 等消息类型
  - 处理企业微信特有的消息格式

- **src/message-sender.ts**: 消息发送（带超时保护）
- **src/media-handler.ts**: 图片/文件下载和保存（带超时保护）
- **src/group-policy.ts**: 群组访问控制策略
- **src/dm-policy.ts**: 私聊访问控制策略

### 构建配置

- **rollup.config.js**: 使用 Rollup 打包
  - 输出 ESM (`dist/index.esm.js`) 和 CJS (`dist/index.cjs.js`) 两种格式
  - 生成 TypeScript 类型定义 (`dist/index.d.ts`)
  - `openclaw/plugin-sdk` 标记为 external

- **openclaw.plugin.json**: OpenClaw 插件元数据
  - 插件 ID: `wecom-multi-account-plugin`
  - 渠道 ID: `wecom_multi`

## 重要约定

### 账号隔离原则

- 每个账号有独立的 WSClient 实例
- 安全策略（dmPolicy、allowFrom、groupPolicy）按账号维度配置
- ReqId 存储按账号隔离（避免不同账号的消息串掉）

### 配置迁移策略

- 写入 `default` 账号时，统一写入 `accounts.default`，不再使用顶层平铺字段
- 旧版顶层字段会在首次写入时自动迁移到 `accounts.default`
- 非 `default` 账号不会继承 `default` 的 botId/secret

### 内存管理

- 消息状态 Map 带 TTL 自动清理（默认 5 分钟过期）
- 定期清理任务每 1 分钟运行一次
- 容量限制：最多保留 10000 条消息状态

## 依赖说明

- **@wecom/aibot-node-sdk**: 企业微信机器人 SDK，提供 WSClient 和消息收发能力
- **openclaw/plugin-sdk**: OpenClaw 插件开发 SDK
- **file-type**: 文件类型检测（用于媒体文件处理）

## 注意事项

- 修改 `src/` 下的源文件后需要运行 `npm run build` 才能生效
- 插件入口是 `index.ts`，导出符合 OpenClaw 插件规范的 default export
- 渠道 ID 固定为 `wecom_multi`，避免与官方单账号插件冲突
