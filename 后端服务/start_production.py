#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生产环境启动脚本
用于在服务器上启动验证码识别服务
"""

import os
import sys

# 生产环境配置
PRODUCTION_CONFIG = {
    'host': '0.0.0.0',  # 监听所有网络接口
    'port': 1205,       # 端口号
    'debug': False,     # 关闭调试模式
    'threaded': True,   # 启用多线程
}

def main():
    """主函数"""
    print("🚀 启动生产环境验证码识别服务...")
    
    # 检查是否为生产环境
    if os.getenv('FLASK_ENV') != 'production':
        os.environ['FLASK_ENV'] = 'production'
    
    # 导入应用
    from local_captcha_server import app, load_admin_config, load_rules, load_api_keys
    
    # 加载配置
    print("📋 加载配置...")
    load_admin_config()
    load_rules()
    load_api_keys()
    
    # 启动服务
    print(f"🌐 服务地址: http://0.0.0.0:{PRODUCTION_CONFIG['port']}")
    print("✅ 生产环境服务启动完成")
    
    try:
        app.run(**PRODUCTION_CONFIG)
    except KeyboardInterrupt:
        print("\n🛑 服务已停止")
    except Exception as e:
        print(f"❌ 服务异常: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()