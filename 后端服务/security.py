#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
统一安全模块：整合请求限流与安全管理（白/黑名单、登录锁、CSRF）。
新代码可 from security import rate_limit, get_api_key_identifier, ...
"""

import time
import secrets
import threading
from collections import defaultdict, deque
from functools import wraps
from flask import request, jsonify, session
from logger_config import logger


# =====================
# 请求限流（滑动窗口）
# =====================

class RateLimiter:
    def __init__(self):
        self.requests = defaultdict(deque)
        self.lock = threading.Lock()
        self.last_cleanup = time.time()
    
    def is_allowed(self, identifier, max_requests, time_window):
        current_time = time.time()
        with self.lock:
            if current_time - self.last_cleanup > 300:
                self._cleanup_old_requests(current_time)
                self.last_cleanup = current_time
            q = self.requests[identifier]
            cutoff = current_time - time_window
            while q and q[0] < cutoff:
                q.popleft()
            current_count = len(q)
            if current_count >= max_requests:
                oldest = q[0]
                retry_after = int(oldest + time_window - current_time) + 1
                return False, {
                    'allowed': False,
                    'limit': max_requests,
                    'remaining': 0,
                    'reset': int(oldest + time_window),
                    'retry_after': retry_after
                }
            q.append(current_time)
            return True, {
                'allowed': True,
                'limit': max_requests,
                'remaining': max_requests - current_count - 1,
                'reset': int(current_time + time_window)
            }
    
    def _cleanup_old_requests(self, current_time):
        cutoff_time = current_time - 3600
        to_remove = []
        for identifier, q in self.requests.items():
            while q and q[0] < cutoff_time:
                q.popleft()
            if not q:
                to_remove.append(identifier)
        for key in to_remove:
            del self.requests[key]
    
    def get_stats(self):
        with self.lock:
            return {
                'total_identifiers': len(self.requests),
                'total_requests_tracked': sum(len(q) for q in self.requests.values())
            }


rate_limiter = RateLimiter()


def rate_limit(max_requests=100, time_window=60, key_func=None):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if key_func:
                identifier = key_func()
            else:
                identifier = request.headers.get('X-Forwarded-For', request.headers.get('X-Real-IP', request.remote_addr))
            allowed, info = rate_limiter.is_allowed(identifier, max_requests, time_window)
            response_headers = {
                'X-RateLimit-Limit': str(info['limit']),
                'X-RateLimit-Remaining': str(info['remaining']),
                'X-RateLimit-Reset': str(info['reset'])
            }
            if not allowed:
                response_headers['Retry-After'] = str(info['retry_after'])
                response = jsonify({
                    'code': 429,
                    'message': '请求过于频繁，请稍后再试',
                    'description': f'每{time_window}秒最多允许{max_requests}次请求',
                    'retry_after': info['retry_after']
                })
                response.status_code = 429
                for k, v in response_headers.items():
                    response.headers[k] = v
                return response
            result = f(*args, **kwargs)
            if hasattr(result, 'headers'):
                for k, v in response_headers.items():
                    result.headers[k] = v
            return result
        return decorated_function
    return decorator


def get_api_key_identifier():
    api_key = request.headers.get('X-API-Key') or request.args.get('api_key')
    if not api_key and request.is_json:
        api_key = request.json.get('api_key')
    return api_key or request.remote_addr


def get_user_identifier():
    from auth import JWTManager
    auth_header = request.headers.get('Authorization')
    token = JWTManager.extract_token_from_header(auth_header)
    if token:
        payload = JWTManager.verify_token(token)
        if payload:
            return f"user_{payload.get('user_id')}"
    return request.remote_addr


# =====================
# 安全管理
# =====================

import json
import os


class SecurityManager:
    def __init__(self, config_file='security_config.json'):
        self.config_file = config_file
        self.whitelist = set()
        self.blacklist = set()
        self.login_failures = defaultdict(deque)
        self.locked_ips = {}
        self.csrf_tokens = {}
        self.lock = threading.Lock()
        self.config = {
            'enable_whitelist': False,
            'enable_blacklist': True,
            'max_login_failures': 5,
            'lockout_duration': 900,
            'failure_window': 300,
            'csrf_token_lifetime': 3600,
            'enable_csrf': True,
        }
        self.load_config()
        logger.info('🔒 [安全管理] 初始化完成')
    
    def load_config(self):
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.config.update(data.get('config', {}))
                    self.whitelist = set(data.get('whitelist', []))
                    self.blacklist = set(data.get('blacklist', []))
                logger.info('✅ [安全管理] 配置加载成功')
                logger.info(f'   白名单: {len(self.whitelist)} 个IP')
                logger.info(f'   黑名单: {len(self.blacklist)} 个IP')
        except Exception as e:
            logger.warning(f'⚠️  [安全管理] 配置加载失败: {str(e)}，使用默认配置')
    
    def save_config(self):
        try:
            data = {
                'config': self.config,
                'whitelist': list(self.whitelist),
                'blacklist': list(self.blacklist)
            }
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            logger.info('💾 [安全管理] 配置已保存')
            return True
        except Exception as e:
            logger.error(f'❌ [安全管理] 配置保存失败: {str(e)}')
            return False
    
    def get_client_ip(self):
        ip = request.headers.get('X-Forwarded-For')
        if ip:
            ip = ip.split(',')[0].strip()
        else:
            ip = request.headers.get('X-Real-IP', request.remote_addr)
        return ip
    
    def is_ip_allowed(self, ip=None):
        if ip is None:
            ip = self.get_client_ip()
        if self.config['enable_blacklist'] and ip in self.blacklist:
            logger.warning(f'🚫 [安全管理] IP 在黑名单中: {ip}')
            return False, 'IP 已被封禁'
        if self.config['enable_whitelist']:
            if ip not in self.whitelist:
                logger.warning(f'🚫 [安全管理] IP 不在白名单中: {ip}')
                return False, 'IP 未授权访问'
        return True, 'OK'
    
    def add_to_whitelist(self, ip):
        with self.lock:
            self.whitelist.add(ip)
            self.save_config()
            logger.info(f'✅ [安全管理] IP 已添加到白名单: {ip}')
    
    def remove_from_whitelist(self, ip):
        with self.lock:
            self.whitelist.discard(ip)
            self.save_config()
            logger.info(f'✅ [安全管理] IP 已从白名单移除: {ip}')
    
    def add_to_blacklist(self, ip):
        with self.lock:
            self.blacklist.add(ip)
            self.save_config()
            logger.info(f'🚫 [安全管理] IP 已添加到黑名单: {ip}')
    
    def remove_from_blacklist(self, ip):
        with self.lock:
            self.blacklist.discard(ip)
            self.save_config()
            logger.info(f'✅ [安全管理] IP 已从黑名单移除: {ip}')
    
    def record_login_failure(self, ip=None):
        if ip is None:
            ip = self.get_client_ip()
        current_time = time.time()
        with self.lock:
            failures = self.login_failures[ip]
            cutoff_time = current_time - self.config['failure_window']
            while failures and failures[0] < cutoff_time:
                failures.popleft()
            failures.append(current_time)
            if len(failures) >= self.config['max_login_failures']:
                unlock_time = current_time + self.config['lockout_duration']
                self.locked_ips[ip] = unlock_time
                logger.warning(f'🔒 [安全管理] IP 已被锁定: {ip} (失败 {len(failures)} 次)')
                logger.warning(f'   解锁时间: {time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(unlock_time))}')
                return True, self.config['lockout_duration']
            logger.warning(f'⚠️  [安全管理] 登录失败: {ip} ({len(failures)}/{self.config["max_login_failures"]})')
            return False, len(failures)
    
    def is_ip_locked(self, ip=None):
        if ip is None:
            ip = self.get_client_ip()
        current_time = time.time()
        with self.lock:
            if ip in self.locked_ips:
                unlock_time = self.locked_ips[ip]
                if current_time < unlock_time:
                    remaining = int(unlock_time - current_time)
                    logger.warning(f'🔒 [安全管理] IP 仍在锁定中: {ip} (剩余 {remaining} 秒)')
                    return True, remaining
                else:
                    del self.locked_ips[ip]
                    if ip in self.login_failures:
                        del self.login_failures[ip]
                    logger.info(f'🔓 [安全管理] IP 已解锁: {ip}')
        return False, 0
    
    def clear_login_failures(self, ip=None):
        if ip is None:
            ip = self.get_client_ip()
        with self.lock:
            if ip in self.login_failures:
                del self.login_failures[ip]
            if ip in self.locked_ips:
                del self.locked_ips[ip]
            logger.info(f'✅ [安全管理] 已清除登录失败记录: {ip}')
    
    def generate_csrf_token(self):
        if not self.config['enable_csrf']:
            return None
        token = secrets.token_urlsafe(32)
        with self.lock:
            self.csrf_tokens[token] = time.time()
            self._cleanup_csrf_tokens()
        return token
    
    def verify_csrf_token(self, token):
        if not self.config['enable_csrf']:
            return True
        if not token:
            return False
        current_time = time.time()
        with self.lock:
            if token not in self.csrf_tokens:
                return False
            token_time = self.csrf_tokens[token]
            if current_time - token_time > self.config['csrf_token_lifetime']:
                del self.csrf_tokens[token]
                return False
            del self.csrf_tokens[token]
            return True
    
    def _cleanup_csrf_tokens(self):
        current_time = time.time()
        expired = [t for t, ts in self.csrf_tokens.items() if current_time - ts > self.config['csrf_token_lifetime']]
        for t in expired:
            del self.csrf_tokens[t]
    
    def get_stats(self):
        with self.lock:
            return {
                'whitelist_count': len(self.whitelist),
                'blacklist_count': len(self.blacklist),
                'locked_ips_count': len(self.locked_ips),
                'failed_login_ips': len(self.login_failures),
                'csrf_tokens_active': len(self.csrf_tokens),
                'config': self.config.copy()
            }


security_manager = SecurityManager()


def require_ip_allowed(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        allowed, message = security_manager.is_ip_allowed()
        if not allowed:
            return jsonify({'code': 403, 'message': '访问被拒绝', 'description': message}), 403
        return f(*args, **kwargs)
    return decorated_function


def check_login_lock(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        locked, remaining = security_manager.is_ip_locked()
        if locked:
            return jsonify({'code': 429, 'message': '登录已被锁定', 'description': '由于多次登录失败，您的 IP 已被临时锁定', 'retry_after': remaining}), 429
        return f(*args, **kwargs)
    return decorated_function


def require_csrf_token(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not security_manager.config['enable_csrf']:
            return f(*args, **kwargs)
        token = request.headers.get('X-CSRF-Token')
        if not token and request.is_json:
            token = request.json.get('csrf_token')
        if not security_manager.verify_csrf_token(token):
            return jsonify({'code': 403, 'message': 'CSRF 验证失败', 'description': 'Invalid or expired CSRF token'}), 403
        return f(*args, **kwargs)
    return decorated_function


def get_security_overview():
    try:
        sec_stats = security_manager.get_stats()
    except Exception:
        sec_stats = {}
    try:
        rl_stats = rate_limiter.get_stats()
    except Exception:
        rl_stats = {}
    return {'security': sec_stats, 'rate_limit': rl_stats}


