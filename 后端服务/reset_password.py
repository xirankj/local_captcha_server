#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
重置管理员密码为默认密码
用于忘记密码或需要重置时使用
"""

import os
import sys
import sqlite3
import hashlib
import bcrypt

# 数据库文件路径
DB_FILE = 'users.db'

def ensure_database_schema():
    """确保数据库结构包含 password_changed 字段"""
    if not os.path.exists(DB_FILE):
        return False
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    try:
        # 检查字段是否存在
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'password_changed' not in columns:
            print("💡 检测到旧版数据库，正在更新结构...")
            cursor.execute('ALTER TABLE users ADD COLUMN password_changed INTEGER DEFAULT 0')
            conn.commit()
            print("✅ 数据库结构已更新，添加了 password_changed 字段")
        else:
            print("✅ 数据库结构检查通过")
    except Exception as e:
        print(f"⚠️  数据库结构检查失败: {str(e)}")
    finally:
        conn.close()
    
    return True

def hash_password(password_sha256):
    """使用bcrypt加密密码"""
    password_bytes = password_sha256.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def reset_admin_password():
    """重置admin密码为默认密码"""
    
    # 检查数据库文件是否存在
    if not os.path.exists(DB_FILE):
        print("❌ 数据库文件不存在，请先启动服务创建数据库")
        return False
    
    try:
        # 连接数据库
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        # 检查admin用户是否存在
        cursor.execute('SELECT id FROM users WHERE username = ?', ('admin',))
        user = cursor.fetchone()
        
        if not user:
            print("❌ admin 用户不存在，正在创建...")
            # 创建admin用户
            default_password_sha256 = hashlib.sha256('admin'.encode()).hexdigest()
            password_hash = hash_password(default_password_sha256)
            
            cursor.execute('''
                INSERT INTO users (username, password_hash, is_active, is_admin, created_at, updated_at, password_changed)
                VALUES (?, ?, 1, 1, datetime('now'), datetime('now'), 0)
            ''', ('admin', password_hash))
            
            conn.commit()
            print("✅ admin 用户已创建")
        else:
            # 重置现有admin用户的密码
            user_id = user[0]
            default_password_sha256 = hashlib.sha256('admin'.encode()).hexdigest()
            password_hash = hash_password(default_password_sha256)
            
            # 标记为未修改密码（强制首次登录修改）
            cursor.execute('''
                UPDATE users SET password_hash = ?, updated_at = datetime('now'), password_changed = 0 WHERE id = ?
            ''', (password_hash, user_id))
            
            conn.commit()
            print("✅ admin 密码已重置")
        
        # 显示新的登录信息
        print("\n" + "=" * 60)
        print("🔑 管理员账户信息")
        print("=" * 60)
        print("用户名: admin")
        print("密码: admin")
        print("\n⚠️  警告: 请首次登录后立即修改密码！")
        print("=" * 60)
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ 重置失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def delete_database():
    """删除数据库文件（彻底重置）"""
    if os.path.exists(DB_FILE):
        import shutil
        backup_file = DB_FILE + '.backup'
        shutil.copy2(DB_FILE, backup_file)
        print(f"💾 已备份到: {backup_file}")
        
        os.remove(DB_FILE)
        print("🗑️  数据库文件已删除")
        print("\n重启服务后会创建新的默认账户")
        return True
    else:
        print("❌ 数据库文件不存在")
        return False

def main():
    print("\n" + "=" * 60)
    print("🔧 验证码识别服务 - 密码重置工具")
    print("=" * 60)
    print()
    
    # 先检查和更新数据库结构
    if not os.path.exists(DB_FILE):
        print("❌ 数据库文件不存在")
        print("   请先启动服务以创建数据库")
        print("   然后重新运行此脚本")
        input("\n按任意键退出...")
        sys.exit(1)
    
    print("🔍 检查数据库结构...")
    ensure_database_schema()
    print()
    
    print("选择重置方式:")
    print("1. 重置 admin 密码为默认密码 (admin/admin)")
    print("2. 删除整个用户数据库（需要重启服务）")
    print("3. 退出")
    print()
    
    choice = input("请选择 [1/2/3]: ").strip()
    
    if choice == '1':
        print("\n正在重置密码...")
        if reset_admin_password():
            print("\n✅ 重置成功！")
            print("现在可以使用 admin/admin 登录")
            print("\n⚠️  重要: 登录后请立即修改密码！")
        else:
            print("\n❌ 重置失败")
            sys.exit(1)
    
    elif choice == '2':
        confirm = input("\n⚠️  警告: 这将删除所有用户数据！确定要继续吗？ [yes/no]: ")
        if confirm.lower() == 'yes':
            print("\n正在删除数据库...")
            if delete_database():
                print("\n✅ 数据库已删除")
                print("请重启服务以创建新的默认账户")
            else:
                print("\n❌ 删除失败")
                sys.exit(1)
        else:
            print("已取消")
    
    elif choice == '3':
        print("已退出")
        sys.exit(0)
    
    else:
        print("无效的选择")
        sys.exit(1)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n已取消操作")
        sys.exit(0)

