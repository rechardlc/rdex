# Claude Skills 配置

## 已安装的 Skills

### 文档处理 (Document Skills)
- **pdf** - PDF 文件处理和生成
- **docx** - Word 文档创建和编辑
- **xlsx** - Excel 表格处理
- **pptx** - PowerPoint 演示文稿生成

### 示例 Skills (Example Skills)
- **algorithmic-art** - 算法艺术生成
- **brand-guidelines** - 品牌指南创建
- **canvas-design** - Canvas 设计
- **doc-coauthoring** - 文档协作
- **frontend-design** - 前端设计
- **internal-comms** - 内部沟通
- **mcp-builder** - MCP 构建器
- **skill-creator** - Skill 创建工具
- **slack-gif-creator** - Slack GIF 创建
- **theme-factory** - 主题工厂
- **web-artifacts-builder** - Web 组件构建
- **webapp-testing** - Web 应用测试

### UI/UX 设计
- **ui-ux-pro-max** - 专业 UI/UX 设计系统
  - 50+ 设计风格
  - 21 种调色板
  - 50 种字体配对
  - 支持 React、Next.js、Vue、Svelte、SwiftUI 等

## 使用方法

### 方式 1：直接提及（推荐）
直接在对话中提及 skill 的功能即可自动触发：
```
用 PDF skill 提取 path/to/file.pdf 的表单字段
用 ui-ux-pro-max 设计一个登录页面
帮我创建一个品牌指南
```

### 方式 2：斜线命令
如果 Claude Code 支持，可以使用斜线命令：
```
/pdf extract path/to/file.pdf
/ui-ux-pro-max design landing-page
```

### 方式 3：显式调用 Skill 工具
```
使用 Skill 工具调用 "pdf" skill
使用 Skill 工具调用 "ui-ux-pro-max" skill，参数 "design dashboard"
```

## 配置文件

- [claude.json](claude.json) - Skills 配置文件
- [skills/](skills/) - 所有 skills 源码（本地副本，可直接迁移）

## 创建自定义 Skill

在 [skills/](skills/) 目录创建新的 skill 文件夹：

1. 创建文件夹，包含 `SKILL.md`
2. 添加 YAML frontmatter：
```yaml
---
name: my-skill
description: Skill 描述和使用场景
---
```
3. 添加指令和示例
4. 在 `.claude/claude.json` 中注册路径

## 文档

- [Agent Skills 规范](../skills/spec/)
- [创建自定义 Skills](https://support.claude.com/en/articles/12512198-creating-custom-skills)
- [使用 Skills](https://support.claude.com/en/articles/12512180-using-skills-in-claude)
