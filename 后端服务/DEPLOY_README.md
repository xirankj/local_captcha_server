# 验证码识别服务部署脚本

## 📋 概述

`deploy.sh` 是一个自动化部署脚本，用于在Linux系统上部署验证码识别服务。脚本支持多种Linux发行版，包括Ubuntu、CentOS、Debian等。

## 🚀 功能特性

- ✅ **自动化部署**: 一键部署完整的验证码识别服务
- ✅ **系统检测**: 自动检测操作系统和架构
- ✅ **依赖管理**: 自动安装Python环境和依赖包
- ✅ **服务管理**: 自动配置systemd服务
- ✅ **防火墙配置**: 自动配置防火墙规则
- ✅ **备份恢复**: 自动备份和恢复数据文件
- ✅ **模拟运行**: 支持模拟运行模式
- ✅ **错误处理**: 完善的错误处理和故障排除建议

## 📦 系统要求

- **操作系统**: Linux (Ubuntu 18.04+, CentOS 7+, Debian 9+)
- **Python**: Python 3.8+
- **权限**: sudo权限
- **内存**: 至少512MB RAM
- **磁盘**: 至少1GB可用空间

## 🛠️ 使用方法

### 基本用法

```bash
# 1. 下载项目文件
git clone <repository-url>
cd 验证码识别/后端服务

# 2. 运行部署脚本
sudo ./deploy.sh
```

### 命令行选项

```bash
# 显示帮助信息
sudo ./deploy.sh --help

# 显示版本信息
sudo ./deploy.sh --version

# 模拟运行（不执行实际操作）
sudo ./deploy.sh --dry-run
```

## 📁 必要文件

部署脚本需要以下文件：

### 核心文件
- `local_captcha_server.py` - 主服务文件
- `auth.py` - 认证模块
- `start_production.py` - 生产环境启动脚本
- `requirements.txt` - Python依赖列表

### 服务文件
- `captcha-server.service` - systemd服务配置

### Python模块
- `history.py` - 历史记录模块
- `security.py` - 安全模块
- `logger_config.py` - 日志配置模块

### 静态文件
- `static/` - 静态资源目录
- `templates/` - 模板文件目录

## 🔧 部署流程

脚本按以下步骤执行部署：

1. **系统检测** - 检测操作系统和架构
2. **文件检查** - 验证所有必要文件存在
3. **Python环境** - 安装Python3和虚拟环境
4. **备份恢复** - 备份现有数据（如果存在）
5. **用户创建** - 创建系统用户
6. **文件复制** - 复制项目文件到安装目录
7. **依赖安装** - 安装Python依赖包
8. **服务配置** - 配置systemd服务
9. **防火墙配置** - 配置防火墙规则
10. **服务启动** - 启动服务
11. **部署验证** - 验证部署结果

## 🌐 访问服务

部署完成后，可以通过以下地址访问服务：

- **本地访问**: http://localhost:1205
- **网络访问**: http://[服务器IP]:1205

### 默认登录信息
- **用户名**: admin
- **密码**: admin
- ⚠️ **请立即修改默认密码！**

## 🔧 常用命令

```bash
# 查看服务状态
sudo systemctl status captcha-server

# 查看服务日志
sudo journalctl -u captcha-server -f

# 重启服务
sudo systemctl restart captcha-server

# 停止服务
sudo systemctl stop captcha-server

# 启动服务
sudo systemctl start captcha-server
```

## 🐛 故障排除

### 常见问题

1. **服务启动失败**
   ```bash
   # 查看详细日志
   sudo journalctl -u captcha-server -n 20
   ```

2. **端口被占用**
   ```bash
   # 检查端口占用
   sudo netstat -tlnp | grep 1205
   ```

3. **防火墙问题**
   ```bash
   # Ubuntu/Debian
   sudo ufw status
   
   # CentOS/RHEL
   sudo firewall-cmd --list-ports
   ```

4. **权限问题**
   ```bash
   # 检查文件权限
   ls -la /opt/captcha-server/
   ```

### 重新部署

```bash
# 停止服务
sudo systemctl stop captcha-server

# 重新运行部署脚本
sudo ./deploy.sh
```

## 📊 部署统计

脚本会显示以下部署信息：

- 部署时间
- 脚本版本
- 服务端口
- 安装目录
- 服务用户

## 🔒 安全建议

1. **修改默认密码**: 部署后立即修改管理员密码
2. **配置防火墙**: 限制访问来源
3. **定期更新**: 保持系统和依赖包更新
4. **监控日志**: 定期检查服务日志
5. **备份数据**: 定期备份配置文件

## 📚 更多帮助

- 查看项目README.md
- 查看快速开始指南
- 查看API文档
- 提交Issue获取支持

## 🎯 下一步操作

部署完成后，建议按以下顺序操作：

1. 访问管理后台
2. 修改管理员密码
3. 配置API密钥
4. 添加验证码识别规则
5. 测试服务功能

---

**注意**: 此脚本仅适用于Linux系统，Windows用户请使用其他部署方式。

