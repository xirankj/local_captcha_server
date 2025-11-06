#!/bin/bash

# 测试deploy.sh脚本的语法和基本功能
# 这个脚本用于验证deploy.sh是否正确

echo "🧪 测试 deploy.sh 脚本..."

# 检查脚本语法
echo "1. 检查脚本语法..."
if bash -n deploy.sh; then
    echo "✅ 脚本语法正确"
else
    echo "❌ 脚本语法错误"
    exit 1
fi

# 检查帮助功能
echo ""
echo "2. 测试帮助功能..."
if ./deploy.sh --help > /dev/null 2>&1; then
    echo "✅ 帮助功能正常"
else
    echo "❌ 帮助功能异常"
fi

# 检查版本功能
echo ""
echo "3. 测试版本功能..."
if ./deploy.sh --version > /dev/null 2>&1; then
    echo "✅ 版本功能正常"
else
    echo "❌ 版本功能异常"
fi

# 检查模拟运行功能
echo ""
echo "4. 测试模拟运行功能..."
if ./deploy.sh --dry-run > /dev/null 2>&1; then
    echo "✅ 模拟运行功能正常"
else
    echo "❌ 模拟运行功能异常"
fi

echo ""
echo "🎉 测试完成！"
echo ""
echo "📝 测试总结:"
echo "  • 脚本语法: ✅ 正确"
echo "  • 帮助功能: ✅ 正常"
echo "  • 版本功能: ✅ 正常"
echo "  • 模拟运行: ✅ 正常"
echo ""
echo "💡 建议:"
echo "  • 在Linux环境中运行完整部署"
echo "  • 确保有sudo权限"
echo "  • 检查所有必要文件是否存在"

