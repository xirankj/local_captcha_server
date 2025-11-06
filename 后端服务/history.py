#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
历史与模型整合模块：提供识别历史记录与模型管理能力。
新代码可 from history import recognition_history, model_manager
"""

import time
import json
import os
import threading
from collections import deque, defaultdict
from datetime import datetime
from logger_config import logger


class RecognitionHistory:
    def __init__(self, max_records=10000, history_file='recognition_history.json'):
        self.max_records = max_records
        self.history_file = history_file
        self.records = deque(maxlen=max_records)
        self.stats = {
            'total': 0,
            'success': 0,
            'failed': 0,
            'by_type': defaultdict(lambda: {'total': 0, 'success': 0, 'failed': 0}),
            'by_host': defaultdict(lambda: {'total': 0, 'success': 0, 'failed': 0}),
            'by_model': defaultdict(lambda: {'total': 0, 'success': 0, 'failed': 0}),
        }
        self.lock = threading.Lock()
        import queue
        self.write_queue = queue.Queue()
        self.unsaved_count = 0
        self.BATCH_SIZE = 10
        self.flush_interval = 60
        self.last_save_time = time.time()
        self._start_background_writer()
        self.load_history()
        logger.info('📊 [识别历史] 初始化完成（异步批量写入已启用）')

    def _start_background_writer(self):
        def background_writer():
            while True:
                try:
                    if not self.write_queue.empty() or time.time() - self.last_save_time > self.flush_interval:
                        if self.unsaved_count > 0:
                            with self.lock:
                                self._save_history_internal()
                                self.unsaved_count = 0
                                self.last_save_time = time.time()
                                logger.debug(f"💾 [识别历史] 后台批量保存了 {len(self.records)} 条记录")
                        time.sleep(1)
                    else:
                        time.sleep(5)
                except Exception as e:
                    logger.error(f"❌ [识别历史] 后台写入线程异常: {str(e)}")
                    time.sleep(5)
        threading.Thread(target=background_writer, daemon=True, name="HistoryWriter").start()
        logger.info("📝 [识别历史] 后台写入线程已启动")

    def add_record(self, record_data):
        with self.lock:
            record = {'timestamp': time.time(), 'datetime': datetime.now().isoformat(), **record_data}
            self.records.append(record)
            self._update_stats(record)
            self.unsaved_count += 1
            if self.unsaved_count >= self.BATCH_SIZE:
                self.write_queue.put(('save',))
            if time.time() - self.last_save_time > self.flush_interval:
                self.write_queue.put(('save',))

    def _update_stats(self, record):
        self.stats['total'] += 1
        if record.get('success', False):
            self.stats['success'] += 1
        else:
            self.stats['failed'] += 1
        ocr_type = str(record.get('ocr_type', 'unknown'))
        self.stats['by_type'][ocr_type]['total'] += 1
        if record.get('success', False):
            self.stats['by_type'][ocr_type]['success'] += 1
        else:
            self.stats['by_type'][ocr_type]['failed'] += 1
        host = record.get('host', 'unknown')
        self.stats['by_host'][host]['total'] += 1
        if record.get('success', False):
            self.stats['by_host'][host]['success'] += 1
        else:
            self.stats['by_host'][host]['failed'] += 1
        model = record.get('model', 'unknown')
        self.stats['by_model'][model]['total'] += 1
        if record.get('success', False):
            self.stats['by_model'][model]['success'] += 1
        else:
            self.stats['by_model'][model]['failed'] += 1

    def get_recent_records(self, limit=50, ocr_type=None, host=None, api_key=None, status=None, start_date=None, end_date=None):
        with self.lock:
            records = list(self.records)
            if ocr_type is not None:
                records = [r for r in records if r.get('ocr_type') == ocr_type]
            if host is not None:
                records = [r for r in records if r.get('host') == host]
            if api_key is not None:
                records = [r for r in records if r.get('api_key') == api_key]
            if status is not None:
                if status == 'success':
                    records = [r for r in records if r.get('success', False)]
                elif status == 'failed':
                    records = [r for r in records if not r.get('success', False)]
            if start_date is not None:
                records = [r for r in records if r.get('timestamp', 0) >= start_date]
            if end_date is not None:
                records = [r for r in records if r.get('timestamp', 0) <= end_date]
            return records[-limit:][::-1]

    def get_filtered_stats(self, ocr_type=None, host=None, api_key=None, status=None, start_date=None, end_date=None):
        with self.lock:
            records = list(self.records)
            if ocr_type is not None:
                records = [r for r in records if r.get('ocr_type') == ocr_type]
            if host is not None:
                records = [r for r in records if r.get('host') == host]
            if api_key is not None:
                records = [r for r in records if r.get('api_key') == api_key]
            if status is not None:
                if status == 'success':
                    records = [r for r in records if r.get('success', False)]
                elif status == 'failed':
                    records = [r for r in records if not r.get('success', False)]
            if start_date is not None:
                records = [r for r in records if r.get('timestamp', 0) >= start_date]
            if end_date is not None:
                records = [r for r in records if r.get('timestamp', 0) <= end_date]

            total = len(records)
            success = sum(1 for r in records if r.get('success', False))
            failed = total - success
            stats = {
                'total': total,
                'success': success,
                'failed': failed,
                'success_rate': success / total if total > 0 else 0,
                'by_type': defaultdict(lambda: {'total': 0, 'success': 0, 'failed': 0}),
                'by_host': defaultdict(lambda: {'total': 0, 'success': 0, 'failed': 0}),
                'by_model': defaultdict(lambda: {'total': 0, 'success': 0, 'failed': 0}),
                'by_api_key': defaultdict(lambda: {'total': 0, 'success': 0, 'failed': 0}),
            }
            for record in records:
                ocr_type_val = str(record.get('ocr_type', 'unknown'))
                host_val = record.get('host', 'unknown')
                model_val = record.get('model', 'unknown')
                api_key_val = record.get('api_key_name', record.get('api_key', 'unknown'))
                success_val = record.get('success', False)
                stats['by_type'][ocr_type_val]['total'] += 1
                stats['by_host'][host_val]['total'] += 1
                stats['by_model'][model_val]['total'] += 1
                stats['by_api_key'][api_key_val]['total'] += 1
                if success_val:
                    stats['by_type'][ocr_type_val]['success'] += 1
                    stats['by_host'][host_val]['success'] += 1
                    stats['by_model'][model_val]['success'] += 1
                    stats['by_api_key'][api_key_val]['success'] += 1
                else:
                    stats['by_type'][ocr_type_val]['failed'] += 1
                    stats['by_host'][host_val]['failed'] += 1
                    stats['by_model'][model_val]['failed'] += 1
                    stats['by_api_key'][api_key_val]['failed'] += 1
            stats['by_type'] = dict(stats['by_type'])
            stats['by_host'] = dict(stats['by_host'])
            stats['by_model'] = dict(stats['by_model'])
            stats['by_api_key'] = dict(stats['by_api_key'])
            return stats

    def get_stats(self, time_range=None):
        with self.lock:
            if time_range is None:
                return {
                    'total': self.stats['total'],
                    'success': self.stats['success'],
                    'failed': self.stats['failed'],
                    'success_rate': self.stats['success'] / self.stats['total'] if self.stats['total'] > 0 else 0,
                    'by_type': dict(self.stats['by_type']),
                    'by_host': dict(self.stats['by_host']),
                    'by_model': dict(self.stats['by_model']),
                }
            else:
                cutoff_time = time.time() - time_range
                recent_records = [r for r in self.records if r['timestamp'] >= cutoff_time]
                stats = {
                    'total': len(recent_records),
                    'success': sum(1 for r in recent_records if r.get('success', False)),
                    'failed': sum(1 for r in recent_records if not r.get('success', False)),
                    'by_type': defaultdict(lambda: {'total': 0, 'success': 0, 'failed': 0}),
                    'by_host': defaultdict(lambda: {'total': 0, 'success': 0, 'failed': 0}),
                    'by_model': defaultdict(lambda: {'total': 0, 'success': 0, 'failed': 0}),
                }
                stats['success_rate'] = stats['success'] / stats['total'] if stats['total'] > 0 else 0
                for record in recent_records:
                    ocr_type = str(record.get('ocr_type', 'unknown'))
                    host = record.get('host', 'unknown')
                    model = record.get('model', 'unknown')
                    success = record.get('success', False)
                    stats['by_type'][ocr_type]['total'] += 1
                    stats['by_host'][host]['total'] += 1
                    stats['by_model'][model]['total'] += 1
                    if success:
                        stats['by_type'][ocr_type]['success'] += 1
                        stats['by_host'][host]['success'] += 1
                        stats['by_model'][model]['success'] += 1
                    else:
                        stats['by_type'][ocr_type]['failed'] += 1
                        stats['by_host'][host]['failed'] += 1
                        stats['by_model'][model]['failed'] += 1
                stats['by_type'] = dict(stats['by_type'])
                stats['by_host'] = dict(stats['by_host'])
                stats['by_model'] = dict(stats['by_model'])
                return stats

    def _save_history_internal(self):
        try:
            data = {
                'records': list(self.records),
                'stats': {
                    'total': self.stats['total'],
                    'success': self.stats['success'],
                    'failed': self.stats['failed'],
                    'by_type': dict(self.stats['by_type']),
                    'by_host': dict(self.stats['by_host']),
                    'by_model': dict(self.stats['by_model']),
                },
                'saved_at': datetime.now().isoformat()
            }
            with open(self.history_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            logger.info(f'💾 [识别历史] 已保存 {len(self.records)} 条记录')
        except Exception as e:
            logger.error(f'❌ [识别历史] 保存失败: {str(e)}')

    def save_history(self):
        with self.lock:
            self._save_history_internal()

    def load_history(self):
        try:
            if os.path.exists(self.history_file):
                with open(self.history_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                self.records = deque(data.get('records', []), maxlen=self.max_records)
                stats_data = data.get('stats', {})
                self.stats['total'] = stats_data.get('total', 0)
                self.stats['success'] = stats_data.get('success', 0)
                self.stats['failed'] = stats_data.get('failed', 0)
                for key in ['by_type', 'by_host', 'by_model']:
                    if key in stats_data:
                        self.stats[key] = defaultdict(lambda: {'total': 0, 'success': 0, 'failed': 0}, stats_data[key])
                logger.info(f'📥 [识别历史] 已加载 {len(self.records)} 条记录')
        except Exception as e:
            logger.warning(f'⚠️  [识别历史] 加载失败: {str(e)}，使用空记录')
    
    def clear_history(self):
        """清除所有识别历史记录"""
        with self.lock:
            self.records.clear()
            self.stats = {
                'total': 0,
                'success': 0,
                'failed': 0,
                'by_type': defaultdict(lambda: {'total': 0, 'success': 0, 'failed': 0}),
                'by_host': defaultdict(lambda: {'total': 0, 'success': 0, 'failed': 0}),
                'by_model': defaultdict(lambda: {'total': 0, 'success': 0, 'failed': 0}),
            }
            self.unsaved_count = 0
            # 保存空历史到文件
            self._save_history_internal()
            logger.info('🗑️ [识别历史] 所有记录已清除')


class ModelManager:
    def __init__(self):
        self.models = {
            'ddddocr': {
                'name': 'ddddocr',
                'display_name': 'DdddOcr (默认)',
                'type': 'text',
                'enabled': True,
                'description': '通用OCR识别引擎'
            },
            'ddddocr_slide': {
                'name': 'ddddocr_slide',
                'display_name': 'DdddOcr 滑块',
                'type': 'slide',
                'enabled': True,
                'description': '滑动验证码识别'
            },
        }
        self.current_model = 'ddddocr'
        self.preprocessing_options = {
            'grayscale': {'name': '灰度化', 'enabled': False, 'description': '将图片转换为灰度图'},
            'threshold': {'name': '二值化', 'enabled': False, 'description': '将图片转换为黑白二值图'},
            'denoise': {'name': '降噪', 'enabled': False, 'description': '去除图片噪点'},
            'sharpen': {'name': '锐化', 'enabled': False, 'description': '增强图片边缘'},
        }
        logger.info('🤖 [模型管理] 初始化完成')

    def get_models(self):
        return self.models

    def get_current_model(self):
        return self.current_model

    def set_current_model(self, model_name):
        if model_name in self.models:
            self.current_model = model_name
            logger.info(f'🤖 [模型管理] 切换到模型: {model_name}')
            return True
        return False

    def get_preprocessing_options(self):
        return self.preprocessing_options

    def update_preprocessing(self, option_name, enabled):
        if option_name in self.preprocessing_options:
            self.preprocessing_options[option_name]['enabled'] = enabled
            logger.info(f'🖼️ [图片预处理] {option_name}: {"启用" if enabled else "禁用"}')
            return True
        return False

    def get_enabled_preprocessing(self):
        return [name for name, opt in self.preprocessing_options.items() if opt['enabled']]


recognition_history = RecognitionHistory()
model_manager = ModelManager()

__all__ = ['RecognitionHistory', 'ModelManager', 'recognition_history', 'model_manager']


