#!/bin/bash

# 严格模式：遇到错误即退出
set -euo pipefail

# 脚本信息
SCRIPT_VERSION="2.0.0"
SCRIPT_NAME="验证码识别服务部署脚本"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
SERVICE_NAME="captcha-server"
SERVICE_USER="captcha"
INSTALL_DIR="/opt/captcha-server"
BACKUP_DIR="$INSTALL_DIR/backup"
PYTHON_MIN_VERSION="3.8"
SERVICE_PORT="1205"

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "\n${BLUE}==>${NC} $1"
}

# 错误处理
error_exit() {
    log_error "$1"
    log_error "部署失败，请检查错误信息"
    
    # 显示故障排除建议
    echo ""
    log_warn "🔧 故障排除建议:"
    echo "  1. 检查系统日志: sudo journalctl -u $SERVICE_NAME -n 20"
    echo "  2. 检查端口占用: sudo netstat -tlnp | grep $SERVICE_PORT"
    echo "  3. 检查防火墙: sudo ufw status 或 sudo firewall-cmd --list-ports"
    echo "  4. 重新运行脚本: sudo ./deploy.sh"
    echo ""
    
    exit 1
}

# 清理函数
cleanup() {
    if [[ "$DRY_RUN" == "true" ]]; then
        return 0
    fi
    
    log_warn "正在清理临时文件..."
    # 清理可能创建的临时文件
    sudo rm -f /tmp/captcha-deploy-* 2>/dev/null || true
}

# 设置退出时的清理
trap cleanup EXIT

# 显示帮助信息
show_help() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help     显示此帮助信息"
    echo "  -v, --version  显示版本信息"
    echo "  --dry-run      模拟运行（不执行实际操作）"
    echo ""
    echo "示例:"
    echo "  sudo $0                # 正常部署"
    echo "  sudo $0 --dry-run      # 模拟部署"
    echo ""
}

# 显示版本信息
show_version() {
    echo "$SCRIPT_NAME v$SCRIPT_VERSION"
    echo "用于部署本地验证码识别服务"
    echo ""
}

# 处理命令行参数
DRY_RUN=false
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--version)
            show_version
            exit 0
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            echo "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
done

# 检查 root 权限
if [[ $EUID -ne 0 ]] && ! sudo -n true 2>/dev/null; then
    error_exit "此脚本需要 sudo 权限，请使用: sudo ./deploy.sh"
fi

# 如果是模拟运行
if [[ "$DRY_RUN" == "true" ]]; then
    log_info "🔍 模拟运行模式 - 不会执行实际操作"
fi

# 执行命令的包装函数（支持模拟运行）
execute_command() {
    local cmd="$1"
    local description="$2"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "🔍 [模拟] $description: $cmd"
        return 0
    else
        log_info "⚡ 执行: $description"
        eval "$cmd"
    fi
}

# 检测操作系统
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS_NAME="$NAME"
        OS_VERSION="$VERSION_ID"
    elif [[ -f /etc/redhat-release ]]; then
        OS_NAME="Red Hat"
        OS_VERSION=$(cat /etc/redhat-release | grep -oE '[0-9]+\.[0-9]+')
    else
        OS_NAME="Unknown"
        OS_VERSION="Unknown"
    fi
    
    log_info "🖥️  操作系统: $OS_NAME $OS_VERSION"
}

# 检测系统架构
detect_arch() {
    ARCH=$(uname -m)
    case $ARCH in
        x86_64) ARCH_NAME="64位" ;;
        i386|i686) ARCH_NAME="32位" ;;
        arm64|aarch64) ARCH_NAME="ARM64" ;;
        *) ARCH_NAME="$ARCH" ;;
    esac
    log_info "🏗️  系统架构: $ARCH_NAME ($ARCH)"
}

log_step "🚀 开始部署验证码识别服务"

# 系统信息检测
detect_os
detect_arch

# 1. 检查必要文件
log_step "1/11 检查必要文件"
REQUIRED_FILES=(
    "local_captcha_server.py"
    "auth.py"
    "start_production.py"
    "requirements.txt"
    "captcha-server.service"
    "history.py"
    "security.py"
    "logger_config.py"
    "config.py"
    "reset_password.py"
)
REQUIRED_DIRS=("static" "templates")
for file in "${REQUIRED_FILES[@]}"; do
    if [[ ! -f "$file" ]]; then
        error_exit "缺少必要文件: $file"
    fi
done
for dir in "${REQUIRED_DIRS[@]}"; do
    if [[ ! -d "$dir" ]]; then
        error_exit "缺少必要目录: $dir"
    fi
done
log_info "✅ 所有必要文件和目录存在"

# 2. 检查 Python 版本
log_step "2/11 检查 Python 环境"
if ! command -v python3 &> /dev/null; then
    log_warn "Python3 未安装，正在安装..."
    sudo apt update || error_exit "apt update 失败"
    sudo apt install -y python3 python3-pip python3-venv || error_exit "Python3 安装失败"
fi

PYTHON_VERSION=$(python3 --version | awk '{print $2}')
log_info "✅ Python 版本: $PYTHON_VERSION"

# 3. 备份现有服务（如果存在）
log_step "3/11 备份现有服务"
if [[ -d "$INSTALL_DIR" ]]; then
    log_warn "检测到现有安装，正在备份..."
    BACKUP_TIME=$(date +%Y%m%d_%H%M%S)
    sudo mkdir -p "$BACKUP_DIR"
    
    # 备份数据文件
    for file in users.db captcha_rules.json api_keys.json admin_config.json recognition_history.json security_config.json; do
        if [[ -f "$INSTALL_DIR/$file" ]]; then
            sudo cp "$INSTALL_DIR/$file" "$BACKUP_DIR/${file}.${BACKUP_TIME}" 2>/dev/null || true
            log_info "备份: $file"
        fi
    done
    
    # 停止旧服务
    if sudo systemctl is-active --quiet $SERVICE_NAME; then
        log_info "停止现有服务..."
        sudo systemctl stop $SERVICE_NAME || log_warn "停止服务失败"
    fi
else
    log_info "首次安装"
fi

# 4. 创建系统用户
log_step "4/11 创建系统用户"
if ! id "$SERVICE_USER" &>/dev/null; then
    log_info "创建系统用户: $SERVICE_USER"
    sudo useradd --system --shell /bin/false --home-dir $INSTALL_DIR --create-home $SERVICE_USER || error_exit "创建用户失败"
else
    log_info "✅ 用户 $SERVICE_USER 已存在"
fi

# 5. 创建安装目录
log_step "5/11 准备安装目录"
sudo mkdir -p $INSTALL_DIR || error_exit "创建目录失败"
sudo chown $SERVICE_USER:$SERVICE_USER $INSTALL_DIR
log_info "✅ 安装目录: $INSTALL_DIR"

# 6. 复制项目文件
log_step "6/11 复制项目文件"

# 获取当前目录
SCRIPT_DIR=$(pwd)
log_info "当前目录: $SCRIPT_DIR"

# 复制核心Python文件
log_info "复制核心Python文件..."
for file in local_captcha_server.py auth.py start_production.py requirements.txt; do
    if [[ -f "$SCRIPT_DIR/$file" ]]; then
        sudo cp -f "$SCRIPT_DIR/$file" "$INSTALL_DIR/" || error_exit "复制 $file 失败"
        log_info "复制: $file"
    else
        error_exit "文件不存在: $file"
    fi
done

# 复制Python模块
log_info "复制Python模块..."
for file in history.py security.py logger_config.py config.py reset_password.py; do
    if [[ -f "$SCRIPT_DIR/$file" ]]; then
        sudo cp -f "$SCRIPT_DIR/$file" "$INSTALL_DIR/" || error_exit "复制 $file 失败"
        log_info "复制: $file"
    else
        error_exit "文件不存在: $file"
    fi
done

# 复制systemd服务文件
sudo cp -f "$SCRIPT_DIR/captcha-server.service" "/etc/systemd/system/" || error_exit "复制服务文件失败"
log_info "复制: captcha-server.service"

# 复制静态文件目录
log_info "复制静态文件..."
if [[ -d "$SCRIPT_DIR/static" ]]; then
    sudo cp -r "$SCRIPT_DIR/static" "$INSTALL_DIR/" || error_exit "复制 static 目录失败"
    log_info "复制: static/"
else
    error_exit "static 目录不存在"
fi

# 复制模板文件目录
log_info "复制模板文件..."
if [[ -d "$SCRIPT_DIR/templates" ]]; then
    sudo cp -r "$SCRIPT_DIR/templates" "$INSTALL_DIR/" || error_exit "复制 templates 目录失败"
    log_info "复制: templates/"
else
    error_exit "templates 目录不存在"
fi

sudo chmod +x $INSTALL_DIR/start_production.py || error_exit "设置执行权限失败"
sudo chmod +x $INSTALL_DIR/reset_password.py || error_exit "设置执行权限失败"

# 恢复备份的数据文件
if [[ -d "$BACKUP_DIR" ]]; then
    log_info "恢复备份的数据文件..."
    for file in users.db captcha_rules.json api_keys.json admin_config.json recognition_history.json security_config.json; do
        LATEST_BACKUP=$(ls -t "$BACKUP_DIR/${file}."* 2>/dev/null | head -1)
        if [[ -f "$LATEST_BACKUP" ]]; then
            sudo cp "$LATEST_BACKUP" "$INSTALL_DIR/$file" || log_warn "恢复 $file 失败"
            log_info "恢复: $file"
        fi
    done
fi

# 修改文件所有者（包括子目录）
sudo chown -R $SERVICE_USER:$SERVICE_USER $INSTALL_DIR
log_info "✅ 文件复制完成"

# 7. 安装 Python 依赖
log_step "7/11 安装 Python 虚拟环境和依赖"
cd $INSTALL_DIR

# 创建或更新虚拟环境
if [[ ! -d "venv" ]]; then
    log_info "创建 Python 虚拟环境..."
    sudo -u $SERVICE_USER python3 -m venv venv || error_exit "创建虚拟环境失败"
else
    log_info "虚拟环境已存在，将更新依赖..."
fi

# 升级 pip 并安装依赖
log_info "安装/更新 Python 依赖包..."
sudo -u $SERVICE_USER $INSTALL_DIR/venv/bin/pip install --upgrade pip -q || error_exit "pip 升级失败"
sudo -u $SERVICE_USER $INSTALL_DIR/venv/bin/pip install -r requirements.txt -q || error_exit "依赖安装失败"
log_info "✅ Python 依赖安装完成"

# 8. 安装 systemd 服务
log_step "8/11 配置 systemd 服务"
# 服务文件已经在步骤6中复制
sudo systemctl daemon-reload || error_exit "systemd reload 失败"
log_info "✅ systemd 服务配置完成"

# 8.5. 检查防火墙配置
log_step "8.5/11 检查防火墙配置"
if command -v ufw &> /dev/null && sudo ufw status | grep -q "Status: active"; then
    log_warn "检测到 UFW 防火墙已启用"
    if ! sudo ufw status | grep -q "$SERVICE_PORT"; then
        log_info "正在配置防火墙规则..."
        sudo ufw allow $SERVICE_PORT/tcp || log_warn "防火墙配置失败，请手动配置"
        log_info "✅ 防火墙规则已添加"
    else
        log_info "✅ 防火墙规则已存在"
    fi
elif command -v firewall-cmd &> /dev/null && sudo firewall-cmd --state &>/dev/null; then
    log_warn "检测到 firewalld 防火墙已启用"
    if ! sudo firewall-cmd --list-ports | grep -q "$SERVICE_PORT"; then
        log_info "正在配置防火墙规则..."
        sudo firewall-cmd --permanent --add-port=$SERVICE_PORT/tcp || log_warn "防火墙配置失败，请手动配置"
        sudo firewall-cmd --reload || log_warn "防火墙重载失败"
        log_info "✅ 防火墙规则已添加"
    else
        log_info "✅ 防火墙规则已存在"
    fi
else
    log_info "未检测到防火墙或防火墙未启用"
fi

# 9. 启动服务
log_step "9/11 启动服务"
sudo systemctl enable $SERVICE_NAME || error_exit "启用服务失败"
log_info "已设置开机自启"

log_info "正在启动服务..."
sudo systemctl start $SERVICE_NAME || error_exit "启动服务失败"

# 等待服务启动
log_info "等待服务启动..."
for i in {1..10}; do
    if sudo systemctl is-active --quiet $SERVICE_NAME; then
        log_info "✅ 服务已启动"
        break
    fi
    if [[ $i -eq 10 ]]; then
        log_error "服务启动超时"
        sudo journalctl -u $SERVICE_NAME -n 20 --no-pager
        error_exit "服务启动失败，请检查上方日志"
    fi
    sleep 2
done

# 10. 验证部署
log_step "10/11 验证部署"

# 检查服务状态
log_info "服务状态:"
sudo systemctl status $SERVICE_NAME --no-pager -l | head -15

# 测试 HTTP 连接
log_info ""
log_info "测试 HTTP 连接..."
sleep 3

if command -v curl &> /dev/null; then
    if curl -f -s --max-time 10 http://localhost:$SERVICE_PORT/health > /dev/null 2>&1; then
        log_info "✅ HTTP 服务响应正常"
        
        # 测试主页访问
        if curl -f -s --max-time 5 http://localhost:$SERVICE_PORT/ > /dev/null 2>&1; then
            log_info "✅ 主页访问正常"
        else
            log_warn "⚠️  主页访问异常"
        fi
    else
        log_warn "⚠️  HTTP 服务未响应，请检查防火墙和端口配置"
        log_info "检查服务日志: sudo journalctl -u $SERVICE_NAME -n 20 --no-pager"
    fi
else
    log_warn "curl 未安装，跳过 HTTP 测试"
fi

# 11. 清理和优化
log_step "11/11 清理和优化"
log_info "设置文件权限..."
sudo chmod 755 $INSTALL_DIR
sudo chmod 644 $INSTALL_DIR/*.py
sudo chmod 644 $INSTALL_DIR/*.json
sudo chmod 644 $INSTALL_DIR/*.txt
sudo chmod 755 $INSTALL_DIR/start_production.py

log_info "清理临时文件..."
sudo find $INSTALL_DIR -name "*.pyc" -delete 2>/dev/null || true
sudo find $INSTALL_DIR -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

log_info "✅ 清理完成"

# 部署成功信息
echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}  ✅ 部署成功！${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo "🌐 访问地址:"
echo "   http://localhost:$SERVICE_PORT"
if command -v hostname &> /dev/null; then
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    if [[ -n "$LOCAL_IP" ]]; then
        echo "   http://$LOCAL_IP:$SERVICE_PORT"
    fi
fi
echo ""
echo "🔑 默认登录账户:"
echo "   用户名: admin"
echo "   密码: admin"
echo "   ⚠️  请立即登录并修改密码！"
echo ""
echo "🔧 常用命令:"
echo "   查看状态: sudo systemctl status $SERVICE_NAME"
echo "   查看日志: sudo journalctl -u $SERVICE_NAME -f"
echo "   重启服务: sudo systemctl restart $SERVICE_NAME"
echo "   停止服务: sudo systemctl stop $SERVICE_NAME"
echo "   重置密码: cd $INSTALL_DIR && sudo -u $SERVICE_USER ./venv/bin/python3 reset_password.py"
echo ""
if [[ -d "$BACKUP_DIR" ]]; then
    echo "💾 备份位置: $BACKUP_DIR"
    echo ""
fi
echo "📚 更多帮助: 查看 README.md 和 快速开始.md"
echo ""

# 部署验证
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}  🎉 部署完成！${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""

# 显示部署统计
log_info "📊 部署统计:"
echo "  • 部署时间: $(date)"
echo "  • 脚本版本: v$SCRIPT_VERSION"
echo "  • 服务端口: $SERVICE_PORT"
echo "  • 安装目录: $INSTALL_DIR"
echo "  • 服务用户: $SERVICE_USER"
echo ""

# 显示下一步操作建议
log_info "🚀 下一步操作:"
echo "  1. 访问管理后台: http://localhost:$SERVICE_PORT"
echo "  2. 使用默认账户登录 (admin/admin)"
echo "  3. 立即修改管理员密码"
echo "  4. 配置API密钥"
echo "  5. 添加验证码识别规则"
echo ""

log_info "✨ 感谢使用 $SCRIPT_NAME！"
echo ""
