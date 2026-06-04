# GitHub Desktop 团队协作指南

> 本指南面向肇庆学院校园助手（KCS）项目团队成员，使用 GitHub Desktop 进行日常开发协作。

---

## 一、安装与配置

### 1. 安装 GitHub Desktop

- 下载地址：https://desktop.github.com/
- 安装后用你的 GitHub 账号登录

### 2. 克隆项目仓库

1. 打开 GitHub Desktop
2. 点击 **File → Clone repository**
3. 在列表中找到 `Kcs` 仓库，点击 **Clone**
4. 选择本地存放路径（建议放在一个好找的位置，比如 `D:\Projects\Kcs`）

### 3. 配置 Git 用户信息

1. 点击 **File → Options**
2. 在 **Git** 选项卡中填写：
   - **Name**：你的真名或昵称（如 `张三`）
   - **Email**：你的 GitHub 邮箱
3. 点击 **Save**

---

## 二、分支管理（核心概念）

### 什么是分支？

分支就像"平行宇宙"——你在自己的分支上改代码，不会影响别人的工作，改好了再合并到主分支。

```
main          ← 稳定版本，随时可以运行
└── dev       ← 开发主线，功能合并到这里
    ├── feature/张三-论坛优化
    ├── feature/李四-小程序页面
    ├── feature/王五-后端接口
    └── feature/赵六-文档测试
```

### 创建自己的分支

1. 点击左上角 **Current Branch** 按钮
2. 点击 **New Branch**
3. 输入分支名：`feature/你的名字-你要做的事`
   - 例如：`feature/张三-论坛评论功能`
   - 例如：`feature/李四-小程序登录页`
4. 基于 `dev` 分支创建（下拉选择）
5. 点击 **Create Branch**

### 切换分支

点击左上角 **Current Branch** → 选择你要切换的分支 → **Switch to this branch**

---

## 三、日常开发流程

### 每天开始工作前

```
1. 打开 GitHub Desktop
2. 确认当前分支是你的 feature 分支
3. 点击菜单栏 Branch → Merge into current branch
4. 选择 dev 分支，把最新代码合并到你的分支
5. 如果有冲突，先解决冲突（见下方教程）
```

### 修改代码

1. 用 VS Code 或其他编辑器打开项目文件夹，正常写代码
2. 写完保存后，回到 GitHub Desktop
3. 左侧会显示你改了哪些文件（蓝色图标 = 已修改，绿色 = 新增，红色 = 已删除）

### 提交代码（Commit）

1. 左下角填写 **Summary**（简短描述你做了什么）
   - ✅ `feat: 添加论坛评论功能`
   - ✅ `fix: 修复登录页面样式问题`
   - ✅ `docs: 更新 README 说明`
   - ❌ `update`（太模糊）
   - ❌ `改了一堆东西`（没有意义）
2. 点击 **Commit to feature/你的分支名**

### 推送到 GitHub（Push）

- 提交后，点击右上角 **Push origin** 按钮
- 这样你的代码就上传到 GitHub 了，别人可以看到

### 创建合并请求（Pull Request）

当你完成了一个功能，需要合并到 `dev` 分支：

1. 点击 **Create Pull Request**（推送后会自动弹出提示）
2. 浏览器会打开 GitHub 页面
3. 填写：
   - **标题**：简要说明你做了什么
   - **描述**：详细说明改了哪些东西、怎么测试的
   - **Reviewers**：选择团队中一个人来审查
4. 点击 **Create Pull Request**
5. 等审查通过后，点 **Merge pull request**

---

## 四、常见问题处理

### 情况 1：合并时出现冲突

**什么时候会冲突？** 你和别人同时改了同一个文件的同一段代码。

**怎么解决：**

1. GitHub Desktop 会弹出冲突提示
2. 点击 **Open in Visual Studio Code**（或你用的编辑器）
3. 打开冲突文件，会看到类似这样的标记：

```
<<<<<<< HEAD
你写的代码
=======
别人写的代码
>>>>>>> dev
```

4. **手动选择保留哪个**（或两个都保留），删掉 `<<<<<<<`、`=======`、`>>>>>>>` 这些标记
5. 保存文件
6. 回到 GitHub Desktop，点击 **Continue merge**

### 情况 2：Push 失败（提示要先 Pull）

说明远程有别人提交的新代码，你需要先拉取：

1. 点击 **Pull origin**
2. 如果有冲突，按上面的方法解决
3. 再次 **Push origin**

### 情况 3：不小心改错了文件，想撤销

- **撤销未提交的修改**：右键文件 → **Discard changes**
- **撤销上一次 commit**：顶部菜单 **History** → 右键最近一次提交 → **Revert this commit**

### 情况 4：想看看别人改了什么

- 点击顶部 **History** 标签页
- 可以看到所有提交记录，点击任意一次可以看到具体改了什么

---

## 五、项目文件分工

| 人员 | 分支命名示例 | 主要修改的文件 |
|---|---|---|
| 张三（后端） | `feature/张三-后端接口` | `auth_server.py`、`jwxt.py`、`supabase/migrations/` |
| 李四（Web 前端） | `feature/李四-论坛优化` | `src/components/`、`src/utils/` |
| 王五（小程序） | `feature/王五-小程序页面` | `kcs-miniapp/src/pages/` |
| 赵六（文档/测试） | `feature/赵六-文档更新` | `README.md`、`*.md`、测试文件 |

**重要原则：不要动别人负责的文件，除非提前沟通。**

---

## 六、Commit 信息规范

| 前缀 | 什么时候用 | 示例 |
|---|---|---|
| `feat:` | 新功能 | `feat: 添加二手商品搜索功能` |
| `fix:` | 修复 bug | `fix: 修复课表显示空白的问题` |
| `docs:` | 文档更新 | `docs: 添加部署说明文档` |
| `style:` | 样式/格式调整 | `style: 调整论坛卡片间距` |
| `refactor:` | 重构代码 | `refactor: 拆分 App.jsx 为多个组件` |
| `test:` | 测试相关 | `test: 添加登录功能单元测试` |

---

## 七、本地开发环境配置

每个成员都需要在本地跑起项目，步骤如下：

### Web 前端

```bash
# 在项目根目录
npm install          # 安装依赖（第一次需要）
npm run dev          # 启动开发服务器，访问 http://localhost:5173
```

### 后端

```bash
# 创建 Python 虚拟环境（第一次需要）
python -m venv .venv

# 激活虚拟环境
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# Windows CMD:
.venv\Scripts\activate.bat

# 安装依赖
pip install -r requirements.txt

# 创建 .env 文件（找项目负责人要配置内容）
# 然后启动
python auth_server.py
```

### 微信小程序

```bash
cd kcs-miniapp
npm install
npm run dev:mp-weixin
# 用微信开发者工具打开 dist/dev/mp-weixin 目录
```

### 环境变量（.env）

`.env` 文件包含敏感信息（数据库密钥等），不会提交到 GitHub。你需要：

1. 找项目负责人拿到 `.env` 文件内容
2. 在项目根目录创建 `.env` 文件，把内容粘贴进去
3. **绝对不要把 .env 文件提交到 GitHub**

---

## 八、每周协作节奏建议

| 时间 | 做什么 |
|---|---|
| 每天开始 | Pull 最新代码到自己的分支 |
| 开发过程中 | 每完成一个小功能就 Commit + Push |
| 每周末 | 开一次短会，同步进度，合并分支 |
| 发现 bug | 在 GitHub Issues 里创建 issue，标记对应的人 |

---

## 九、速查表

| 操作 | GitHub Desktop 怎么做 |
|---|---|
| 拉取最新代码 | **Branch → Merge into current branch** 选 `dev` |
| 提交修改 | 左下角写描述 → **Commit to feature/xxx** |
| 推送到远程 | 右上角 **Push origin** |
| 创建 PR | 推送后点 **Create Pull Request** |
| 切换分支 | 左上角 **Current Branch** → 选择 |
| 查看历史 | 顶部 **History** 标签 |
| 撤销修改 | 右键文件 → **Discard changes** |
| 解决冲突 | 弹出提示后用编辑器手动修改 → **Continue merge** |

---

> 有问题随时在群里问，不要自己瞎摸索浪费时间。
