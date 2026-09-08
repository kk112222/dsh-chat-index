# dsh-chat-index

> A per-session **question index** for the DeepSeek Harness Web UI (dsh web): a thin
> time-proportional dot rail on the right edge of every conversation, plus an
> expandable chain panel. Every user question is a node with its text and time —
> including questions in **branch/subagent sessions** — click any node to jump to
> that message and briefly highlight it.

[![npm version](https://img.shields.io/npm/v/dsh-chat-index?color=4a7bd6)](https://www.npmjs.com/package/dsh-chat-index)
[![license](https://img.shields.io/github/license/kk112222/dsh-chat-index?color=green)](LICENSE)
[![release](https://img.shields.io/github/v/release/kk112222/dsh-chat-index)](https://github.com/kk112222/dsh-chat-index/releases)
[![CI](https://github.com/kk112222/dsh-chat-index/actions/workflows/ci.yml/badge.svg)](https://github.com/kk112222/dsh-chat-index/actions/workflows/ci.yml)

---

## 功能 / Features

- **右侧圆点窄条(rail)**:每个提问一个圆点,**按真实提问时间间隔分布**
  (顶部 = 最早,底部 = 最近);点击圆点 → 聊天区滚动定位并**短暂高亮**;
  按住上下拖动可快速滑动,拖动时右侧浮出该提问的摘要小窗;条顶显示提问数。
- **链面板(chain)**:会话标题行最右的常驻 `≡` 开关,或窄条底部 `⇱`,
  展开链视图 —— 每个节点显示**问题摘要 + 时间**;**分支/子会话**以子树
  挂在主会话下(节点可点击,先切换到对应会话再定位高亮);`✕` 收起。
- 空会话不显示窄条,但 `≡` 始终可用(面板显示"还没有提问")。
- 数据源:当前会话实时快照 + 持久历史(`session.history` 分页),换会话自动重建。
- 纯前端实现,host 仅保留最小 loader 入口。
- 与已有同类(`dsh-question-nav`、`dsh-chat-rail`、`dsh-chat-index-rail`)的差异:
  **链面板 + 分支会话子树 + 时间比例分布**。

## 截图 / Screenshots

(待补充 —— 运行后截图右侧窄条与展开的链面板,放入 `docs/` 并在下方引用)

## 安装 / Install

通过 DSH 官方插件通道安装(npm 发布后可用):

```bash
dsh plugin --profile web add dsh-chat-index
```

> 手动安装(无需联网,便于本地调试):把本包放进 profile 依赖目录,并在
> `~/.dsh/profiles/web/cordis.patch.yml` 追加:
> ```yaml
> - insert:
>     - id: chat-index
>       name: 'dsh-chat-index'
> ```
> 无需重启服务,刷新页面即可。注意:**手动通道与官方通道二选一**,避免双重挂载。

## 使用 / Usage

1. 打开任意会话 → 右侧出现窄条(有提问时)。
2. 点圆点 / 按住拖动 → 跳到对应提问并高亮。
3. 点标题行右侧 `≡`(或窄条底部 `⇱`)展开链面板;点节点跳转,`✕` 收起。
4. 会话内开关状态各自记忆;刷新页面后默认收起。

## 开发 / Development

```bash
node scripts/build.mjs        # 生成 lib/client.js(src/client/* 拼接)
node scripts/smoke.mjs        # 离线冒烟测试(模拟 DSH 模块加载器)
npm run check                 # build + 语法检查 + smoke
```

结构:

```
src/client/  客户端源码片段(纯 JS,无 JSX/TS)
             00-libs 01-style 02-utils 03-data 04-components 05-apply
lib/         发布产物(lib/index.js 宿主入口 + lib/client.js 浏览器模块)
cordis.patch.yml    DSH bundle patch(loader 挂载行)
scripts/      构建与冒烟脚本
```

## 发布 / Publishing

- 版本:bump `package.json` 的 `version`(semver)。
- 推送 tag(如 `v0.1.1`)会触发 [.github/workflows/publish.yml](.github/workflows/publish.yml)
  自动 `npm publish`(需在仓库 Settings → Secrets → Actions 配置 `NPM_TOKEN`,
  值 = 一个 npm **Automation** 令牌;令牌须带 npmjs 的 2FA 绕过能力)。
- 市场目录条目在 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
  的 `data/plugins/kk112222__dsh-chat-index.yml`,指向本仓库,一般无需改动。

## License

[MIT](LICENSE) © xiaoshuai111
