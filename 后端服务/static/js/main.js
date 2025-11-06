
        // ==========================================
        // 页面显示控制
        // ==========================================
        
        // 显示登录页面
        function showLoginPage() {
            // 隐藏关于页面
            document.getElementById('aboutPage').style.display = 'none';
            // 显示登录页面
            document.getElementById('loginContainer').style.display = 'flex';
            document.getElementById('loginContainer').classList.add('active');
            // 确保登录页面有背景图样式（如果有配置）
            const bgImg = document.getElementById('backgroundImage');
            if (bgImg) {
                if (bgImg.complete && bgImg.naturalWidth > 0) {
                    // 背景图已加载，显示背景图
                    document.getElementById('loginContainer').classList.add('has-background');
                    bgImg.style.display = 'block';
                } else {
                    // 背景图未加载，等待加载完成
                    bgImg.onload = function() {
                        document.getElementById('loginContainer').classList.add('has-background');
                        bgImg.style.display = 'block';
                    };
                }
            }
            // 更新一言显示状态
            updateHitokotoVisibility();
        }
        
        // 显示关于页面
        function showAboutPage() {
            // 隐藏登录页面
            document.getElementById('loginContainer').style.display = 'none';
            document.getElementById('loginContainer').classList.remove('active');
            // 隐藏主应用
            document.getElementById('mainApp').style.display = 'none';
            // 显示关于页面
            document.getElementById('aboutPage').style.display = 'block';
            // 隐藏背景图（只在登录页面显示）
            const bgImg = document.getElementById('backgroundImage');
            if (bgImg) {
                bgImg.style.display = 'none';
            }
            // 更新一言显示状态
            updateHitokotoVisibility();
        }

        // ==========================================
        // JWT Token 管理
        // ==========================================
        const TOKEN_KEY = 'admin_token';
        
        function saveToken(token) {
            localStorage.setItem(TOKEN_KEY, token);
        }
        
        function getToken() {
            return localStorage.getItem(TOKEN_KEY);
        }
        
        function removeToken() {
            localStorage.removeItem(TOKEN_KEY);
        }
        
        function getAuthHeaders() {
            const token = getToken();
            if (token) {
                return {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                };
            }
            return {
                'Content-Type': 'application/json'
            };
        }
        
        // ==========================================
        // SHA256 加密工具函数
        // ==========================================
        async function sha256Hash(message) {
            // 优先使用 crypto.subtle（HTTPS 环境）
            if (window.crypto && window.crypto.subtle) {
                try {
                    const msgBuffer = new TextEncoder().encode(message);
                    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                    return hashHex;
                } catch (e) {
                    console.warn('crypto.subtle 失败，降级到 js-sha256:', e);
                }
            }
            // 降级使用 js-sha256（HTTP 环境）
            if (typeof sha256 === 'function') {
                return sha256(message);
            }
            throw new Error('无法计算 SHA256: crypto.subtle 和 js-sha256 都不可用');
        }
        // ==========================================
        // 登录相关功能
        // ==========================================
        
        // 检查登录状态
        async function checkLoginStatus() {
            const token = getToken();
            if (!token) {
                // 没有token，显示关于页面（默认页面）
                showAboutPage();
                return;
            }
            
            try {
                const response = await fetch('/admin/status', {
                    headers: getAuthHeaders()
                });
                const data = await response.json();
                
                if (data.logged_in) {
                    // 已登录，显示主应用
                    document.getElementById('loginContainer').style.display = 'none';
                    document.getElementById('loginContainer').classList.remove('active');
                    document.getElementById('mainApp').style.display = 'flex';
                    document.getElementById('aboutPage').style.display = 'none';
                    console.log('✅ 已登录:', data.username);
                } else {
                    // token无效，清除并显示关于页面
                    removeToken();
                    showAboutPage();
                }
            } catch (error) {
                console.error('检查登录状态失败:', error);
                // 出错时清除token并显示关于页面
                removeToken();
                showAboutPage();
            }
        }
        
        // 处理登录
        async function handleLogin(event) {
            event.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorEl = document.getElementById('loginError');
            const loginBtn = document.getElementById('loginBtn');
            
            // 禁用按钮
            loginBtn.disabled = true;
            loginBtn.textContent = '登录中...';
            errorEl.classList.remove('show');
            
            try {
                const passwordSha = await sha256Hash(password);
                const response = await fetch('/admin/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password: passwordSha })
                });
                
                const data = await response.json();
                
                if (response.ok && data.code === 200) {
                    console.log('✅ 登录成功');
                    
                    // 保存 JWT token
                    if (data.data && data.data.token) {
                        saveToken(data.data.token);
                        console.log('🔑 Token 已保存');
                    }
                    
                    // 是否需要强制修改密码
                    if (data.data && data.data.is_default_password) {
                        openChangePasswordModal(true);
                        // 隐藏取消按钮，强制修改
                        document.getElementById('cancelChangePassword').style.display = 'none';
                        return;
                    }
                    
                    // 登录成功，切换到主应用
                    document.getElementById('loginContainer').style.display = 'none';
                    document.getElementById('loginContainer').classList.remove('active');
                    document.getElementById('mainApp').style.display = 'flex';
                    document.getElementById('aboutPage').style.display = 'none';
                    
                    // 隐藏背景图，管理页面不显示背景图
                    const bgImg = document.getElementById('backgroundImage');
                    if (bgImg) {
                        bgImg.style.display = 'none';
                    }
                    document.getElementById('loginContainer').classList.remove('has-background');
                    
                    // 更新一言显示状态
                    updateHitokotoVisibility();
                    
                    // 清空表单
                    document.getElementById('loginForm').reset();
                    
                    // 加载数据
                    updateRulesCount();
                } else {
                    // 登录失败
                    errorEl.textContent = data.description || '登录失败';
                    errorEl.classList.add('show');
                }
            } catch (error) {
                console.error('登录失败:', error);
                errorEl.textContent = '网络错误，请稍后重试';
                errorEl.classList.add('show');
            } finally {
                // 恢复按钮
                loginBtn.disabled = false;
                loginBtn.textContent = '登录';
            }
        }
        
        // 处理登出
        async function handleLogout() {
            if (!confirm('确定要登出吗？')) {
                return;
            }
            
            try {
                // 调用后端登出接口（可选）
                await fetch('/admin/logout', {
                    method: 'POST',
                    headers: getAuthHeaders()
                });
                
                // 删除本地 token
                removeToken();
                console.log('🚺 登出成功');
                
                // 切换到关于页面（默认页面）
                showAboutPage();
                
                // 清空表单
                document.getElementById('loginForm').reset();
            } catch (error) {
                console.error('登出失败:', error);
                // 即使出错，也删除token并跳转到关于页面
                removeToken();
                showAboutPage();
            }
        }
        
        // ==========================================
        // 页面切换
        // ==========================================
        
        function showPage(pageId, event) {
            // 隐藏所有页面
            document.querySelectorAll('.content-card').forEach(card => {
                card.classList.remove('active');
            });
            
            // 移除菜单激活状态
            document.querySelectorAll('.menu-item').forEach(item => {
                item.classList.remove('active');
            });
            
            // 显示当前页面
            document.getElementById(pageId).classList.add('active');
            
            // 激活当前菜单
            if (event && event.currentTarget) {
                event.currentTarget.classList.add('active');
            }
            
            // 如果是规则页，加载规则并显示下载和导入按钮
            if (pageId === 'rules') {
                loadRules();
                document.querySelector('.download-btn').classList.add('show');
                document.querySelector('.btn-import').classList.add('show');
            } else if (pageId === 'apikeys') {
                loadApiKeys();
                document.querySelector('.download-btn').classList.remove('show');
                document.querySelector('.btn-import').classList.remove('show');
            } else if (pageId === 'settings') {
                loadSystemConfigToForm();
                document.querySelector('.download-btn').classList.remove('show');
                document.querySelector('.btn-import').classList.remove('show');
            } else if (pageId === 'history') {
                // 加载识别历史
                loadHistoryFilters();  // 先加载筛选选项
                loadHistoryStats();
                loadHistoryRecords();
                document.querySelector('.download-btn').classList.remove('show');
                document.querySelector('.btn-import').classList.remove('show');
            } else if (pageId === 'security') {
                // 加载安全管理
                loadSecurityStats();
                loadWhitelist();
                loadBlacklist();
                document.querySelector('.download-btn').classList.remove('show');
                document.querySelector('.btn-import').classList.remove('show');
            } else if (pageId === 'models') {
                // 加载模型管理
                loadModels();
                loadPreprocessing();
                document.querySelector('.download-btn').classList.remove('show');
                document.querySelector('.btn-import').classList.remove('show');
            } else {
                document.querySelector('.download-btn').classList.remove('show');
                document.querySelector('.btn-import').classList.remove('show');
            }
        }
        
        // 加载规则
        async function loadRules() {
            console.log('[INFO] 开始加载规则...');
            try {
                const response = await fetch('/rules', {
                    headers: getAuthHeaders()
                });
                console.log('[INFO] API响应:', response);
                
                // 检查是否未授权
                if (response.status === 401) {
                    console.warn('⚠️  未登录，跳转到关于页面');
                    showAboutPage();
                    return;
                }
                
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                }
                
                const data = await response.json();
                console.log('[DATA] 规则数据:', data);
                
                const count = data.count || 0;
                document.getElementById('rulesCountText').textContent = '共 ' + count + ' 个网站';
                
                // 更新首页的规则数
                const rulesCountEl = document.getElementById('rulesCount');
                if (rulesCountEl) {
                    rulesCountEl.textContent = count;
                }
                
                if (count === 0) {
                    document.getElementById('rulesContent').innerHTML = 
                        '<div class="no-rules">暂无规则，请使用浏览器脚本添加</div>';
                    return;
                }
                
                // 生成表格
                let html = '<table class="rules-table"><thead><tr>';
                html += '<th>网站</th><th>规则数</th><th>类型</th><th>操作</th>';
                html += '</tr></thead><tbody>';
                
                let globalIndex = 0;
                for (const [host, rules] of Object.entries(data.rules)) {
                    const ruleCount = Array.isArray(rules) ? rules.length : 0;
                    
                    if (Array.isArray(rules)) {
                        rules.forEach((rule, index) => {
                            const ocr_type = rule.ocr_type || rule.ocrType;
                            let typeName = '-';
                            if (ocr_type === 1) typeName = '英数';
                            else if (ocr_type === 4) typeName = '滑动拼图';
                            else if (ocr_type === 5) typeName = '滑块行为';
                            
                            html += '<tr>';
                            if (index === 0) {
                                html += '<td rowspan="' + ruleCount + '"><strong>' + host + '</strong></td>';
                            }
                            html += '<td>' + (index + 1) + '</td>';
                            html += '<td>' + typeName + '</td>';
                            html += '<td>';
                            html += '<button class="action-btn btn-edit" onclick="editRule(&quot;' + host + '&quot;, ' + index + ')">编辑</button>';
                            html += '<button class="action-btn btn-delete" onclick="deleteRule(&quot;' + host + '&quot;, ' + index + ')">删除</button>';
                            html += '</td>';
                            html += '</tr>';
                        });
                    }
                }
                
                html += '</tbody></table>';
                document.getElementById('rulesContent').innerHTML = html;
                
                console.log('[SUCCESS] 规则加载完成');
            } catch (error) {
                console.error('[ERROR] 加载规则失败:', error);
                document.getElementById('rulesContent').innerHTML = 
                    '<div class="no-rules">加载失败: ' + error.message + '</div>';
            }
        }
        
        // 下载规则
        function downloadRules() {
            window.location.href = '/rules/export';
        }
        
        // 页面加载时获取规则数
        async function updateRulesCount() {
            try {
                const response = await fetch('/rules', {
                    headers: getAuthHeaders()
                });
                
                // 检查是否未授权
                if (response.status === 401) {
                    return; // 静默失败，不显示错误
                }
                
                const data = await response.json();
                document.getElementById('rulesCount').textContent = data.count || 0;
            } catch (error) {
                console.error('获取规则数失败:', error);
            }
        }
        
        // 页面加载完成
        window.addEventListener('DOMContentLoaded', function() {
            console.log('[INIT] 页面加载完成');
            
            // 检查登录状态
            checkLoginStatus();
            
            // 确保首页菜单激活
            document.querySelectorAll('.menu-item').forEach(function(item, index) {
                if (index === 0) {
                    item.classList.add('active');
                }
            });
            
            // 加载系统配置并初始化一言和背景
            loadSystemConfigAndInit();
        });
        
        // 加载系统配置并初始化
        async function loadSystemConfigAndInit() {
            try {
                const response = await fetch('/admin/config');
                const data = await response.json();
                if (data.code === 200) {
                    const config = data.data;
                    // 初始化背景图
                    if (config.background_api) {
                        initBackgroundImage(config.background_api);
                    }
                    // 初始化一言（登录页面和后台页面需要显示）
                    if (config.hitokoto_api) {
                        initHitokoto(config.hitokoto_api);
                    }
                }
            } catch (error) {
                console.error('加载系统配置失败:', error);
            }
        }
        
        // 初始化背景图（只在登录页面显示）
        function initBackgroundImage(apiUrl) {
            if (!apiUrl) return;
            
            // 创建背景图元素
            let bgImg = document.getElementById('backgroundImage');
            if (!bgImg) {
                bgImg = document.createElement('img');
                bgImg.id = 'backgroundImage';
                bgImg.className = 'background-image';
                bgImg.style.display = 'none'; // 默认隐藏
                document.body.insertBefore(bgImg, document.body.firstChild);
            }
            
            // 加载图片
            bgImg.src = apiUrl + '?t=' + Date.now(); // 添加时间戳防止缓存
            bgImg.onload = function() {
                // 背景图加载完成
                // 只有在登录页面激活时才显示背景图
                console.log('背景图加载完成');
                // 检查当前是否在登录页面，如果是则显示背景图
                const loginContainer = document.getElementById('loginContainer');
                if (loginContainer && loginContainer.style.display !== 'none' && loginContainer.classList.contains('active')) {
                    loginContainer.classList.add('has-background');
                    bgImg.style.display = 'block';
                } else {
                    // 不在登录页面，保持隐藏
                    bgImg.style.display = 'none';
                }
            };
            bgImg.onerror = function() {
                console.error('背景图加载失败');
                // 失败时隐藏背景图（不删除，以便重试）
                bgImg.style.display = 'none';
            };
        }
        
        // 初始化一言
        async function initHitokoto(apiUrl) {
            if (!apiUrl) return;
            
            try {
                const response = await fetch(apiUrl);
                const data = await response.json();
                
                const container = document.getElementById('hitokotoContainer');
                const textEl = document.getElementById('hitokotoText');
                const fromEl = document.getElementById('hitokotoFrom');
                
                if (data.hitokoto) {
                    textEl.textContent = data.hitokoto;
                    fromEl.textContent = data.from ? '—— ' + data.from : '';
                    // 不直接显示，根据当前页面状态决定
                    updateHitokotoVisibility();
                } else {
                    // 兼容其他格式
                    textEl.textContent = data.content || data.text || '';
                    fromEl.textContent = data.source || data.author || '';
                    if (textEl.textContent) {
                        // 不直接显示，根据当前页面状态决定
                        updateHitokotoVisibility();
                    }
                }
            } catch (error) {
                console.error('一言加载失败:', error);
            }
        }
        
            // 根据当前页面状态更新一言显示
            function updateHitokotoVisibility() {
                const hitokotoContainer = document.getElementById('hitokotoContainer');
                if (!hitokotoContainer || !hitokotoContainer.textContent.trim()) {
                    return;
                }
                
                // 检查当前显示的页面
                const aboutPage = document.getElementById('aboutPage');
                const loginContainer = document.getElementById('loginContainer');
                const mainApp = document.getElementById('mainApp');
                
                // 如果关于页面显示，则隐藏一言
                if (aboutPage && aboutPage.style.display !== 'none') {
                    hitokotoContainer.style.display = 'none';
                }
                // 如果登录页面或管理后台显示，则显示一言
                else if ((loginContainer && loginContainer.style.display !== 'none' && loginContainer.classList.contains('active')) || 
                         (mainApp && mainApp.style.display === 'flex')) {
                    hitokotoContainer.style.display = 'block';
                } else {
                    hitokotoContainer.style.display = 'none';
                }
            }
        
        // 保存系统配置
        async function saveSystemConfig() {
            const hitokotoApi = document.getElementById('hitokotoApi').value.trim();
            const backgroundApi = document.getElementById('backgroundApi').value.trim();
            
            try {
                const response = await fetch('/admin/config', {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        hitokoto_api: hitokotoApi,
                        background_api: backgroundApi
                    })
                });
                const result = await response.json();
                if (result.code === 200) {
                    alert('配置保存成功！请刷新页面查看效果');
                } else {
                    alert('保存失败: ' + result.description);
                }
            } catch (error) {
                alert('保存失败: ' + error.message);
            }
        }
        
        // 加载系统配置到表单
        async function loadSystemConfigToForm() {
            try {
                const response = await fetch('/admin/config');
                const data = await response.json();
                if (data.code === 200) {
                    document.getElementById('hitokotoApi').value = data.data.hitokoto_api || '';
                    document.getElementById('backgroundApi').value = data.data.background_api || '';
                }
            } catch (error) {
                console.error('加载配置失败:', error);
            }
        }
        
        // 打开修改密码模态框
        function openChangePasswordModal(force = false) {
            document.getElementById('changePasswordModal').classList.add('show');
            document.getElementById('forceChangeNotice').style.display = force ? 'block' : 'none';
            document.getElementById('cancelChangePassword').style.display = force ? 'none' : 'inline-block';
            document.getElementById('oldPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        }
        
        function closeChangePasswordModal() {
            document.getElementById('changePasswordModal').classList.remove('show');
        }
        
        // 提交修改密码
        async function submitChangePassword() {
            const oldPwd = document.getElementById('oldPassword').value;
            const newPwd = document.getElementById('newPassword').value;
            const confirmPwd = document.getElementById('confirmPassword').value;
            
            if (!oldPwd || !newPwd) {
                alert('请填写完整');
                return;
            }
            if (newPwd !== confirmPwd) {
                alert('两次输入的新密码不一致');
                return;
            }
            if (newPwd.length < 8) {
                if (!confirm('密码长度少于8位，是否继续？')) {
                    return;
                }
            }
            
            try {
                const oldSha = await sha256Hash(oldPwd);
                const newSha = await sha256Hash(newPwd);
                const resp = await fetch('/admin/change-password', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ old_password: oldSha, new_password: newSha })
                });
                const result = await resp.json();
                if (result.code === 200) {
                    alert('密码修改成功，请重新登录');
                    closeChangePasswordModal();
                    // 退出登录到登录页
                    await handleLogout();
                } else {
                    alert('修改失败: ' + result.description);
                }
            } catch (e) {
                alert('修改失败: ' + e.message);
            }
        }
        
        // 全局变量保存当前编辑的规则
        let currentEditHost = null;
        let currentEditIndex = null;
        let importedFileData = null;
        
        // 编辑规则
        async function editRule(host, index) {
            currentEditHost = host;
            currentEditIndex = index;
            
            try {
                const response = await fetch('/rules', {
                    headers: getAuthHeaders()
                });
                const data = await response.json();
                
                const rule = data.rules[host][index];
                document.getElementById('editHost').value = host;
                document.getElementById('editRuleData').value = JSON.stringify(rule, null, 2);
                
                document.getElementById('editModal').classList.add('show');
            } catch (error) {
                alert('加载规则失败: ' + error.message);
            }
        }
        
        // 关闭编辑模态框
        function closeEditModal() {
            document.getElementById('editModal').classList.remove('show');
            currentEditHost = null;
            currentEditIndex = null;
        }
        
        // 保存规则
        async function saveRule() {
            const ruleDataStr = document.getElementById('editRuleData').value;
            
            try {
                const ruleData = JSON.parse(ruleDataStr);
                
                const response = await fetch('/rules/update', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        host: currentEditHost,
                        index: currentEditIndex,
                        rule: ruleData
                    })
                });
                
                const result = await response.json();
                
                if (result.code === 200) {
                    alert('规则更新成功！');
                    closeEditModal();
                    loadRules();  // 重新加载规则
                } else {
                    alert('更新失败: ' + result.description);
                }
            } catch (error) {
                alert('保存失败: ' + error.message);
            }
        }
        
        // 删除规则
        async function deleteRule(host, index) {
            var msg = '确定要删除该条规则吗？\\n\\n网站: ' + host + '\\n索引: ' + (index + 1);
            if (!confirm(msg)) {
                return;
            }
            
            try {
                const response = await fetch('/rules/delete-single', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        host: host,
                        index: index
                    })
                });
                
                const result = await response.json();
                
                if (result.code === 200) {
                    alert('规则删除成功！');
                    loadRules();  // 重新加载规则
                    updateRulesCount();  // 更新规则数
                } else {
                    alert('删除失败: ' + result.description);
                }
            } catch (error) {
                alert('删除失败: ' + error.message);
            }
        }
        
        // 显示导入模态框
        function showImportModal() {
            document.getElementById('importModal').classList.add('show');
            document.getElementById('fileName').textContent = '';
            importedFileData = null;
        }
        
        // 关闭导入模态框
        function closeImportModal() {
            document.getElementById('importModal').classList.remove('show');
            document.getElementById('importFile').value = '';
            document.getElementById('fileName').textContent = '';
            importedFileData = null;
        }
        
        // 处理文件选择
        function handleFileSelect(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            document.getElementById('fileName').textContent = '已选择: ' + file.name;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    importedFileData = JSON.parse(e.target.result);
                } catch (error) {
                    alert('文件格式错误，请选择有效的 JSON 文件');
                    importedFileData = null;
                }
            };
            reader.readAsText(file);
        }
        
        // 导入规则
        async function importRules() {
            if (!importedFileData) {
                alert('请先选择要导入的文件');
                return;
            }
            
            const mode = document.querySelector('input[name="importMode"]:checked').value;
            
            var confirmMsg;
            if (mode === 'replace') {
                confirmMsg = '确定要覆盖所有现有规则吗？\\n\\n此操作将删除所有现有规则并替换为导入的规则！';
            } else {
                confirmMsg = '确定要合并导入规则吗？\\n\\n导入的规则将与现有规则合并。';
            }
            
            if (!confirm(confirmMsg)) {
                return;
            }
            
            try {
                const response = await fetch('/rules/import', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        rules: importedFileData,
                        mode: mode
                    })
                });
                
                const result = await response.json();
                
                if (result.code === 200) {
                    alert('导入成功！\\n\\n当前共有 ' + result.count + ' 个网站的规则。');
                    closeImportModal();
                    loadRules();  // 重新加载规则
                    updateRulesCount();  // 更新规则数
                } else {
                    alert('导入失败: ' + result.description);
                }
            } catch (error) {
                alert('导入失败: ' + error.message);
            }
        }
        
        // ==================== API Key 管理函数 ====================
        
        // 加载 API Keys
        async function loadApiKeys() {
            console.log('[INFO] 开始加载 API Keys...');
            try {
                // 加载统计概要
                const summaryResponse = await fetch('/api-keys/stats/summary', {
                    headers: getAuthHeaders()
                });
                const summaryData = await summaryResponse.json();
                
                if (summaryData.code === 200) {
                    const summary = summaryData.summary;
                    document.getElementById('totalKeys').textContent = summary.total_keys;
                    document.getElementById('activeKeys').textContent = summary.active_keys;
                    document.getElementById('totalRequests').textContent = summary.total_requests;
                }
                
                // 加载 API Keys 列表
                const response = await fetch('/api-keys', {
                    headers: getAuthHeaders()
                });
                const data = await response.json();
                
                if (data.code !== 200) {
                    throw new Error('加载失败');
                }
                
                const keys = data.keys || [];
                
                if (keys.length === 0) {
                    document.getElementById('apiKeysContent').innerHTML = 
                        '<div class="no-rules">暂无 API Key，请点击上方按钮创建</div>';
                    return;
                }
                
                // 生成表格
                let html = '<table class="rules-table"><thead><tr>';
                html += '<th>名称</th><th>API Key</th><th>创建时间</th><th>最后使用</th><th>使用次数</th><th>操作</th>';
                html += '</tr></thead><tbody>';
                
                keys.forEach(key => {
                    const createdAt = new Date(key.created_at).toLocaleString('zh-CN');
                    const lastUsed = key.last_used && key.last_used !== '从未使用' 
                        ? new Date(key.last_used).toLocaleString('zh-CN') 
                        : '从未使用';
                    const totalUse = key.stats.total || 0;
                    
                    html += '<tr>';
                    html += '<td><strong>' + (key.name || '无名称') + '</strong></td>';
                    // API Key 列，添加复制按钮
                    html += '<td style="font-family: monospace; font-size: 12px;">';
                    html += '<span style="margin-right: 8px;">' + key.key + '</span>';
                    html += '<button class="action-btn" style="background: #27ae60; color: white; padding: 3px 8px; font-size: 11px;" ';
                    html += 'onclick="copyToClipboard(&quot;' + key.full_key + '&quot;)" title="复制完整 API Key">';
                    html += '📋 复制</button>';
                    html += '</td>';
                    html += '<td>' + createdAt + '</td>';
                    html += '<td>' + lastUsed + '</td>';
                    html += '<td>' + totalUse + '</td>';
                    html += '<td>';
                    html += '<button class="action-btn btn-edit" onclick="viewKeyStats(&quot;' + key.full_key + '&quot;)">统计</button>';
                    html += '<button class="action-btn btn-delete" onclick="deleteApiKey(&quot;' + key.full_key + '&quot;)">删除</button>';
                    html += '</td>';
                    html += '</tr>';
                });
                
                html += '</tbody></table>';
                document.getElementById('apiKeysContent').innerHTML = html;
                
                console.log('[SUCCESS] API Keys 加载完成');
            } catch (error) {
                console.error('[ERROR] 加载 API Keys 失败:', error);
                document.getElementById('apiKeysContent').innerHTML = 
                    '<div class="no-rules">加载失败: ' + error.message + '</div>';
            }
        }
        
        // 显示创建 API Key 模态框
        function showCreateKeyModal() {
            document.getElementById('keyName').value = '';
            document.getElementById('createKeyModal').classList.add('show');
        }
        
        // 关闭创建 API Key 模态框
        function closeCreateKeyModal() {
            document.getElementById('createKeyModal').classList.remove('show');
        }
        
        // 创建 API Key
        async function createApiKey() {
            const name = document.getElementById('keyName').value.trim();
            
            if (!name) {
                alert('请输入 API Key 名称');
                return;
            }
            
            try {
                const response = await fetch('/api-keys', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ name: name })
                });
                
                const result = await response.json();
                
                if (result.code === 200) {
                    // 关闭创建模态框
                    closeCreateKeyModal();
                    
                    // 显示 API Key
                    document.getElementById('newApiKey').value = result.api_key;
                    document.getElementById('showKeyModal').classList.add('show');
                    
                    // 重新加载列表
                    setTimeout(() => loadApiKeys(), 500);
                } else {
                    alert('创建失败: ' + result.description);
                }
            } catch (error) {
                alert('创建失败: ' + error.message);
            }
        }
        
        // 关闭显示 API Key 模态框
        function closeShowKeyModal() {
            document.getElementById('showKeyModal').classList.remove('show');
        }
        
        // 复制 API Key
        function copyApiKey() {
            const textarea = document.getElementById('newApiKey');
            textarea.select();
            document.execCommand('copy');
            alert('✅ API Key 已复制到剪贴板！');
        }
        
        // 复制到剪贴板（通用函数）
        function copyToClipboard(text) {
            // 尝试使用现代 API
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(() => {
                    // 显示简短提示
                    showCopyNotification();
                }).catch(err => {
                    // 如果失败，使用传统方法
                    fallbackCopyToClipboard(text);
                });
            } else {
                // 使用传统方法
                fallbackCopyToClipboard(text);
            }
        }
        
        // 传统复制方法
        function fallbackCopyToClipboard(text) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                showCopyNotification();
            } catch (err) {
                alert('复制失败，请手动复制：' + text);
            }
            document.body.removeChild(textarea);
        }
        
        // 显示复制成功提示
        function showCopyNotification() {
            // 创建提示元素
            const notification = document.createElement('div');
            notification.textContent = '✅ 已复制到剪贴板';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #27ae60;
                color: white;
                padding: 12px 24px;
                border-radius: 5px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                z-index: 10000;
                font-size: 14px;
                animation: slideInRight 0.3s ease-out;
            `;
            
            document.body.appendChild(notification);
            
            // 2秒后自动消失
            setTimeout(() => {
                notification.style.animation = 'slideOutRight 0.3s ease-out';
                setTimeout(() => {
                    document.body.removeChild(notification);
                }, 300);
            }, 2000);
        }
        
        // 删除 API Key
        async function deleteApiKey(apiKey) {
            if (!confirm('确定要删除该 API Key 吗？\\n\\n此操作不可恢复！')) {
                return;
            }
            
            try {
                const response = await fetch('/api-keys/' + encodeURIComponent(apiKey), {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                
                const result = await response.json();
                
                if (result.code === 200) {
                    alert('✅ API Key 删除成功！');
                    loadApiKeys();  // 重新加载列表
                } else {
                    alert('删除失败: ' + result.description);
                }
            } catch (error) {
                alert('删除失败: ' + error.message);
            }
        }
        
        // 查看 API Key 统计（使用模态框显示）
        async function viewKeyStats(apiKey) {
            try {
                const response = await fetch('/api-keys/' + encodeURIComponent(apiKey) + '/stats', {
                    headers: getAuthHeaders()
                });
                const result = await response.json();
                
                if (result.code === 200) {
                    showStatsModal(result);
                } else {
                    alert('获取统计失败: ' + result.description);
                }
            } catch (error) {
                alert('获取统计失败: ' + error.message);
            }
        }
        
        // 显示统计模态框
        function showStatsModal(stats) {
            // 创建模态框
            const modal = document.createElement('div');
            modal.className = 'modal show';
            modal.id = 'statsModal';
            modal.style.display = 'flex';
            
            // 构建内容
            let content = '<div class="modal-content" style="max-width: 600px; max-height: 80vh;">';
            content += '<div class="modal-header">';
            content += '<h3 class="modal-title">📊 API Key 统计信息</h3>';
            content += '<button class="modal-close" onclick="closeStatsModal()">&times;</button>';
            content += '</div>';
            
            content += '<div class="modal-body" style="max-height: 60vh; overflow-y: auto;">';
            
            // 基本信息
            content += '<div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px;">';
            content += '<h4 style="margin-top: 0; color: #2c3e50;">基本信息</h4>';
            content += '<p><strong>名称:</strong> ' + stats.name + '</p>';
            content += '<p><strong>创建时间:</strong> ' + new Date(stats.created_at).toLocaleString('zh-CN') + '</p>';
            
            const lastUsed = stats.last_used && stats.last_used !== '从未使用' 
                ? new Date(stats.last_used).toLocaleString('zh-CN') 
                : '从未使用';
            content += '<p><strong>最后使用:</strong> ' + lastUsed + '</p>';
            content += '<p><strong>总请求次数:</strong> <span style="color: #e74c3c; font-size: 18px; font-weight: bold;">' + stats.stats.total + '</span></p>';
            content += '</div>';
            
            // 按类型统计
            content += '<div style="margin-bottom: 20px;">';
            content += '<h4 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px;">按验证码类型统计</h4>';
            
            if (Object.keys(stats.stats.types).length === 0) {
                content += '<p style="color: #95a5a6;">暂无数据</p>';
            } else {
                content += '<table class="rules-table" style="margin-top: 10px;">';
                content += '<thead><tr><th>类型</th><th>次数</th><th>比例</th></tr></thead>';
                content += '<tbody>';
                
                const total = stats.stats.total;
                for (const [type, count] of Object.entries(stats.stats.types)) {
                    const percentage = ((count / total) * 100).toFixed(1);
                    content += '<tr>';
                    content += '<td><strong>' + type + '</strong></td>';
                    content += '<td>' + count + '</td>';
                    content += '<td>' + percentage + '%</td>';
                    content += '</tr>';
                }
                content += '</tbody></table>';
            }
            content += '</div>';
            
            // 按网站统计
            content += '<div style="margin-bottom: 20px;">';
            content += '<h4 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px;">按网站统计 (Top 20)</h4>';
            
            if (Object.keys(stats.stats.hosts).length === 0) {
                content += '<p style="color: #95a5a6;">暂无数据</p>';
            } else {
                // 排序并取前20个
                const hosts = Object.entries(stats.stats.hosts).sort((a, b) => b[1] - a[1]).slice(0, 20);
                
                content += '<div style="max-height: 300px; overflow-y: auto; border: 1px solid #ecf0f1; border-radius: 5px;">';
                content += '<table class="rules-table" style="margin: 0;">';
                content += '<thead style="position: sticky; top: 0; background: #f8f9fa; z-index: 1;">';
                content += '<tr><th style="width: 60px;">排名</th><th>网站</th><th style="width: 100px;">调用次数</th></tr>';
                content += '</thead>';
                content += '<tbody>';
                
                hosts.forEach((item, index) => {
                    const [host, count] = item;
                    content += '<tr>';
                    content += '<td style="text-align: center;">' + (index + 1) + '</td>';
                    content += '<td style="word-break: break-all;">' + host + '</td>';
                    content += '<td><strong>' + count + '</strong></td>';
                    content += '</tr>';
                });
                
                content += '</tbody></table>';
                content += '</div>';
                
                if (Object.keys(stats.stats.hosts).length > 20) {
                    content += '<p style="color: #95a5a6; font-size: 12px; margin-top: 10px;">';
                    content += 'ℹ️ 总共 ' + Object.keys(stats.stats.hosts).length + ' 个网站，仅显示前 20 个';
                    content += '</p>';
                }
            }
            content += '</div>';
            
            content += '</div>';
            
            content += '<div class="modal-footer">';
            content += '<button class="modal-btn btn-primary" onclick="closeStatsModal()">关闭</button>';
            content += '</div>';
            
            content += '</div>';
            
            modal.innerHTML = content;
            document.body.appendChild(modal);
            
            // 点击背景关闭
            modal.onclick = function(e) {
                if (e.target === modal) {
                    closeStatsModal();
                }
            };
        }
        
        // 关闭统计模态框
        function closeStatsModal() {
            const modal = document.getElementById('statsModal');
            if (modal) {
                modal.remove();
            }
        }
        
        // ==========================================
        // 安全管理功能
        // ==========================================
        
        // 加载安全统计
        async function loadSecurityStats() {
            try {
                const response = await fetch('/security/stats', {
                    headers: getAuthHeaders()
                });
                
                if (!response.ok) {
                    throw new Error('获取安全统计失败');
                }
                
                const result = await response.json();
                const stats = result.data;
                
                // 更新统计显示
                document.getElementById('whitelistCount').textContent = stats.whitelist_count;
                document.getElementById('blacklistCount').textContent = stats.blacklist_count;
                document.getElementById('lockedIpsCount').textContent = stats.locked_ips_count;
                document.getElementById('failedLoginsCount').textContent = stats.failed_login_ips;
                
                // 更新配置表单
                document.getElementById('enableWhitelist').checked = stats.config.enable_whitelist;
                document.getElementById('enableBlacklist').checked = stats.config.enable_blacklist;
                document.getElementById('enableCsrf').checked = stats.config.enable_csrf;
                document.getElementById('maxLoginFailures').value = stats.config.max_login_failures;
                document.getElementById('lockoutDuration').value = stats.config.lockout_duration;
                
            } catch (error) {
                console.error('加载安全统计失败:', error);
            }
        }
        
        // 加载白名单
        async function loadWhitelist() {
            try {
                const response = await fetch('/security/whitelist', {
                    headers: getAuthHeaders()
                });
                
                if (!response.ok) {
                    throw new Error('获取白名单失败');
                }
                
                const result = await response.json();
                const whitelist = result.data.whitelist;
                
                const container = document.getElementById('whitelistContent');
                
                if (whitelist.length === 0) {
                    container.innerHTML = '<div class="no-data">暂无白名单IP</div>';
                    return;
                }
                
                let html = '';
                whitelist.forEach(ip => {
                    html += `
                        <div class="ip-item">
                            <span class="ip-address">${ip}</span>
                            <button class="ip-remove-btn" onclick="removeFromWhitelist('${ip}')">移除</button>
                        </div>
                    `;
                });
                
                container.innerHTML = html;
                
            } catch (error) {
                console.error('加载白名单失败:', error);
                document.getElementById('whitelistContent').innerHTML = '<div class="no-data">加载失败</div>';
            }
        }
        
        // 加载黑名单
        async function loadBlacklist() {
            try {
                const response = await fetch('/security/blacklist', {
                    headers: getAuthHeaders()
                });
                
                if (!response.ok) {
                    throw new Error('获取黑名单失败');
                }
                
                const result = await response.json();
                const blacklist = result.data.blacklist;
                
                const container = document.getElementById('blacklistContent');
                
                if (blacklist.length === 0) {
                    container.innerHTML = '<div class="no-data">暂无黑名单IP</div>';
                    return;
                }
                
                let html = '';
                blacklist.forEach(ip => {
                    html += `
                        <div class="ip-item">
                            <span class="ip-address">${ip}</span>
                            <button class="ip-remove-btn" onclick="removeFromBlacklist('${ip}')">移除</button>
                        </div>
                    `;
                });
                
                container.innerHTML = html;
                
            } catch (error) {
                console.error('加载黑名单失败:', error);
                document.getElementById('blacklistContent').innerHTML = '<div class="no-data">加载失败</div>';
            }
        }
        
        // 添加到白名单
        async function addToWhitelist() {
            const input = document.getElementById('whitelistIpInput');
            const ip = input.value.trim();
            
            if (!ip) {
                alert('请输入IP地址');
                return;
            }
            
            // 简单的IP格式验证
            const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (!ipPattern.test(ip)) {
                alert('IP地址格式不正确');
                return;
            }
            
            try {
                const response = await fetch('/security/whitelist', {
                    method: 'POST',
                    headers: {
                        ...getAuthHeaders(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ ip: ip })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    alert('添加成功');
                    input.value = '';
                    loadWhitelist();
                    loadSecurityStats();
                } else {
                    alert('添加失败: ' + result.description);
                }
                
            } catch (error) {
                console.error('添加到白名单失败:', error);
                alert('添加失败: ' + error.message);
            }
        }
        
        // 从白名单移除
        async function removeFromWhitelist(ip) {
            if (!confirm(`确定要从白名单移除 ${ip} 吗？`)) {
                return;
            }
            
            try {
                const response = await fetch('/security/whitelist', {
                    method: 'DELETE',
                    headers: {
                        ...getAuthHeaders(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ ip: ip })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    alert('移除成功');
                    loadWhitelist();
                    loadSecurityStats();
                } else {
                    alert('移除失败: ' + result.description);
                }
                
            } catch (error) {
                console.error('从白名单移除失败:', error);
                alert('移除失败: ' + error.message);
            }
        }
        
        // 添加到黑名单
        async function addToBlacklist() {
            const input = document.getElementById('blacklistIpInput');
            const ip = input.value.trim();
            
            if (!ip) {
                alert('请输入IP地址');
                return;
            }
            
            // 简单的IP格式验证
            const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (!ipPattern.test(ip)) {
                alert('IP地址格式不正确');
                return;
            }
            
            try {
                const response = await fetch('/security/blacklist', {
                    method: 'POST',
                    headers: {
                        ...getAuthHeaders(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ ip: ip })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    alert('添加成功');
                    input.value = '';
                    loadBlacklist();
                    loadSecurityStats();
                } else {
                    alert('添加失败: ' + result.description);
                }
                
            } catch (error) {
                console.error('添加到黑名单失败:', error);
                alert('添加失败: ' + error.message);
            }
        }
        
        // 从黑名单移除
        async function removeFromBlacklist(ip) {
            if (!confirm(`确定要从黑名单移除 ${ip} 吗？`)) {
                return;
            }
            
            try {
                const response = await fetch('/security/blacklist', {
                    method: 'DELETE',
                    headers: {
                        ...getAuthHeaders(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ ip: ip })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    alert('移除成功');
                    loadBlacklist();
                    loadSecurityStats();
                } else {
                    alert('移除失败: ' + result.description);
                }
                
            } catch (error) {
                console.error('从黑名单移除失败:', error);
                alert('移除失败: ' + error.message);
            }
        }
        
        // 更新安全配置
        async function updateSecurityConfig() {
            const config = {
                enable_whitelist: document.getElementById('enableWhitelist').checked,
                enable_blacklist: document.getElementById('enableBlacklist').checked,
                enable_csrf: document.getElementById('enableCsrf').checked,
                max_login_failures: parseInt(document.getElementById('maxLoginFailures').value),
                lockout_duration: parseInt(document.getElementById('lockoutDuration').value)
            };
            
            try {
                const response = await fetch('/security/config', {
                    method: 'PUT',
                    headers: {
                        ...getAuthHeaders(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(config)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    console.log('安全配置已更新');
                    loadSecurityStats();
                } else {
                    alert('更新失败: ' + result.description);
                }
                
            } catch (error) {
                console.error('更新安全配置失败:', error);
                alert('更新失败: ' + error.message);
            }
        }
        
        // ==========================================
        // 识别历史功能
        // ==========================================
        
        // 加载识别历史记录
        // 加载历史记录筛选选项
        async function loadHistoryFilters() {
            try {
                const response = await fetch('/history/filters', {
                    headers: getAuthHeaders()
                });
                
                if (!response.ok) {
                    return; // 静默失败
                }
                
                const result = await response.json();
                const filters = result.data;
                
                // 填充网站下拉列表
                const hostFilter = document.getElementById('historyHostFilter');
                if (hostFilter) {
                    hostFilter.innerHTML = '<option value="">全部网站</option>';
                    filters.hosts.forEach(host => {
                        if (host !== 'unknown') {
                            const option = document.createElement('option');
                            option.value = host;
                            option.textContent = host;
                            hostFilter.appendChild(option);
                        }
                    });
                }
                
                // 填充API Key下拉列表
                const apiKeyFilter = document.getElementById('historyApiKeyFilter');
                if (apiKeyFilter) {
                    apiKeyFilter.innerHTML = '<option value="">全部 API Key</option>';
                    filters.api_keys.forEach(item => {
                        const option = document.createElement('option');
                        option.value = item.key;
                        option.textContent = item.name;
                        apiKeyFilter.appendChild(option);
                    });
                }
            } catch (error) {
                console.error('加载筛选选项失败:', error);
            }
        }
        
        // 加载历史记录（支持完整筛选）
        async function loadHistoryRecords() {
            const container = document.getElementById('historyRecords');
            container.innerHTML = '<div class="no-data">加载中...</div>';
            
            try {
                // 获取筛选条件
                const typeFilter = document.getElementById('historyTypeFilter')?.value || '';
                const hostFilter = document.getElementById('historyHostFilter')?.value || '';
                const apiKeyFilter = document.getElementById('historyApiKeyFilter')?.value || '';
                const statusFilter = document.getElementById('historyStatusFilter')?.value || '';
                const startDate = document.getElementById('historyStartDate')?.value || '';
                const endDate = document.getElementById('historyEndDate')?.value || '';
                const limitFilter = document.getElementById('historyLimitFilter')?.value || '50';
                
                // 构建URL
                let url = `/history/records?limit=${limitFilter}`;
                if (typeFilter) url += `&ocr_type=${typeFilter}`;
                if (hostFilter) url += `&host=${encodeURIComponent(hostFilter)}`;
                if (apiKeyFilter) url += `&api_key=${encodeURIComponent(apiKeyFilter)}`;
                if (statusFilter) url += `&status=${statusFilter}`;
                if (startDate) {
                    const timestamp = new Date(startDate).getTime() / 1000;
                    url += `&start_date=${timestamp}`;
                }
                if (endDate) {
                    const date = new Date(endDate);
                    date.setHours(23, 59, 59, 999);
                    const timestamp = date.getTime() / 1000;
                    url += `&end_date=${timestamp}`;
                }
                
                const response = await fetch(url, {
                    headers: getAuthHeaders()
                });
                
                if (!response.ok) {
                    throw new Error('获取历史记录失败');
                }
                
                const result = await response.json();
                const records = result.data;
                const stats = result.stats;
                
                // 更新统计数据
                if (stats) {
                    const totalEl = document.getElementById('filteredTotal');
                    const successEl = document.getElementById('filteredSuccess');
                    const failedEl = document.getElementById('filteredFailed');
                    const rateEl = document.getElementById('filteredSuccessRate');
                    
                    if (totalEl) totalEl.textContent = stats.total || 0;
                    if (successEl) successEl.textContent = stats.success || 0;
                    if (failedEl) failedEl.textContent = stats.failed || 0;
                    if (rateEl) {
                        const rate = stats.total > 0 ? (stats.success / stats.total * 100).toFixed(1) : 0;
                        rateEl.textContent = rate + '%';
                    }
                    
                    // 显示详细统计
                    showDetailedStats(stats);
                }
                
                // 显示记录
                if (records.length === 0) {
                    container.innerHTML = '<div class="no-data">暂无符合条件的历史记录</div>';
                    return;
                }
                
                // 渲染记录
                let html = '';
                const typeMap = {'1': '英数验证码', '4': '滑动拼图', '5': '滑块行为'};
                
                records.forEach(record => {
                    const date = new Date(record.datetime);
                    const timeStr = date.toLocaleString('zh-CN');
                    const typeName = typeMap[record.ocr_type] || record.ocr_type;
                    const statusIcon = record.success ? '✅ 成功' : '❌ 失败';
                    const statusColor = record.success ? '#52c41a' : '#f5222d';
                    
                    html += `
                        <div class="history-record">
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 13px;">
                                <div>
                                    <div style="color: #999; margin-bottom: 5px;">时间</div>
                                    <div style="font-weight: bold;">${timeStr}</div>
                                </div>
                                <div>
                                    <div style="color: #999; margin-bottom: 5px;">类型</div>
                                    <div style="font-weight: bold; color: #1890ff;">${typeName}</div>
                                </div>
                                <div>
                                    <div style="color: #999; margin-bottom: 5px;">网站</div>
                                    <div style="font-weight: bold;">${record.host || '-'}</div>
                                </div>
                                <div>
                                    <div style="color: #999; margin-bottom: 5px;">API Key</div>
                                    <div style="font-weight: bold; font-size: 12px;">${record.api_key_name || (record.api_key ? record.api_key.substring(0, 12) + '...' : '-')}</div>
                                </div>
                                <div>
                                    <div style="color: #999; margin-bottom: 5px;">状态</div>
                                    <div style="font-weight: bold; color: ${statusColor};">${statusIcon}</div>
                                </div>
                                <div>
                                    <div style="color: #999; margin-bottom: 5px;">耗时</div>
                                    <div style="font-weight: bold;">${record.duration ? (record.duration < 1 ? (record.duration * 1000).toFixed(0) + 'ms' : record.duration.toFixed(2) + 's') : '-'}</div>
                                </div>
                            </div>
                            ${record.result ? `
                                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #f0f0f0;">
                                    <div style="color: #999; font-size: 12px; margin-bottom: 5px;">识别结果</div>
                                    <div style="font-family: monospace; background: #f9f9f9; padding: 8px; border-radius: 4px; font-size: 14px;">
                                        ${record.result}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    `;
                });
                
                container.innerHTML = html;
                
            } catch (error) {
                console.error('加载历史记录失败:', error);
                container.innerHTML = '<div class="no-data">加载失败: ' + error.message + '</div>';
            }
        }
        
        // 显示详细统计
        function showDetailedStats(stats) {
            const detailedStatsDiv = document.getElementById('detailedStats');
            if (!detailedStatsDiv) return;
            
            detailedStatsDiv.style.display = 'block';
            
            // 按类型统计
            const typeStats = stats.by_type || {};
            const typeStatsDiv = document.getElementById('typeStats');
            if (typeStatsDiv) {
                const typeNames = {'1': '英数验证码', '4': '滑动拼图', '5': '滑块行为'};
                typeStatsDiv.innerHTML = renderStats(typeStats, typeNames);
            }
            
            // 按网站统计（Top 5）
            const hostStats = stats.by_host || {};
            const hostStatsDiv = document.getElementById('hostStats');
            if (hostStatsDiv) {
                const hostStatsArray = Object.entries(hostStats)
                    .sort((a, b) => b[1].total - a[1].total)
                    .slice(0, 5);
                const hostStatsObj = Object.fromEntries(hostStatsArray);
                hostStatsDiv.innerHTML = renderStats(hostStatsObj);
            }
            
            // 按API Key统计
            const apiKeyStats = stats.by_api_key || {};
            const apiKeyStatsDiv = document.getElementById('apiKeyStats');
            if (apiKeyStatsDiv) {
                apiKeyStatsDiv.innerHTML = renderStats(apiKeyStats);
            }
        }
        
        // 渲染统计数据
        function renderStats(statsObj, nameMap = {}) {
            if (Object.keys(statsObj).length === 0) {
                return '<div style="color: #999; font-size: 12px;">暂无数据</div>';
            }
            
            let html = '';
            for (const [key, value] of Object.entries(statsObj)) {
                const displayName = nameMap[key] || key;
                const total = value.total || 0;
                const success = value.success || 0;
                const failed = value.failed || 0;
                const rate = total > 0 ? (success / total * 100).toFixed(1) : 0;
                
                html += `
                    <div class="stat-item">
                        <span class="stat-label">${displayName}</span>
                        <span class="stat-value">
                            ${total} 次
                            (<span class="stat-success">${success}</span> /
                            <span class="stat-failed">${failed}</span>,
                            ${rate}%)
                        </span>
                    </div>
                `;
            }
            
            return html;
        }
        
        // 重置筛选条件
        function resetFilters() {
            const typeFilter = document.getElementById('historyTypeFilter');
            const hostFilter = document.getElementById('historyHostFilter');
            const apiKeyFilter = document.getElementById('historyApiKeyFilter');
            const statusFilter = document.getElementById('historyStatusFilter');
            const startDate = document.getElementById('historyStartDate');
            const endDate = document.getElementById('historyEndDate');
            const limitFilter = document.getElementById('historyLimitFilter');
            
            if (typeFilter) typeFilter.value = '';
            if (hostFilter) hostFilter.value = '';
            if (apiKeyFilter) apiKeyFilter.value = '';
            if (statusFilter) statusFilter.value = '';
            if (startDate) startDate.value = '';
            if (endDate) endDate.value = '';
            if (limitFilter) limitFilter.value = '50';
            
            loadHistoryRecords();
        }
        
        // 加载历史统计
        async function loadHistoryStats() {
            try {
                const response = await fetch('/history/stats', {
                    headers: getAuthHeaders()
                });
                
                if (!response.ok) {
                    throw new Error('获取统计失败');
                }
                
                const result = await response.json();
                const stats = result.data;
                
                // 使用正确的元素ID更新统计数据
                const totalEl = document.getElementById('filteredTotal');
                const successEl = document.getElementById('filteredSuccess');
                const failedEl = document.getElementById('filteredFailed');
                const rateEl = document.getElementById('filteredSuccessRate');
                
                if (totalEl) totalEl.textContent = stats.total || 0;
                if (successEl) successEl.textContent = stats.success || 0;
                if (failedEl) failedEl.textContent = stats.failed || 0;
                if (rateEl) {
                    const rate = stats.success_rate ? (stats.success_rate * 100).toFixed(1) : '0.0';
                    rateEl.textContent = rate + '%';
                }
                
            } catch (error) {
                console.error('加载统计失败:', error);
            }
        }
        
        // 清除历史
        async function clearHistory() {
            if (!confirm('确定要清除所有历史记录吗？此操作不可恢复！')) {
                return;
            }
            
            try {
                const response = await fetch('/history/clear', {
                    method: 'POST',
                    headers: getAuthHeaders()
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    alert('历史记录已清除');
                    loadHistoryRecords();
                    loadHistoryStats();
                } else {
                    alert('清除失败: ' + result.description);
                }
                
            } catch (error) {
                console.error('清除历史失败:', error);
                alert('清除失败: ' + error.message);
            }
        }
        
        // ==========================================
        // 模型管理功能
        // ==========================================
        
        // 加载模型列表
        async function loadModels() {
            try {
                const response = await fetch('/models', {
                    headers: getAuthHeaders()
                });
                
                if (!response.ok) {
                    throw new Error('获取模型失败');
                }
                
                const result = await response.json();
                const models = result.models;
                const currentModel = result.current_model;
                
                // 更新当前模型显示
                const currentModelInfo = models[currentModel];
                document.getElementById('currentModelName').textContent = 
                    currentModelInfo ? currentModelInfo.display_name : currentModel;
                
                // 显示模型列表
                const container = document.getElementById('modelsContent');
                let html = '';
                
                for (const [key, model] of Object.entries(models)) {
                    const isCurrent = key === currentModel;
                    const statusBadge = isCurrent ? 
                        '<span style="color: #52c41a; margin-left: 10px;">✅ 使用中</span>' : '';
                    
                    html += `
                        <div class="ip-item" style="flex-direction: column; align-items: flex-start;">
                            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                                <div>
                                    <strong>${model.display_name}</strong>
                                    ${statusBadge}
                                </div>
                                ${!isCurrent ? `<button class="btn-primary" onclick="switchModel('${key}')">切换</button>` : ''}
                            </div>
                            <div style="color: #666; font-size: 12px; margin-top: 5px;">
                                ${model.description}
                            </div>
                        </div>
                    `;
                }
                
                container.innerHTML = html;
                
            } catch (error) {
                console.error('加载模型失败:', error);
                document.getElementById('modelsContent').innerHTML = '<div class="no-data">加载失败</div>';
            }
        }
        
        // 切换模型
        async function switchModel(modelName) {
            try {
                const response = await fetch('/models/current', {
                    method: 'PUT',
                    headers: {
                        ...getAuthHeaders(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ model_name: modelName })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    alert('模型已切换');
                    loadModels();
                } else {
                    alert('切换失败: ' + result.description);
                }
                
            } catch (error) {
                console.error('切换模型失败:', error);
                alert('切换失败: ' + error.message);
            }
        }
        
        // 加载预处理选项
        async function loadPreprocessing() {
            try {
                const response = await fetch('/models/preprocessing', {
                    headers: getAuthHeaders()
                });
                
                if (!response.ok) {
                    throw new Error('获取预处理选项失败');
                }
                
                const result = await response.json();
                const options = result.options;
                
                const container = document.getElementById('preprocessingContent');
                let html = '';
                
                for (const [key, option] of Object.entries(options)) {
                    html += `
                        <div class="form-row">
                            <label class="form-label">
                                <input type="checkbox" id="prep_${key}" 
                                    ${option.enabled ? 'checked' : ''}
                                    onchange="updatePreprocessing('${key}', this.checked)">
                                ${option.name}
                            </label>
                            <span class="form-hint">${option.description}</span>
                        </div>
                    `;
                }
                
                container.innerHTML = html;
                
            } catch (error) {
                console.error('加载预处理选项失败:', error);
                document.getElementById('preprocessingContent').innerHTML = '<div class="no-data">加载失败</div>';
            }
        }
        
        // 更新预处理选项
        async function updatePreprocessing(optionName, enabled) {
            try {
                const response = await fetch('/models/preprocessing', {
                    method: 'PUT',
                    headers: {
                        ...getAuthHeaders(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        option_name: optionName,
                        enabled: enabled 
                    })
                });
                
                const result = await response.json();
                
                if (!response.ok) {
                    alert('更新失败: ' + result.description);
                    // 恢复checkbox状态
                    document.getElementById(`prep_${optionName}`).checked = !enabled;
                }
                
            } catch (error) {
                console.error('更新预处理选项失败:', error);
                alert('更新失败: ' + error.message);
            }
        }
    