# Chrome Behavior Logger with FastAPI Backend

一个 Chrome 插件 + FastAPI 后端服务，用于记录用户在百度页面的 HTTP 请求、XHR/Fetch 请求以及用户行为数据，并将数据发送到本地后端服务存储为 JSON 文件。

## 项目结构

```
Chrome_behavior/
├── manifest.json          # Chrome 插件配置文件
├── background.js          # 后台 Service Worker，监听 webRequest
├── content.js             # 内容脚本，Hook XHR/Fetch 和监听用户行为
├── backend/
│   ├── main.py            # FastAPI 后端服务
│   └── requirements.txt   # Python 依赖
├── logs/                  # 数据存储目录（运行时自动创建）
└── README.md
```

## 功能说明

### 插件功能

1. **webRequest 监听** (background.js)
   - 监听百度域名下的所有 HTTP 请求
   - 记录请求头、响应头、请求体、状态码等
   - 自动过滤静态资源（css、js、图片等）

2. **XHR/Fetch Hook** (content.js)
   - 拦截页面内的 XMLHttpRequest 和 fetch API 调用
   - 捕获完整的请求体、响应体、请求头、响应头
   - 记录请求耗时

3. **用户行为监听** (content.js)
   - 文本输入事件 (text_input)
   - 鼠标移动事件 (cursor_move)
   - 鼠标停留时长 (cursor_dwell)
   - 点击事件 (click)
   - 窗口焦点变化 (window_blur/focus)

### 后端功能

1. **API 接口**
   - `POST /api/requests` - 接收 HTTP 请求事件
   - `POST /api/xhr` - 接收 XHR/Fetch 事件
   - `POST /api/behavior` - 接收用户行为事件
   - `POST /api/batch` - 批量接收事件（插件使用此接口）
   - `GET /` - 服务状态检查
   - `GET /health` - 健康检查
   - `GET /docs` - Swagger API 文档

2. **数据存储**
   - 自动按域名分类存储
   - 每个事件存储为独立的 JSON 文件
   - 文件名格式：`{来源}_{时间戳}_{事件类型}.json`
   - 存储位置：`logs/{域名}/` 目录

## 安装步骤

### 1. 后端服务安装

**前置要求：**
- Python 3.8+
- pip

```bash
# 进入后端目录
cd /home/catliu/桌面/Chrome_behavior/backend

# 安装依赖
pip install -r requirements.txt
```

### 2. Chrome 插件安装

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择 `/home/catliu/桌面/Chrome_behavior` 目录
6. 确认插件已加载并启用

## 运行步骤

### 1. 启动后端服务

```bash
cd /home/catliu/桌面/Chrome_behavior/backend
python main.py
```

启动成功后会显示：
```
============================================================
Chrome Request Logger Backend Server
============================================================
Storage Directory: /home/catliu/桌面/Chrome_behavior/logs
Server starting at: http://localhost:8000
API Docs: http://localhost:8000/docs
============================================================
```

### 2. 测试百度请求

1. 确保后端服务正在运行
2. 在 Chrome 中打开百度首页：`https://www.baidu.com`
3. 按 `F12` 打开开发者工具，切换到 `Console` 标签
4. 你应该看到插件的日志输出：
   ```
   [BehaviorLogger] Background service worker started
   [BehaviorLogger] Backend URL: http://localhost:8000
   ```

5. 在百度搜索框中输入任意关键词，观察：
   - Console 中会输出各种事件日志
   - 后端终端会显示接收到的请求

6. 查看后端终端，应该能看到类似输出：
   ```
   [HTTP Request] http_request - GET https://www.baidu.com/
     Request ID: ...
     [Stored] /home/catliu/桌面/Chrome_behavior/logs/www.baidu.com/http_..._http_request.json
   
   [Behavior] text_input at https://www.baidu.com/
     Value: 测试搜索
     [Stored] /home/catliu/桌面/Chrome_behavior/logs/www.baidu.com/behavior_..._text_input.json
   ```

### 3. 查看存储的数据

所有数据存储在 `logs/` 目录下，按域名分类：

```
logs/
└── www.baidu.com/
    ├── http_20260423_103000_123456_http_request.json
    ├── http_20260423_103000_234567_http_request_headers.json
    ├── xhr_20260423_103001_345678_fetch_response.json
    └── behavior_20260423_103002_456789_text_input.json
```

## API 文档

启动后端服务后，可以访问以下地址查看 API 文档：

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 事件类型说明

### HTTP 请求事件 (background.js)

| 事件类型 | 说明 |
|---------|------|
| `http_request` | 请求开始时触发 |
| `http_request_headers` | 发送请求头时触发 |
| `http_response_headers` | 收到响应头时触发 |
| `http_request_completed` | 请求完成时触发 |
| `http_request_error` | 请求出错时触发 |

### XHR/Fetch 事件 (content.js)

| 事件类型 | 说明 |
|---------|------|
| `xhr_request` | XHR 请求发送前 |
| `xhr_response` | XHR 响应收到后 |
| `xhr_error` | XHR 请求出错 |
| `fetch_request` | Fetch 请求发送前 |
| `fetch_response` | Fetch 响应收到后 |
| `fetch_error` | Fetch 请求出错 |

### 用户行为事件 (content.js)

| 事件类型 | 说明 |
|---------|------|
| `text_input` | 输入框内容变化 |
| `cursor_move` | 鼠标移动（节流） |
| `cursor_dwell` | 鼠标在某位置停留 |
| `click` | 鼠标点击 |
| `window_blur` | 窗口失去焦点 |
| `window_focus` | 窗口获得焦点 |
| `logger_ready` | 脚本初始化完成 |

## 配置说明

### 修改后端地址

如果需要修改后端服务地址，编辑以下文件中的 `BACKEND_URL`：

- `background.js` 第 2 行
- `content.js` 第 3 行

### 修改监听域名

默认只监听百度域名，如需添加其他域名：

1. 修改 `manifest.json` 中的 `host_permissions`
2. 修改 `background.js` 中的 `chrome.webRequest` 监听的 urls
3. 修改 `content.js` 中的 `isBaiduUrl()` 函数

### 修改静态资源过滤

编辑 `STATIC_EXTENSIONS` 数组来添加或移除需要过滤的静态资源扩展名。

## 注意事项

1. **CORS 问题**：后端已启用 CORS，允许所有来源访问
2. **插件刷新**：修改插件代码后，需要在 `chrome://extensions/` 中重新加载插件
3. **页面刷新**：修改 content.js 后，需要刷新目标页面才能生效
4. **后端依赖**：确保 Python 环境已安装所有依赖

## 故障排查

### 后端无法启动

- 检查 Python 版本（需要 3.8+）
- 检查端口 8000 是否被占用
- 检查依赖是否正确安装

### 插件无法连接后端

- 确认后端服务正在运行
- 检查 `BACKEND_URL` 配置是否正确
- 查看浏览器 Console 是否有错误信息
- 确认插件已正确加载

### 数据未存储

- 检查 `logs/` 目录权限
- 查看后端终端是否有错误信息
- 确认后端收到了请求

## 示例测试流程

1. **启动后端**
   ```bash
   cd backend && python main.py
   ```

2. **打开百度**
   - 访问 `https://www.baidu.com`

3. **观察日志**
   - 浏览器 Console：查看插件输出
   - 后端终端：查看接收的请求

4. **触发事件**
   - 在搜索框输入文字（触发 text_input）
   - 移动鼠标（触发 cursor_move/cursor_dwell）
   - 点击搜索按钮（触发 click + HTTP 请求）

5. **查看数据**
   - 检查 `logs/www.baidu.com/` 目录下的 JSON 文件
