# dev-playkit

这是一个基于 Playwright 的前端开发辅助工具，支持自动登录、页面监控、请求调试和行为录制。通过 MCP 协议可以在 AI 编辑器（Cursor/Claude Desktop）中使用，并且为 llm 提供页面报错，请求以及渲染信息。

## 安装

### 方式 1: NPM 安装

```shell
# 全局安装
npm i -g dev-playkit

# 或使用 yarn
yarn global add dev-playkit

# 打开百度
dev-playkit --urls=["https://www.baidu.com/"]
```

### MCP 集成（AI 工具）

在 Cursor 或 Claude Desktop 的配置文件中添加：

```json
{
  "mcpServers": {
    "dev-playkit": {
      "command": "npx",
      "args": ["-y", "dev-playkit"]
    }
  }
}
```

如果 npx 方式无法使用，可以使用本地链接：

```shell
# 然后在配置文件中使用绝对路径
{
  "mcpServers": {
    "dev-playkit": {
      "command": "/path/to/node",
      "args": ["/path/to/node_modules/dev-playkit/build/index.js"]
    }
  }
}
```

## 功能特性

### 🔐 自动登录与认证

自动处理登录流程，保存并复用 Cookie，告别重复输入账号密码

**workflow**：监听3xx状态码 => 取 header 中的 location 地址进行重定向 => 操作 dom 回填账号进行登录 => 登录成功 => 复制 cookie 到 目标 url 下

#### 使用示例

1. **账号密码设置**

方式 1: 命令行中使用`authWithoutHost`参数设置，适用于测试环境，账号不固定且密码不敏感

```shell
# 使用通用账号（适用于所有认证站点）
dev-playkit --urls='["http://localhost:3000"]' \
  --authWithoutHost='{"user":"testuser","pwd":"test123"}'
```

方式 2: 在文件`~/.cache/dev-playkit-cache/auth.json`中配置, 适用于敏感账号, 不方便在命令行中显示的

```json
{
  "sso.example.com": {
    "user": "your_username",
    "pwd": "your_password"
  },
  "auth.test.com": {
    "user": "another_user",
    "pwd": "another_pwd"
  }
}
```

**2. 进行登录适配，在 loginAdaptors.js 文件中添加适配。**

```javascript
module.exports = [{
  // 地址匹配
	pattern: /example\.com/,
  // 执行一段脚本， 回填账号后点击登录按钮
	adaptor: async (account) => {
		// 模仿用户输入
		const inputting = (dom, text) => {
			if (!dom || !text) return;
			const simulateKeyEvent = (type, key) =>
				dom.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));

			for (const char of text) {
				simulateKeyEvent('keydown', char);
				simulateKeyEvent('keypress', char);
				dom.value += char;
				dom.dispatchEvent(new Event('input', { bubbles: true }));
				dom.dispatchEvent(new Event('change', { bubbles: true }));
				simulateKeyEvent('keyup', char);
			}
		}
		inputting(document.querySelector('\#login-username'), account.user)
		inputting(document.querySelector('\#login-password'), account.pwd)
		await new Promise(resolve => setTimeout(resolve, 500));
		document.querySelector('\#btn-login')?.click()
		return "success" // return success to indicate login success
	},
}
];
```

**3. 在** **`settings.json`** 文件中进行设置

```shell
"cookiesShouldBeSaved": {
		"description": "值为域名数组，用于设置需要保存 cookie 的域名",
		"value": [
			"ssosv.example.com",
		]
	},
	"authSites": {
		"description": "值为数组，用于设置登录网站的地址",
		"value": [
			"ssosv.example.com",
		]
	},
```

- `cookiesShouldBeSaved`: 默认情况下 cookies 不会被保存，设置域名以在缓存中保存该域名下的 cookies
    - 测试环境的账号可能会经常变动，所以一般不进行保存
    - 生产环境账号通常比较稳定，，且登录流程比较繁琐，所以建议保存生产环境的 cookies 以避免反复登录。
- `authsites`: 如果设置的地址被检测到将触发登录流程：
    - 如果对应的域名在`auth.json`中以设置账号且`loginAdaptors`存在，则进行自动登录
    - 如果没有，进程将暂停并等待用户进行手动登录

**场景示例**

```shell
# 测试环境 - 使用公开账号，不保存 Cookie
dev-playkit --urls='["http://localhost:3000"]' \
  --authWithoutHost='{"user":"test_user"}'

# 正式环境 - 使用配置文件中的账号，自动保存 Cookie
dev-playkit --urls='["http://localhost:3000"]'
```

### 🔍 页面监控与验证

#### 批量验证页面

修改了基础配置或者全局组件，担心影响100+页面？一条命令批量验证多个页面，自动捕获 Console 错误和网络异常，以及截图验证渲染。

**workflow**：
1. 会依次打开所有页面 => 每个页面渲染等待30s => 截屏 => 关闭
2. 在渲染过程中会去捕获页面报错和网络报错
3. 结合 ai，可以让它诊断以及修复，以及通过截屏识别页面是否白屏

```shell
# 验证多个页面，每个页面等待 30 秒后截图
dev-playkit --debug=false \
  --urls='["http://localhost:3000/page1","http://localhost:3000/page2","http://localhost:3000/page3"]' \
  --timeout=30000
 
# 无头模式验证（CI/CD），--headless=true， 适用于持续集成环境
dev-playkit --debug=false --headless=true \
  --urls='["http://localhost:3000/page1","http://localhost:3000/page2"]' \
  --timeout=10000
```

#### **调试模式，监控单个地址**
- 开发辅助，自动打开 f12，浏览器会一直保持打开，监听页面以及网络

```shell
# 调试模式：无超时、不自动关闭、自动打开开发者工具
dev-playkit --debug=true \
  --urls='["http://localhost:3000"]' \
  --openDevtools=true
```

**监控特定 API 请求**

```shell
# 只显示匹配 /api/ 的网络请求
dev-playkit --urls='["http://localhost:3000"]' \
  --networkFilterPatterns='["/api/.*"]'

# 监控多个 API 路径
dev-playkit --urls='["http://localhost:3000"]' \
  --networkFilterPatterns='["/api/user.*", "/api/order.*"]'
```

**查看截图**

所有截图自动保存在`~/.cache/dev-playkit-cache/`目录下，文件名格式：`screenshot_timestamp.png`

```shell
# 查看缓存目录
ls ~/.cache/dev-playkit-cache/screenshot_*.png
```

### 🎭 请求控制`request/mock`

#### mock 请求
- 我们开发的时候可能经常都需要 mock 数据，前端 mock 一般可能是在代码里 mock 数据或者通过 service worker。而这个 mock 功能**是在浏览器层面拦截请求更改数据**。
- 通过这个 mock ，我们可以在**调试一些线上 bug, 比如请求或者数据相关的一些问题，或者进行前后端问题的区****分**。
- 模拟错误返回的，比如 500 状态

##### **使用示例**

通过在终端中执行 curl 命令调用接口`request/mock`进行请求捕获和模拟

```shell
# 1. 先启动工具（默认调试模式，浏览器保持打开）
dev-playkit --urls='["http://localhost:3000"]'

# 2. 在终端中执行 curl 命令调用接口 request/mock， 传递 url 和数据
curl -X POST http://localhost:3000/request/mock \
  -H "Content-Type: application/json" \
  -d '{"url": "/api/users", "response": {"code": 0, "data": [{"id": 1, "name": "Mock User"}]}}'

# 3. 在浏览器中触发请求，会返回 Mock 的数据

# 4. 取消 Mock
curl -X POST http://localhost:3000/request/mock/cancel \
  -H "Content-Type: application/json" \
  -d '{"url": "/api/users"}'
```

##### **实际应用场景**

```shell
# 场景 1: 调试错误状态
# 模拟服务器 500 错误，测试前端错误处理
curl -X POST http://localhost:3000/request/mock \
  -H "Content-Type: application/json" \
  -d '{"url": "/api/submit", "response": {"error": "Internal Server Error"}, "status": 500}'

# 场景 2: 测试空数据
# 模拟空列表返回，测试前端空状态展示
curl -X POST http://localhost:3000/request/mock \
  -H "Content-Type: application/json" \
  -d '{"url": "/api/list", "response": {"code": 0, "data": []}}'

# 场景 3: 复现线上问题
# 直接在线上页面 Mock 特定返回，验证问题
curl -X POST http://localhost:3000/request/mock \
  -H "Content-Type: application/json" \
  -d '{"url": "/api/problematic", "response": {"buggy": "data"}}'
```

#### 捕获请求`request/capture`

捕获指定请求的完整数据，可以在终端查看，省掉去 Network 面板查找请求的步骤，也方便提供数据喂给 AI。

**使用示例**

```shell
# 1. 启动工具
dev-playkit --urls='["http://localhost:3000"]'

# 2. 设置捕获（在另一个终端执行）
curl -X POST http://localhost:3000/request/capture \
  -H "Content-Type: application/json" \
  -d '{"url": "/api/users"}'

# 3. 在浏览器中触发请求，终端会自动打印完整的请求和响应

# 4. 取消捕获
curl -X POST http://localhost:3000/request/capture/cancel \
  -H "Content-Type: application/json" \
  -d '{"url": "/api/users"}'
```

### 📹 行为录制与回放

不知道各位有没有这样的痛点，修改表单逻辑，每次刷新都要重新填写？现在可以快速录制一次，结合 ai 自动回放，专注代码修改。

这个功能可以录制用户在页面的操作，点击/输入/滚动/停留...。保存之后可以进行回放，完全复刻用户的操作。

#### 完整使用流程

```shell
# 1. 启动工具（默认调试模式）
dev-playkit -urls='["http://localhost:3000"]'

# 2. 开始录制（在另一个终端执行）
curl -X POST http://localhost:3000/recorder/start \
  -H "Content-Type: application/json" \
  -d '{"name": "填写表单流程"}'

# 返回: {"success": true, "sessionId": "rec_1234567890_abc"}

# 3. 在浏览器中进行操作
#    - 填写表单
#    - 点击按钮
#    - 滚动页面
#    - 等等...

# 4. 停止录制
curl -X POST http://localhost:3000/recorder/stop

# 返回: {"success": true, "sessionId": "rec_1234567890_abc", "eventCount": 15}

# 5. 回放录制（使用返回的 sessionId）
curl -X POST http://localhost:3000/recorder/replay/rec_1234567890_abc
```

#### 管理录制

```shell
# 查看所有录制
curl http://localhost:3000/recorder/sessions

# 查看特定录制的详情
curl http://localhost:3000/recorder/session/rec_1234567890_abc

# 重命名录制
curl -X PUT http://localhost:3000/recorder/session/rec_1234567890_abc/name \
  -H "Content-Type: application/json" \
  -d '{"name": "新的名称"}'

# 删除录制
curl -X DELETE http://localhost:3000/recorder/session/rec_1234567890_abc
```

#### 高级回放选项

```shell
# 2 倍速回放（加快调试速度）
curl -X POST "http://localhost:3000/recorder/replay/rec_1234567890_abc?speed=2.0"

# 0.5 倍速回放（慢速观察）
curl -X POST "http://localhost:3000/recorder/replay/rec_1234567890_abc?speed=0.5"

# 跳过鼠标移动事件（只执行点击、输入等关键操作）
curl -X POST "http://localhost:3000/recorder/replay/rec_1234567890_abc?skipMouseMoves=true"

# 每步截图（用于调试）
curl -X POST "http://localhost:3000/recorder/replay/rec_1234567890_abc?screenshot=true"

# 组合使用
curl -X POST "http://localhost:3000/recorder/replay/rec_1234567890_abc?speed=2.0&skipMouseMoves=true&screenshot=true"
```

#### 实际应用场景

```shell
# 场景 1: 表单调试
# 录制一次填表流程，之后每次修改代码后自动回放
# 1. 录制填表
curl -X POST http://localhost:3000/recorder/start -H "Content-Type: application/json" -d '{"name": "表单填写"}'
# 2. 手动填写表单
# 3. 停止录制
curl -X POST http://localhost:3000/recorder/stop
# 4. 修改代码，刷新页面
# 5. 快速回放（2倍速）
curl -X POST "http://localhost:3000/recorder/replay/rec_xxx?speed=2.0"

# 场景 2: 回归测试
# 录制关键用户流程，定期回放验证
curl -X POST http://localhost:3000/recorder/start -H "Content-Type: application/json" -d '{"name": "核心流程测试"}'
# ... 操作 ...
curl -X POST http://localhost:3000/recorder/stop

# 场景 3: Bug 复现
# 录制出现 Bug 的操作步骤，方便重复调试
curl -X POST http://localhost:3000/recorder/start -H "Content-Type: application/json" -d '{"name": "Bug复现步骤"}'
# ... 触发 Bug 的操作 ...
curl -X POST http://localhost:3000/recorder/stop
```

**查看录制状态**

```shell
# 检查是否正在录制
curl http://localhost:3000/recorder/status

# 返回示例（录制中）:
# {"isRecording": true, "sessionId": "rec_xxx", "eventCount": 5}

# 返回示例（未录制）:
# {"isRecording": false}
```

### 🤖 AI 协作（MCP 协议）

支持 Model Context Protocol，可以在 Cursor 或 Claude Desktop 中通过自然语言使用所有功能。

#### 结合 ai 编辑器
1. **自动处理报错**- AI 可以读取页面的 Console 错误和网络异常，自动诊断问题
2. **调试请求**- 让 AI 帮你 Mock 或捕获请求，无需手动输入 curl 命令
3. **快速上手**- 不熟悉命令？直接问 AI，它会帮你调用对应的 API
4. **视觉检测**- AI + 截图 + 图像识别，可以检测白屏、渲染异常等问题
5. **自动化回放**- 结合录制功能，让 AI 检测页面刷新并自动回放

#### AI 提示词示例

##### **打开页面并登录**

**提示词示例：** 使用 dev-playkit 打开这个页面 http://localhost:3000，通用账号是 admin，密码是 123456

AI 会自动：
1. 调用工具打开页面
2. 传递账号密码参数
3. 等待页面加载完成
4. 报告页面状态和可能的错误

##### **Mock API 数据**

**提示词示例：** mock 这个 api /api/users，期望的返回是 {"code":0,"msg":"成功","data":{"list": [1,2,3]}}

AI 会自动：
1. 调用 Mock API
2. 正确转义 JSON
3. 确认 Mock 设置成功

##### **捕获请求数据**

**提示词示例：** 捕获一下这个接口 /api/login 的返回值，我要看看返回的数据结构

AI 会自动：
1. 设置请求捕获
2. 等待请求触发
3. 展示捕获到的数据
4. 分析数据结构

##### **录制和回放**

**提示词示例：** 开始录制用户操作

操作完成后：

**提示词示例：** 停止录制并保存为"登录流程"

之后可以：

**提示词示例：** 检测到页面刷新就自动回放上次录制

##### **调试页面问题**

**提示词示例：** 这个页面报错了，帮我看看是什么问题

AI 会自动：
1. 获取 Console 错误
2. 获取网络错误
3. 截取页面
4. 分析问题并提供解决方案

##### **批量验证页面**

```latex
验证这些页面是否正常：
- http://localhost:3000/page1
- http://localhost:3000/page2
- http://localhost:3000/page3
```

AI 会自动：
1. 批量打开页面
2. 检测错误
3. 生成截图
4. 汇总报告

##### **使用相关问题**

AI 可以直接回答配置相关的问题，帮助你快速使用。

**提示词示例：** 缓存文件在哪里？auth.json 的格式是什么？

#### 实际工作流

**场景：调试表单提交问题**
1. 告诉 AI：`打开 localhost:3000 的表单页面`
2. 告诉 AI：`开始录制操作`
3. 手动填写表单并提交
4. 告诉 AI：`停止录制`
5. 修改代码
6. 告诉 AI：`监听页面刷新事件，刷新后自动回放录制`
7. 代码修改、保存、自动刷新、自动回放，循环调试

**场景：复现线上问题**
1. 告诉 AI：`打开线上页面 https://example.com/page`
2. 告诉 AI：`mock 接口 /api/data 返回 {...异常数据...}`
3. 在页面上操作触发问题
4. 告诉 AI：`帮我看看页面报了什么错`
5. AI 分析错误并提供修复建议

**场景：新功能测试**
1. 告诉 AI：`打开 localhost:3000`
2. 告诉 AI：`mock 所有 /api/user 开头的接口，返回测试数据`
3. 测试新功能
4. 告诉 AI：`捕获 /api/submit 的请求和返回`
5. AI 展示并分析数据结构

## 配置

### 认证配置

首次运行时，工具会在`~/.cache/dev-playkit-cache/`创建配置文件：

**auth.json**- 认证信息

```json
{
  "sso.example.com": {
    "user": "username",
    "pwd": "password"
  }
}
```

**settings.json**- 默认设置

```json
{
  "authSites": {
    "description": "需要认证的站点域名",
    "value": ["sso.example.com"]
  },
  "cookiesShouldBeSaved": {
    "description": "需要保存 Cookie 的域名",
    "value": [".example.com"]
  },
  "networkFilterPatterns": {
    "description": "需要监控的网络请求（正则表达式）",
    "value": ["/api/.*"]
  },
  "authFilePath": {
    "description": "认证文件路径",
    "value": "/Users//.cache/dev-playkit-cache/auth.json"
  }
}
```

### 命令行参数

```shell
# 浏览器选项
--headless=false          # 是否使用无头模式
--viewport="1920x1080"    # 浏览器窗口大小
--openDevtools=false      # 是否打开 DevTools
--timeout=5000            # 页面加载
--debug=true             # 默认为true, 调试模式（无超时，不自动关闭）

# 认证选项
--authWithoutHost='{"user":"u","pwd":"p"}' # 通用认证配置

# 网络选项
--networkFilterPatterns='["/api/.*"]'  # 网络请求过滤

# 服务端选项
--port=3000               # 服务端口
--newWindow=true          # 是否在新终端窗口运行
```

## 详细文档
- [](./src/public/readme/monitor.md)- 浏览器自动化、错误捕获、认证流程
- [](./src/public/readme/recorder.md)- 录制、回放、API 详解
- [](./src/public/readme/server.md)- HTTP 接口、请求控制、截图

## 缓存目录

所有配置、Cookie、截图、录制文件都保存在：

```latex
~/.cache/dev-playkit-cache/
├── auth.json              # 认证配置
├── settings.json          # 默认设置
├── cookies.json           # 保存的 Cookie
├── errors.log             # 错误日志
├── screenshot_*.png       # 截图文件
└── recordings/            # 录制文件
    └── rec_*.json
```

## 常见问题

**Q: 自动登录不工作？**
1. 检查`settings.json`中的`authSites`是否包含认证站点域名
2. 检查`auth.json`中是否配置了正确的账号密码

**Q: Cookie 没有保存？**

在`settings.json`中添加需要保存 Cookie 的域名：

```json
{
  "cookiesShouldBeSaved": {
    "value": [".example.com", "example.com"]
  }
}
```

**Q: AI 工具无法调用？**
1. 确保 MCP 配置路径正确
2. 尝试使用全局安装 + 绝对路径的方式
3. 重启 AI 工具（Cursor/Claude Desktop）