#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
集中配置常量（非密钥）
说明：不在此存储密钥/口令，密钥使用环境变量或独立安全存储。
"""

DEFAULT_HOST = '0.0.0.0'
DEFAULT_PORT = 1205
SESSION_LIFETIME_HOURS = 1

# 限流默认值
RATE_LIMIT_DEFAULT_MAX = 100
RATE_LIMIT_DEFAULT_WINDOW = 60

# 历史记录
HISTORY_MAX_RECORDS = 10000
HISTORY_FLUSH_INTERVAL = 60




