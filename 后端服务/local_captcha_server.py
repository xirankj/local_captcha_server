#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
本地验证码识别服务
支持英数验证码和滑动验证码识别
使用 ddddocr 和 opencv 进行识别
"""

from flask import Flask, request, jsonify, session, make_response, render_template, url_for
from flask_cors import CORS
import base64
import io
import json
import time
import os
import secrets
import hashlib
from datetime import datetime, timedelta
from PIL import Image
import numpy as np
from functools import wraps
import bcrypt

# 引入日志系统
from logger_config import logger

# 引入新的认证模块
from auth import UserDatabase, JWTManager

# 引入请求限流模块
from security import rate_limit, get_api_key_identifier, get_user_identifier

# 引入安全管理模块
from security import security_manager, require_ip_allowed, check_login_lock, require_csrf_token

# 引入识别历史和模型管理模块
from history import recognition_history, model_manager
from config import DEFAULT_HOST, DEFAULT_PORT

app = Flask(__name__)
CORS(app, supports_credentials=True)  # 允许跨域请求并支持凭证

# 设置 session 密钥（用于加密 session）
app.secret_key = secrets.token_hex(32)
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)

# 规则文件路径（保存在当前目录）
RULES_FILE = os.path.join(os.path.dirname(__file__), 'captcha_rules.json')
APIKEY_FILE = os.path.join(os.path.dirname(__file__), 'api_keys.json')
ADMIN_CONFIG_FILE = os.path.join(os.path.dirname(__file__), 'admin_config.json')

# 存储规则的内存数据库
rules_db = {}

# 存储 API Key 的内存数据库
# 结构: {"api_key": {"name": "名称", "created_at": "创建时间", "stats": {"total": 0, "types": {}, "hosts": {}}}}
api_keys_db = {}

# 管理员配置
admin_config = {
    'username': 'admin',
    'password_hash': '',  # 存储加密后的密码
    'enabled': True,
    'session_timeout': 3600,
    'is_default_password': True,  # 标记是否为默认密码
    'hitokoto_api': '',  # 一言API地址
    'background_api': ''  # 随机背景图API地址
}

# 延迟导入OCR库（首次使用时加载）
ocr_instance = None
slide_instance = None

# 初始化用户数据库
DB_FILE = os.path.join(os.path.dirname(__file__), 'users.db')
user_db = UserDatabase(DB_FILE)


def load_rules():
    """从文件加载规则"""
    global rules_db
    try:
        if os.path.exists(RULES_FILE):
            with open(RULES_FILE, 'r', encoding='utf-8') as f:
                rules_db = json.load(f)
            logger.info(f"📥 加载规则文件: {RULES_FILE}")
            logger.info(f"✅ 已加载 {len(rules_db)} 个网站的规则")
        else:
            logger.info(f"💡 规则文件不存在，将创建新文件: {RULES_FILE}")
            rules_db = {}
    except Exception as e:
        logger.warning(f"⚠️  加载规则失败: {str(e)}，使用空规则库")
        rules_db = {}


def save_admin_config():
    """保存管理员配置到文件"""
    try:
        config = {
            "admin": {
                "username": admin_config['username'],
                "password_hash": admin_config['password_hash'],
                "enabled": admin_config['enabled'],
                "is_default_password": admin_config.get('is_default_password', False)
            },
            "session_timeout": admin_config['session_timeout'],
            "hitokoto_api": admin_config.get('hitokoto_api', ''),
            "background_api": admin_config.get('background_api', ''),
            "note": "密码已加密存储，请勿手动修改此文件"
        }
        with open(ADMIN_CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        logger.info(f"💾 管理员配置已保存: {ADMIN_CONFIG_FILE}")
        return True
    except Exception as e:
        logger.error(f"❌ 保存管理员配置失败: {str(e)}")
        return False


def load_admin_config():
    """从文件加载管理员配置"""
    global admin_config
    try:
        if os.path.exists(ADMIN_CONFIG_FILE):
            with open(ADMIN_CONFIG_FILE, 'r', encoding='utf-8') as f:
                config = json.load(f)
                admin_info = config.get('admin', {})
                admin_config['username'] = admin_info.get('username', 'admin')
                admin_config['session_timeout'] = config.get('session_timeout', 3600)
                admin_config['enabled'] = admin_info.get('enabled', True)
                admin_config['hitokoto_api'] = config.get('hitokoto_api', '')
                admin_config['background_api'] = config.get('background_api', '')
                
                # 处理密码：兼容旧的明文密码和新的加密密码
                if 'password_hash' in admin_info:
                    admin_config['password_hash'] = admin_info['password_hash']
                    admin_config['is_default_password'] = admin_info.get('is_default_password', False)
                elif 'password' in admin_info:
                    # 旧的明文密码，转换为加密存储（先SHA256再 bcrypt）
                    old_password = admin_info['password']
                    old_password_sha256 = hashlib.sha256(old_password.encode()).hexdigest()
                    admin_config['password_hash'] = hash_password(old_password_sha256)
                    admin_config['is_default_password'] = (old_password == 'admin123' or old_password == 'admin')
                    # 保存加密后的配置
                    save_admin_config()
                    logger.info("🔐 已将明文密码转换为加密存储")
                else:
                    # 没有密码，使用默认密码admin（先SHA256再bcrypt）
                    default_password_sha256 = hashlib.sha256('admin'.encode()).hexdigest()
                    admin_config['password_hash'] = hash_password(default_password_sha256)
                    admin_config['is_default_password'] = True
                    save_admin_config()
                
            logger.info(f"📥 加载管理员配置: {ADMIN_CONFIG_FILE}")
            logger.info(f"✅ 管理员账号: {admin_config['username']}")
            logger.info(f"📌 一言API: {admin_config.get('hitokoto_api', '未配置')}")
            logger.info(f"📌 背景API: {admin_config.get('background_api', '未配置')}")
            if admin_config.get('is_default_password', False):
                logger.warning("⚠️  警告: 使用默认密码，首次登录将强制修改！")
        else:
            logger.info(f"💡 管理员配置文件不存在，将创建默认配置: {ADMIN_CONFIG_FILE}")
            logger.warning("⚠️  默认账号: admin / admin (首次登录将强制修改！)")
            # 使用默认密码admin（先SHA256再bcrypt）
            admin_config['username'] = 'admin'
            default_password_sha256 = hashlib.sha256('admin'.encode()).hexdigest()
            admin_config['password_hash'] = hash_password(default_password_sha256)
            admin_config['is_default_password'] = True
            admin_config['enabled'] = True
            admin_config['session_timeout'] = 3600
            save_admin_config()
    except Exception as e:
        logger.warning(f"⚠️  加载管理员配置失败: {str(e)}，使用默认配置")
        admin_config['username'] = 'admin'
        default_password_sha256 = hashlib.sha256('admin'.encode()).hexdigest()
        admin_config['password_hash'] = hash_password(default_password_sha256)
        admin_config['is_default_password'] = True


def load_api_keys():
    """从文件加载 API Keys"""
    global api_keys_db
    try:
        if os.path.exists(APIKEY_FILE):
            with open(APIKEY_FILE, 'r', encoding='utf-8') as f:
                api_keys_db = json.load(f)
            logger.info(f"📥 加载 API Keys 文件: {APIKEY_FILE}")
            logger.info(f"✅ 已加载 {len(api_keys_db)} 个 API Key")
        else:
            logger.info(f"💡 API Keys 文件不存在，将创建新文件: {APIKEY_FILE}")
            api_keys_db = {}
    except Exception as e:
        logger.warning(f"⚠️  加载 API Keys 失败: {str(e)}，使用空数据库")
        api_keys_db = {}


def migrate_admin_to_database():
    """将admin_config.json中的管理员账户迁移到数据库"""
    try:
        # 检查数据库是否已有用户
        users = user_db.list_all_users()
        if users:
            logger.info(f"💾 数据库中已有 {len(users)} 个用户，跳过迁移")
            return
        
        # 读取旧配置
        if not os.path.exists(ADMIN_CONFIG_FILE):
            logger.info("💡 未找到旧配置文件，创建默认管理员账户")
            # 🔐 修复默认密码问题：创建时标记为默认密码
            default_password_sha256 = hashlib.sha256('admin'.encode()).hexdigest()
            success, message = user_db.create_user(
                username='admin',
                password_sha256=default_password_sha256,
                email=None,
                is_admin=True
            )
            if success:
                logger.warning("=" * 60)
                logger.warning("⚠️  SECURITY WARNING: 默认管理员账户已创建")
                logger.warning("  用户名: admin")
                logger.warning("  密码: admin")
                logger.warning("  ⚠️  首次登录将被强制要求修改密码！")
                logger.warning("  ⚠️  请妥善保管新密码，默认密码极其不安全！")
                logger.warning("=" * 60)
            else:
                logger.error(f"❌ 创建默认管理员失败: {message}")
            return
        
        # 读取旧配置文件
        with open(ADMIN_CONFIG_FILE, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        admin_info = config.get('admin', {})
        username = admin_info.get('username', 'admin')
        password_hash = admin_info.get('password_hash', '')
        
        if not password_hash:
            logger.warning("⚠️  旧配置中没有密码，使用默认密码 admin")
            password_hash_sha256 = hashlib.sha256('admin'.encode()).hexdigest()
        else:
            # 尝试验证是否为bcrypt加密的
            # 我们需要找到原始密码（SHA256）
            # 但是由于已经是bcrypt加密，我们无法逆向
            # 所以我们直接使用默认密码，并提示用户修改
            logger.warning("⚠️  检测到加密密码，但无法直接迁移")
            logger.warning("🔑 将重置为默认密码 admin，请立即登录并修改！")
            password_hash_sha256 = hashlib.sha256('admin'.encode()).hexdigest()
        
        # 创建用户
        success, message = user_db.create_user(
            username=username,
            password_sha256=password_hash_sha256,
            email=None,
            is_admin=True
        )
        
        if success:
            logger.info(f"✅ 管理员账户迁移成功: {username}")
            logger.warning("⚠️  密码已重置为: admin，请立即修改！")
            # 备份旧配置文件
            backup_file = ADMIN_CONFIG_FILE + '.backup'
            import shutil
            shutil.copy2(ADMIN_CONFIG_FILE, backup_file)
            logger.info(f"💾 旧配置已备份到: {backup_file}")
        else:
            logger.error(f"❌ 管理员账户迁移失败: {message}")
            
    except Exception as e:
        logger.exception(f"❌ 数据迁移失败: {str(e)}")


def save_rules():
    """保存规则到文件"""
    try:
        with open(RULES_FILE, 'w', encoding='utf-8') as f:
            json.dump(rules_db, f, ensure_ascii=False, indent=2)
        logger.info(f"💾 规则已保存: {RULES_FILE} ({len(rules_db)} 个网站)")
        return True
    except Exception as e:
        logger.error(f"❌ 保存规则失败: {str(e)}")
        return False


def deduplicate_rules():
    """去除rules_db中的重复规则"""
    global rules_db
    total_removed = 0
    
    def is_duplicate(rule1, rule2):
        """检查两条规则是否重复"""
        # 对于滑动验证码 (ocr_type=4)
        if rule1.get('ocr_type') == 4 and rule2.get('ocr_type') == 4:
            return (rule1.get('big_image') == rule2.get('big_image') and
                    rule1.get('small_image') == rule2.get('small_image') and
                    rule1.get('move_item') == rule2.get('move_item'))
        # 对于滑块行为验证码 (ocr_type=5)
        elif rule1.get('ocr_type') == 5 and rule2.get('ocr_type') == 5:
            return rule1.get('move_item') == rule2.get('move_item')
        # 对于英数字验证码 (ocr_type=1 或默认)
        elif rule1.get('ocr_type', 1) == 1 and rule2.get('ocr_type', 1) == 1:
            return (rule1.get('img') == rule2.get('img') and
                    rule1.get('input') == rule2.get('input'))
        return False
    
    for host, rules in rules_db.items():
        if not isinstance(rules, list) or len(rules) <= 1:
            continue
        
        # 去重
        unique_rules = []
        for rule in rules:
            is_dup = any(is_duplicate(rule, existing) for existing in unique_rules)
            if not is_dup:
                unique_rules.append(rule)
            else:
                total_removed += 1
        
        rules_db[host] = unique_rules
        
        if len(rules) != len(unique_rules):
            logger.info(f"🧽 {host}: 移除了 {len(rules) - len(unique_rules)} 条重复规则")
    
    if total_removed > 0:
        logger.info(f"✅ 总共移除 {total_removed} 条重复规则")
        save_rules()
    else:
        logger.info("✅ 没有发现重复规则")
    
    return total_removed


def save_api_keys():
    """保存 API Keys 到文件"""
    try:
        with open(APIKEY_FILE, 'w', encoding='utf-8') as f:
            json.dump(api_keys_db, f, ensure_ascii=False, indent=2)
        logger.debug(f"💾 API Keys 已保存: {APIKEY_FILE} ({len(api_keys_db)} 个)")
        return True
    except Exception as e:
        logger.error(f"❌ 保存 API Keys 失败: {str(e)}")
        return False


def hash_password(password):
    """使用 bcrypt 加密密码"""
    # 将密码转换为字节
    password_bytes = password.encode('utf-8')
    # 生成盐值并加密
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    # 返回字符串格式
    return hashed.decode('utf-8')


def verify_password(password, hashed_password):
    """验证密码是否匹配"""
    try:
        password_bytes = password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except (ValueError, TypeError) as e:
        logger.warning(f"⚠️ 密码验证失败: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"❌ 密码验证未知错误: {str(e)}")
        return False


def is_default_password(password_hash):
    """检测是否为默认密码（通过尝试验证admin来判断）"""
    # 如果是明文存储的旧密码，直接判断
    if password_hash == 'admin123' or password_hash == 'admin':
        return True
    # 尝试验证是否为加密后的默认密码
    try:
        return verify_password('admin', password_hash)
    except Exception as e:
        logger.warning(f"⚠️ 检测默认密码失败: {str(e)}")
        return False


def generate_api_key():
    """生成唯一的 API Key"""
    return 'sk_' + secrets.token_urlsafe(32)


def verify_api_key(api_key):
    """验证 API Key 是否有效"""
    return api_key in api_keys_db


def record_api_usage(api_key, ocr_type, host=None):
    """记录 API Key 使用统计"""
    if api_key not in api_keys_db:
        return
    
    stats = api_keys_db[api_key].get('stats', {'total': 0, 'types': {}, 'hosts': {}})
    
    # 总次数
    stats['total'] = stats.get('total', 0) + 1
    
    # 按类型统计
    type_name = str(ocr_type)
    stats['types'][type_name] = stats.get('types', {}).get(type_name, 0) + 1
    
    # 按网站统计
    if host:
        stats['hosts'][host] = stats.get('hosts', {}).get(host, 0) + 1
    
    # 更新最后使用时间
    api_keys_db[api_key]['last_used'] = datetime.now().isoformat()
    api_keys_db[api_key]['stats'] = stats
    
    # 保存到文件
    save_api_keys()


def require_admin_login(f):
    """管理员登录验证装饰器 - 使用JWT token"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # 跳过 OPTIONS 预检请求
        if request.method == 'OPTIONS':
            return '', 204
        
        # 从 Authorization header 获取 token
        auth_header = request.headers.get('Authorization')
        token = JWTManager.extract_token_from_header(auth_header)
        
        if not token:
            return jsonify({
                'code': 401,
                'description': '缺少认证token，请先登录'
            }), 401
        
        # 验证 token
        payload = JWTManager.verify_token(token)
        if not payload:
            return jsonify({
                'code': 401,
                'description': 'Token无效或已过期，请重新登录'
            }), 401
        
        # 检查是否为管理员
        if not payload.get('is_admin', False):
            return jsonify({
                'code': 403,
                'description': '权限不足，需要管理员权限'
            }), 403
        
        # 将用户信息添加到 request 对象，供后续使用
        request.current_user = payload
        return f(*args, **kwargs)
    
    return decorated_function


def require_api_key(f):
    """API Key 验证装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # 仅从 header 获取 API Key（安全要求）
        api_key = request.headers.get('X-API-Key')
        
        # 支持从 JSON body 中获取（向后兼容）
        if not api_key and request.is_json:
            api_key = request.json.get('api_key')
        
        # 不再支持URL参数传递API Key（安全考虑）
        # 警告：如果从URL参数传递，记录日志但不允许
        if request.args.get('api_key'):
            logger.warning(f"🚨 检测到从URL参数传递API Key，已拒绝 - IP: {request.remote_addr}")
            return jsonify({
                'valid': False,
                'description': 'API Key 不能通过URL参数传递，请使用请求头 X-API-Key'
            }), 401
        
        if not api_key:
            return jsonify({
                'valid': False,
                'description': '缺少 API Key，请在请求头中添加 X-API-Key（格式: X-API-Key: your_api_key）'
            }), 401
        
        if not verify_api_key(api_key):
            logger.warning(f"🚨 无效的API Key尝试 - IP: {request.remote_addr}")
            return jsonify({
                'valid': False,
                'description': 'API Key 无效或已过期'
            }), 403
        
        # 将 api_key 添加到 request 对象中，供后续使用
        request.api_key = api_key
        return f(*args, **kwargs)
    
    return decorated_function


def get_ocr():
    """懒加载OCR实例"""
    global ocr_instance
    if ocr_instance is None:
        try:
            import ddddocr
            ocr_instance = ddddocr.DdddOcr(show_ad=False)
            logger.info("✅ ddddocr 英数识别模型加载成功")
        except ImportError:
            logger.error("❌ 未安装 ddddocr，请运行: pip install ddddocr")
            return None
    return ocr_instance


def get_slide_ocr():
    """懒加载滑块识别实例"""
    global slide_instance
    
    # 临时方案：每次都创建新实例，避免状态污染
    # TODO: 如果性能问题明显，需要调查ddddocr的状态管理
    try:
        import ddddocr
        logger.info("🔧 [DEBUG] 创建新的 ddddocr 滑块实例")
        slide_instance = ddddocr.DdddOcr(det=False, ocr=False, show_ad=False)
        logger.info("✅ [DEBUG] ddddocr 滑块识别模型加载成功")
        return slide_instance
    except ImportError:
        logger.error("❌ 未安装 ddddocr，请运行: pip install ddddocr")
        return None
    except Exception as e:
        logger.error(f"❌ [DEBUG] 创建 ddddocr 实例失败: {str(e)}")
        return None


def base64_to_image(base64_str):
    """将base64字符串转换为PIL Image对象"""
    try:
        # 移除可能的前缀
        if ',' in base64_str:
            base64_str = base64_str.split(',')[1]
        
        img_data = base64.b64decode(base64_str)
        byte_stream = io.BytesIO(img_data)
        img = Image.open(byte_stream)
        # 加载图片数据到内存，然后关闭流
        img.load()
        byte_stream.close()
        return img
    except Exception as e:
        logger.error(f"❌ Base64转图片失败: {str(e)}")
        return None


def recognize_text_captcha(img_base64):
    """识别英数验证码"""
    ocr = get_ocr()
    if ocr is None:
        return None
    
    try:
        img = base64_to_image(img_base64)
        if img is None:
            return None
        
        # 转换为字节流供ddddocr使用
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='PNG')
        img_bytes = img_byte_arr.getvalue()
        
        # OCR识别
        result = ocr.classification(img_bytes)
        return result
    except Exception as e:
        logger.error(f"❌ OCR识别失败: {str(e)}")
        return None


def recognize_slide_captcha(big_img_base64, small_img_base64):
    """识别滑动拼图验证码，返回滑动距离"""
    logger.info("🔧 [DEBUG] 开始滑块识别流程")
    
    slide = get_slide_ocr()
    if slide is None:
        logger.error("❌ [DEBUG] 获取滑块OCR实例失败")
        return None
    
    logger.info("✅ [DEBUG] 滑块OCR实例获取成功")
    
    big_byte_arr = None
    small_byte_arr = None
    
    try:
        # 转换图片
        logger.info("🔧 [DEBUG] 开始转换base64图片")
        big_img = base64_to_image(big_img_base64)
        small_img = base64_to_image(small_img_base64)
        
        if big_img is None or small_img is None:
            logger.error("❌ [DEBUG] 图片转换失败")
            return None
        
        logger.info(f"✅ [DEBUG] 图片转换成功 - 大图: {big_img.size}, 小图: {small_img.size}")
        
        # 转换为字节流
        logger.info("🔧 [DEBUG] 开始转换为字节流")
        big_byte_arr = io.BytesIO()
        big_img.save(big_byte_arr, format='PNG')
        big_bytes = big_byte_arr.getvalue()
        logger.info(f"✅ [DEBUG] 大图字节流: {len(big_bytes)} bytes")
        
        small_byte_arr = io.BytesIO()
        small_img.save(small_byte_arr, format='PNG')
        small_bytes = small_byte_arr.getvalue()
        logger.info(f"✅ [DEBUG] 小图字节流: {len(small_bytes)} bytes")
        
        # 识别滑动距离
        logger.info("🔧 [DEBUG] 调用 slide.slide_match()")
        result = slide.slide_match(small_bytes, big_bytes, simple_target=True)
        logger.info(f"✅ [DEBUG] slide_match 返回: {result}")
        
        distance = result.get('target', [0])[0] if result else 0
        logger.info(f"✅ [DEBUG] 计算得到距离: {distance}")
        
        return distance
        
    except Exception as e:
        logger.error(f"❌ [DEBUG] 滑块识别失败: {str(e)}")
        import traceback
        logger.error(f"❌ [DEBUG] 堆栈跟踪:\n{traceback.format_exc()}")
        return None
    finally:
        logger.info("🔧 [DEBUG] 执行资源清理")
        # 确保资源被释放
        if big_byte_arr is not None:
            big_byte_arr.close()
            logger.info("✅ [DEBUG] 大图字节流已关闭")
        if small_byte_arr is not None:
            small_byte_arr.close()
            logger.info("✅ [DEBUG] 小图字节流已关闭")


@app.route('/hello', methods=['POST', 'OPTIONS'])
@rate_limit(max_requests=100, time_window=60, key_func=get_api_key_identifier)  # 每分钟最多100次
@require_api_key
def identify_captcha():
    """验证码识别接口 - 兼容原脚本"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        data = request.json
        ocr_type = data.get('ocr_type', 1)
        host = data.get('host', 'unknown')
        
        # 记录 API 使用统计
        record_api_usage(request.api_key, ocr_type, host)
        
        logger.info(f"🔍 收到识别请求 - 类型: {ocr_type}, 网站: {host}")
        
        # 英数验证码识别
        if ocr_type == 1:
            img_base64 = data.get('img')
            if not img_base64:
                return jsonify({
                    'valid': False,
                    'description': '缺少验证码图片数据'
                }), 400
            
            start_time = time.time()
            result = recognize_text_captcha(img_base64)
            duration = time.time() - start_time
            
            # 记录识别历史
            try:
                # 获取API Key名称
                api_key_name = api_keys_db.get(request.api_key, {}).get('name', '未知')
                
                recognition_history.add_record({
                    'ocr_type': ocr_type,
                    'host': host,
                    'model': model_manager.get_current_model(),
                    'success': result is not None,
                    'result': result if result else None,
                    'duration': duration,
                    'preprocessing': model_manager.get_enabled_preprocessing(),
                    'api_key': request.api_key,
                    'api_key_name': api_key_name
                })
            except Exception as e:
                logger.warning(f"⚠️  记录识别历史失败: {str(e)}")
            
            if result:
                logger.info(f"✅ 识别结果: {result} (耗时: {duration:.2f}s)")
                return jsonify({
                    'valid': True,
                    'data': result,
                    'description': '验证码识别完成',
                    'showTime': 2000
                })
            else:
                return jsonify({
                    'valid': False,
                    'description': 'OCR识别失败，请检查ddddocr是否安装'
                }), 500
        
        # 滑动拼图验证码识别
        elif ocr_type == 4:
            big_img = data.get('big_image')
            small_img = data.get('small_image')
            
            if not big_img or not small_img:
                return jsonify({
                    'valid': False,
                    'description': '缺少大图或小图数据'
                }), 400
            
            start_time = time.time()
            distance = recognize_slide_captcha(big_img, small_img)
            duration = time.time() - start_time
            
            logger.info(f"🔧 [DEBUG] recognize_slide_captcha 返回距离: {distance}")
            
            # 记录识别历史
            logger.info("🔧 [DEBUG] 准备记录识别历史")
            try:
                # 获取API Key名称
                api_key_name = api_keys_db.get(request.api_key, {}).get('name', '未知')
                
                logger.info("🔧 [DEBUG] 调用 recognition_history.add_record()")
                recognition_history.add_record({
                    'ocr_type': ocr_type,
                    'host': host,
                    'model': model_manager.get_current_model(),
                    'success': distance is not None,
                    'result': str(distance) if distance is not None else None,
                    'duration': duration,
                    'preprocessing': model_manager.get_enabled_preprocessing(),
                    'api_key': request.api_key,
                    'api_key_name': api_key_name
                })
                logger.info("✅ [DEBUG] 识别历史记录成功")
            except Exception as e:
                logger.warning(f"⚠️  记录识别历史失败: {str(e)}")
                import traceback
                logger.error(f"⚠️  [DEBUG] 堆栈: {traceback.format_exc()}")
            
            if distance is not None:
                logger.info(f"✅ 滑动距离: {distance}px (耗时: {duration:.2f}s)")
                return jsonify({
                    'valid': True,
                    'data': str(distance),
                    'description': '滑块识别完成',
                    'showTime': 2000
                })
            else:
                return jsonify({
                    'valid': False,
                    'description': '滑块识别失败'
                }), 500
        
        # 滑块行为验证码
        elif ocr_type == 5:
            width = data.get('small_image_width', 280)
            # 简单算法：滑动到80-90%位置
            distance = int(width * 0.85)
            
            # 记录识别历史
            try:
                # 获取API Key名称
                api_key_name = api_keys_db.get(request.api_key, {}).get('name', '未知')
                
                recognition_history.add_record({
                    'ocr_type': ocr_type,
                    'host': host,
                    'model': 'behavior_algorithm',
                    'success': True,
                    'result': str(distance),
                    'duration': 0.001,  # 行为算法非常快
                    'preprocessing': [],
                    'api_key': request.api_key,
                    'api_key_name': api_key_name
                })
            except Exception as e:
                logger.warning(f"⚠️  记录识别历史失败: {str(e)}")
            
            logger.info(f"✅ 滑块行为距离: {distance}px (宽度: {width}px)")
            return jsonify({
                'valid': True,
                'data': str(distance),
                'description': '滑块行为识别完成',
                'showTime': 2000
            })
        
        else:
            return jsonify({
                'valid': False,
                'description': f'不支持的验证码类型: {ocr_type}'
            }), 400
            
    except Exception as e:
        logger.exception(f"❌ 处理请求失败: {str(e)}")
        return jsonify({
            'valid': False,
            'description': f'服务器错误: {str(e)}'
        }), 500


@app.route('/admin/login', methods=['POST', 'OPTIONS'])
@rate_limit(max_requests=5, time_window=60)  # 登录接口：每分钟最多5次（防暴力破解）
@check_login_lock  # 检查登录锁定
def admin_login():
    """管理员登录 - 使用JWT token认证"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        data = request.json
        username = data.get('username')
        password_sha256 = data.get('password')  # 前端传来的已是SHA256加密后的
        
        if not username or not password_sha256:
            return jsonify({
                'code': 400,
                'description': '用户名和密码不能为空'
            }), 400
        
        # 使用新的认证系统
        user = user_db.authenticate(username, password_sha256)
        
        if not user:
            # 记录登录失败
            locked, count = security_manager.record_login_failure()
            
            print(f"⚠️  登录失败: {username} (账号或密码错误)")
            
            if locked:
                return jsonify({
                    'code': 429,
                    'description': f'登录失败次数过多，账号已被锁定 {count} 秒'
                }), 429
            
            return jsonify({
                'code': 401,
                'description': f'用户名或密码错误 (剩余尝试次数: {security_manager.config["max_login_failures"] - count})'
            }), 401
        
        # 检查账户是否启用
        if not user.get('is_active', False):
            return jsonify({
                'code': 403,
                'description': '账号已被禁用'
            }), 403
        
        # 登录成功，清除失败记录
        security_manager.clear_login_failures()
        
        # 🔐 修复会话固定攻击：清除旧的session数据，生成新的session_id
        session.permanent = True
        session.clear()  # 清除旧的session数据
        # 通过修改session强制生成新的session_id
        session['_new_session'] = True
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['login_time'] = datetime.now().isoformat()
        
        # 🔐 检查是否为默认密码：通过数据库标记判断
        is_default_password = False
        try:
            # 从数据库获取完整用户信息（包含 password_changed 标记）
            cursor = user_db._get_connection().cursor()
            cursor.execute('''
                SELECT password_changed, created_at FROM users WHERE id = ?
            ''', (user['id'],))
            user_info = cursor.fetchone()
            
            if user_info:
                password_changed = user_info[0] if user_info[0] is not None else 0
                is_default_password = (password_changed == 0)
                
                if is_default_password:
                    logger.warning(f"⚠️  用户 {username} 使用默认密码，强制要求修改")
        except Exception as e:
            logger.warning(f"检查默认密码失败: {str(e)}")
        
        # 生成 JWT token
        token = JWTManager.generate_token(
            user_id=user['id'],
            username=user['username'],
            is_admin=bool(user.get('is_admin', 0))
        )
        
        # 生成 CSRF token
        csrf_token = security_manager.generate_csrf_token()
        
        logger.info(f"✅ 管理员登录成功: {username}, session已重新生成")
        
        return jsonify({
            'code': 200,
            'description': '登录成功',
            'data': {
                'user_id': user['id'],
                'username': user['username'],
                'is_admin': bool(user.get('is_admin', 0)),
                'token': token,
                'csrf_token': csrf_token,
                'login_time': user.get('last_login'),
                'is_default_password': is_default_password
            }
        })
            
    except Exception as e:
        logger.exception(f"❌ 登录失败: {str(e)}")
        return jsonify({
            'code': 500,
            'description': f'登录失败: {str(e)}'
        }), 500


@app.route('/admin/logout', methods=['POST', 'OPTIONS'])
def admin_logout():
    """管理员登出"""
    if request.method == 'OPTIONS':
        return '', 204
    
    username = session.get('admin_username', 'unknown')
    session.clear()
    print(f"🚺 管理员登出: {username}")
    
    return jsonify({
        'code': 200,
        'description': '登出成功'
    })


@app.route('/admin/change-password', methods=['POST', 'OPTIONS'])
@require_admin_login
def change_password():
    """修改管理员密码 - 使用新数据库"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        data = request.json
        old_password_sha256 = data.get('old_password')  # 旧密码SHA256
        new_password_sha256 = data.get('new_password')  # 新密码SHA256
        
        if not old_password_sha256 or not new_password_sha256:
            return jsonify({
                'code': 400,
                'description': '旧密码和新密码不能为空'
            }), 400
        
        # 从 token 获取当前用户ID
        user_id = request.current_user.get('user_id')
        
        print(f"🔑 用户 {user_id} 请求修改密码")
        
        # 使用新数据库修改密码
        success, message = user_db.change_password(
            user_id=user_id,
            old_password_sha256=old_password_sha256,
            new_password_sha256=new_password_sha256
        )
        
        if success:
            print(f"✅ 用户 {user_id} 密码修改成功")
            return jsonify({
                'code': 200,
                'description': message
            })
        else:
            print(f"⚠️  用户 {user_id} 密码修改失败: {message}")
            return jsonify({
                'code': 401 if '旧密码' in message else 500,
                'description': message
            }), 401 if '旧密码' in message else 500
            
    except Exception as e:
        print(f"❌ 修改密码失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'code': 500,
            'description': f'修改密码失败: {str(e)}'
        }), 500


@app.route('/admin/status', methods=['GET', 'OPTIONS'])
def admin_status():
    """检查登录状态 - 使用JWT token"""
    if request.method == 'OPTIONS':
        return '', 204
    
    # 从 Authorization header 获取 token
    auth_header = request.headers.get('Authorization')
    token = JWTManager.extract_token_from_header(auth_header)
    
    if not token:
        return jsonify({
            'code': 401,
            'logged_in': False,
            'description': '缺少认证token'
        })
    
    # 验证 token
    payload = JWTManager.verify_token(token)
    if not payload:
        return jsonify({
            'code': 401,
            'logged_in': False,
            'description': 'Token无效或已过期'
        })
    
    # 返回用户信息
    return jsonify({
        'code': 200,
        'logged_in': True,
        'user_id': payload.get('user_id'),
        'username': payload.get('username'),
        'is_admin': payload.get('is_admin', False)
    })


@app.route('/admin/config', methods=['GET', 'OPTIONS'])
def get_system_config():
    """获取系统配置（公开接口，前端需要调用）"""
    if request.method == 'OPTIONS':
        return '', 204
    
    return jsonify({
        'code': 200,
        'data': {
            'hitokoto_api': admin_config.get('hitokoto_api', ''),
            'background_api': admin_config.get('background_api', '')
        }
    })


@app.route('/admin/config', methods=['PUT'])
@require_admin_login
def update_system_config():
    """更新系统配置"""
    try:
        data = request.json
        
        if 'hitokoto_api' in data:
            admin_config['hitokoto_api'] = data['hitokoto_api'].strip()
        
        if 'background_api' in data:
            admin_config['background_api'] = data['background_api'].strip()
        
        # 保存到文件
        if save_admin_config():
            logger.info(f"✅ 系统配置已更新: {session.get('admin_username')}")
            return jsonify({
                'code': 200,
                'description': '配置保存成功'
            })
        else:
            return jsonify({
                'code': 500,
                'description': '配置保存失败'
            }), 500
            
    except Exception as e:
        logger.error(f"❌ 更新配置失败: {str(e)}")
        return jsonify({
            'code': 500,
            'description': f'配置更新失败: {str(e)}'
        }), 500


@app.route('/captchaHostQuery', methods=['POST', 'OPTIONS'])
@rate_limit(max_requests=200, time_window=60)  # 规则查询：每分钟最多200次
def query_rules():
    """查询验证码规则"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        data = request.json
        host = data.get('host')
        
        if host in rules_db:
            print(f"📋 找到规则: {host}")
            return jsonify({
                'code': 531,
                'data': rules_db[host]
                # 移除description，避免前端弹出无用提示
            })
        else:
            print(f"🔍 新网站，启动自动识别: {host}")
            return jsonify({
                'code': 533
                # 移除description，避免前端弹出无用提示
            })
    except Exception as e:
        return jsonify({
            'code': 500,
            'description': f'查询失败: {str(e)}'
        }), 500


@app.route('/captchaHostAdd', methods=['POST', 'OPTIONS'])
@rate_limit(max_requests=50, time_window=60)  # 添加规则：每分钟最多50次
def add_rules():
    """添加验证码规则"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        data = request.json
        host = data.get('host')
        
        if not host:
            return jsonify({
                'code': 400,
                'description': '缺少host参数'
            }), 400
        
        # 如果type为0，表示黑名单
        if data.get('type') == 0:
            rules_db[host] = []
            print(f"🚫 添加黑名单: {host}")
            
            # 保存到文件
            save_rules()
            
            return jsonify({
                'code': 530,
                'description': '已添加到黑名单'
            })
        
        # 添加或更新规则
        if host not in rules_db:
            rules_db[host] = []
        
        # 检查是否已存在相同规则（根据关键字段判断）
        def is_duplicate(existing_rule, new_rule):
            """检查规则是否重复"""
            # 对于滑动验证码 (ocr_type=4)
            if new_rule.get('ocr_type') == 4:
                return (existing_rule.get('big_image') == new_rule.get('big_image') and
                        existing_rule.get('small_image') == new_rule.get('small_image') and
                        existing_rule.get('move_item') == new_rule.get('move_item'))
            # 对于滑块行为验证码 (ocr_type=5)
            elif new_rule.get('ocr_type') == 5:
                return existing_rule.get('move_item') == new_rule.get('move_item')
            # 对于英数字验证码 (ocr_type=1)
            else:
                return (existing_rule.get('img') == new_rule.get('img') and
                        existing_rule.get('input') == new_rule.get('input'))
        
        # 检查是否存在重复
        is_dup = any(is_duplicate(rule, data) for rule in rules_db[host])
        
        if is_dup:
            print(f"⚠️  规则已存在，跳过添加: {host}")
            return jsonify({
                'code': 200,
                'description': '规则已存在'
            })
        
        rules_db[host].append(data)
        print(f"✅ 添加规则成功: {host}")
        
        # 保存到文件
        save_rules()
        
        return jsonify({
            'code': 200,
            'description': '规则添加成功'
        })
    except Exception as e:
        return jsonify({
            'code': 500,
            'description': f'添加失败: {str(e)}'
        }), 500


@app.route('/captchaHostDel', methods=['POST', 'OPTIONS'])
@rate_limit(max_requests=50, time_window=60)  # 删除规则：每分钟最多50次
def delete_rules():
    """删除验证码规则"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        data = request.json
        host = data.get('host')
        
        if host in rules_db:
            del rules_db[host]
            print(f"🗑️  删除规则: {host}")
            
            # 保存到文件
            save_rules()
            
            return jsonify({
                'code': 200,
                'description': '规则删除成功'
            })
        else:
            return jsonify({
                'code': 404,
                'description': '未找到规则'
            })
    except Exception as e:
        return jsonify({
            'code': 500,
            'description': f'删除失败: {str(e)}'
        }), 500


@app.route('/rules/update', methods=['POST', 'OPTIONS'])
@require_admin_login
def update_rule():
    """更新单条规则"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        data = request.json
        host = data.get('host')
        index = data.get('index')  # 规则索引
        rule_data = data.get('rule')  # 新的规则数据
        
        if not host or index is None or not rule_data:
            return jsonify({
                'code': 400,
                'description': '缺少必要参数'
            }), 400
        
        if host not in rules_db:
            return jsonify({
                'code': 404,
                'description': '未找到该网站规则'
            }), 404
        
        if index < 0 or index >= len(rules_db[host]):
            return jsonify({
                'code': 404,
                'description': '规则索引无效'
            }), 404
        
        # 更新规则
        rules_db[host][index] = rule_data
        print(f"✏️  更新规则: {host}[{index}]")
        
        # 保存到文件
        save_rules()
        
        return jsonify({
            'code': 200,
            'description': '规则更新成功'
        })
    except Exception as e:
        return jsonify({
            'code': 500,
            'description': f'更新失败: {str(e)}'
        }), 500


@app.route('/rules/delete-single', methods=['POST', 'OPTIONS'])
@require_admin_login
def delete_single_rule():
    """删除单条规则"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        data = request.json
        host = data.get('host')
        index = data.get('index')  # 规则索引
        
        if not host or index is None:
            return jsonify({
                'code': 400,
                'description': '缺少必要参数'
            }), 400
        
        if host not in rules_db:
            return jsonify({
                'code': 404,
                'description': '未找到该网站规则'
            }), 404
        
        if index < 0 or index >= len(rules_db[host]):
            return jsonify({
                'code': 404,
                'description': '规则索引无效'
            }), 404
        
        # 删除规则
        deleted_rule = rules_db[host].pop(index)
        print(f"🗑️  删除规则: {host}[{index}]")
        
        # 如果该网站没有规则了，删除整个host
        if len(rules_db[host]) == 0:
            del rules_db[host]
            print(f"🗑️  网站 {host} 已无规则，已删除")
        
        # 保存到文件
        save_rules()
        
        return jsonify({
            'code': 200,
            'description': '规则删除成功'
        })
    except Exception as e:
        return jsonify({
            'code': 500,
            'description': f'删除失败: {str(e)}'
        }), 500


@app.route('/rules/import', methods=['POST', 'OPTIONS'])
@require_admin_login
def import_rules():
    """导入规则"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        data = request.json
        imported_rules = data.get('rules')  # 导入的规则数据
        mode = data.get('mode', 'merge')  # 导入模式：merge 或 replace
        
        if not imported_rules:
            return jsonify({
                'code': 400,
                'description': '缺少规则数据'
            }), 400
        
        if not isinstance(imported_rules, dict):
            return jsonify({
                'code': 400,
                'description': '规则格式错误'
            }), 400
        
        global rules_db
        
        if mode == 'replace':
            # 覆盖模式：直接替换
            rules_db = imported_rules
            print(f"📥 覆盖导入规则，共 {len(rules_db)} 个网站")
        else:
            # 合并模式：合并规则
            for host, rules in imported_rules.items():
                if host in rules_db:
                    # 网站已存在，合并规则（去重）
                    existing_rules = rules_db[host]
                    for rule in rules:
                        # 简单去重：检查是否已存在相同规则
                        if rule not in existing_rules:
                            existing_rules.append(rule)
                else:
                    # 新网站，直接添加
                    rules_db[host] = rules
            print(f"📥 合并导入规则，当前共 {len(rules_db)} 个网站")
        
        # 保存到文件
        save_rules()
        
        return jsonify({
            'code': 200,
            'description': f'规则导入成功（{mode}模式）',
            'count': len(rules_db)
        })
    except Exception as e:
        return jsonify({
            'code': 500,
            'description': f'导入失败: {str(e)}'
        }), 500


@app.route('/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({
        'status': 'running',
        'timestamp': int(time.time()),
        'ocr_loaded': ocr_instance is not None,
        'slide_loaded': slide_instance is not None,
        'rules_count': len(rules_db)
    })


@app.route('/rules', methods=['GET'])
@require_admin_login
def get_all_rules():
    """获取所有规则（用于备份和查看）"""
    return jsonify({
        'code': 200,
        'count': len(rules_db),
        'rules': rules_db,
        'file_path': RULES_FILE
    })


@app.route('/rules/export', methods=['GET'])
@require_admin_login
def export_rules():
    """导出规则文件（直接返回JSON文件）"""
    from flask import send_file
    if os.path.exists(RULES_FILE):
        return send_file(RULES_FILE, 
                        mimetype='application/json',
                        as_attachment=True,
                        download_name='captcha_rules_backup.json')
    else:
        return jsonify({
            'code': 404,
            'description': '规则文件不存在'
        }), 404


# ==============================================
# API Key 管理接口
# ==============================================

@app.route('/api-keys', methods=['GET'])
@require_admin_login
def get_api_keys():
    """获取所有 API Keys（不显示完整密钥）"""
    keys_info = []
    for api_key, info in api_keys_db.items():
        # 隐藏部分密钥内容
        masked_key = api_key[:8] + '...' + api_key[-4:] if len(api_key) > 12 else api_key
        
        keys_info.append({
            'key': masked_key,
            'full_key': api_key,  # 为管理界面保留完整key，实际使用中可能需要隐藏
            'name': info.get('name', ''),
            'created_at': info.get('created_at', ''),
            'last_used': info.get('last_used', '从未使用'),
            'stats': info.get('stats', {'total': 0, 'types': {}, 'hosts': {}})
        })
    
    return jsonify({
        'code': 200,
        'count': len(keys_info),
        'keys': keys_info
    })


@app.route('/api-keys', methods=['POST'])
@require_admin_login
def create_api_key():
    """创建新的 API Key"""
    try:
        data = request.json or {}
        name = data.get('name', '无名称')
        
        # 生成新的 API Key
        api_key = generate_api_key()
        
        # 保存到数据库
        api_keys_db[api_key] = {
            'name': name,
            'created_at': datetime.now().isoformat(),
            'last_used': None,
            'stats': {
                'total': 0,
                'types': {},
                'hosts': {}
            }
        }
        
        # 保存到文件
        save_api_keys()
        
        print(f"✨ 创建新 API Key: {name}")
        
        return jsonify({
            'code': 200,
            'description': 'API Key 创建成功',
            'api_key': api_key,
            'name': name
        })
    except Exception as e:
        return jsonify({
            'code': 500,
            'description': f'创建失败: {str(e)}'
        }), 500


@app.route('/api-keys/<api_key>', methods=['DELETE'])
@require_admin_login
def delete_api_key(api_key):
    """删除 API Key"""
    if api_key not in api_keys_db:
        return jsonify({
            'code': 404,
            'description': '未找到该 API Key'
        }), 404
    
    try:
        name = api_keys_db[api_key].get('name', '无名称')
        del api_keys_db[api_key]
        save_api_keys()
        
        print(f"🗑️ 删除 API Key: {name}")
        
        return jsonify({
            'code': 200,
            'description': 'API Key 删除成功'
        })
    except Exception as e:
        return jsonify({
            'code': 500,
            'description': f'删除失败: {str(e)}'
        }), 500


@app.route('/api-keys/<api_key>/stats', methods=['GET'])
@require_admin_login
def get_api_key_stats(api_key):
    """获取指定 API Key 的统计信息"""
    if api_key not in api_keys_db:
        return jsonify({
            'code': 404,
            'description': '未找到该 API Key'
        }), 404
    
    key_info = api_keys_db[api_key]
    stats = key_info.get('stats', {'total': 0, 'types': {}, 'hosts': {}})
    
    # 类型名称映射
    type_names = {
        '1': '英数验证码',
        '4': '滑动拼图验证码',
        '5': '滑块行为验证码'
    }
    
    formatted_types = {}
    for type_id, count in stats.get('types', {}).items():
        type_name = type_names.get(type_id, f'类型{type_id}')
        formatted_types[type_name] = count
    
    return jsonify({
        'code': 200,
        'name': key_info.get('name', ''),
        'created_at': key_info.get('created_at', ''),
        'last_used': key_info.get('last_used', '从未使用'),
        'stats': {
            'total': stats.get('total', 0),
            'types': formatted_types,
            'hosts': stats.get('hosts', {})
        }
    })


@app.route('/api-keys/stats/summary', methods=['GET'])
@require_admin_login
def get_api_keys_summary():
    """获取所有 API Key 的统计概要"""
    total_keys = len(api_keys_db)
    total_requests = 0
    active_keys = 0
    type_summary = {}
    host_summary = {}
    
    for api_key, info in api_keys_db.items():
        stats = info.get('stats', {})
        key_total = stats.get('total', 0)
        
        total_requests += key_total
        
        if key_total > 0:
            active_keys += 1
        
        # 统计类型
        for type_id, count in stats.get('types', {}).items():
            type_summary[type_id] = type_summary.get(type_id, 0) + count
        
        # 统计网站
        for host, count in stats.get('hosts', {}).items():
            host_summary[host] = host_summary.get(host, 0) + count
    
    # 类型名称映射
    type_names = {
        '1': '英数验证码',
        '4': '滑动拼图验证码',
        '5': '滑块行为验证码'
    }
    
    formatted_types = {}
    for type_id, count in type_summary.items():
        type_name = type_names.get(type_id, f'类型{type_id}')
        formatted_types[type_name] = count
    
    return jsonify({
        'code': 200,
        'summary': {
            'total_keys': total_keys,
            'active_keys': active_keys,
            'total_requests': total_requests,
            'type_usage': formatted_types,
            'host_usage': host_summary
        }
    })


# ==============================================
# 识别历史管理接口
# ==============================================

@app.route('/history/stats', methods=['GET'])
@require_admin_login
def get_history_stats():
    """获取识别历史统计数据"""
    try:
        # 获取时间范围参数（秒）
        time_range = request.args.get('time_range', type=int)
        
        # 获取统计数据
        stats = recognition_history.get_stats(time_range=time_range)
        
        return jsonify({
            'code': 200,
            'data': stats  # 修改为data，与前端保持一致
        })
    except Exception as e:
        logger.error(f"❌ 获取历史统计失败: {str(e)}")
        return jsonify({
            'code': 500,
            'description': f'获取统计失败: {str(e)}'
        }), 500


@app.route('/history/records', methods=['GET'])
@require_admin_login
def get_history_records():
    """获取识别历史记录"""
    try:
        # 获取查询参数
        limit = request.args.get('limit', 50, type=int)
        ocr_type = request.args.get('ocr_type', type=int)
        host = request.args.get('host', type=str)
        api_key = request.args.get('api_key', type=str)
        status = request.args.get('status', type=str)  # 'success' 或 'failed'
        start_date = request.args.get('start_date', type=float)  # 时间戳
        end_date = request.args.get('end_date', type=float)  # 时间戳
        
        # 获取历史记录
        records = recognition_history.get_recent_records(
            limit=limit,
            ocr_type=ocr_type,
            host=host,
            api_key=api_key,
            status=status,
            start_date=start_date,
            end_date=end_date
        )
        
        # 获取筛选后的统计数据
        filtered_stats = recognition_history.get_filtered_stats(
            ocr_type=ocr_type,
            host=host,
            api_key=api_key,
            status=status,
            start_date=start_date,
            end_date=end_date
        )
        
        return jsonify({
            'code': 200,
            'count': len(records),
            'data': records,
            'stats': filtered_stats  # 返回筛选后的统计数据
        })
    except Exception as e:
        logger.error(f"❌ 获取历史记录失败: {str(e)}")
        return jsonify({
            'code': 500,
            'description': f'获取记录失败: {str(e)}'
        }), 500


@app.route('/history/filters', methods=['GET'])
@require_admin_login
def get_history_filters():
    """获取历史记录的所有可用筛选项"""
    try:
        # 获取所有记录
        all_records = recognition_history.get_recent_records(limit=10000)  # 获取足够多的记录
        
        # 提取唯一值
        hosts = sorted(set(r.get('host', 'unknown') for r in all_records))
        api_keys = sorted(set(r.get('api_key', 'unknown') for r in all_records))
        api_key_names = sorted(set(r.get('api_key_name', 'unknown') for r in all_records))
        
        # 构建 API Key 映射（名称 -> key）
        api_key_map = {}
        for r in all_records:
            key = r.get('api_key')
            name = r.get('api_key_name')
            if key and name:
                api_key_map[name] = key
        
        return jsonify({
            'code': 200,
            'data': {
                'hosts': hosts,
                'api_keys': [{'key': api_key_map.get(name, name), 'name': name} 
                            for name in api_key_names if name != 'unknown'],
                'types': [
                    {'value': 1, 'label': '英数验证码'},
                    {'value': 4, 'label': '滑动拼图'},
                    {'value': 5, 'label': '滑块行为'}
                ],
                'statuses': [
                    {'value': 'success', 'label': '成功'},
                    {'value': 'failed', 'label': '失败'}
                ]
            }
        })
    except Exception as e:
        logger.error(f"❌ 获取筛选选项失败: {str(e)}")
        return jsonify({
            'code': 500,
            'description': f'获取失败: {str(e)}'
        }), 500


@app.route('/history/clear', methods=['POST'])
@require_admin_login
def clear_history():
    """清除所有识别历史"""
    try:
        recognition_history.clear_history()
        logger.info(f"🗑️ 管理员清除了识别历史")
        
        return jsonify({
            'code': 200,
            'description': '历史记录已清除'
        })
    except Exception as e:
        logger.error(f"❌ 清除历史失败: {str(e)}")
        return jsonify({
            'code': 500,
            'description': f'清除失败: {str(e)}'
        }), 500


# ==============================================
# 模型管理接口
# ==============================================

@app.route('/models', methods=['GET'])
@require_admin_login
def get_models():
    """获取所有可用模型"""
    try:
        models = model_manager.get_models()
        current_model = model_manager.get_current_model()
        
        return jsonify({
            'code': 200,
            'current_model': current_model,
            'models': models
        })
    except Exception as e:
        logger.error(f"❌ 获取模型列表失败: {str(e)}")
        return jsonify({
            'code': 500,
            'description': f'获取模型失败: {str(e)}'
        }), 500


@app.route('/models/current', methods=['PUT'])
@require_admin_login
def set_current_model():
    """设置当前使用的模型"""
    try:
        data = request.json
        model_name = data.get('model_name')
        
        if not model_name:
            return jsonify({
                'code': 400,
                'description': '缺少模型名称'
            }), 400
        
        success = model_manager.set_current_model(model_name)
        
        if success:
            return jsonify({
                'code': 200,
                'description': '模型切换成功'
            })
        else:
            return jsonify({
                'code': 404,
                'description': '模型不存在'
            }), 404
            
    except Exception as e:
        logger.error(f"❌ 切换模型失败: {str(e)}")
        return jsonify({
            'code': 500,
            'description': f'切换失败: {str(e)}'
        }), 500


@app.route('/models/preprocessing', methods=['GET'])
@require_admin_login
def get_preprocessing_options():
    """获取图片预处理选项"""
    try:
        options = model_manager.get_preprocessing_options()
        
        return jsonify({
            'code': 200,
            'options': options
        })
    except Exception as e:
        logger.error(f"❌ 获取预处理选项失败: {str(e)}")
        return jsonify({
            'code': 500,
            'description': f'获取失败: {str(e)}'
        }), 500


@app.route('/models/preprocessing', methods=['PUT'])
@require_admin_login
def update_preprocessing_option():
    """更新图片预处理选项"""
    try:
        data = request.json
        option_name = data.get('option_name')
        enabled = data.get('enabled', False)
        
        if not option_name:
            return jsonify({
                'code': 400,
                'description': '缺少选项名称'
            }), 400
        
        success = model_manager.update_preprocessing(option_name, enabled)
        
        if success:
            return jsonify({
                'code': 200,
                'description': '预处理选项更新成功'
            })
        else:
            return jsonify({
                'code': 404,
                'description': '预处理选项不存在'
            }), 404
            
    except Exception as e:
        logger.error(f"❌ 更新预处理选项失败: {str(e)}")
        return jsonify({
            'code': 500,
            'description': f'更新失败: {str(e)}'
        }), 500


@app.route('/', methods=['GET'])
@rate_limit(max_requests=100, time_window=60)  # 允许每分钟 100 次访问（页面加载）
def index():
    """首页 - 使用模板系统（前后端分离）"""
    return render_template('index.html',
                         server_url='http://localhost:1205',
                         hitokoto_api=admin_config.get('hitokoto_api', ''),
                         background_api=admin_config.get('background_api', ''))


# ==========================================
# 旧版路由已删除（原 4000+ 行内嵌 HTML）
# 新版使用模板系统，详见 templates/index.html
# ==========================================


# ==========================================
# 安全管理 API
# ==========================================

@app.route('/security/stats', methods=['GET'])
@require_admin_login
def get_security_stats():
    """获取安全统计信息"""
    try:
        stats = security_manager.get_stats()
        return jsonify({
            'code': 200,
            'data': stats
        })
    except Exception as e:
        return jsonify({
            'code': 500,
            'description': f'获取统计失败: {str(e)}'
        }), 500


@app.route('/security/whitelist', methods=['GET', 'POST', 'DELETE'])
@require_admin_login
def manage_whitelist():
    """管理 IP 白名单"""
    try:
        if request.method == 'GET':
            # 获取白名单
            return jsonify({
                'code': 200,
                'data': {
                    'whitelist': list(security_manager.whitelist),
                    'enabled': security_manager.config['enable_whitelist']
                }
            })
        
        elif request.method == 'POST':
            # 添加到白名单
            data = request.json
            ip = data.get('ip')
            
            if not ip:
                return jsonify({
                    'code': 400,
                    'description': '缺少 IP 地址'
                }), 400
            
            security_manager.add_to_whitelist(ip)
            
            return jsonify({
                'code': 200,
                'description': f'IP {ip} 已添加到白名单'
            })
        
        elif request.method == 'DELETE':
            # 从白名单移除
            data = request.json
            ip = data.get('ip')
            
            if not ip:
                return jsonify({
                    'code': 400,
                    'description': '缺少 IP 地址'
                }), 400
            
            security_manager.remove_from_whitelist(ip)
            
            return jsonify({
                'code': 200,
                'description': f'IP {ip} 已从白名单移除'
            })
    
    except Exception as e:
        return jsonify({
            'code': 500,
            'description': f'操作失败: {str(e)}'
        }), 500


@app.route('/security/blacklist', methods=['GET', 'POST', 'DELETE'])
@require_admin_login
def manage_blacklist():
    """管理 IP 黑名单"""
    try:
        if request.method == 'GET':
            # 获取黑名单
            return jsonify({
                'code': 200,
                'data': {
                    'blacklist': list(security_manager.blacklist),
                    'enabled': security_manager.config['enable_blacklist']
                }
            })
        
        elif request.method == 'POST':
            # 添加到黑名单
            data = request.json
            ip = data.get('ip')
            
            if not ip:
                return jsonify({
                    'code': 400,
                    'description': '缺少 IP 地址'
                }), 400
            
            security_manager.add_to_blacklist(ip)
            
            return jsonify({
                'code': 200,
                'description': f'IP {ip} 已添加到黑名单'
            })
        
        elif request.method == 'DELETE':
            # 从黑名单移除
            data = request.json
            ip = data.get('ip')
            
            if not ip:
                return jsonify({
                    'code': 400,
                    'description': '缺少 IP 地址'
                }), 400
            
            security_manager.remove_from_blacklist(ip)
            
            return jsonify({
                'code': 200,
                'description': f'IP {ip} 已从黑名单移除'
            })
    
    except Exception as e:
        return jsonify({
            'code': 500,
            'description': f'操作失败: {str(e)}'
        }), 500


@app.route('/security/config', methods=['GET', 'PUT'])
@require_admin_login
def manage_security_config():
    """管理安全配置"""
    try:
        if request.method == 'GET':
            # 获取配置
            return jsonify({
                'code': 200,
                'data': security_manager.config
            })
        
        elif request.method == 'PUT':
            # 更新配置
            data = request.json
            
            # 更新配置项
            for key in ['enable_whitelist', 'enable_blacklist', 'max_login_failures', 
                       'lockout_duration', 'failure_window', 'csrf_token_lifetime', 'enable_csrf']:
                if key in data:
                    security_manager.config[key] = data[key]
            
            # 保存配置
            security_manager.save_config()
            
            return jsonify({
                'code': 200,
                'description': '安全配置已更新',
                'data': security_manager.config
            })
    
    except Exception as e:
        return jsonify({
            'code': 500,
            'description': f'操作失败: {str(e)}'
        }), 500


@app.route('/security/unlock-ip', methods=['POST'])
@require_admin_login
def unlock_ip():
    """手动解锁 IP"""
    try:
        data = request.json
        ip = data.get('ip')
        
        if not ip:
            return jsonify({
                'code': 400,
                'description': '缺少 IP 地址'
            }), 400
        
        security_manager.clear_login_failures(ip)
        
        return jsonify({
            'code': 200,
            'description': f'IP {ip} 已解锁'
        })
    
    except Exception as e:
        return jsonify({
            'code': 500,
            'description': f'操作失败: {str(e)}'
        }), 500


if __name__ == '__main__':
    import sys
    import signal
    import atexit
    
    # 设置 Windows 控制台支持 UTF-8
    if sys.platform == 'win32':
        try:
            import codecs
            sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
            sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')
        except Exception as e:
            logger.warning(f"⚠️ 设置 UTF-8 编码失败: {str(e)}")
            pass
    
    # 定义退出处理函数
    def cleanup_on_exit():
        """程序退出时的清理工作"""
        try:
            logger.info("=" * 60)
            logger.info("🛑 正在关闭服务...")
            
            # 保存识别历史
            logger.info("💾 正在保存识别历史...")
            recognition_history.save_history()
            logger.info("✅ 识别历史已保存")
            
            # 保存安全配置
            logger.info("💾 正在保存安全配置...")
            security_manager.save_config()
            logger.info("✅ 安全配置已保存")
            
            logger.info("🎉 服务已安全关闭")
            logger.info("=" * 60)
        except Exception as e:
            logger.error(f"❌ 退出清理失败: {str(e)}")
    
    # 注册退出处理函数
    atexit.register(cleanup_on_exit)
    
    # 处理 Ctrl+C 信号
    def signal_handler(signum, frame):
        """信号处理函数"""
        logger.info("\n🛑 收到停止信号，正在关闭服务...")
        cleanup_on_exit()
        sys.exit(0)
    
    # 注册信号处理
    signal.signal(signal.SIGINT, signal_handler)
    if hasattr(signal, 'SIGTERM'):
        signal.signal(signal.SIGTERM, signal_handler)
    
    logger.info("=" * 60)
    logger.info("🚀 本地验证码识别服务启动中...")
    logger.info("=" * 60)
    logger.info("📍 服务地址: http://localhost:1205")
    logger.info("💡 提示: 请确保已安装依赖:")
    logger.info("   pip install flask flask-cors ddddocr pillow numpy")
    logger.info("=" * 60)
    
    # 启动时迁移数据库（如果需要）
    logger.info("🔄 检查数据库迁移...")
    migrate_admin_to_database()
    
    # 加载管理员配置（包括系统设置）
    logger.info("📋 加载管理员配置...")
    load_admin_config()
    
    # 加载配置、规则和 API Keys
    load_rules()
    load_api_keys()
    
    # 自动去除重复规则
    logger.info("🧽 检查并移除重复规则...")
    deduplicate_rules()
    
    # 加载安全配置
    logger.info("🔒 加载安全配置...")
    security_manager.load_config()
    
    logger.info("=" * 60)
    logger.info("✅ 服务启动完成")
    logger.info("🔑 默认登录账户: admin / admin")
    logger.warning("⚠️  请立即登录并修改密码！")
    logger.info("=" * 60)
    logger.info("🔒 安全功能:")
    logger.info(f"   - 请求限流: ✅ 已启用")
    logger.info(f"   - 登录保护: ✅ 已启用 (最多 {security_manager.config['max_login_failures']} 次失败)")
    logger.info(f"   - IP 白名单: {'✅ 已启用' if security_manager.config['enable_whitelist'] else '❌ 未启用'}")
    logger.info(f"   - IP 黑名单: {'✅ 已启用' if security_manager.config['enable_blacklist'] else '❌ 未启用'}")
    logger.info(f"   - CSRF 保护: {'✅ 已启用' if security_manager.config['enable_csrf'] else '❌ 未启用'}")
    logger.info("=" * 60)
    
    app.run(host=DEFAULT_HOST, port=DEFAULT_PORT, debug=False)
