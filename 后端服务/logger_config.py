#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
日志配置模块
统一管理应用日志输出
"""

import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from datetime import datetime


def setup_logger(name='captcha_server', log_file='captcha_server.log', level=logging.INFO):
    """
    配置日志系统
    
    Args:
        name: logger 名称
        log_file: 日志文件名
        level: 日志级别
        
    Returns:
        配置好的 logger 实例
    """
    
    # 创建日志目录
    log_dir = 'logs'
    if not os.path.exists(log_dir):
        try:
            os.makedirs(log_dir)
        except Exception as e:
            print(f"⚠️ 创建日志目录失败: {e}")
    
    log_path = os.path.join(log_dir, log_file)
    
    # 创建 logger
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # 避免重复添加 handler
    if logger.handlers:
        return logger
    
    # 日志格式
    formatter = logging.Formatter(
        '[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # 文件 handler（带日志轮转，最大 10MB，保留 5 个备份）
    try:
        file_handler = RotatingFileHandler(
            log_path,
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5,
            encoding='utf-8'
        )
        file_handler.setLevel(level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except Exception as e:
        print(f"⚠️ 配置文件日志失败: {e}")
    
    # 控制台 handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # 阻止日志向上传播到 root logger
    logger.propagate = False
    
    return logger


# 全局 logger 实例
logger = setup_logger()

# 便捷函数
def info(msg):
    """记录信息日志"""
    logger.info(msg)

def warning(msg):
    """记录警告日志"""
    logger.warning(msg)

def error(msg):
    """记录错误日志"""
    logger.error(msg)

def debug(msg):
    """记录调试日志"""
    logger.debug(msg)

def exception(msg):
    """记录异常日志（包含堆栈跟踪）"""
    logger.exception(msg)


if __name__ == '__main__':
    # 测试日志系统
    logger.info("✅ 日志系统测试 - INFO")
    logger.warning("⚠️ 日志系统测试 - WARNING")
    logger.error("❌ 日志系统测试 - ERROR")
    try:
        1 / 0
    except:
        logger.exception("💥 日志系统测试 - EXCEPTION")
    
    print(f"\n✅ 日志已保存到: logs/captcha_server.log")

