# 🔓 本地验证码识别服务

<div align="center">

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0+-green.svg)](https://flask.palletsprojects.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux-lightgrey.svg)]()

**基于 ddddocr 的本地验证码自动识别系统**

无需联网 · 保护隐私 · 高效稳定 · 完整后台

[功能特性](#-功能特性) · [快速开始](#-快速开始) · [部署方式](#-部署方式) · [使用文档](#-使用说明) · [API文档](#-api-接口)

</div>

---

## 📋 目录

- [项目简介](#-项目简介)
- [功能特性](#-功能特性)
- [技术架构](#-技术架构)
- [快速开始](#-快速开始)
- [部署方式](#-部署方式)
- [使用说明](#-使用说明)
- [API 接口](#-api-接口)
- [前端脚本](#-前端脚本tampermonkey)
- [安全说明](#-安全说明)
- [常见问题](#-常见问题)
- [开发指南](#-开发指南)

---

## 📖 项目简介

本项目是一个**完全本地化**的验证码识别解决方案，由**后端服务**和**前端脚本**两部分组成：

- **后端服务**：基于 Flask + ddddocr 的识别服务，提供 REST API 和完整的 Web 管理后台
- **前端脚本**：Tampermonkey 用户脚本，在浏览器中自动识别并填入验证码

### 🎯 适用场景

- ✅ 批量处理需要验证码的任务
- ✅ 自动化测试和爬虫开发
- ✅ 提升重复性操作的效率
- ✅ 保护隐私，不将验证码上传到第三方服务

### ⚠️ 免责声明

本项目仅用于学习和研究目的，请勿用于非法用途。使用本工具产生的任何后果由使用者自行承担。

---

## ✨ 功能特性

### 🔍 验证码识别

| 类型 | 说明 | 识别方式 |
|------|------|----------|
| **英数验证码** (类型1) | 常见的字母+数字验证码 | ddddocr OCR 识别 |
| **滑动拼图** (类型4) | 需要拖动滑块拼接图片 | OpenCV 图像匹配算法 |
| **滑块行为** (类型5) | 仅需拖动滑块到指定位置 | 基于算法的行为模拟 |

### 🛡️ 安全防护

- **JWT Token 认证**：管理后台使用 JWT 进行身份验证
- **API Key 管理**：支持多密钥管理，每个密钥独立统计
- **请求限流**：防止 API 滥用
  - 登录接口：5次/分钟
  - 识别接口：100次/分钟
  - 规则接口：50-200次/分钟
- **IP 访问控制**：支持白名单/黑名单
- **登录保护**：失败次数限制和自动锁定
- **CSRF 防护**：防止跨站请求伪造
- **密码加密**：SHA256 + bcrypt 双重加密

### 📊 完整管理后台

1. **仪表盘**
   - 系统运行状态监控
   - 识别统计图表
   - 实时性能数据

2. **API Key 管理**
   - 创建/删除 API Key
   - 查看使用统计
   - 按网站和类型分类统计

3. **识别历史**
   - 记录所有识别请求
   - 支持多维度筛选
   - 导出历史数据

4. **规则管理**
   - 为不同网站配置规则
   - 导入/导出规则
   - 自动/手动添加规则

5. **安全管理**
   - IP 白名单/黑名单配置
   - 请求限流设置
   - 登录日志查看

6. **系统设置**
   - 修改管理员密码
   - 一言 API 配置
   - 背景图 API 配置

### 🎨 其他特性

- ✅ 支持多用户管理（SQLite 数据库）
- ✅ 完整的日志系统
- ✅ 数据自动备份恢复
- ✅ 跨平台支持（Windows/Linux）
- ✅ systemd 服务管理（Linux）
- ✅ 一键部署脚本
- ✅ 密码重置工具

---

## 🏗️ 技术架构

### 后端技术栈

```
核心框架：Flask 3.0+
OCR引擎：ddddocr 1.5.6+
图像处理：Pillow, OpenCV, NumPy
认证加密：bcrypt, PyJWT
数据库：SQLite3
跨域支持：Flask-CORS
```

### 前端技术栈

```
脚本引擎：Tampermonkey
核心库：jQuery 2.2.4
请求库：GM_xmlhttpRequest
```

### 项目结构

```
验证码识别/
├── 后端服务/                    # Flask 后端服务
│   ├── local_captcha_server.py  # 主服务文件（2095行）
│   ├── auth.py                  # JWT认证和用户管理
│   ├── security.py              # 安全模块（限流/黑白名单）
│   ├── history.py               # 识别历史管理
│   ├── config.py                # 配置文件
│   ├── logger_config.py         # 日志配置
│   ├── reset_password.py        # 密码重置工具
│   ├── start_production.py      # 生产环境启动脚本
│   ├── deploy.sh                # Linux 自动部署脚本
│   ├── start_windows.bat        # Windows 启动脚本
│   ├── requirements.txt         # Python 依赖
│   ├── templates/               # HTML 模板
│   │   └── index.html          # 管理后台页面
│   └── static/                  # 静态资源
│       ├── css/
│       └── js/
│
├── 前端脚本/                    # Tampermonkey 用户脚本
│   └── 万能验证码识别_本地版.user.js  # 前端脚本（2509行）
│
└── 使用文档/                    # 使用文档和示例
```

---

## 🚀 快速开始

### 系统要求

- **Python**: 3.8 或更高版本
- **内存**: 至少 512MB RAM
- **磁盘**: 至少 1GB 可用空间
- **浏览器**: Chrome/Firefox + Tampermonkey 扩展

### Windows 快速启动

```batch
# 1. 安装依赖
cd 后端服务
pip install -r requirements.txt

# 2. 启动服务
start_windows.bat

# 3. 访问管理后台
# 浏览器打开: http://localhost:1205
# 默认账户: admin / admin
```

### Linux 快速启动

```bash
# 1. 进入后端目录
cd 后端服务

# 2. 安装依赖
pip3 install -r requirements.txt

# 3. 启动服务
python3 local_captcha_server.py

# 4. 访问管理后台
# 浏览器打开: http://localhost:1205
# 默认账户: admin / admin
```

---

## 📦 部署方式

### 方式一：开发环境（Windows）

适合本地测试和开发。

```batch
# 1. 克隆项目
git clone <repository-url>
cd 验证码识别/后端服务

# 2. 创建虚拟环境（可选）
python -m venv venv
venv\Scripts\activate

# 3. 安装依赖
pip install -r requirements.txt

# 4. 启动服务
python local_captcha_server.py

# 或使用启动脚本
start_windows.bat
```

### 方式二：生产环境（Linux）

适合服务器长期运行。

#### 自动部署（推荐）

```bash
# 1. 上传项目到服务器
cd 后端服务

# 2. 赋予执行权限
chmod +x deploy.sh

# 3. 运行部署脚本（需要 sudo 权限）
sudo ./deploy.sh

# 部署完成后会自动：
# - 安装所有依赖
# - 配置 systemd 服务
# - 配置防火墙规则
# - 自动启动服务
```

#### 手动部署

```bash
# 1. 安装 Python 和依赖
sudo apt update
sudo apt install -y python3 python3-pip python3-venv

# 2. 创建安装目录
sudo mkdir -p /opt/captcha-server
sudo cp -r . /opt/captcha-server/

# 3. 创建虚拟环境
cd /opt/captcha-server
python3 -m venv venv
source venv/bin/activate

# 4. 安装依赖
pip install -r requirements.txt

# 5. 配置 systemd 服务
sudo cp captcha-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable captcha-server
sudo systemctl start captcha-server

# 6. 查看状态
sudo systemctl status captcha-server
```

### 方式三：Docker 部署（待支持）

```bash
# 敬请期待...
```

---

## 📖 使用说明

### 1. 首次登录

1. 访问 `http://localhost:1205`
2. 点击右上角「管理员登录」
3. 使用默认账户：`admin / admin`
4. **首次登录会强制要求修改密码**

### 2. 创建 API Key

1. 登录管理后台
2. 点击左侧菜单「API Keys」
3. 点击「创建 API Key」按钮
4. 输入密钥名称（如：测试密钥）
5. 复制生成的 API Key（格式：`sk_xxx...`）

### 3. 安装前端脚本

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 打开脚本文件：`前端脚本/万能验证码识别_本地版.user.js`
3. 复制脚本内容，创建新脚本并粘贴
4. 保存并启用脚本

### 4. 配置前端脚本

1. 在任意网页打开 Tampermonkey 菜单
2. 点击「规则管理」
3. 点击「设置 API Key」
4. 粘贴之前创建的 API Key
5. 点击确定

### 5. 添加识别规则

有两种方式添加规则：

#### 自动识别（推荐）

脚本会自动检测页面中的验证码并尝试识别。

#### 手动添加规则

1. **英数验证码**：
   - 打开 Tampermonkey 菜单 → 规则管理
   - 点击「添加英数验证码规则」
   - 右键点击验证码图片
   - 点击验证码输入框
   - 完成规则添加

2. **滑动拼图**：
   - 打开 Tampermonkey 菜单 → 规则管理
   - 点击「添加滑动拼图验证码规则」
   - 依次点击：大图 → 小图 → 滑块
   - 完成规则添加

3. **滑块行为**：
   - 打开 Tampermonkey 菜单 → 规则管理
   - 点击「添加滑块行为验证码规则」
   - 点击滑块元素
   - 完成规则添加

### 6. 查看识别历史

1. 登录管理后台
2. 点击左侧菜单「识别历史」
3. 查看所有识别记录
4. 支持按时间、网站、API Key、类型筛选

### 7. 导出/导入规则

**导出规则：**
1. 登录管理后台
2. 点击左侧菜单「规则管理」
3. 点击「导出规则」按钮
4. 保存 JSON 文件

**导入规则：**
1. 登录管理后台
2. 点击左侧菜单「规则管理」
3. 点击「导入规则」按钮
4. 选择导入模式（合并/覆盖）
5. 上传 JSON 文件

### 8. 密码管理

**修改密码：**
1. 登录管理后台
2. 点击右上角用户名
3. 选择「修改密码」
4. 输入旧密码和新密码

**重置密码（忘记密码）：**

Windows:
```batch
cd 后端服务
python reset_password.py
```

Linux:
```bash
cd /opt/captcha-server
sudo -u captcha ./venv/bin/python3 reset_password.py
```

---

## 🔌 API 接口

### 认证方式

所有 API 请求需要在请求头中添加 API Key：

```http
X-API-Key: sk_your_api_key_here
```

管理后台接口需要 JWT Token：

```http
Authorization: Bearer <your_jwt_token>
```

### 验证码识别接口

#### POST `/hello`

识别验证码（支持英数/滑块/行为识别）

**请求头：**
```http
Content-Type: application/json
X-API-Key: sk_your_api_key
```

**请求体（英数验证码）：**
```json
{
  "ocr_type": 1,
  "img": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "host": "example.com"
}
```

**请求体（滑动拼图）：**
```json
{
  "ocr_type": 4,
  "big_image": "data:image/png;base64,...",
  "small_image": "data:image/png;base64,...",
  "host": "example.com"
}
```

**请求体（滑块行为）：**
```json
{
  "ocr_type": 5,
  "small_image_width": 280,
  "host": "example.com"
}
```

**响应（成功）：**
```json
{
  "valid": true,
  "data": "AB12",
  "description": "验证码识别完成",
  "showTime": 2000
}
```

**响应（失败）：**
```json
{
  "valid": false,
  "description": "API Key 无效或已过期"
}
```

### 规则管理接口

#### POST `/captchaHostQuery`

查询网站规则

**请求体：**
```json
{
  "host": "example.com"
}
```

**响应（找到规则）：**
```json
{
  "code": 531,
  "data": [...]
}
```

**响应（未找到）：**
```json
{
  "code": 533
}
```

#### POST `/captchaHostAdd`

添加网站规则

**请求体：**
```json
{
  "host": "example.com",
  "img": "img.captcha",
  "input": "input#code",
  "ocr_type": 1,
  "title": "示例网站",
  "path": "https://example.com/login"
}
```

#### POST `/captchaHostDel`

删除网站规则

**请求体：**
```json
{
  "host": "example.com"
}
```

### 管理后台接口

#### POST `/admin/login`

管理员登录

**请求体：**
```json
{
  "username": "admin",
  "password": "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918"
}
```

注：密码需先进行 SHA256 加密

**响应：**
```json
{
  "code": 200,
  "description": "登录成功",
  "data": {
    "user_id": 1,
    "username": "admin",
    "is_admin": true,
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "csrf_token": "...",
    "is_default_password": false
  }
}
```

#### GET `/history/stats`

获取识别历史统计

**响应：**
```json
{
  "code": 200,
  "data": {
    "total_count": 1234,
    "success_count": 1180,
    "failed_count": 54,
    "success_rate": 95.62,
    "avg_duration": 0.15,
    "type_stats": {...},
    "host_stats": {...}
  }
}
```

#### GET `/api-keys`

获取所有 API Keys

**响应：**
```json
{
  "code": 200,
  "count": 3,
  "keys": [
    {
      "key": "sk_abc...xyz",
      "full_key": "sk_abcdefghijklmnopqrstuvwxyz123456",
      "name": "测试密钥",
      "created_at": "2024-01-01T12:00:00",
      "last_used": "2024-01-15T10:30:00",
      "stats": {
        "total": 1500,
        "types": {...},
        "hosts": {...}
      }
    }
  ]
}
```

---

## 🎭 前端脚本（Tampermonkey）

### 功能特性

- ✅ 自动检测页面中的验证码
- ✅ 自动识别并填入结果
- ✅ 支持跨域图片处理
- ✅ 支持 iframe 内的验证码
- ✅ 智能规则匹配
- ✅ 手动添加规则（英数/滑块/行为）
- ✅ 规则导入/导出
- ✅ 识别历史记录
- ✅ 提示音和视觉反馈

### 脚本菜单

右键点击 Tampermonkey 图标，可以看到以下菜单：

- **规则管理**：打开规则管理界面
- **设置 API Key**：配置后端 API Key
- **添加英数验证码规则**：手动添加英数验证码规则
- **添加滑动拼图规则**：手动添加滑动拼图规则
- **添加滑块行为规则**：手动添加滑块行为规则
- **停止识别该网站**：将当前网站加入黑名单
- **删除该网站全部规则**：删除当前网站的所有规则
- **恢复出厂设置**：清除所有设置和缓存

### 配置选项

脚本内部配置（可在规则管理界面修改）：

- `autoIdentification`: 自动识别（默认：开启）
- `showHintCheck`: 显示提示信息（默认：开启）
- `warningTone`: 提示音（默认：开启）
- `autoBlackList`: 自动黑名单（默认：关闭）
- `hotKeyToImgResult`: 快捷键识别（默认：关闭）

### 工作原理

1. **页面加载检测**：脚本在页面加载时自动检测可能的验证码元素
2. **规则匹配**：优先使用用户手动添加的规则，其次使用自动规则
3. **图片提取**：将验证码图片转换为 Base64 格式
4. **API 调用**：通过 `GM_xmlhttpRequest` 调用后端识别接口
5. **结果填入**：将识别结果自动填入对应的输入框
6. **事件触发**：触发 change/input 等事件，确保网站识别到输入

### 兼容性处理

- **跨域图片**：使用 `GM_xmlhttpRequest` 获取跨域图片
- **Canvas 验证码**：Hook `drawImage` 方法获取图片源
- **React 输入框**：兼容 React 的事件系统
- **图片旋转**：自动检测并修正旋转的验证码图片
- **iframe 验证码**：通过 `postMessage` 跨 iframe 通信

---

## 🔒 安全说明

### 安全特性

1. **密码安全**
   - 前端 SHA256 预加密，避免明文传输
   - 后端 bcrypt 二次加密，防止数据库泄露
   - 强制修改默认密码

2. **API Key 安全**
   - 仅通过 HTTP Header 传递
   - 禁止 URL 参数传递
   - 支持密钥启用/禁用

3. **会话安全**
   - JWT Token 有效期 24 小时
   - 登录时重新生成 Session ID
   - HttpOnly Cookie 防止 XSS

4. **接口安全**
   - 请求限流防止滥用
   - IP 白名单/黑名单
   - CSRF Token 保护

5. **数据安全**
   - 自动备份数据文件
   - SQLite 本地存储
   - 敏感信息脱敏显示

### 安全建议

1. ✅ 首次登录后立即修改管理员密码
2. ✅ 定期更换 API Key
3. ✅ 配置 IP 白名单限制访问来源
4. ✅ 启用 HTTPS（生产环境）
5. ✅ 定期备份数据库和配置文件
6. ✅ 定期查看识别历史和日志
7. ✅ 限制非必要人员访问管理后台

### 默认安全配置

```python
# 请求限流
登录接口：5次/分钟
识别接口：100次/分钟
规则接口：50-200次/分钟

# 登录保护
最大失败次数：5次
锁定时长：300秒（5分钟）
失败窗口期：600秒（10分钟）

# JWT 配置
Token 有效期：24小时
加密算法：HS256

# CSRF 配置
Token 有效期：3600秒（1小时）
```

---

## ❓ 常见问题

### Q1: 启动后无法访问管理后台？

**A:** 检查以下几点：
1. 确认服务已启动（查看控制台输出）
2. 检查端口 1205 是否被占用：`netstat -ano | findstr 1205`（Windows）或 `lsof -i:1205`（Linux）
3. 检查防火墙是否放行端口 1205
4. 尝试使用 `http://127.0.0.1:1205` 替代 `localhost`

### Q2: 前端脚本无法识别验证码？

**A:** 排查步骤：
1. 确认后端服务正常运行
2. 检查是否已设置 API Key
3. 打开浏览器开发者工具（F12），查看 Console 是否有错误
4. 尝试手动添加规则（规则管理 → 添加规则）
5. 查看管理后台「识别历史」是否有请求记录

### Q3: 识别准确率不高？

**A:** 提升准确率的方法：
1. 使用手动规则替代自动规则
2. 检查验证码图片是否清晰
3. 在管理后台「模型管理」中调整预处理选项
4. 对于特定网站，可以配置专用的图像处理参数

### Q4: Linux 部署后服务无法启动？

**A:** 检查以下内容：
1. 查看服务状态：`sudo systemctl status captcha-server`
2. 查看详细日志：`sudo journalctl -u captcha-server -n 50`
3. 检查 Python 版本是否 >= 3.8
4. 确认所有依赖已安装：`pip list | grep -E "flask|ddddocr"`
5. 检查文件权限：`ls -la /opt/captcha-server`

### Q5: 如何修改监听端口？

**A:** 修改方法：
1. 编辑 `config.py` 文件
2. 修改 `DEFAULT_PORT = 1205` 为其他端口
3. 如果使用 systemd 服务，需要重新加载：
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart captcha-server
   ```
4. 更新防火墙规则

### Q6: 忘记管理员密码怎么办？

**A:** 使用密码重置工具：
```bash
# Windows
cd 后端服务
python reset_password.py

# Linux
cd /opt/captcha-server
sudo -u captcha ./venv/bin/python3 reset_password.py
```

### Q7: 如何清除所有数据重新开始？

**A:** 删除以下文件：
```bash
# 数据库
rm users.db

# 配置文件
rm captcha_rules.json
rm api_keys.json
rm admin_config.json
rm security_config.json
rm recognition_history.json

# 然后重启服务
```

### Q8: 如何备份数据？

**A:** 需要备份以下文件：
```bash
# 自动备份（Linux 部署脚本会自动备份）
/opt/captcha-server/backup/

# 手动备份
cp users.db users.db.backup
cp captcha_rules.json captcha_rules.json.backup
cp api_keys.json api_keys.json.backup
```

### Q9: 如何升级到新版本？

**A:** 升级步骤：
```bash
# 1. 备份数据（重要！）
# 2. 停止服务
sudo systemctl stop captcha-server

# 3. 更新代码
git pull origin main

# 4. 更新依赖
source venv/bin/activate
pip install -r requirements.txt --upgrade

# 5. 重新部署
sudo ./deploy.sh

# 6. 检查服务状态
sudo systemctl status captcha-server
```

### Q10: 能否同时支持多个用户使用？

**A:** 可以。系统支持：
- 多个管理员账户（在数据库中创建）
- 多个 API Key（每个用户使用独立的 Key）
- 独立的使用统计

---

## 👨‍💻 开发指南

### 开发环境搭建

```bash
# 1. 克隆项目
git clone <repository-url>
cd 验证码识别

# 2. 安装开发依赖
cd 后端服务
pip install -r requirements.txt
pip install pytest pytest-cov black flake8  # 开发工具

# 3. 启动开发服务器
python local_captcha_server.py
```

### 代码结构说明

```
后端服务/
├── local_captcha_server.py    # 主服务文件
│   ├── Flask 应用初始化
│   ├── 路由定义
│   ├── 验证码识别逻辑
│   └── 管理接口
│
├── auth.py                     # 认证模块
│   ├── UserDatabase           # 用户数据库管理
│   ├── JWTManager            # JWT Token 管理
│   └── 密码加密/验证
│
├── security.py                 # 安全模块
│   ├── rate_limit             # 请求限流装饰器
│   ├── SecurityManager        # 安全管理器
│   └── IP 访问控制
│
├── history.py                  # 历史记录模块
│   ├── RecognitionHistory     # 识别历史管理
│   └── ModelManager          # 模型管理
│
├── config.py                   # 配置模块
│   └── 全局配置常量
│
└── logger_config.py            # 日志模块
    └── 日志配置和初始化
```

### 添加新的验证码类型

1. 在 `local_captcha_server.py` 的 `identify_captcha()` 函数中添加新的 `ocr_type`
2. 实现对应的识别函数
3. 更新前端脚本，添加对应的规则添加功能
4. 更新 API 文档

### 运行测试

```bash
# 运行所有测试
pytest

# 运行特定测试
pytest tests/test_auth.py

# 生成覆盖率报告
pytest --cov=. --cov-report=html
```

### 代码规范

- 遵循 PEP 8 规范
- 使用 `black` 格式化代码：`black *.py`
- 使用 `flake8` 检查代码：`flake8 *.py`
- 添加必要的注释和文档字符串

### 提交代码

```bash
# 1. 创建新分支
git checkout -b feature/your-feature-name

# 2. 提交修改
git add .
git commit -m "feat: 添加新功能"

# 3. 推送到远程
git push origin feature/your-feature-name

# 4. 创建 Pull Request
```

### 调试技巧

1. **启用详细日志**：修改 `logger_config.py` 中的日志级别为 `DEBUG`
2. **使用断点调试**：在 IDE 中设置断点
3. **查看请求详情**：在浏览器开发者工具的 Network 面板查看
4. **模拟 API 请求**：使用 Postman 或 curl 测试 API

---

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

---

## 🙏 致谢

- [ddddocr](https://github.com/sml2h3/ddddocr) - 强大的 OCR 识别库
- [Flask](https://flask.palletsprojects.com/) - 轻量级 Web 框架
- [Tampermonkey](https://www.tampermonkey.net/) - 用户脚本管理器

---

## 📞 联系方式

- **问题反馈**：通过 GitHub Issues 提交
- **功能建议**：通过 GitHub Discussions 讨论
- **贡献代码**：欢迎提交 Pull Request

---

## 🔄 更新日志

### v6.8.0 (2024-01-15)
- ✨ 新增 API Key 管理系统
- ✨ 新增识别历史追踪功能
- ✨ 新增完整的管理后台
- 🔒 增强安全防护（JWT、限流、IP 控制）
- 🐛 修复多个已知问题
- 📝 完善文档

### v6.0.0 (2023-12-01)
- ✨ 重构后端架构
- ✨ 新增 SQLite 用户数据库
- ✨ 新增模型管理功能
- 🎨 优化前端脚本

---

<div align="center">

**⭐ 如果觉得项目有帮助，请给个 Star ⭐**

Made with ❤️ by Developer

</div>
