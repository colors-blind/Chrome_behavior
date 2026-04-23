# Chrome Behavior Logger with FastAPI Backend (HTTPS 支持)

一个 Chrome 插件 + FastAPI 后端服务，用于记录用户在百度页面的 HTTP 请求、XHR/Fetch 请求以及用户行为数据，并将数据发送到本地后端服务存储为 JSON 文件。

**重要提示**：现代网站几乎都使用 HTTPS，浏览器会阻止 HTTPS 页面向 HTTP 地址发送请求（混合内容限制）。因此本项目默认使用 HTTPS 模式。

## 项目结构

```
Chrome_behavior/
├── manifest.json          # Chrome 插件配置文件
├── background.js          # 后台 Service Worker，监听 webRequest
├── content.js             # 内容脚本，Hook XHR/Fetch 和监听用户行为
├── backend/
│   ├── main.py            # FastAPI 后端服务（支持 HTTPS）
│   ├── generate_cert.py   # SSL 自签名证书生成脚本
│   ├── requirements.txt   # Python 依赖
│   └── certs/             # SSL 证书目录（运行时创建）
│       ├── server.key     # 私钥文件
│       └── server.crt     # 证书文件
├── logs/                   # 数据存储目录（运行时自动创建）
└── README.md
```

## 快速开始

### 第一步：安装后端依赖

```bash
cd /home/catliu/桌面/Chrome_behavior/backend
pip install -r requirements.txt
```

### 第二步：生成 SSL 自签名证书

```bash
cd /home/catliu/桌面/Chrome_behavior/backend
python generate_cert.py
```

成功后会显示：
```
============================================================
正在生成自签名 SSL 证书...
============================================================
私钥已保存: /home/catliu/桌面/Chrome_behavior/backend/certs/server.key
证书已保存: /home/catliu/桌面/Chrome_behavior/backend/certs/server.crt
============================================================
证书生成完成！
============================================================
证书有效期: 365 天
私钥文件: /home/catliu/桌面/Chrome_behavior/backend/certs/server.key
证书文件: /home/catliu/桌面/Chrome_behavior/backend/certs/server.crt
```

### 第三步：在 Chrome 中信任自签名证书（关键步骤！）

由于这是自签名证书，Chrome 会认为它不安全。需要手动信任：

#### 方法一：通过浏览器访问添加信任（推荐先尝试）

1. 确保后端服务**还未启动**，先执行这一步
2. 打开 Chrome，访问：`https://localhost:8443`
3. 你会看到"你的连接不是专用连接"的警告页面
4. 点击 **"高级"** 按钮
5. 点击 **"继续前往 localhost（不安全）"**
6. 现在证书已被临时信任，关闭这个标签页

#### 方法二：将证书导入系统（永久信任）

如果方法一不行，或者需要永久信任：

**Linux 系统：**

```bash
# 进入证书目录
cd /home/catliu/桌面/Chrome_behavior/backend/certs

# 复制证书到系统信任目录
sudo cp server.crt /usr/local/share/ca-certificates/chrome-logger.crt

# 更新系统证书信任
sudo update-ca-certificates
```

然后重启 Chrome 浏览器。

**Windows 系统：**

1. 双击 `server.crt` 文件
2. 点击 **"安装证书"**
3. 选择 **"本地计算机"**，点击下一步
4. 选择 **"将所有的证书放入下列存储"**
5. 点击 **"浏览"**，选择 **"受信任的根证书颁发机构"**
6. 点击确定 → 下一步 → 完成
7. 重启 Chrome

**Mac 系统：**

1. 双击 `server.crt` 文件
2. 在弹出的对话框中，选择 **"系统"** 钥匙串，点击添加
3. 打开"钥匙串访问"应用
4. 在左侧选择"系统"，找到 "localhost" 证书
5. 双击该证书，展开"信任"部分
6. 将"使用此证书时"改为 **"始终信任"**
7. 关闭并输入密码确认

### 第四步：启动后端服务

```bash
cd /home/catliu/桌面/Chrome_behavior/backend
python main.py
```

成功启动后显示：
```
======================================================================
Chrome Request Logger Backend Server
======================================================================
Storage Directory: /home/catliu/桌面/Chrome_behavior/logs
[成功] 找到 SSL 证书，启用 HTTPS 模式
  私钥: /home/catliu/桌面/Chrome_behavior/backend/certs/server.key
  证书: /home/catliu/桌面/Chrome_behavior/backend/certs/server.crt

重要提示：
1. 首次访问需要手动信任自签名证书
   方法一：浏览器访问 https://localhost:8443 并点击高级 -> 继续前往
   方法二：使用 mkcert 生成系统信任的证书

Server starting at: https://localhost:8443
API Docs: https://localhost:8443/docs
======================================================================
```

### 第五步：安装/更新 Chrome 插件

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角"开发者模式"
3. 找到之前安装的插件，点击 **刷新按钮**（圆形箭头图标）
4. 或者重新加载：点击"加载已解压的扩展程序"，选择 `/home/catliu/桌面/Chrome_behavior` 目录

### 第六步：测试百度请求

1. 确保后端服务正在运行
2. 在 Chrome 中打开百度首页：`https://www.baidu.com`
3. 按 `F12` 打开开发者工具，切换到 `Console` 标签
4. 确认看到以下日志（没有红色错误）：
   ```
   [BehaviorLogger] logger_ready {message: '行为记录器已启动，XHR和Fetch钩子已激活', timestamp: '...', pageUrl: 'https://www.baidu.com/'}
   [BehaviorLogger] Backend URL: https://localhost:8443
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
   
   [Batch] Received 5 events
     [1] cursor_move: https://www.baidu.com/
     [Stored] ...
     [2] xhr_response: https://www.baidu.com/sugrec
     [Stored] ...
   ```

## 常见问题排查

### 问题 1：浏览器显示 "net::ERR_CERT_AUTHORITY_INVALID" 或 "net::ERR_CERT_COMMON_NAME_INVALID"

**原因**：自签名证书未被信任。

**解决方法**：
1. 先停止后端服务
2. 单独打开 Chrome 标签页，访问 `https://localhost:8443`
3. 点击"高级" → "继续前往 localhost"
4. 然后刷新百度页面

或者使用 mkcert 生成真正受信任的证书（见下文推荐方案）。

### 问题 2：Console 显示 "Backend connection error: Failed to fetch"

**原因**：连接后端失败，可能是：
- 后端服务未启动
- 证书未被信任
- 网络问题

**排查步骤**：
1. 确认后端服务正在运行（终端有日志输出）
2. 在浏览器新标签页访问 `https://localhost:8443/health`
   - 如果显示安全警告：证书未被信任，按上面的方法处理
   - 如果显示 `{"status":"healthy"}`：证书信任成功
3. 如果仍有问题，检查 Chrome 扩展是否已刷新

### 问题 3：修改代码后不生效

**注意**：
- 修改 `manifest.json`、`background.js`：需要在 `chrome://extensions/` 中刷新插件
- 修改 `content.js`：需要刷新目标页面（百度页面）
- 修改 `main.py`：如果启用了 `--reload` 会自动重载，否则需要手动重启

## 推荐方案：使用 mkcert 生成系统信任的证书

自签名证书每次都需要手动信任很麻烦，推荐使用 `mkcert` 工具，它可以生成操作系统和浏览器都信任的本地证书。

### 安装 mkcert

**Linux（Ubuntu/Debian）：**
```bash
sudo apt install libnss3-tools
curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
chmod +x mkcert-v*-linux-amd64
sudo cp mkcert-v*-linux-amd64 /usr/local/bin/mkcert
```

**macOS：**
```bash
brew install mkcert
brew install nss  # 如果使用 Firefox
```

**Windows：**
```bash
# 使用 Chocolatey
choco install mkcert

# 或者使用 Scoop
scoop bucket add extras
scoop install mkcert
```

### 使用 mkcert 生成证书

```bash
# 1. 安装本地 CA（首次运行）
mkcert -install

# 2. 生成证书
cd /home/catliu/桌面/Chrome_behavior/backend/certs
mkcert -key-file server.key -cert-file server.crt localhost 127.0.0.1 ::1
```

这样生成的证书会被系统自动信任，无需手动操作！

## 命令行参数

后端服务 `main.py` 支持以下参数：

```bash
# 默认 HTTPS 模式（端口 8443）
python main.py

# 指定端口
python main.py --port 8444

# 禁用自动重载
python main.py --no-reload

# 绑定特定地址
python main.py --host 127.0.0.1

# 强制使用 HTTP 模式（仅用于测试，HTTPS 页面无法访问）
python main.py --http
```

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 服务状态 |
| `/health` | GET | 健康检查 |
| `/api/requests` | POST | 接收 HTTP 请求事件 |
| `/api/xhr` | POST | 接收 XHR/Fetch 事件 |
| `/api/behavior` | POST | 接收用户行为事件 |
| `/api/batch` | POST | 批量接收事件 |
| `/docs` | GET | Swagger API 文档 |
| `/redoc` | GET | ReDoc API 文档 |

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

## 完整测试流程

```bash
# 1. 安装依赖
cd /home/catliu/桌面/Chrome_behavior/backend
pip install -r requirements.txt

# 2. 生成证书
python generate_cert.py

# 3. 在 Chrome 中信任证书
#    访问 https://localhost:8443 -> 高级 -> 继续前往

# 4. 启动后端
python main.py

# 5. 刷新 Chrome 插件（chrome://extensions/）

# 6. 打开百度并测试
#    访问 https://www.baidu.com
#    输入搜索词，观察后端终端日志

# 7. 查看存储的数据
ls -la /home/catliu/桌面/Chrome_behavior/logs/www.baidu.com/
```
