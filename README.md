# WeCom OpenClaw Plugin (Multi-Account)

企业微信多账号 OpenClaw 插件，支持同时接入多个企业微信机器人账号，每个账号可以独立配置安全策略和绑定不同的 Agent。

## 目录

- [为什么需要多账号](#为什么需要多账号)
- [安装](#安装)
- [配置](#配置)
- [多账号与 Agent 绑定](#多账号与-agent-绑定)
- [验证和调试](#验证和调试)
- [已知限制](#已知限制)
- [从旧版迁移](#从旧版迁移)
- [开发和构建](#开发和构建)

## 为什么需要多账号

- **环境隔离**：生产环境和开发环境使用不同的企业微信机器人
- **团队隔离**：不同团队使用独立的机器人账号，互不干扰
- **策略隔离**：每个账号可以配置独立的安全策略（dmPolicy、allowFrom、groupPolicy）
- **Agent 路由**：不同账号可以绑定到不同的 Agent，实现业务分流

## 安装

### 前置要求

- 已安装 Node.js（建议 v18 或更高版本）
- 已安装 OpenClaw CLI
- 已安装 Git

### 方式一：直接安装（推荐）

**步骤 1：下载插件代码**

```bash
# 进入你的工作目录（可以是任意目录）
cd ~/Downloads

# 克隆仓库
git clone https://github.com/WecomTeam/wecom-openclaw-plugin.git

# 进入插件目录
cd wecom-openclaw-plugin
```

**步骤 2：安装依赖**

```bash
npm install
```

等待依赖安装完成，可能需要 1-2 分钟。

**步骤 3：构建插件**

```bash
npm run build
```

构建成功后，会在 `dist/` 目录下生成编译后的文件。

**步骤 4：安装到 OpenClaw**

```bash
openclaw plugins install .
```

安装成功后，插件会被复制到 `~/.openclaw/extensions/wecom-multi-account-openclaw-plugin/` 目录。

**步骤 5：验证安装**

```bash
openclaw plugins list
```

如果看到 `wecom-multi-account-openclaw-plugin` 出现在列表中，说明安装成功。

### 方式二：开发调试模式（适合需要修改代码的场景）

如果你需要修改插件代码并实时测试，使用软链接方式更方便。

**步骤 1：下载并构建插件**

```bash
# 进入你的开发目录
cd ~/Developer

# 克隆仓库
git clone https://github.com/WecomTeam/wecom-openclaw-plugin.git

# 进入插件目录
cd wecom-openclaw-plugin

# 安装依赖
npm install

# 构建插件
npm run build
```

**步骤 2：检查是否已安装旧版本**

```bash
openclaw plugins list
```

如果看到 `wecom-multi-account-openclaw-plugin` 已存在，需要先卸载：

```bash
openclaw plugins uninstall wecom-multi-account-openclaw-plugin
```

或者手动删除：

```bash
rm -rf ~/.openclaw/extensions/wecom-multi-account-openclaw-plugin
```

**步骤 3：创建软链接**

```bash
# 确保当前在插件目录下
pwd
# 应该显示类似：/Users/你的用户名/Developer/wecom-openclaw-plugin

# 创建软链接
ln -s "$(pwd)" ~/.openclaw/extensions/wecom-multi-account-openclaw-plugin
```

**步骤 4：验证软链接**

```bash
ls -la ~/.openclaw/extensions/ | grep wecom
```

应该看到类似输出：
```
wecom-multi-account-openclaw-plugin -> /Users/你的用户名/Developer/wecom-openclaw-plugin
```

**步骤 5：重启 OpenClaw**

```bash
openclaw gateway restart
```

**步骤 6：验证插件加载**

```bash
openclaw plugins list
```

**后续修改代码时的流程：**

1. 修改代码
2. 重新构建：`npm run build`
3. 重启 Gateway：`openclaw gateway restart`
4. 测试功能

### 常见问题

**问题 1：`openclaw: command not found`**

说明 OpenClaw CLI 未安装或未添加到 PATH。请先安装 OpenClaw。

**问题 2：`npm: command not found`**

说明 Node.js 未安装。请先安装 Node.js：
```bash
# macOS
brew install node

# 或者从官网下载：https://nodejs.org/
```

**问题 3：构建失败，提示缺少依赖**

删除 `node_modules` 和 `package-lock.json`，重新安装：
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

**问题 4：插件安装后不生效**

1. 检查插件是否在列表中：`openclaw plugins list`
2. 重启 Gateway：`openclaw gateway restart`
3. 查看日志：`openclaw logs --follow`

**问题 5：软链接创建失败**

确保目标目录不存在：
```bash
rm -rf ~/.openclaw/extensions/wecom-multi-account-openclaw-plugin
ln -s "$(pwd)" ~/.openclaw/extensions/wecom-multi-account-openclaw-plugin
```

## 配置

### 完整配置示例

在 `openclaw.json` 中配置：

```json
{
  "channels": {
    "wecom_multi": {
      "defaultAccount": "main",
      "accounts": {
        "main": {
          "enabled": true,
          "name": "生产环境机器人",
          "botId": "BOT_ID_MAIN",
          "secret": "SECRET_MAIN",
          "websocketUrl": "wss://openws.work.weixin.qq.com",
          "dmPolicy": "pairing",
          "allowFrom": [],
          "groupPolicy": "allowlist",
          "groupAllowFrom": ["GROUP_ID_1", "GROUP_ID_2"],
          "sendThinkingMessage": true
        },
        "development": {
          "enabled": true,
          "name": "开发环境机器人",
          "botId": "BOT_ID_DEV",
          "secret": "SECRET_DEV",
          "dmPolicy": "open",
          "allowFrom": ["*"],
          "groupPolicy": "open",
          "sendThinkingMessage": false
        }
      }
    }
  }
}
```

### 配置字段说明

#### 渠道级配置

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `defaultAccount` | string | 否 | 默认出站账号 ID，省略时使用 `default` 或第一个账号 |
| `accounts` | object | 是 | 账号配置对象，key 为账号 ID |

#### 账号级配置

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `enabled` | boolean | 否 | false | 是否启用该账号 |
| `name` | string | 否 | 自动生成 | 账号显示名称 |
| `botId` | string | 是 | - | 企业微信机器人 ID |
| `secret` | string | 是 | - | 企业微信机器人 Secret |
| `websocketUrl` | string | 否 | wss://openws.work.weixin.qq.com | WebSocket 服务地址 |
| `dmPolicy` | string | 否 | pairing | 私聊策略：`open`/`allowlist`/`pairing`/`disabled` |
| `allowFrom` | array | 否 | [] | 私聊白名单（用户 ID 列表），`dmPolicy=open` 时设为 `["*"]` |
| `groupPolicy` | string | 否 | open | 群组策略：`open`/`allowlist`/`disabled` |
| `groupAllowFrom` | array | 否 | [] | 群组白名单（群组 ID 列表） |
| `sendThinkingMessage` | boolean | 否 | true | 是否发送"思考中"提示消息 |

### 安全策略说明

#### dmPolicy（私聊策略）

- **`pairing`**（推荐）：需要管理员批准后才能对话
- **`open`**：允许所有用户直接对话（需配合 `allowFrom: ["*"]`）
- **`allowlist`**：仅允许白名单用户对话
- **`disabled`**：禁用私聊

#### groupPolicy（群组策略）

- **`open`**：允许所有群组触发
- **`allowlist`**：仅允许白名单群组触发
- **`disabled`**：禁用群组消息

## 多账号与 Agent 绑定

### 配置 Agent 路由

在 `openclaw.json` 中配置 `bindings`：

```json
{
  "bindings": [
    {
      "match": {
        "channel": "wecom_multi",
        "accountId": "main"
      },
      "agentId": "main"
    },
    {
      "match": {
        "channel": "wecom_multi",
        "accountId": "development"
      },
      "agentId": "development"
    }
  ],
  "agents": {
    "defaults": {
      "model": {
        "primary": "claude-opus-4-6"
      }
    },
    "list": [
      {
        "id": "main",
        "name": "生产环境 Agent"
      },
      {
        "id": "development",
        "name": "开发环境 Agent"
      }
    ]
  }
}
```

### 路由规则说明

- `match.channel`: 固定为 `wecom_multi`
- `match.accountId`: 账号 ID，对应 `channels.wecom_multi.accounts` 的 key
- `agentId`: 目标 Agent ID，对应 `agents.list` 中的 `id`

### 示例场景

**场景 1：按环境隔离**

```json
{
  "channels": {
    "wecom_multi": {
      "accounts": {
        "prod": { "botId": "PROD_BOT", "secret": "...", "enabled": true },
        "staging": { "botId": "STAGING_BOT", "secret": "...", "enabled": true }
      }
    }
  },
  "bindings": [
    { "match": { "channel": "wecom_multi", "accountId": "prod" }, "agentId": "prod-agent" },
    { "match": { "channel": "wecom_multi", "accountId": "staging" }, "agentId": "staging-agent" }
  ]
}
```

**场景 2：按团队隔离**

```json
{
  "channels": {
    "wecom_multi": {
      "accounts": {
        "team-a": { "botId": "TEAM_A_BOT", "secret": "...", "enabled": true },
        "team-b": { "botId": "TEAM_B_BOT", "secret": "...", "enabled": true }
      }
    }
  },
  "bindings": [
    { "match": { "channel": "wecom_multi", "accountId": "team-a" }, "agentId": "team-a-agent" },
    { "match": { "channel": "wecom_multi", "accountId": "team-b" }, "agentId": "team-b-agent" }
  ]
}
```

## 验证和调试

### 1. 检查插件是否加载

```bash
openclaw plugins list
```

应该能看到 `@wecom/wecom-multi-account-openclaw-plugin` 或本地插件路径。

### 2. 检查渠道状态

```bash
openclaw channels list
```

应该能看到 `wecom_multi` 渠道和所有配置的账号。

### 3. 检查账号连接状态

```bash
openclaw status
```

查看每个账号的连接状态：
- `running: true` 表示 WebSocket 已连接
- `configured: true` 表示 botId 和 secret 已配置
- `lastError` 显示最近的错误信息

### 4. 重启 Gateway

修改配置后需要重启 Gateway：

```bash
openclaw gateway restart
```

或者重启特定账号：

```bash
openclaw channels restart wecom_multi --account main
```

### 5. 查看日志

```bash
openclaw logs --follow
```

关键日志标识：
- `[WeCom]`: 插件日志
- `WSClient connected`: WebSocket 连接成功
- `Pairing approved`: 用户配对批准
- `Message received`: 收到消息

### 常见问题排查

**问题：账号显示 `configured: false`**

检查 `botId` 和 `secret` 是否正确配置。

**问题：账号显示 `running: false`**

1. 检查 `enabled: true` 是否设置
2. 检查 `websocketUrl` 是否正确
3. 查看 `lastError` 字段的错误信息

**问题：企业微信 WebSocket 认证失败（错误码 600041）**

检查 `botId` 和 `secret` 是否正确，可以在企业微信管理后台重新获取。

**问题：消息无响应**

1. 检查 `dmPolicy` 和 `allowFrom` 配置
2. 检查 `bindings` 是否正确配置
3. 查看日志中是否有策略拒绝信息

## 已知限制

### 1. 不支持原生文件附件发送

当前版本的 `sendMedia` 仍然会将附件降级为文本链接发送：

```
Sending attachments is not supported yet
[原始文本]
[附件 URL]
```

这是因为企业微信 API 的文件上传流程较复杂，后续版本会支持。

### 2. 不支持消息反应（Reactions）

企业微信 API 不支持消息反应功能。

### 3. 不支持消息线程（Threads）

企业微信 API 不支持消息线程功能。

## 从旧版迁移

### 为什么改成 `wecom_multi`

为了避免与官方单账号插件 `wecom` 冲突，多账号插件使用独立的渠道 ID `wecom_multi`。

### 从单账号配置迁移

**旧配置（单账号）：**

```json
{
  "channels": {
    "wecom_multi": {
      "enabled": true,
      "botId": "BOT_ID",
      "secret": "SECRET",
      "dmPolicy": "pairing"
    }
  }
}
```

**新配置（多账号）：**

```json
{
  "channels": {
    "wecom_multi": {
      "defaultAccount": "default",
      "accounts": {
        "default": {
          "enabled": true,
          "botId": "BOT_ID",
          "secret": "SECRET",
          "dmPolicy": "pairing"
        }
      }
    }
  }
}
```

**自动迁移：**

插件会自动识别旧配置并将其映射为 `default` 账号，无需手动修改。当你通过 CLI 或 API 修改配置时，插件会自动将旧配置迁移到 `accounts.default`。

### 添加第二个账号

在已有配置基础上添加新账号：

```json
{
  "channels": {
    "wecom_multi": {
      "defaultAccount": "main",
      "accounts": {
        "default": {
          "enabled": true,
          "botId": "OLD_BOT_ID",
          "secret": "OLD_SECRET"
        },
        "new-account": {
          "enabled": true,
          "name": "新账号",
          "botId": "NEW_BOT_ID",
          "secret": "NEW_SECRET",
          "dmPolicy": "open",
          "allowFrom": ["*"]
        }
      }
    }
  }
}
```

## 开发和构建

### 开发环境设置

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化自动构建）
npm run dev
```

### 构建

```bash
# 清理旧构建产物
npm run clean

# 生产构建
npm run build
```

构建产物：
- `dist/index.esm.js` - ESM 格式
- `dist/index.cjs.js` - CommonJS 格式
- `dist/index.d.ts` - TypeScript 类型定义
- `dist/src/*.d.ts` - 子模块类型定义

### 项目结构

```
.
├── index.ts                 # 插件入口
├── src/
│   ├── channel.ts          # OpenClaw 插件接口实现
│   ├── utils.ts            # 多账号配置解析和管理
│   ├── state-manager.ts    # 全局状态管理（WSClient、消息状态、ReqId）
│   ├── monitor.ts          # WebSocket 连接监控
│   ├── message-parser.ts   # 消息内容解析
│   ├── message-sender.ts   # 消息发送（带超时保护）
│   ├── media-handler.ts    # 图片/文件下载和保存
│   ├── group-policy.ts     # 群组访问控制策略
│   ├── dm-policy.ts        # 私聊访问控制策略
│   ├── onboarding.ts       # 账号配置引导
│   ├── runtime.ts          # OpenClaw Runtime 管理
│   ├── const.ts            # 常量定义
│   ├── interface.ts        # 类型定义
│   ├── reqid-store.ts      # ReqId 持久化存储
│   └── timeout.ts          # 超时工具
├── dist/                    # 构建产物
├── openclaw.plugin.json     # 插件元数据
├── package.json
├── tsconfig.json
├── rollup.config.js
└── README.md
```

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request。

## 相关链接

- [OpenClaw 文档](https://openclaw.ai/docs)
- [企业微信机器人 API](https://developer.work.weixin.qq.com/document/path/99819)
- [GitHub 仓库](https://github.com/WecomTeam/wecom-openclaw-plugin)
