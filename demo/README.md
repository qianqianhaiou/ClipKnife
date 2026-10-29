# 官网交互示例

首页 `#demo` 嵌入独立 `/demo/` 页面。演示以当前桌面软件的素材库、智能搜索和分组整理为依据；不调用桌面 API、不读取本机素材、不执行模型推理。完整功能以下载的桌面版本为准。

## 设计与交互

设计方向：让访客直接进入紧凑、可操作的素刀工作区。黑色画布、深灰侧栏、品牌橙激活态、彩色实体小图标和中性细边框与工作区的正式 UI 基准一致。头部保留当前四项主导航，分组从「素材库 → 智能分类 → 我的分组」进入。

内容顺序：24 项示例素材 → 文件夹与类型筛选 → 画面描述搜索 → 详情与分镜静帧 → 添加到分组。另有 3 项可以模拟导入的示例。音频只展示信息，视频只切换静帧，搜索通过固定描述、标签和同义词匹配。

动效只用于结果出现、抽屉与弹窗过渡和控件反馈；系统选择减少动画时关闭过渡。宽屏详情使用侧栏，窄桌面使用弹窗。移动端展示实拍演示截图及电脑体验提示，不加载 React。无 JavaScript 时保留静态内容和下载入口。

## 开发与构建

需要 Node.js 22.12+ 和 pnpm 10。在 `demo/` 执行：

```powershell
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm test
pnpm build
pnpm build:check
```

开发地址为 `http://127.0.0.1:41388/demo/`。源代码位于 `demo/src/`，Vite 只构建这个演示，不改变现有静态网站的构建方式。React 用于共享交互状态，Radix Dialog/Select 提供弹窗焦点管理和键盘可操作的下拉框；其余依赖用于构建、类型检查和测试，没有增加远程运行时依赖。

`pnpm build` 先写入被忽略的 `demo/.build/`，再按允许路径发布到 `docs/demo/index.html` 与 `docs/assets/demo/`。`build-manifest.json` 记录每个输出的 SHA-256。源文件和这些静态输出一起提交，现有托管仍直接发布 `docs/`。`build:check` 重新构建并逐字节比对，不修改已发布目录。`.gitattributes` 固定新文件换行符，避免 Windows checkout 改变校验和。

发布时分两次构建轻量入口和 React 工作区，均输出普通 IIFE 脚本，CSS 单独提取。入口通过普通 `<script>` 延迟加载工作区，等待样式就绪后再挂载。因此首页演示和独立体验页既可通过 HTTP 访问，也可直接打开 `docs/index.html` 或 `docs/demo/index.html`。开发服务器仍使用 Vite 模块与热更新；手册等 Markdown 页面继续使用 HTTP 预览。

在仓库根目录验证整站：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/docs-site.test.ps1
```

## 运行边界

- 所有照片和样例信息随网站发布；素材来源见 [ASSETS.md](ASSETS.md)。
- 状态只保存在当前标签页的 `sessionStorage`，使用带版本的独立键。损坏或不兼容的数据回到初始状态；存储被禁用时仍能在内存中操作。
- 首页在演示接近视口且页面至少 1024px 时加载 iframe；小于该宽度会移除 iframe。独立页小于 1024px 时不下载 React 主包。
- HTTP 下 iframe 仅接受同源、指定窗口发来的就绪消息；`file://` 下仅接受当前 iframe 的不透明来源消息。超时、脚本或样式加载失败都提供重试。
- 「创作工具」「任务中心」「人物分组」「设置」在演示中提供边界说明，不显示虚假的成功任务或设备信息。

## 原生验证

遵循工作区约定，不使用浏览器实例验收。`scripts/demo-visual/` 通过隔离 Wry/WebView2 宿主加载已构建的 HTTP 页面、操作真实 DOM、输出检查结果并截取原生窗口客户区。需要工作区现有的 `settings-visual.exe`（支持本地 41387 端口），路径由参数传入，不复制或提交二进制。

```powershell
python scripts/demo-visual/serve.py
# 另一终端，NativeHostPath 指向已构建的隔离宿主
./scripts/demo-visual/capture.ps1 -NativeHostPath <settings-visual.exe> -Scenario workflow -Run workflow
./scripts/demo-visual/capture.ps1 -NativeHostPath <settings-visual.exe> -Scenario workflow -Width 1024 -Height 768 -Run narrow
./scripts/demo-visual/capture.ps1 -NativeHostPath <settings-visual.exe> -Scenario mobile -Width 390 -Height 844 -Run phone
./scripts/demo-visual/capture.ps1 -NativeHostPath <settings-visual.exe> -Scenario reduced-motion -ReducedMotion -Run reduced
./scripts/demo-visual/capture.ps1 -NativeHostPath <settings-visual.exe> -Scenario library -Width 1280 -Height 800 -Scale 1.25 -Run scaled
```

更多场景：`library`、`detail`、`search-landing`、`search`、`preview`、`nested`、`advanced`、`groups`、`empty`、`image-error`、`storage-denied`、`corrupt-session`、`session`。首页使用 `-Page '' -Scenario home` 或 `home-mobile`；文档页使用 `-Page manual/ -Scenario document`。

模块失败验证：停止普通预览服务，再用 `python scripts/demo-visual/serve.py --fail-module` 启动，运行 `-Scenario module-error`。故障只作用于本地测试服务，不改变发布文件。

本地文件验证需要支持 `file://` 的隔离宿主。下面命令复用工作区已有原生工具的 Cargo 清单与锁文件，离线构建官网专用宿主到 `.cache/`；不会修改桌面端仓库或放宽 WebView 安全设置。`SourceNativeDirectory` 指向桌面仓库的 `scripts/settings-visual/native`：

```powershell
./scripts/demo-visual/prepare-native.ps1 -SourceNativeDirectory ../clip-knife/scripts/settings-visual/native
./scripts/demo-visual/capture.ps1 -NativeHostPath .cache/demo-review/native-target/debug/settings-visual.exe -LocalFile -Page '' -Scenario home -Run file-home
./scripts/demo-visual/capture.ps1 -NativeHostPath .cache/demo-review/native-target/debug/settings-visual.exe -LocalFile -Scenario workflow -Run file-workflow
./scripts/demo-visual/capture.ps1 -NativeHostPath .cache/demo-review/native-target/debug/settings-visual.exe -LocalFile -Scenario session -Run file-session
```

文件模式由宿主在顶层文档注入 QA，使用标题回传报告，避免 Wry 0.55 的 HTTP IPC 解析器拒绝文件 URI。嵌入页仍使用原始来源隔离，首页检查就绪与可见性，独立页检查完整交互。这个宿主也支持上述 HTTP 场景。用 `--fail-style` 替代 `--fail-module` 可单独验证样式失败；两者均运行 `-Scenario module-error`。

每次检查使用新的 `-Run` 值创建隔离用户数据目录。截图、报告和缓存只保存在被忽略的 `.cache/demo-review/`；脚本核对窗口归属、CSS 尺寸与实际像素/DPR、非空截图、运行错误、失败图片和交互断言。检查脚本只按 `?qa=` 注入，生产输出不包含测试钩子。合并前结果见 [REVIEW.md](REVIEW.md)。
