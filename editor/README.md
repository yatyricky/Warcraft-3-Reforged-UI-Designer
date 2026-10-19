# WC3 UI Editor

纯浏览器端的 Warcraft III Reforged UI 可视化编辑器（本仓库 `editor/` 子目录的全新工程，与 legacy Electron 版无关）。

## 运行

```bash
cd editor
npm install
npm run dev      # http://localhost:5273
npm test         # Vitest 单测（布局引擎 golden / 序列化 / store / 校验）
npm run build    # tsc + vite build
```

## 技术栈

- React 19 + TypeScript strict + Vite
- zustand 状态管理（规范化树：`frames: Record<id, FrameNode>`），immer 产生不可变快照
- 撤销/重做：整树快照历史（结构共享，上限 100 步），拖拽手势合为一步
- Tailwind CSS v4，深色主题
- Vitest（node 环境，纯逻辑测试）

## 数据模型（对齐 Zulaman-WE 的 FrameComponent）

布局采用 uGUI RectTransform 语义，坐标为 war3 frame 单位（全屏游戏区 = 0.8 × 0.6，原点左下）：

- 点锚（anchorMin == anchorMax）：`anchoredPosition` 为 pivot 相对锚点的偏移，`sizeDelta` 即实际宽高
- 拉伸锚：`anchoredPosition` 相对锚区中心，`sizeDelta` 为相对锚区宽高的增量（Unity 规则）
- 布局求解公式与 `Zulaman-WE/csproj/src/Components/FrameComponent.cs` 的点锚实现一致；权威参考见 `docs/war3-ui-frame-guide.md`

9 种类型：FRAME / IMAGE / TEXT / BUTTON / CHECKBOX / STATUSBAR / SLIDER / EDITBOX / TEXTAREA。
FRAME 与 IMAGE 对应框架运行时已实现的 `FrameComponent` / `FrameImage`；其余类型在画布上为简化预览，字段为 v2 导出预留。

## 功能（v1）

- 三栏布局：层级树 | 画布 | Inspector，顶栏工程信息
- 画布：16:9 舞台 + 4:3 安全区（0.8×0.6 游戏区）标示、按类型渲染、滚轮平移 / Ctrl+滚轮缩放、空格/中键拖拽平移
- 选择：点击 / Shift·Ctrl 加选 / marquee 框选；隐藏或失活元素幽灵显示、不可交互
- 变换：拖拽移动（多选批量）、8 向 resize 手柄、pivot 与锚点 gizmo、16 组锚点预设（保持矩形）、
  吸附（游戏区边缘/中线 + 可选 0.01 网格）
- 层级树：拖拽重排/改父（上 1/3 before、下 1/3 after、中间 into，含环检测）、显隐/激活切换、双击重命名
- Inspector：Frame 标志（active/visible/raycastTarget）、Rect Transform（锚点预设/锚点/位置/尺寸/Pivot/解算矩形只读）、
  类型属性（贴图双轨路径、文本、颜色、对齐、状态条与滑条数值）、事件函数名（v2 导出预留）
- 快捷键：Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y，Ctrl+S / Ctrl+Shift+S，Ctrl+O / Ctrl+N，Ctrl+D 复制，
  Delete 删除，方向键微调（Shift ×10，快速连按合并为一步 undo），Esc 取消选择
- 工程文件：`.wc3ui.json`（schemaVersion 1，防御式加载）。Chromium 用 File System Access API（保存句柄会话内复用），
  其他浏览器降级为下载/上传；localStorage 防抖自动暂存（仅在有编辑历史后写入），重载后可恢复
- **自定义资产**：背景图片与元素贴图预览图会复制到 `~/.tmp/W3RUID/<工程名>/`，工程文件内以 `asset:<文件名>` 相对引用。
  首次使用会弹出目录选择器（请选择或新建 `~/.tmp/W3RUID` 文件夹），目录句柄存入 IndexedDB 跨会话复用；
  不支持 File System Access 的浏览器降级为会话内 blob URL（不落盘）

## v2 规划（未实现）

- C# 导出：生成 SharpForge 风格 GameObject + FrameComponent 层级代码（对齐 `Zulaman-WE/csproj/src/Program.cs` 的
  UiTest 命令式风格：`new GameObject` → `AddComponent<FrameComponent>` → 属性赋值；代码约束：不用 `?.`、
  全局命名空间、无 GetLocalPlayer）
- FDF/TOC 生成；文字/事件等 Zulaman-WE 框架侧尚未实现的类型跟随其组件迭代逐步启用
- scrollview / 特效（SPRITE/MODEL）组合件（参考 `docs/war3-ui-frame-guide.md` §14 配方）

## 目录

```
editor/
  src/core/          纯逻辑：类型、默认值、布局求解/逆变换、序列化、校验（100% 可单测）
  src/store/         zustand store（文档快照历史、选择、视口、全部编辑动作）
  src/components/    TopBar / Hierarchy / canvas/（Canvas、FrameView、SelectionOverlay）/ inspector/
  src/persistence/   文件读写（FS Access + 降级）、自动暂存
  tests/             Vitest：布局 golden（UiTest 三场景）、roundtrip、store、校验
  docs/              war3-ui-frame-guide.md（从 Zulaman-WE 复制的权威参考）
```
