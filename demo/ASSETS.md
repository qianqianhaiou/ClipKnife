# 演示素材来源

全部图片为 AI 生成的示例画面，不是用户素材。没有临时远程图片地址，没有下载网络图库。文件名、分辨率、时长、大小、标签、描述、分镜时间和搜索命中均为固定演示数据，不表示图片文件自身的真实拍摄信息。

| 文件名（同时有 `-thumb.webp` 缩略图） | 来源与画面要求 |
| --- | --- |
| `sunset` | 本任务用 ImageGen 生成：金色日落、礁石与海浪，旅行纪实摄影，16:9，无文字和 UI |
| `street` | 本任务用 ImageGen 生成：雨后城市街道、橱窗暖光与蓝调天空，16:9，无文字和 UI |
| `architecture` | 本任务用 ImageGen 生成：白色现代建筑、几何切面与深蓝天空，16:9，无文字和 UI |
| `ceramic` | 本任务用 ImageGen 生成：窗边陶器、亚麻布与暖光，16:9，无文字和 UI |
| `forest` | 本任务用 ImageGen 生成：林间小径、蕨类与穿过树林的阳光，16:9，无文字和 UI |
| `maple` | 本任务用 ImageGen 生成：逆光的橙红枫叶特写，16:9，无文字和 UI |
| `traveler` | 本任务用 ImageGen 生成：背对镜头的虚构旅行者沿夕阳海岸行走，16:9，无文字和 UI |
| `mountain`、`coast`、`city`、`dog`、`coffee` | 复用桌面端已记录来源的 ImageGen 搜索示例；原来源说明为相邻 `clip-knife/src/assets/search/README.md`，与其 0–4 号示例顺序一致 |
| `atlas-stage.webp` | 复用同一桌面端搜索页中已记录来源的 ImageGen 素材背景，压缩到 1440px 宽，仅作低对比背景 |
| `preview.webp` | 本任务演示的原生窗口截图，1440×900，WebP 压缩；不是旧版软件截图 |

图片只做尺寸压缩和 WebP 编码。详情图最长边不超过 1280px，缩略图最长边 480px；背景约 58KB，静态预览约 143KB。构建时所有文件复制到 `docs/assets/demo/`。

`NavigationIcon.tsx` 和 `MaterialLibraryIcon.tsx` 复用桌面应用已有 SVG 定义，保证主导航与素材类型图标一致。辅助线性图标来自锁定版本的 Lucide，弹窗与选择器来自 Radix UI。构建脚本收集运行时依赖的完整许可证，随静态输出发布到 `docs/assets/demo/third-party-notices.txt`。原生截图脚本沿用工作区既有 `clip-knife/scripts/settings-visual/capture.ps1` 的窗口归属、DPI 校验和截图方法。
