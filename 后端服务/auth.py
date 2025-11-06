#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
用户认证模块
支持多用户管理，使用JWT token进行身份验证
"""

import sqlite3
import bcrypt
import jwt
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Tuple
import os
from logger_config import logger


# JWT 配置
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', secrets.token_hex(32))
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24  # token有效期24小时


class UserDatabase:
    """用户数据库管理类"""
    
    def __init__(self, db_path: str = 'users.db'):
        """初始化数据库连接"""
        self.db_path = db_path
        self._init_database()
    
    def _get_connection(self) -> sqlite3.Connection:
        """获取数据库连接"""
        conn = sqlite3.Connection(self.db_path)
        conn.row_factory = sqlite3.Row  # 使返回结果可以通过列名访问
        return conn
    
    def _init_database(self):
        """初始化数据库表结构"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        # 创建用户表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                email TEXT,
                is_active INTEGER DEFAULT 1,
                is_admin INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_login TEXT,
                password_changed INTEGER DEFAULT 0
            )
        ''')
        
        # 兼容旧数据库：添加新字段
        try:
            cursor.execute('ALTER TABLE users ADD COLUMN password_changed INTEGER DEFAULT 0')
        except sqlite3.OperationalError:
            # 字段已存在，忽略错误
            pass
        
        # 创建索引
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_username ON users(username)
        ''')
        
        conn.commit()
        conn.close()
        
        logger.info(f"✅ 用户数据库初始化完成: {self.db_path}")
    
    def hash_password(self, password: str) -> str:
        """使用bcrypt加密密码（密码已经是SHA256）"""
        password_bytes = password.encode('utf-8')
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password_bytes, salt)
        return hashed.decode('utf-8')
    
    def verify_password(self, password: str, password_hash: str) -> bool:
        """验证密码（密码已经是SHA256）"""
        try:
            password_bytes = password.encode('utf-8')
            hash_bytes = password_hash.encode('utf-8')
            return bcrypt.checkpw(password_bytes, hash_bytes)
        except:
            return False
    
    def create_user(self, username: str, password_sha256: str, email: str = None, 
                   is_admin: bool = False) -> Tuple[bool, str]:
        """
        创建新用户
        
        Args:
            username: 用户名
            password_sha256: SHA256加密后的密码
            email: 邮箱（可选）
            is_admin: 是否为管理员
            
        Returns:
            (成功标志, 消息)
        """
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            # 检查用户名是否已存在
            cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
            if cursor.fetchone():
                return False, '用户名已存在'
            
            # 加密密码
            password_hash = self.hash_password(password_sha256)
            
            # 插入新用户
            now = datetime.now().isoformat()
            cursor.execute('''
                INSERT INTO users (username, password_hash, email, is_active, is_admin, 
                                 created_at, updated_at)
                VALUES (?, ?, ?, 1, ?, ?, ?)
            ''', (username, password_hash, email, 1 if is_admin else 0, now, now))
            
            conn.commit()
            logger.info(f"✅ 创建用户成功: {username} (管理员: {is_admin})")
            return True, '用户创建成功'
            
        except Exception as e:
            logger.error(f"❌ 创建用户失败: {str(e)}")
            return False, f'创建用户失败: {str(e)}'
        finally:
            conn.close()
    
    def authenticate(self, username: str, password_sha256: str) -> Optional[Dict]:
        """
        验证用户登录
        
        Args:
            username: 用户名
            password_sha256: SHA256加密后的密码
            
        Returns:
            用户信息字典，验证失败返回None
        """
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            # 查询用户
            cursor.execute('''
                SELECT id, username, password_hash, email, is_active, is_admin, 
                       created_at, last_login, password_changed
                FROM users WHERE username = ?
            ''', (username,))
            
            user_row = cursor.fetchone()
            if not user_row:
                return None
            
            # 转换为字典
            user = dict(user_row)
            
            # 检查账户是否激活
            if not user['is_active']:
                return None
            
            # 验证密码
            if not self.verify_password(password_sha256, user['password_hash']):
                return None
            
            # 更新最后登录时间
            now = datetime.now().isoformat()
            cursor.execute('UPDATE users SET last_login = ? WHERE id = ?', 
                         (now, user['id']))
            conn.commit()
            
            # 移除敏感信息
            del user['password_hash']
            user['last_login'] = now
            
            return user
            
        except Exception as e:
            logger.error(f"❌ 用户认证失败: {str(e)}")
            return None
        finally:
            conn.close()
    
    def get_user_by_id(self, user_id: int) -> Optional[Dict]:
        """根据ID获取用户信息"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                SELECT id, username, email, is_active, is_admin, created_at, 
                       updated_at, last_login, password_changed
                FROM users WHERE id = ?
            ''', (user_id,))
            
            user_row = cursor.fetchone()
            return dict(user_row) if user_row else None
            
        finally:
            conn.close()
    
    def get_user_by_username(self, username: str) -> Optional[Dict]:
        """根据用户名获取用户信息"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                SELECT id, username, email, is_active, is_admin, created_at, 
                       updated_at, last_login
                FROM users WHERE username = ?
            ''', (username,))
            
            user_row = cursor.fetchone()
            return dict(user_row) if user_row else None
            
        finally:
            conn.close()
    
    def change_password(self, user_id: int, old_password_sha256: str, 
                       new_password_sha256: str) -> Tuple[bool, str]:
        """
        修改用户密码
        
        Args:
            user_id: 用户ID
            old_password_sha256: 旧密码（SHA256）
            new_password_sha256: 新密码（SHA256）
            
        Returns:
            (成功标志, 消息)
        """
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            # 获取当前密码哈希
            cursor.execute('SELECT password_hash FROM users WHERE id = ?', (user_id,))
            row = cursor.fetchone()
            if not row:
                return False, '用户不存在'
            
            current_hash = row['password_hash']
            
            # 验证旧密码
            if not self.verify_password(old_password_sha256, current_hash):
                return False, '旧密码错误'
            
            # 加密新密码
            new_hash = self.hash_password(new_password_sha256)
            
            # 更新密码并标记为已修改
            now = datetime.now().isoformat()
            cursor.execute('''
                UPDATE users SET password_hash = ?, updated_at = ?, password_changed = 1 WHERE id = ?
            ''', (new_hash, now, user_id))
            
            conn.commit()
            logger.info(f"✅ 用户 {user_id} 密码修改成功，已标记为已修改")
            return True, '密码修改成功'
            
        except Exception as e:
            logger.error(f"❌ 修改密码失败: {str(e)}")
            return False, f'修改密码失败: {str(e)}'
        finally:
            conn.close()
    
    def list_all_users(self) -> list:
        """获取所有用户列表"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                SELECT id, username, email, is_active, is_admin, created_at, last_login
                FROM users ORDER BY created_at DESC
            ''')
            
            return [dict(row) for row in cursor.fetchall()]
            
        finally:
            conn.close()
    
    def delete_user(self, user_id: int) -> Tuple[bool, str]:
        """删除用户"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            # 检查是否存在
            cursor.execute('SELECT username FROM users WHERE id = ?', (user_id,))
            row = cursor.fetchone()
            if not row:
                return False, '用户不存在'
            
            username = row['username']
            
            # 删除用户
            cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))
            conn.commit()
            
            logger.info(f"✅ 删除用户成功: {username}")
            return True, '用户删除成功'
            
        except Exception as e:
            logger.error(f"❌ 删除用户失败: {str(e)}")
            return False, f'删除用户失败: {str(e)}'
        finally:
            conn.close()
    
    def update_user_status(self, user_id: int, is_active: bool) -> Tuple[bool, str]:
        """更新用户激活状态"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            now = datetime.now().isoformat()
            cursor.execute('''
                UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?
            ''', (1 if is_active else 0, now, user_id))
            
            if cursor.rowcount == 0:
                return False, '用户不存在'
            
            conn.commit()
            status = '启用' if is_active else '禁用'
            logger.info(f"✅ 用户 {user_id} 已{status}")
            return True, f'用户已{status}'
            
        except Exception as e:
            logger.error(f"❌ 更新用户状态失败: {str(e)}")
            return False, f'更新失败: {str(e)}'
        finally:
            conn.close()


class JWTManager:
    """JWT Token管理类"""
    
    @staticmethod
    def generate_token(user_id: int, username: str, is_admin: bool = False) -> str:
        """
        生成JWT token
        
        Args:
            user_id: 用户ID
            username: 用户名
            is_admin: 是否为管理员
            
        Returns:
            JWT token字符串
        """
        payload = {
            'user_id': user_id,
            'username': username,
            'is_admin': is_admin,
            'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
            'iat': datetime.utcnow()
        }
        
        token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
        return token
    
    @staticmethod
    def verify_token(token: str) -> Optional[Dict]:
        """
        验证JWT token
        
        Args:
            token: JWT token字符串
            
        Returns:
            解码后的payload字典，验证失败返回None
        """
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("⚠️  Token已过期")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"⚠️  无效的Token: {str(e)}")
            return None
    
    @staticmethod
    def extract_token_from_header(auth_header: str) -> Optional[str]:
        """
        从Authorization header中提取token
        
        Args:
            auth_header: Authorization header值 (格式: "Bearer <token>")
            
        Returns:
            token字符串，提取失败返回None
        """
        if not auth_header:
            return None
        
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return None
        
        return parts[1]
