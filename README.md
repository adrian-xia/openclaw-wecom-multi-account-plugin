# WeCom OpenClaw Plugin (Multi-Account Fork)

这个仓库是在现有 `wecom-openclaw-plugin` 的基础上，补上 **企业微信多账号支持** 的实现。

## 这次改了什么

- 支持 `channels.wecom_multi.accounts.<accountId>` 多账号配置
- 支持 `channels.wecom_multi.defaultAccount` 指定默认出站账号
- 兼容旧单账号配置：
  - `channels.wecom_multi.botId`
  - `channels.wecom_multi.secret`
  - 以及其他旧版平铺字段
- outbound 发送时会按 `accountId` 选择正确的 WSClient
- security / pairing / allowFrom 都按账号维度隔离
- gateway `logoutAccount` 只影响指定账号

## 配置示例

```json
{
  "channels": {
    "wecom_multi": {
      "defaultAccount": "main",
      "accounts": {
        "main": {
          "enabled": true,
          "name": "main-wecom",
          "botId": "BOT_ID_MAIN",
          "secret": "SECRET_MAIN",
          "dmPolicy": "pairing"
        },
        "development": {
          "enabled": true,
          "name": "development-wecom",
          "botId": "BOT_ID_DEV",
          "secret": "SECRET_DEV",
          "dmPolicy": "pairing"
        }
      }
    }
  }
}
```

## 兼容旧配置

如果你现在还是旧配置：

```json
{
  "channels": {
    "wecom_multi": {
      "enabled": true,
      "botId": "BOT_ID",
      "secret": "SECRET"
    }
  }
}
```

这份 fork 仍然会把它当作 `default` 账号读取。

当你后续调用插件写配置时，账号配置会统一写入：

```json
channels.wecom_multi.accounts.default
```

这样后面再加第二个账号时就不会乱。

## 构建

```bash
npm install
npm run build
```
