# dsh-chat-index

DSH (DeepSeek Harness) Web 插件：在每个会话的右侧提供「提问索引」。

## 功能

- **右侧窄条(rail)**:每个提问一个圆点,圆点按**真实提问时间间隔**分布
  (顶部=最早、底部=最近);点击圆点滚动定位并短暂高亮,按住上下拖动快速滑动;
  顶部显示提问数。会话没有任何提问时窄条自动隐藏。
- **链状面板(chain)**:会话标题行最右侧的 `≡`(每个会话常驻,空会话也可用)
  或窄条底部 `⇱` 展开链视图,节点显示问题摘要与提问时间;来自分支会话
  (子会话/分叉)的提问以子树形式挂在主会话之下;每个会话各自的展开状态
  会被记住。`✕` 收起。
- **分支跳转**:点击分支节点会先切换到对应会话,再滚动定位并高亮。
- 数据源:当前会话实时窗口(`useSession`)+ 持久历史(`session.history`
  分页,含分支会话);会话切换后自动重建。

- 部署:安装为 DSH npm 型插件,包体挂在 web profile 的
  `~/.dsh/profiles/web/node_modules`,经用户层 `cordis.patch.yml`
  (loader 热 watch)插入 entry `chat-index` — 免重启热挂载,刷新页面即可。

## 结构与实现

- 挂载座位:`conversation.session.header.utilities`(list/session;自带
  `sessionId` / `useSession` / `useSessions`);可视层通过
  `react-dom` portal 到 `document.body`,不受头部布局影响。
- 数据:当前会话实时窗口来自 `useSession`;完整提问历史与各分支会话的提问
  由 `ctx.connection.api.sessions.history(...)` 分页拉取(与产品打开历史
  会话同一条 RPC),并实时合并窗口内新增提问;分支树由 `useSessions`
  列表里 `parentSessionId` 递归得到。
- 跳转:切到目标会话(`ctx.sessions.open`)后等待窗口打开,按
  `data-chat-anchor-key` 定位消息行,滚动 `[data-conversation-scroll]`
  滚动容器并短暂高亮;目标在更早历史时有限次 `loadOlder` 后重试。

## 开发

```bash
node scripts/build.mjs      # 重新生成 lib/client.js
```

`src/client/*.js` 按文件名排序拼接,运行在
`window.__ModuleLoader__.load({ id, factory })` 的 factory 作用域内,
可直接使用 `require('react')` 等运行时可用模块。

## 安装(本机 profile — 已按此方式部署)

1. `node scripts/build.mjs`(生成 `lib/client.js`)
2. 把本包拷入 web profile 的依赖目录:
   `C:\Users\asus\.dsh\profiles\web\node_modules\dsh-chat-index\`
   (package.json / lib / cordis.patch.yml)
3. 在 `C:\Users\asus\.dsh\profiles\web\cordis.patch.yml`(官方标注的用户挂载层,
   热生效,loader 实时 watch)追加:

   ```yaml
   - insert:
       - id: chat-index
         name: 'dsh-chat-index'
   ```

4. 无需重启服务:**刷新 dsh web 页面**(Ctrl+Shift+R)即可加载插件。
   profile patch 与 `cordis.patch.yml` 都会在下次完整重启时保留生效。

> 说明:也可以走官方 `dsh plugin --profile web add`/`dsh.profile.bundles`
> 通道挂载,但不要与上面的手动 patch 行同时使用,否则下次启动会双重挂载。

### 卸载/回滚

- 删除 `cordis.patch.yml` 中 `id: chat-index` 的 insert 块 → 插件行被热移除;
- 删除 `...\node_modules\dsh-chat-index\` 目录;
- 刷新页面。若曾改过 `dsh.profile.bundles`,同步删除数组里的 `"dsh-chat-index"`。

## License

MIT
