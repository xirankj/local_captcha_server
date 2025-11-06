// ==========================================
// 本地版验证码识别脚本
// ==========================================
// 服务地址: http://localhost:1205/
// 使用前请确保本地服务已启动
// ==========================================

// ==UserScript==
// @name         万能验证码自动输入(本地API Key)
// @namespace    http://localhost:1205/
// @version      6.8.0-local-apikey
// @description  本地版验证码识别脚本，支持英数字、滑动拼图、滑块行为验证码，增加API Key验证功能
// @author       crab + AI Assistant
// @match        *://*/*
// @connect      localhost
// @connect      127.0.0.1
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/2.2.4/jquery.min.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @grant        GM_openInTab
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_xmlhttpRequest
// @nocompat     Chrome
// ==/UserScript==

let Set = undefined;

class CaptchaWrite {
    IdCard() {
        return Set["idCard"] == undefined ? "local-user" : Set["idCard"];
    }

    getApiKey() {
        return Set["apiKey"] == undefined ? "" : Set["apiKey"];
    }

    getCaptchaServerUrl() {
      return "http://localhost:1205/";
    }

    constructor() {
        this.Tip = this.AddTip();
        if (GM_listValues().indexOf("set") == -1) {
            var WhetherHelp = confirm("【本地版】万能验证码填入\n初始化完毕!\n使用本地识别服务，无需识别码！\n在将来的时间里将会在后台默默的为你\n自动识别页面是否存在验证码并填入。\n对于一些书写不规整的验证码页面请手动添加规则。\n\n提示：请确保本地服务已启动(http://localhost:1205)");
            if (WhetherHelp == true) {
                this.openHelp();
            }
        }
        Set = GM_getValue("set");
        Set = Set == undefined ? {} : Set;
        // 设置默认配置
        var configSetKeys = {
            "autoIdentification": "true",
            "showHintCheck": "true",
            "warningTone": "true",
            "autoBlackList": "false",
            "hotKeyToImgResult": "false",
            "idCard": "local-user",
            "apiKey": ""
        };
        $.each(configSetKeys, function (key, val) {
            if (Set[key] == undefined) {
                Set[key] = val;
                GM_setValue("set", Set);
            }
        });
    }

    // 恢复出厂设置
    clearSet() {
        var that = this;
        let res = confirm('您确认要恢复出厂设置吗？注意：清除后所有内容均需重新设置！');
        if (res == true) {
            GM_setValue("set", { "idCard": "" });
        }
        return res;
    }

    // 打开帮助页面
    openHelp() {
        return GM_openInTab(this.getCaptchaServerUrl() + "help.html", {
            active: true
        });
    }

    // 设置 API Key
    SetApiKey() {
        var that = this;
        var currentKey = this.getApiKey();
        var keyDisplay = currentKey ? currentKey.substring(0, 10) + '...' : '未设置';

        var newKey = prompt(
            '📝 配置 API Key (用于安全访问验证码识别服务)\n\n' +
            '当前 API Key: ' + keyDisplay + '\n\n' +
            '🔐 安全说明:\n' +
            '- API Key 通过请求头安全传输\n' +
            '- 不会出现在URL或日志中\n' +
            '- 请妥善保管您的API Key\n\n' +
            '📋 获取 API Key:\n' +
            '1. 浏览器访问管理后台: http://localhost:1205\n' +
            '2. 使用管理员账号登录\n' +
            '3. 点击左侧菜单 "API Keys"\n' +
            '4. 点击 "创建 API Key"\n' +
            '5. 复制生成的完整 API Key\n' +
            '6. 粘贴到下方的输入框\n\n' +
            '⚠️  注意: 如果不输入，将无法使用验证码识别服务',
            currentKey
        );

        if (newKey !== null) {
            // 用户点击了确定（即使是空字符串）
            Set['apiKey'] = newKey.trim();
            GM_setValue('set', Set);

            if (newKey.trim() === '') {
                alert('✅ API Key 已清除，将不使用 API 验证\n\n注意: 如果后端启用了强制 API Key 验证，需要重新设置\n\n如果无法访问识别服务，请重新设置API Key');
            } else {
                alert('✅ API Key 设置成功！\n\nAPI Key: ' + newKey.substring(0, 20) + '...\n\n注意:\n1. 请刷新页面后生效\n2. API Key 通过请求头安全传输\n3. 请妥善保管您的API Key，不要泄露');
            }

            // 清除所有缓存，确保使用新的 API Key
            for (var key in localStorage) {
                if (key.indexOf('CapFooww_') === 0) {
                    localStorage.removeItem(key);
                }
            }
        }
    }

    // 打开 API Key 管理页面
    openApiKeyManager() {
        return GM_openInTab(this.getCaptchaServerUrl(), {
            active: true
        });
    }

    //手动添加英数规则
    LetterPickUp() {
        let that = this;
        let AddRule = {};
        let IdentifyResult = '';
        
        // 确保提示功能启用
        if (Set["showHintCheck"] != "true") {
            Set["showHintCheck"] = "true";
            GM_setValue("set", Set);
        }
        
        that.Hint('请对验证码图片点击右键！', 1000 * 50);
        $("canvas,img,input[type='image']").each(function () {
            $(this).on("contextmenu mousedown", function (e) {// 为了避免某些hook的拦截
                if (e.button != 2) {//不为右键则返回
                    return;
                }
                if (that.getCapFoowwLocalStorage("crabAddRuleLock") != null) {
                    return;
                }
                that.setCapFoowwLocalStorage("crabAddRuleLock", "lock", new Date().getTime() + 100);//100毫秒内只能1次
                let img = that.Aimed($(this));
                // console.log('[手动添加规则]验证码图片规则为:' + img);
                if ($(img).length != 1) {
                    that.Hint('验证码选择错误，该图片实际对应多个元素。')
                    return;
                }

                that.Hint('等待识别')
                IdentifyResult = that.ImgPathToResult(img, function ManualRule(img, IdentifyResult) {
                    if (img && IdentifyResult) {
                        console.log('记录信息' + img + IdentifyResult);
                        AddRule['img'] = img;
                        $("img").each(function () {
                            $(this).off("click");
                            $(this).off("on");
                            $(this).off("load");
                        });
                        that.Hint('接下来请点击验证码输入框', 1000 * 50);
                        $("input,textarea").each(function () {
                            $(this).click(function () {
                                var input = that.Aimed($(this));
                                // console.log('LetterPickUp_input' + input);
                                AddRule['input'] = input;
                                AddRule['path'] = window.location.href;
                                AddRule['title'] = document.title;
                                AddRule['host'] = window.location.host;
                                AddRule['ocr_type'] = 1;
                                AddRule['idcard'] = that.IdCard();
                                that.WriteImgCodeResult(IdentifyResult, input);
                                that.Hint('完成')
                                //移除事件
                                $("input").each(function () {
                                    $(this).off("click");
                                });
                                //添加信息
                                that.Query({
                                    "method": "captchaHostAdd", "data": AddRule
                                }, function (data) {
                                    writeResultIntervals[writeResultIntervals.length] = {"img": img, "input": input}
                                });
                                that.delCapFoowwLocalStorage(window.location.host);
                            });
                        });
                    }
                });
            });
        });
        that.sendPostMessage("LetterPickUp")
    }

    //手动添加滑动拼图规则
    SlidePickUp() {
        // 确保提示功能启用
        if (Set["showHintCheck"] != "true") {
            Set["showHintCheck"] = "true";
            GM_setValue("set", Set);
        }
        
        crabCaptcha.Hint('请依次点击滑动拼图验证码的大图、小图、滑块（若无法区分请前往官网查看帮助文档）。', 1000 * 50)
        $("canvas,img,div,button,span").each(function () {
            $(this).on("contextmenu mousedown click", function (e) {// 为了避免某些hook的拦截
                if (e.type != 'click' && e.button != 2) {//不为右键则返回
                    return;
                }
                crabCaptcha.onSlideTagClick(e);
            });
        });

        crabCaptcha.sendPostMessage("SlidePickUp");
    }

    //递归发送postMessage给iframe中得脚本
    sendPostMessage(funName) {
        const iframes = document.querySelectorAll("iframe");
        iframes.forEach((iframe) => {
            iframe.contentWindow.postMessage({
                sign: "crab",
                action: funName,
            }, "*");
        });
    }

    // 添加滑动拼图规则
    onSlideTagClick(e) {
        var that = this;
        let el = e.target;
        let tagName = el.tagName.toLowerCase();
        let eleWidth = Number(that.getNumber(that.getElementStyle(el).width)) || 0;
        let eleHeight = Number(that.getNumber(that.getElementStyle(el).height)) || 0;
        let eleTop = Number($(el).offset().top) || 0;
        let storagePathCache = that.getCapFoowwLocalStorage("slidePathCache");
        let ruleCache = (storagePathCache && storagePathCache) || {ocr_type: 4};

        // 特殊处理 button 和 span 元素作为滑块
        if (tagName === "button" || tagName === "span") {
            var smallImgRule = null;
            if (storagePathCache != null && (smallImgRule = storagePathCache['small_image']) != null) {
                // 如果已经选择了小图，且元素在小图下方，则认为是滑块
                if ($(smallImgRule).offset().top < eleTop) {
                    ruleCache['move_item'] = that.Aimed(el);
                    that.setCapFoowwLocalStorage("slidePathCache", ruleCache, new Date().getTime() + 1000 * 60);
                    const elementType = tagName === "button" ? "按钮" : "Span元素";
                    that.Hint(`您已成功选择滑块（${elementType}）。`, 5000);

                    // 检查是否完成全部选择
                    const finish = Object.keys(ruleCache).filter((item) => item).length == 4;
                    if (finish) {
                        that.finishSlideRule(ruleCache);
                    }
                    return;
                } else {
                    that.Hint('请先选择大图和小图，再选择滑块。', 3000);
                    return;
                }
            } else {
                // 如果还没选择小图，提示用户先选择图片
                that.Hint('请先依次选择大图和小图，最后选择滑块。', 3000);
                return;
            }
        }

        if (tagName === "img") {
            if (eleWidth >= eleHeight && eleWidth > 150) {
                ruleCache['big_image'] = that.Aimed(el);
                that.setCapFoowwLocalStorage("slidePathCache", ruleCache, new Date().getTime() + 1000 * 60);
                that.Hint('您已成功选择大图片。', 5000);
                that.checkTargetNeedZIndex(ruleCache, el);
            } else if (eleWidth < 100 && eleWidth > 15 && eleWidth - eleHeight <= 10) {
                ruleCache['small_image'] = that.Aimed(el);
                that.setCapFoowwLocalStorage("slidePathCache", ruleCache, new Date().getTime() + 1000 * 60);
                that.Hint('您已成功选择小图片。', 5000);
                that.checkTargetNeedZIndex(ruleCache, el);
            }
        } else {
            let curEl = el;
            for (let i = 0; i < 3; i++) {
                if (!curEl || curEl === Window) {
                    break;
                }
                let position = that.getElementStyle(curEl).position;
                let bgUrl = that.getElementStyle(curEl)["backgroundImage"];
                eleWidth = Number(that.getNumber(that.getElementStyle(curEl).width)) || 0;
                eleHeight = Number(that.getNumber(that.getElementStyle(curEl).height)) || 0;

                if ((position === "absolute" || that.checkClassName(curEl, "slide") ) && eleWidth < 100 && eleHeight < 100) {
                    //如果是绝对定位，并且宽高小于100，基本上就是滑块了
                    var smallImgRule = null;
                    if (storagePathCache != null && (smallImgRule = storagePathCache['small_image']) != null) {
                        //检查一下滑块是否比小图低
                        if ($(smallImgRule).offset().top < eleTop) {
                            ruleCache['move_item'] = that.Aimed(curEl);
                            that.setCapFoowwLocalStorage("slidePathCache", ruleCache, new Date().getTime() + 1000 * 60);
                            that.Hint('您已成功选择滑块。', 5000);
                            break;
                        }
                    }
                }
                let reg = /url\("(.+)"\)/im;
                if (bgUrl && bgUrl.match(reg)) {
                    // 根据背景图去做操作
                    if (eleWidth >= eleHeight && eleWidth > 150) {
                        ruleCache['big_image'] = that.Aimed(el);
                        that.Hint('您已成功选择大图片。', 5000);
                        that.setCapFoowwLocalStorage("slidePathCache", ruleCache, new Date().getTime() + 1000 * 60);
                        that.checkTargetNeedZIndex(ruleCache, curEl);
                        break;
                    } else if (eleWidth < 100 && eleWidth > 15 && eleWidth - eleHeight <= 10) {
                        ruleCache['small_image'] = that.Aimed(el);
                        that.Hint('您已成功选择小图片。', 5000);
                        that.setCapFoowwLocalStorage("slidePathCache", ruleCache, new Date().getTime() + 1000 * 60);
                        that.checkTargetNeedZIndex(ruleCache, curEl);
                        break;
                    }
                }
                if (tagName === "canvas") {
                    // 如果是canvas 直接寻找class中特定样式
                    if ((that.checkClassName(curEl, "canvas_bg") || that.checkClassName(curEl.parentNode, "captcha_basic_bg")) || (position != "absolute" && (eleWidth >= 300 && eleWidth >= eleHeight * 1.5 && eleWidth <= eleHeight * 3))) {
                        ruleCache['big_image'] = that.Aimed(el);
                        that.Hint('您已成功选择大图片。', 5000);
                        that.setCapFoowwLocalStorage("slidePathCache", ruleCache, new Date().getTime() + 1000 * 60);
                        that.checkTargetNeedZIndex(ruleCache, curEl);
                        break;
                    } else if (that.checkClassName(curEl, "slide") || that.checkClassName(curEl, "slice") || that.checkClassName(curEl, "mark") || that.checkClassName(curEl, "block")) {
                        ruleCache['small_image'] = that.Aimed(el);
                        that.Hint('您已成功选择小图片。', 5000);
                        that.setCapFoowwLocalStorage("slidePathCache", ruleCache, new Date().getTime() + 1000 * 60);
                        that.checkTargetNeedZIndex(ruleCache, curEl);
                        break;
                    }
                }

                curEl = curEl.parentNode;
            }

            curEl = el;
            const firstImg = curEl.querySelector("img");
            firstImg && that.onSlideTagClick({target: firstImg});
        }
        const finish = Object.keys(ruleCache).filter((item) => item).length == 4;
        if (finish) {
            that.finishSlideRule(ruleCache);
        }
    }

    /**
     * 完成滑动拼图规则添加
     * @param ruleCache
     */
    finishSlideRule(ruleCache) {
        var that = this;
        $("canvas,img,div,button,span").each(function () {
            $(this).off("click");
            $(this).off("contextmenu");
            $(this).off("mousedown");
        });

        var AddRule = {};
        AddRule['path'] = window.location.href;
        AddRule['title'] = document.title;
        AddRule['host'] = window.location.host;
        AddRule['idcard'] = that.IdCard();

        for (var key in ruleCache) {
            AddRule[key] = ruleCache[key];
        }

        //添加规则
        that.Query({"method": "captchaHostAdd", "data": AddRule});

        that.Hint('规则添加完毕，开始识别中。', 5000);
        ruleCache.ocrType = 4;
        writeResultIntervals[writeResultIntervals.length] = ruleCache;
        that.checkSlideCaptcha(ruleCache);
        that.delCapFoowwLocalStorage("slidePathCache");
    }

    /**
     * 判断是否存在指定className
     * @param curEl
     * @param Name
     * @returns {boolean}
     */
    checkClassName(curEl, Name) {
        var a = curEl.classList;
        for (var i = 0; i < a.length; i++) {
            if (a[i].indexOf(Name) != -1) {
                return true;
            }
        }
        return false;
    }

    /**
     * 判断判断滑块元素是否需要降级
     * @param curEl
     * @param Name
     * @returns {boolean}
     */
    checkTargetNeedZIndex(ruleCache, curEl) {
        if (ruleCache['big_image'] != null && ruleCache['small_image'] != null) {
            $(ruleCache['big_image']).css("z-index", "9998");
            $(ruleCache['small_image']).css("z-index", "9999");
        } else {
            $(curEl).css("z-index", "-1");
        }
        return false;
    }

    // 检查滑动拼图验证码并识别
    checkSlideCaptcha(slideCache) {
        var that = this;
        const {big_image, small_image, move_item} = slideCache;

        document.querySelector(big_image).onload = function () {
            that.checkSlideCaptcha(slideCache);
        }

        //判断验证码是否存在并可见
        if (!big_image || !small_image || !move_item || document.querySelector(small_image) == null
            || document.querySelector(big_image) == null || document.querySelector(move_item) == null
            || !$(small_image).is(":visible") || !$(big_image).is(":visible") || !$(move_item).is(":visible")) {
            // console.log("滑动拼图验证码不可见，本次不识别");
            return;
        }


        const check = async () => {
            try {
                var Results = that.getCapFoowwLocalStorage("验证码滑动整体超时锁");
                if (Results != null) {
                    return;
                }
                // console.log("滑动拼图验证码出现，准备开始识别");
                var bigImgElem = document.querySelector(big_image);
                var smallImgElem = document.querySelector(small_image);
                var moveItemElem = document.querySelector(move_item);

                const big_base64 = await that.ImgElemToBase64(bigImgElem);
                const small_base64 = await that.ImgElemToBase64(smallImgElem);
                if (!big_base64 || !small_base64) {
                    // 本轮未获取到有效图片（可能跨域处理中），等待下次重试
                    return;
                }
            $(bigImgElem).removeAttr("crab-src-base64");
            $(smallImgElem).removeAttr("crab-src-base64");
            if (small_base64 == null || big_base64 == null) {
                // console.log("滑动拼图验证码为null");
                return;
            }

            var big_base64Hash = that.strHash(big_base64);
            if (that.getCapFoowwLocalStorage("滑块识别缓存：" + big_base64Hash) != null) {
                return;
            }
            that.setCapFoowwLocalStorage("滑块识别缓存：" + big_base64Hash, "同一个滑块仅识别一次", new Date().getTime() + (1000 * 60 * 60));//同一个滑块1小时内仅识别一次
            this.Hint("开始滑动， 在下一条提示之前，请勿操作鼠标！", 5000)

            let bigWidth = that.getNumber(that.getElementStyle(bigImgElem)['width']);
            let smallWidth = that.getNumber(that.getElementStyle(smallImgElem)['width']);

            var postData = {
                big_image: big_base64,
                small_image: small_base64,
                big_image_width: bigWidth,
                small_image_width: smallWidth,
                ocr_type: 4
            }

            that.Identify_Crab(null, postData, function Slide(data) {
                console.log("等待滑动距离：" + data.data)
                that.moveSideCaptcha(bigImgElem, smallImgElem, moveItemElem, data);
            });
            } catch (e) {
                console.error('滑动拼图图片转换失败:', e);
                // 失败不抛出，静默等待下次重试
            }
        }
        check();
    }

    //手动添加滑块行为规则
    slideBehaviorRule() {
        // 确保提示功能启用
        if (Set["showHintCheck"] != "true") {
            Set["showHintCheck"] = "true";
            GM_setValue("set", Set);
        }
        
        crabCaptcha.Hint('请点击一次滑块。注意：滑块行为类验证码仅有一个滑块！', 1000 * 50)
        $("canvas,img,div,button,span").each(function () {
            $(this).on("contextmenu mousedown click", function (e) {// 为了避免某些hook的拦截
                if (e.type != 'click' && e.button != 2) {//不为右键则返回
                    return;
                }
                crabCaptcha.onSlideBehaviorClick(e);
            });
        });

        crabCaptcha.sendPostMessage("slideBehaviorRule");
    }

    // 添加滑块行为规则
    onSlideBehaviorClick(e) {
        var that = this;
        let el = e.target;
        let eleWidth = Number(that.getNumber(that.getElementStyle(el).width)) || 0;
        let eleHeight = Number(that.getNumber(that.getElementStyle(el).height)) || 0;
        let storagePathCache = that.getCapFoowwLocalStorage("slidePathCache");


        let curEl = el;
        for (let i = 0; i < 3; i++) {
            if (!curEl || curEl === Window) {
                break;
            }
            let position = that.getElementStyle(curEl).position;
            eleWidth = Number(that.getNumber(that.getElementStyle(curEl).width)) || 0;
            eleHeight = Number(that.getNumber(that.getElementStyle(curEl).height)) || 0;

            if (position === "absolute" && eleWidth < 100 && eleHeight < 100) {
                //如果是绝对定位，并且宽高小于100，基本上就是滑块了
                $("canvas,img,div").each(function () {
                    $(this).off("click");
                });
                let AddRule = (storagePathCache && storagePathCache) || {ocr_type: 5};
                AddRule['path'] = window.location.href;
                AddRule['title'] = document.title;
                AddRule['host'] = window.location.host;
                AddRule['move_item'] = that.Aimed(curEl);
                AddRule['idcard'] = that.IdCard();

                //添加规则
                that.Query({"method": "captchaHostAdd", "data": AddRule});

                that.Hint('规则添加完毕，开始识别中。', 5000);
                AddRule.ocrType = 5;
                writeResultIntervals[writeResultIntervals.length] = AddRule;
                that.checkSlideBehaviorCaptcha(AddRule);
                that.delCapFoowwLocalStorage("slidePathCache")
                that.Hint('您已成功选择滑块。', 5000);
                break;
            }
            curEl = curEl.parentNode;
        }
    }

    // 检查滑块行为验证码并识别
    checkSlideBehaviorCaptcha(slideCache) {
        var that = this;
        const {move_item} = slideCache;

        //判断验证码是否存在并可见
        if (!move_item || document.querySelector(move_item) == null || !$(move_item).is(":visible")) {
            // console.log("滑块行为验证码不可见，本次不识别");
            return;
        }

        const check = async () => {
            var Results = that.getCapFoowwLocalStorage("验证码滑动整体超时锁");
            if (Results != null) {
                return;
            }
            // console.log("滑块行为验证码出现，准备开始识别");
            var moveItemElem = document.querySelector(move_item);

            let moveItemParentElemStyles = that.getElementStyle(moveItemElem.parentNode);
            let moveItemElemStyles = that.getElementStyle(moveItemElem);
            let left = that.getNumber(moveItemElemStyles.left);
            let small_image_width = that.getNumber(moveItemParentElemStyles.width);
            if (left != 0) {
                return;
            }
            if (that.getCapFoowwLocalStorage("滑块行为识别缓存：" + small_image_width) != null) {
                return;
            }
            that.setCapFoowwLocalStorage("滑块行为识别缓存：" + small_image_width, "同一个滑块仅识别一次", new Date().getTime() + (1000 * 60));
            this.Hint("开始滑动， 在下一条提示之前，请勿操作鼠标！", 5000)

            var postData = {
                small_image: "5oqx5q2J77yM5Li65LqG56iL5bqP55qE5Y+R5bGV5Y+v5o6n77yM5q2k5aSE5b+F6aG75Lyg5Y+C5Yiw5LqR56uv44CC",
                small_image_width: small_image_width,
                salt: new Date().getTime(),
                ocr_type: 5
            }

            that.Identify_Crab(null, postData, function Slide(data) {
                console.log("等待滑动距离：" + data.data)
                that.moveSideCaptcha(moveItemElem, moveItemElem, moveItemElem, data);
                that.delCapFoowwLocalStorage("滑块行为识别缓存：" + small_image_width);
            });
        }
        check();
    }

    /**
     * 滑动事件
     * @param targetImg 小图片
     * @param moveItem 按钮
     * @param distance 滑动距离
     */
    moveSideCaptcha(bigImg, smallImg, moveItem, data) {
        const that = this;
        let distance = that.getNumber(data.data);
        if (distance === 0) {
            console.log("滑动距离不可为0", distance);
            return;
        }
        distance = distance + 5;

        const btn = moveItem;
        let target = smallImg;

        // 剩余滑动距离
        let varible = null;
        // 上次剩余滑动距离（可能存在识别错误滑到头了滑不动的情况）
        let oldVarible = null;
        // 获得初始滑块左侧距离
        let targetLeft = that.getNumber(that.getElementStyle(target).left) || 0;
        let targetWidth = that.getNumber(that.getElementStyle(target).width) || 0;
        let targetMargin = that.getNumber(that.getElementStyle(target).marginLeft) || 0;
        let targetParentLeft = that.getNumber(that.getElementStyle(target.parentNode).left) || 0;
        let targetParentMargin = that.getNumber(that.getElementStyle(target.parentNode).marginLeft) || 0;
        let targetTransform = that.getNumber(that.getEleTransform(target)) || 0;
        let targetParentTransform = that.getNumber(that.getEleTransform(target.parentNode)) || 0;

        // 滑块与小图元素距离屏幕左侧的差距(用于后期取不到滑动距离切换参照物的差值)
        let eledifference = moveItem.getBoundingClientRect().x - smallImg.getBoundingClientRect().x;

        // 小图与大图元素距离屏幕左侧的差距(用于后期取不到滑动距离切换参照物的差值)
        let bigToSmaill = smallImg.getBoundingClientRect().x - bigImg.getBoundingClientRect().x;

        var rect = btn.getBoundingClientRect();
        //鼠标指针在屏幕上的坐标；
        var screenX = rect.x;
        var screenY = rect.y;
        //鼠标指针在浏览器窗口内的坐标；
        var clientX = screenX + rect.width / 2 - 2;
        var clientY = screenY + rect.height / 2 - 2;

        // 模拟 touchstart/pointerdown 事件
        const touchStartEvent = new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            view: document.defaultView,
            detail: 0,
            screenX: screenX,
            screenY: screenY,
            clientX: clientX,
            clientY: clientY,
            pointerType: 'touch'
        });
        btn.dispatchEvent(touchStartEvent);

        // 初始化 MouseEvent 对象
        const mousedown = new MouseEvent("mousedown", {
            bubbles: true,
            cancelable: true,
            view: document.defaultView,
            detail: 0,
            screenX: screenX,
            screenY: screenY,
            clientX: clientX,
            clientY: clientY,
        });
        btn.dispatchEvent(mousedown);

        let dx = 0;
        let dy = 0;
        // 总滑动次数
        let sideCount = 0;
        // 滑不动了的次数
        let sideMaxCount = 0;
        // 滑动取值规则
        let crabRuleId = 0;
        // 滑动速度
        let runTime = 0;
        // 突进滑动距离
        let firstLength = 20;
        // 是否完成
        let isFinish = false;

        // 模拟触摸轨迹数组
        const o = [];

        //持续滑动
        function continueSide() {
            setTimeout(function () {
                var intervalLock = that.getCapFoowwLocalStorage("验证码滑动整体超时锁");
                if (intervalLock == null) {
                    that.setCapFoowwLocalStorage("验证码滑动整体超时锁", {time: new Date().getTime()}, new Date().getTime() + (1000 * 10));
                } else {
                    // 采用自解开锁模式
                    if (intervalLock.time + 1000 * 3 < new Date().getTime()) {
                        that.Hint("本次滑动超时请刷新验证码后重试，若该页面多次出现此问题请联系群内志愿者处理。", 2000);
                        that.finishSide(btn, screenX, screenY, clientX, clientY);
                        return;
                    }
                }

                if (sideCount > 20 && varible == null && btn != null) {
                    //如果10次循环了已滑动的距离还是null，则使用按钮的距离
                    console.log("使用按钮得距离计算剩余")
                    let targetWidth = that.getNumber(that.getElementStyle(target).width);
                    let btnWidth = that.getNumber(that.getElementStyle(btn).width);
                    //正常来说，小图片应该比滑块的宽度小，此处做*2加权判断
                    if (targetWidth < btnWidth * 2) {
                        // 滑块一般贴近左边，而小图可能稍稍向右，所以总滑动距离-滑块得差
                        distance = distance + eledifference;
                    } else {
                        distance = distance - 2.5;
                    }
                    target = btn;
                }
                let newTargetLeft = that.getNumber(that.getElementStyle(target).left) || 0;
                let newTargetMargin = that.getNumber(that.getElementStyle(target).marginLeft) || 0;
                let newTargetParentLeft = that.getNumber(that.getElementStyle(target.parentNode).left) || 0;
                let newTargetParentMargin = that.getNumber(that.getElementStyle(target.parentNode).marginLeft) || 0;
                let newTargetTransform = that.getNumber(that.getEleTransform(target)) || 0;
                let newTargetParentTransform = that.getNumber(that.getEleTransform(target.parentNode)) || 0;
                let newTargetWidth = that.getNumber(that.getElementStyle(target).width) || 0;

                if (newTargetLeft !== targetLeft || crabRuleId == 1) {
                    varible = newTargetLeft;
                    targetLeft = newTargetLeft;
                    crabRuleId = 1;
                } else if (newTargetParentLeft !== targetParentLeft || crabRuleId == 2) {
                    varible = newTargetParentLeft;
                    targetParentLeft = newTargetParentLeft;
                    crabRuleId = 2;
                } else if (newTargetTransform !== targetTransform || targetTransform != 0 || crabRuleId == 3) {
                    varible = newTargetTransform;
                    targetTransform = newTargetTransform;
                    crabRuleId = 3;
                } else if (newTargetParentTransform != targetParentTransform || crabRuleId == 4) {
                    varible = newTargetParentTransform;
                    targetParentTransform = newTargetParentTransform;
                    crabRuleId = 4;
                } else if (newTargetMargin != targetMargin || crabRuleId == 5) {
                    varible = newTargetMargin;
                    targetMargin = newTargetMargin;
                    crabRuleId = 5;
                } else if (newTargetParentMargin != targetParentMargin || crabRuleId == 6) {
                    if (bigToSmaill != 0) {
                        newTargetParentMargin = newTargetParentMargin + bigToSmaill;
                    }
                    varible = newTargetParentMargin;
                    targetParentMargin = newTargetParentMargin;
                    crabRuleId = 6;
                }

                if (varible != null && varible != 0) {
                    if (varible == oldVarible) {
                        //发现滑不动了
                        sideMaxCount += 1;
                    } else {
                        sideMaxCount = 0;
                    }
                }
                oldVarible = varible;
                //本次需要滑出去得距离
                let tempDistance = firstLength + Math.random();
                // 剩余距离（总距离-已滑动距离）
                const residue = distance - varible;
                const avg = distance / 10;

                // 判断距离，计算速度
                if (residue > distance / 2) {//距离有一半时，距离较较远，可以高速
                    runTime = 0.2 + Math.random() * (0.5 - 0.2);
                    firstLength = 5;
                } else if (residue > distance / 4) {//距离有四分之一时，距离较近了，开始减速
                    runTime = Math.floor(Math.random() * (12 - 8 + 1)) + 8;
                    firstLength = 3;
                } else if (residue > avg) {//四分之一到十分之一
                    runTime = Math.floor(Math.random() * (12 - 8 + 1)) + 8;
                    firstLength = 2;
                } else if (residue < avg) {//最后十分之一
                    runTime = Math.floor(Math.random() * 5) + 18;
                    firstLength = 0;
                }

                // 总滑动距离较近，慢点滑动避免超速
                if (avg <= 10) {
                    runTime = runTime * 5;
                } else if (avg <= 13) {
                    runTime = runTime * 2;
                }

                //超过了就让他倒着走
                if (residue <= 0) {
                    tempDistance = tempDistance * -1;
                    console.log("超过了，倒着走："+tempDistance);
                }

                console.log("滑动速度：" + runTime + "，剩余距离：" + residue + "，突进距离：" + firstLength);

                dx += tempDistance;
                // 随机定义y得偏差
                let sign = Math.random() > 0.5 ? -1 : 1;
                dy += -1;


                //鼠标指针在屏幕上的坐标
                let _screenX = screenX + dx;
                let _screenY = screenY + dy;
                //鼠标指针在浏览器窗口内的坐标
                let _clientX = clientX + dx;
                let _clientY = clientY + dy;

                // 模拟 touchmove/pointermove 事件
                const touchMoveEvent = new PointerEvent('pointermove', {
                    bubbles: true,
                    cancelable: true,
                    view: document.defaultView,
                    screenX: _screenX,
                    screenY: _screenY,
                    clientX: _clientX,
                    clientY: _clientY,
                    pointerType: 'touch'
                });
                btn.dispatchEvent(touchMoveEvent);

                const mousemove = new MouseEvent('mousemove', {
                    bubbles: true,
                    cancelable: true,
                    view: document.defaultView,
                    screenX: _screenX,
                    screenY: _screenY,
                    clientX: _clientX,
                    clientY: _clientY
                });
                btn.dispatchEvent(mousemove);

                o.push(Math.round(dy));


                // 容错值
                const fault = 1;
                //判断剩余距离是否大于要滑动得距离(1像素误差),或者滑不动了
                if (varible != null && (sideMaxCount > 5 || (varible == distance || (varible > distance && varible - fault <= distance) || (varible < distance && varible + fault >= distance)))) {
                    if (isFinish) {
                        console.log("滑动完毕，等待清除事件");
                        // 模拟 touchend/pointerup 事件
                        const touchEndEvent = new PointerEvent('pointerup', {
                            bubbles: true,
                            cancelable: true,
                            view: document.defaultView,
                            screenX: _screenX,
                            screenY: _screenY,
                            clientX: _clientX,
                            clientY: _clientY,
                            pointerType: 'touch'
                        });
                        btn.dispatchEvent(touchEndEvent);

                        that.finishSide(btn, _screenX, _screenY, _clientX, _clientY);
                        that.Hint(data.description, data.showTime)
                        return;
                    }
                    console.log("故意跳过，使其缓慢回溯");
                    isFinish = true;
                    distance -= 5;
                }

                sideCount += 1;

                //再次执行
                continueSide();
            }, runTime);
        }

        continueSide();
    }


    // 完成滑动
    finishSide(btn, _screenX, _screenY, _clientX, _clientY) {
        var that = this;
        var eventList = ["mouseup"]
        for (var i = 0; i < eventList.length; i++) {
            var mouseup = new MouseEvent(eventList[i], {
                bubbles: true,
                cancelable: true,
                view: document.defaultView,
                clientX: _clientX,
                clientY: _clientY,
                screenX: _screenX,
                screenY: _screenY
            });
            setTimeout(() => {
                btn.dispatchEvent(mouseup);
                console.log("滑动完毕，释放鼠标");
            }, Math.ceil(Math.random() * 500));
        }

        //1秒后解除全局锁,避免网速慢导致验证码刷新不出来
        setTimeout(() => {
            that.delCapFoowwLocalStorage("验证码滑动整体超时锁");
        }, 1000);

    }

    getEleTransform(el) {
        const style = window.getComputedStyle(el, null);
        var transform = style.getPropertyValue("-webkit-transform") || style.getPropertyValue("-moz-transform") || style.getPropertyValue("-ms-transform") || style.getPropertyValue("-o-transform") || style.getPropertyValue("transform") || "null";
        return transform && transform.split(",")[4];
    }

    // 字符串转数字
    getNumber(str) {
        try {
            return Number(str.split(".")[0].replace(/[^0-9]/gi, ""));
        } catch (e) {
            return 0;
        }
    }


    //创建提示元素
    AddTip() {
        var TipHtml = $("<div id='like996_identification'></div>").text("Text.");
        TipHtml.css({
            "background-color": "rgba(211,211,211,0.86)",
            "align-items": "center",
            "justify-content": "center",
            "position": "fixed",
            "color": "black",
            "top": "-5em",
            "height": "2em",
            "margin": "0em",
            "padding": "0em",
            "font-size": "20px",
            "width": "100%",
            "left": "0",
            "right": "0",
            "text-align": "center",
            "z-index": "9999999999999",
            "padding-top": "3px",
            display: 'none'

        });
        $("body").append(TipHtml);
        return TipHtml;
    }

    //展示提醒
    Hint(Content, Duration) {
        if (Set["showHintCheck"] != "true") {
            return;
        }
        if (self != top) {
            // 如果当前在iframe中，则让父页面去提示
            window.parent.postMessage({
                sign: "crab",
                action: "Hint",
                postData: {Content: Content, Duration: Duration}
            }, "*");
            return;
        }
        // 处理一下对象传值（很奇怪，这玩意传到最后回出来两层，谁研究透了麻烦告诉我一下）
        while (Content?.constructor === Object) {
            Content = Content.Content;
            Duration = Content.Duration;
        }

        var that = crabCaptcha;

        that.Tip.stop(true, false).animate({
            top: '-5em'
        }, 300, function () {
            if (Set["warningTone"] == "true") {
                Content += that.doWarningTone(Content)
            }
            Content += "<span style='color:red;float: right;margin-right: 20px;' onclick='document.getElementById(\"like996_identification\").remove()'>X</span>";
            that.Tip.show();
            that.Tip.html(Content);

        });
        that.Tip.animate({
            top: '0em'
        }, 500).animate({
            top: '0em'
        }, Duration ? Duration : 3000).animate({
            top: '-5em'
        }, 500, function () {
            that.Tip.hide();
        });
        return;
    }

    //查询规则
    Query(Json, callback) {
        var that = this;
        var QueryRule = '';
        var LocalStorageData = this.getCapFoowwLocalStorage(Json.method + "_" + Json.data.host);
        if (Json.method == 'captchaHostAdd') {
            that.delCapFoowwLocalStorage("captchaHostQuery_" + Json.data.host);
            LocalStorageData = null;
            //清除自动查找验证码功能
            clearInterval(this.getCapFoowwLocalStorage("autoRulesIntervalID"));
        }
        if (LocalStorageData != null) {
            // console.log("存在本地缓存的验证码识别规则直接使用。")
            if (callback != null) {
                callback(LocalStorageData);
                return;
            } else {
                return LocalStorageData;
            }
        }

        // 构建 HTTP Headers，包含 API Key
        var headers = {
            'Content-Type': 'application/json; charset=utf-8',
            'path': window.location.href
        };

        // 如果配置了 API Key，则添加到 Header 中
        var apiKey = that.getApiKey();
        if (apiKey && apiKey.trim() !== "") {
            headers['X-API-Key'] = apiKey;
        }

        GM_xmlhttpRequest({
            url: that.getCaptchaServerUrl() + Json.method,
            method: 'POST',
            headers: headers,
            data: JSON.stringify(Json.data),
            responseType: "json",
            onload: obj => {
                // 检查HTTP状态码
                if (obj.status === 401 || obj.status === 403) {
                    var errorMsg = 'API Key 验证失败 (HTTP ' + obj.status + ')';
                    that.Hint('⚠️ ' + errorMsg + '\n\n请检查 API Key 配置是否正确', 8000);
                    console.error('API Key 验证失败:', obj);
                    if (callback) {
                        callback({ code: obj.status, description: errorMsg });
                    }
                    return;
                }
                
                var data = obj.response;
                // 注释掉自动显示description，避免无用提示
                // if (data.description != undefined) {
                //     that.Hint(data.description)
                // }
                QueryRule = data;
                that.setCapFoowwLocalStorage(Json.method + "_" + Json.data.host, data, new Date().getTime() + 1000 * 60)
                if (callback != null) {
                    callback(QueryRule);
                }

            },
            onerror: err => {
                console.error('请求失败:', err);
                // 如果是网络错误，给用户友好提示
                if (err.error && err.error.includes('network')) {
                    that.Hint('❌ 无法连接到验证码识别服务\n\n请确保本地服务已启动 (http://localhost:1205)', 5000);
                }
            }
        });


        return QueryRule;
    }

    //开始识别
    Start() {
        //检查配置中是否有此网站
        var that = this;
        var Pathname = window.location.href;
        var Card = that.IdCard();
        if (Set["hotKeyToImgResult"] != "true") {
            writeResultInterval = setInterval(function () {
                that.WriteResultsInterval();
            }, 500);
        } else {
            crabCaptcha.crabFacebook()
        }
        that.Query({
            "method": "captchaHostQuery", "data": {
                "host": window.location.host, "path": Pathname, "idcard": Card
            }
        }, function (Rule) {
            if (Rule.code == 531 || Rule.code == 532) {
                // console.log('有规则执行规则' + Pathname);
                var data = Rule.data;
                for (var i = 0; i < data.length; i++) {
                    // 修复字段名称不一致问题：ocr_type -> ocrType
                    if (data[i].ocr_type && !data[i].ocrType) {
                        data[i].ocrType = data[i].ocr_type;
                    }
                    writeResultIntervals[i] = data[i];
                }
                // console.log('等待验证码图片出现');
            } else if (Rule.code == 530) {
                // console.log('黑名单' + Pathname);
                // if (that.getCapFoowwLocalStorage("网站黑名单提示锁") == null) {
                //     that.setCapFoowwLocalStorage("网站黑名单提示锁", "lock", new Date().getTime() + 9999999 * 9999999);
                //     that.Hint('该网站在黑名单中，无法识别。', 5000);
                // }
                return
            } else if (Rule.code == 533 && Set["autoIdentification"] == "true") {
                // console.log('新网站开始自动化验证码查找' + Pathname);
                let autoRulesCheckElems = [];
                const autoRulesIntervalID = setInterval(function () {
                    var MatchList = that.AutoRules(autoRulesCheckElems);
                    if (MatchList != null && MatchList.length > 0) {
                        writeResultIntervals.splice(0);
                        // console.log('检测到新规则，开始绑定元素');
                        for (i in MatchList) {
                            writeResultIntervals[i] = MatchList[i];
                        }
                    }
                }, 1000);
                that.setCapFoowwLocalStorage("autoRulesIntervalID", autoRulesIntervalID, new Date().getTime() + (99999 * 99999));
            }
        });


        const actions = {
            SlidePickUp: that.SlidePickUp,
            LetterPickUp: that.LetterPickUp,
            slideBehaviorRule: that.slideBehaviorRule,
            Hint: that.Hint,
        };

        window.addEventListener(
            "message",
            (event) => {
                const {data = {}} = event || {};
                const {sign, action, postData} = data;
                if (sign === "crab") {
                    if (action && actions[action]) {
                        actions[action](postData);
                    }
                }
            },
            false
        );

    }

    // 定时执行绑定验证码img操作
    WriteResultsInterval() {
        for (var i = 0; i < writeResultIntervals.length; i++) {
            var ocrType = writeResultIntervals[i].ocrType;
            if (!ocrType || ocrType == 1) {
                // 英数验证码
                var imgAddr = writeResultIntervals[i].img;
                var inputAddr = writeResultIntervals[i].input;
                if (document.querySelector(imgAddr) == null || document.querySelector(inputAddr) == null) {
                    continue;
                }
                try {
                    if (this.getCapFoowwLocalStorage("err_" + writeResultIntervals[i].img) == null) {// 写入识别规则之前，先判断她是否有错误
                        this.RuleBindingElement(imgAddr, inputAddr);
                    }
                } catch (e) {
                    window.clearInterval(writeResultInterval);
                    this.addBadWeb(imgAddr, inputAddr);
                    return;
                }
            } else if (ocrType == 4) {
                //滑动拼图验证码
                var big_image = writeResultIntervals[i].big_image;
                if (document.querySelector(big_image) == null) {
                    continue;
                }
                this.checkSlideCaptcha(writeResultIntervals[i]);
            } else if (ocrType == 5) {
                //滑块行为验证码
                var move_item = writeResultIntervals[i].move_item;
                if (document.querySelector(move_item) == null) {
                    continue;
                }
                this.checkSlideBehaviorCaptcha(writeResultIntervals[i]);
            }
        }
    }

    //调用识别接口
    Identify_Crab(img, postData, callback) {
        var that = this;
        var postDataHash = that.strHash(JSON.stringify(postData));
        var Results = that.getCapFoowwLocalStorage("识别结果缓存:" + postDataHash);
        if (Results != null) {
            if (callback.name != 'ManualRule') {// 不为手动直接返回结果
                return Results.data;
            }
        }
        postData["idCard"] = that.IdCard();
        postData["version"] = "6.8-apikey";
        postData["host"] = window.location.hostname; // 添加当前网站，用于统计
        that.setCapFoowwLocalStorage("识别结果缓存:" + postDataHash, "识别中..", new Date().getTime() + (9999999 * 9999999));//同一个验证码只识别一次
        var url = that.getCaptchaServerUrl() + "/hello";

        // 构建 HTTP Headers，包含 API Key
        var headers = {
            'Content-Type': 'application/json; charset=UTF-8',
            'path': window.location.href
        };

        // 如果配置了 API Key，则添加到 Header 中
        var apiKey = that.getApiKey();
        if (apiKey && apiKey.trim() !== "") {
            headers['X-API-Key'] = apiKey;
        }

        // console.log("验证码变动，开始识别");
        GM_xmlhttpRequest({
            url: url,
            method: 'POST',
            headers: headers,
            data: JSON.stringify(postData),
            responseType: "json",
            onload: obj => {
                var data = obj.response;
                if (!data.valid) {
                    var errorMsg = data.description || '未知错误';
                    // 特别处理 API Key 相关错误
                    if (errorMsg.indexOf('API Key') !== -1 || obj.status === 401 || obj.status === 403) {
                        var hintMsg = '⚠️ API Key 验证失败！\n\n';
                        hintMsg += '可能的原因：\n';
                        hintMsg += '1. API Key 未配置或配置错误\n';
                        hintMsg += '2. API Key 已过期或被删除\n\n';
                        hintMsg += '解决方法：\n';
                        hintMsg += '1. 点击 Tampermonkey 图标\n';
                        hintMsg += '2. 选择"🔑 设置 API Key"\n';
                        hintMsg += '3. 输入正确的 API Key\n\n';
                        hintMsg += '错误信息：' + errorMsg;
                        that.Hint(hintMsg, 10000);
                        console.error('API Key 验证失败:', errorMsg);
                    } else if (data.description != undefined) {
                        that.Hint('识别请求发生错误： ' + data.description, 5000);
                    }
                    that.setCapFoowwLocalStorage("识别结果缓存:" + postDataHash, errorMsg, new Date().getTime() + (9999999 * 9999999))

                } else {

                    that.setCapFoowwLocalStorage("识别结果缓存:" + postDataHash, data, new Date().getTime() + (9999999 * 9999999))
                    if (callback != null) {
                        if (callback.name == 'Slide') {
                            //滑动识别
                            callback(data);
                        } else {
                            var Results = data.data;
                            if (Results.length < 4) {
                                that.Hint('验证码识别结果可能错误，请刷新验证码尝试', 5000)
                            } else if (data.description != '' && data.description != null) {
                                that.Hint(data.description, data.showTime)
                            } else {
                                that.Hint('验证码识别完成', 500)
                            }
                            if (callback.name == 'WriteRule') {
                                // 自动识别
                                callback(data.data);
                            } else if (callback.name == 'ManualRule') {
                                // 手动添加规则
                                callback(img, data.data);
                            }
                        }
                    }
                }
            },
            onerror: err => {
                console.log(err)
            }
        });

        return Results;
    }

    //根据规则提取验证码base64并识别
    async ImgPathToResult(imgElement, callback) {
        var that = this;
        var imgObj = $(imgElement);
        if (!imgObj.is(":visible")) {
            // console.log("验证码不可见，本次不识别");
            return;
        }
        try {
            var imgBase64 = await that.ImgElemToBase64(imgObj[0], imgElement);

            if (imgBase64.length < 255) {
                throw new Error("图片大小异常");
            }
        } catch (e) {
            if (callback.name == 'ManualRule') {
                that.Hint('跨域策略，请重新右键点击图片');
            }
            return;
        }

        var postData = {img: imgBase64, ocr_type: 1};
        that.Identify_Crab(imgElement, postData, callback);
    }

    // 图片对象转Base64
    ImgElemToBase64(imgObj) {
        return new Promise((resolve, reject) => {
            var that = this;
            var imgBase64, imgSrc;
            try {
                var elementTagName = imgObj.tagName.toLowerCase();
                if (elementTagName === "img" || elementTagName === "input") {
                    imgSrc = $(imgObj).attr("src");
                } else if (elementTagName === "div") {
                    imgSrc = that.getElementStyle(imgObj)["backgroundImage"]
                    if (imgSrc.trim().indexOf("data:image/") != -1) {
                        // 是base64格式的
                        imgSrc = imgSrc.match("(data:image/.*?;base64,.*?)[\"']")[1]
                    } else {
                        // 是url格式的
                        imgSrc = imgSrc.split('"')[1];
                    }
                }

                if (imgSrc != undefined && imgSrc.indexOf("data:") == 0) {
                    // 使用base64页面直显
                    imgBase64 = imgSrc;
                    // 兼容部分浏览器中replaceAll不存在
                    while (imgBase64.indexOf("\n") != -1) {
                        imgBase64 = imgBase64.replace("\n", "");
                    }
                    // 解决存在url编码的换行问题
                    while (imgBase64.indexOf("%0D%0A") != -1) {
                        imgBase64 = imgBase64.replace("%0D%0A", "");
                    }
                } else if (imgSrc != undefined && (((imgSrc.indexOf("http") == 0 || imgSrc.indexOf("//") == 0) && imgSrc.indexOf(window.location.protocol + "//" + window.location.host + "/") == -1) || $(imgObj).attr("crab_err") != undefined)) {
                    if (imgSrc.indexOf("//") == 0) {
                        imgSrc = window.location.protocol + imgSrc;
                    }
                    // 跨域模式下单独获取src进行转base64
                    var Results = that.getCapFoowwLocalStorage("验证码跨域识别锁：" + imgSrc);
                    if (Results != null) {
                        reject("验证码跨域识别锁住");
                        return;
                    }
                    // 缩短跨域锁定时间，避免长时间无法重试
                    that.setCapFoowwLocalStorage("验证码跨域识别锁：" + imgSrc, "避免逻辑错误多次识别", new Date().getTime() + 5000);

                    GM_xmlhttpRequest({
                        url: imgSrc, method: 'GET', responseType: "blob", onload: obj => {
                            if (obj.status == 200) {
                                let blob = obj.response;
                                let fileReader = new FileReader();
                                fileReader.onloadend = (e) => {
                                    let base64 = e.target.result;
                                    if (elementTagName == "div") {
                                        that.setDivImg(base64, imgObj);
                                    } else {
                                        $(imgObj).attr("src", base64);
                                    }

                                };
                                fileReader.readAsDataURL(blob)
                            }
                        }, onerror: err => {
                            that.Hint('请求跨域图片异常，请联系群内志愿者操作。');
                            reject("请求跨域图片异常");
                        }
                    });
                } else {
                    // 使用canvas进行图片转换
                    imgBase64 = that.ConversionBase(imgObj);
                }

                var transform = that.getElementStyle(imgObj)['transform'];
                if (transform != 'none' && transform != 'matrix(1, 0, 0, 1, 0, 0)') {
                    //图片可能存在旋转
                    let rotationBase64 = that.rotationImg(imgObj);
                    if (rotationBase64 != null) {
                        imgBase64 = rotationBase64;
                    }
                }

                resolve(imgBase64.replace(/.*,/, "").trim());
            } catch (e) {
                $(imgObj).attr("crab_err", 1);
                // 返回 null 由调用方判断并重试，避免未捕获的 Promise 异常
                resolve(null);
            }

        });
    }

    //重新设置div的背景图验证码
    setDivImg(imgBase64, imgObj) {
        var that = this;
        // 创建一个临时的 Image 对象，并设置它的 src 属性为背景图片 URL
        var img = new Image();
        // 创建一个 Canvas 元素
        var canvas = document.createElement('canvas');
        canvas.width = that.getNumber(that.getElementStyle(imgObj)["width"]);
        canvas.height = that.getNumber(that.getElementStyle(imgObj)["height"]);

        // 在 Canvas 上绘制背景图片
        var ctx = canvas.getContext('2d');

        var position = imgObj.style.backgroundPosition;
        var parts = position.split(' ');
        var bgPartsX = 0;
        var bgPartsY = 0;
        if (parts.length == 2) {
            bgPartsX = parseFloat(parts[0].replace(/[^-\d\.]/g, ''));
            bgPartsY = parseFloat(parts[1].replace(/[^-\d\.]/g, ''));
        }


        // 当图片加载完成后执行
        img.onload = function () {
            var position = imgObj.style.backgroundSize;
            var bgSize = position.split(' ');
            var bgSizeW = canvas.width;
            var bgSizeH = canvas.width / img.width * img.height;//有时候页面上的不准，按比例缩放即可
            if (canvas.height == 0) {
                canvas.height = bgSizeH;
            }
            if (bgSize.length == 2) {
                bgSizeW = parseFloat(bgSize[0].replace(/[^-\d\.]/g, ''));
                bgSizeH = parseFloat(bgSize[1].replace(/[^-\d\.]/g, ''));
            }
            if (parts.length == 2 || bgSize.length == 2) {
                ctx.drawImage(img, bgPartsX, bgPartsY, bgSizeW, bgSizeH);
                $(imgObj).css('background-position', '');
                $(imgObj).css('background-size', '');
            } else {
                ctx.drawImage(img, 0, 0);
            }
            // 将截取的图像作为新的背景图片设置到 div 元素中
            $(imgObj).css('background-image', 'url(' + canvas.toDataURL() + ')');
        };
        img.src = imgBase64;
    }

    //绑定规则到元素，并尝试识别
    RuleBindingElement(img, input) {
        var that = this;
        //创建一个触发操作
        let imgObj = img;
        if (typeof (imgObj) == "string") {
            imgObj = document.querySelector(img)
        }
        if (imgObj == null) {
            return;
        }

        imgObj.onload = function () {
            that.RuleBindingElement(imgObj, input)
        }

        this.ImgPathToResult(img, function WriteRule(vcode) {
            that.WriteImgCodeResult(vcode, input)
        })

    }

    //写入操作
    WriteImgCodeResult(ImgCodeResult, WriteInput) {
        var that = this;
        WriteInput = document.querySelector(WriteInput);
        const setValue = () => {
            WriteInput.value = ImgCodeResult;
        };
        setValue();
        if (typeof (InputEvent) !== 'undefined') {
            let eventReactNames = ["input", "change", "focus", "invalid", "keypress", "keydown", "keyup", "input", "blur", "select", "focus"];
            for (var j = 0; j < eventReactNames.length; j++) {
                if (that.FireForReact(WriteInput, eventReactNames[j])) {
                    setValue();
                }
            }
            let eventNames = ["keypress", "keydown", "keyup", "input", "blur", "select", "focus"];
            for (var i = 0; i < eventNames.length; i++) {
                that.Fire(WriteInput, eventNames[i]);
                setValue();
            }
        } else if (KeyboardEvent) {
            WriteInput.dispatchEvent(new KeyboardEvent("input"));
        }
    }

    // 各类原生事件
    Fire(element, eventName) {
        var event = document.createEvent("HTMLEvents");
        event.initEvent(eventName, true, true);
        element.dispatchEvent(event);
    }

    // 各类react事件
    FireForReact(element, eventName) {
        try {
            let env = new Event(eventName);
            element.dispatchEvent(env);
            var funName = Object.keys(element).find(p => Object.keys(element[p]).find(f => f.toLowerCase().endsWith(eventName)));
            if (funName != undefined) {
                element[funName].onChange(env)
                return true;
            }
        } catch (e) {
            // console.log("各类react事件调用出错！")
        }
        return false;

    }

    //转换图片为：canvas
    ConversionBase(img) {
        var canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, img.width, img.height);
        var imgObj = $(img);
        try {
            //尝试直接转换，如果失败，可能存在跨域
            return canvas.toDataURL("image/png");
        } catch (e) {
            // 对跨域的场景进行处理
            let imgSrc = imgObj.attr("crab-src");
            let imgBase64 = imgObj.attr("crab-src-base64");

            if (imgBase64 != undefined) {
                return imgBase64;
            }
            if (imgSrc == undefined) {
                throw new Error("canvas图片跨域，无法加载！");
            }
            // 跨域模式下单独获取src进行转base64
            var Results = this.getCapFoowwLocalStorage("验证码跨域识别锁：" + imgSrc);
            if (Results != null) {
                return null;
            }
            // 缩短跨域锁定时间，避免长时间无法重试
            this.setCapFoowwLocalStorage("验证码跨域识别锁：" + imgSrc, "避免逻辑错误多次识别", new Date().getTime() + 5000);


            this.Hint('正在处理跨域验证码请勿操作鼠标！');
            GM_xmlhttpRequest({
                url: imgSrc,
                method: 'GET',
                responseType: "blob",
                onload: (response) => {
                    if (response.status === 200) {
                        const blob = response.response;
                        const fileReader = new FileReader();
                        fileReader.onloadend = (e) => {
                            const base64 = e.target.result;
                            $(img).attr("crab-src-base64", base64);
                        }
                        fileReader.readAsDataURL(blob);
                    }
                }
            });
        }
    }


    // 部分滑动图片可能存在旋转，需要修正
    rotationImg(img) {
        let style = window.getComputedStyle(img);    // 获取元素的样式
        let matrix = new DOMMatrixReadOnly(style.transform); // 将样式中的 transform 属性值转换成 DOMMatrix 对象
        var angle = Math.round(Math.atan2(matrix.b, matrix.a) * (180 / Math.PI)); // 通过 DOMMatrix 对象计算旋转角度
        if (angle != 0) {
            let canvas = document.createElement("canvas");
            let ctx = canvas.getContext('2d');
            let width = img.naturalWidth;
            let height = img.naturalHeight;
            canvas.width = width;
            canvas.height = canvas.width * width / height;
            ctx.translate(canvas.width * 0.5, canvas.height * 0.5);
            ctx.rotate(angle * Math.PI / 180);
            ctx.drawImage(img, -canvas.height / 2, -canvas.width / 2, canvas.height, canvas.width);
            return canvas.toDataURL("image/png");
        }
        return null;

    }

    hashCode(strKey) {
        var hash = 0;
        if (strKey != null && strKey != "") {
            for (var i = 0; i < strKey.length; i++) {
                hash = hash * 31 + strKey.charCodeAt(i);
                hash = this.intValue(hash);
            }
        }
        return hash;
    }

    intValue(num) {
        var MAX_VALUE = 0x7fffffff;
        var MIN_VALUE = -0x80000000;
        if (num > MAX_VALUE || num < MIN_VALUE) {
            return num &= 0xFFFFFFFF;
        }
        return num;
    }

    //自动规则
    AutoRules(autoRulesCheckElems) {
        var that = this;
        if (autoRulesCheckElems.length > 1500) {
            //如果一个页面的元素超过1500个，则停止自动规则，避免卡顿
            return;
        }
        // 最终规则
        var MatchList = [];
        //验证码元素
        let captchaMap = [];
        $("canvas,img,input[type='image'],div").each(function () {
            let img = this;
            if (!$(img).is(":visible")) {
                return true;
            }
            let elemCode = that.hashCode($(img).html());
            if (autoRulesCheckElems.indexOf(elemCode) == -1) {
                autoRulesCheckElems.push(elemCode);
            }

            let checkList = [...that.getCaptchaFeature(img), ...that.getCaptchaFeature(img.parentNode),];
            checkList = checkList.filter((item) => item);
            let isInvalid = ["#", "about:blank"].includes(img.getAttribute("src")) || !img.getAttribute("src") || img.getAttribute("src").indexOf("data:") == 0;
            let imgRules = "code,captcha,yzm,check,random,veri,vcodeimg,验证码,看不清,换一张,login,点击,verify,yanzhengma".split(",");
            let isHave = false;
            for (let i = 0; i < checkList.length && !isHave; i++) {
                // 先判null
                if (checkList[i] == null || checkList[i] == undefined || typeof(checkList[i])!="string") {
                    continue;
                }


                let elemAttributeData = checkList[i].toLowerCase();

                //如果元素内包含logo字符串，则直接跳过
                if (elemAttributeData.toString().toLowerCase().indexOf("logo") != -1) {
                    return true;
                }


                let imgStyles = that.getElementStyle(img);
                let imgWidth = that.getNumber(imgStyles["width"]);
                let imgHeight = that.getNumber(imgStyles["height"]);
                let imgTagName = img.tagName.toLowerCase();

                // 验证码得相关属性需要满足特定字符串，并且宽高及图片属性不能太过分
                for (let j = 0; j < imgRules.length; j++) {
                    if (elemAttributeData.indexOf(imgRules[j]) != -1
                        && ((imgTagName == "img" && !isInvalid) || imgTagName != "img") && imgWidth > 30 && imgWidth < 150
                        && ((imgTagName == "div" && imgStyles['backgroundImage'] != 'none') || imgTagName != "div")
                        && imgHeight < 80 && imgHeight != imgWidth) {
                        captchaMap.push({"img": img, "input": null})
                        isHave = true;
                        break;
                    }
                }

            }

        });
        captchaMap.forEach((item) => {
            let imgEle = item.img;
            let parentNode = imgEle.parentNode;
            for (let i = 0; i < 4; i++) {
                // 以当前可能是验证码的图片为基点，向上遍历四层查找可能的Input输入框
                if (!parentNode) {
                    return;
                }
                let inputTags = [...parentNode.querySelectorAll("input")];
                if (inputTags.length) {
                    let input = inputTags.pop();
                    let type = input.getAttribute("type");
                    while (type !== "text" && inputTags.length) {
                        if (type === "password") {
                            break;
                        }
                        input = inputTags.pop();
                        type = input.getAttribute("type");
                    }

                    let inputWidth = that.getNumber(that.getElementStyle(input).width);
                    if (!type || (type === "text" && inputWidth > 50)) {
                        // 给目标元素添加边框，证明自动规则选中得
                        $(imgEle).css("borderStyle", "solid").css("borderColor", "red").css("border-width", "2px").css("box-sizing", "border-box");
                        $(input).css("borderStyle", "solid").css("borderColor", "red").css("border-width", "1px").css("box-sizing", "border-box");
                        MatchList.push({"img": that.Aimed(imgEle), "input": that.Aimed(input)})
                        break;
                    }
                    if (type === "password") {
                        // 验证码一般在密码框后面，遍历到密码框了就大概率说明没有验证码
                        break;
                    }
                }
                parentNode = parentNode.parentNode;
            }
        });

        return MatchList;
    }

    // 获取验证码特征
    getCaptchaFeature(el) {
        let checkList = [];
        checkList.push(el.getAttribute("id"));
        checkList.push(el.className);
        checkList.push(el.getAttribute("alt"));
        checkList.push(el.getAttribute("src"));
        checkList.push(el.getAttribute("name"));
        checkList.push(el.getAttribute("title"));

        return checkList;
    }

    //根据元素生成JsPath
    Aimed(Element) {
        // console.log('---根据元素创建配置信息---');
        if (Element.length > 0) {
            Element = Element[0]
        }
        var that = this;
        var ElementLocalName = Element.localName;
        var result;
        // 如果有vue的id，则直接返回
        var vueId = that.getDataV(Element);
        if (vueId != null) {
            result = ElementLocalName + "[" + vueId + "]";
            if ($(result).length == 1) {
                return result;
            }
        }
        // 如果有placeholder，则直接返回
        var placeholder = that.getPlaceholder(Element);
        if (placeholder != null) {
            result = ElementLocalName + "[" + placeholder + "]";
            if ($(result).length == 1) {
                return result;
            }
        }
        // 如果有alt，则直接返回
        var alt = that.getAlt(Element);
        if (alt != null) {
            result = ElementLocalName + "[" + alt + "]";
            if ($(result).length == 1) {
                return result;
            }
        }

        // 如果有name且只有一个，则直接返回
        var selectElement = that.getElementName(Element);
        if (selectElement != null) {
            return selectElement;
        }

        // 如果有src，且src后面无参数则直接返回
        var src = that.getSrc(Element);
        if (src != null && src.length < 200) {
            result = ElementLocalName + "[" + src + "]";
            if ($(result).length == 1) {
                return result;
            }
        }
        // 如果有onClick则直接返回
        var onClick = that.getOnClick(Element);
        if (onClick != null && onClick.length < 200) {
            result = ElementLocalName + "[" + onClick + "]";
            if ($(result).length == 1) {
                return result;
            }
        }
        // 如果有elemClassName则直接返回
        var elemClassName = that.getElementClassName(Element);
        if (elemClassName != null && elemClassName.length < 200) {
            return elemClassName;
        }

        var cssPath = that.getElementCssPath(Element);
        if (cssPath != null && cssPath != "") {
            try {
                //避免样式选择器有时候选到错的无法使用问题
                if ($(cssPath).length == 1) {
                    return cssPath;
                }
            } catch (e) {
            }
        }

        var Symbol = (this.getElementId(Element) ? "#" : Element.className ? "." : false);
        var locationAddr;
        if (!Symbol) {
            locationAddr = that.Climb(Element.parentNode, ElementLocalName);
        } else {
            locationAddr = that.Climb(Element, ElementLocalName);
        }
        if ($(locationAddr).length == 1) {
            return locationAddr.trim();
        }

        // if (confirm("当前元素无法自动选中，是否手动指定JsPath?\n(该功能为熟悉JavaScript的用户使用，若您不知道，请点击取消。)\n注意：如果该提示影响到您得操作了，关闭'自动查找验证码'功能即可！")) {
        //     result = prompt("请输入待选择元素的JsPath，例如：\n#app > div:nth-child(3) > div > input");
        //     try {
        //         if ($(result).length == 1) {
        //             return result;
        //         }
        //     } catch (e) {
        //     }
        // }

        that.Hint('该网站非标准web结构，暂时无法添加规则，请联系群内志愿者添加。')
        return null;

    }

    //判断元素id是否可信
    getElementId(element) {
        var id = element.id;
        if (id) {
            if (this.checkBadElemId(id)) {// 对抗类似vue这种无意义id
                if (id.length < 40) {// 对抗某些会自动变换id的验证码
                    return true;
                }
            }
        }
        return false;
    }

    //爬层级
    Climb(Element, ElementLocalName, Joint = '') {
        var ElementType = (this.getElementId(Element) ? Element.id : Element.className ? Element.className.replace(/\s/g, ".") : false);
        var Symbol = (this.getElementId(Element) ? "#" : Element.className ? "." : false);
        var Address;
        if (ElementType && ElementLocalName == Element.localName) {
            Address = ElementLocalName + Symbol + ElementType;
        } else {
            Address = "";
            if (Symbol != false) {
                Address = Address + Symbol;
            }
            if (ElementType != false) {
                Address = Address + ElementType;
            }
            Address = ' ' + ElementLocalName
        }
        if ($(Address).length == 1) {
            return Address + ' ' + Joint;
        } else {
            Joint = this.Climb($(Element).parent()[0], $(Element).parent()[0].localName, Address + ' ' + Joint)
            return Joint;
        }
    }

    // 获取vue的data-v-xxxx
    getDataV(element) {
        var elementKeys = element.attributes;
        if (elementKeys == null) {
            return null;
        }
        for (var i = 0; i < elementKeys.length; i++) {
            var key = elementKeys[i].name;
            if (key.indexOf("data-v-") != -1) {
                return key;
            }
        }
        return null;
    }

    // 获取placeholder="验证码"
    getPlaceholder(element) {
        var elementKeys = element.attributes;
        if (elementKeys == null) {
            return null;
        }
        for (var i = 0; i < elementKeys.length; i++) {
            var key = elementKeys[i].name.toLowerCase();
            if (key == "placeholder" && elementKeys[i].value != "") {
                return elementKeys[i].name + "='" + elementKeys[i].value + "'";
            }
        }
        return null;
    }

    // 获取alt="kaptcha"
    getAlt(element) {
        var elementKeys = element.attributes;
        if (elementKeys == null) {
            return null;
        }
        for (var i = 0; i < elementKeys.length; i++) {
            var key = elementKeys[i].name.toLowerCase();
            if (key == "alt") {
                return elementKeys[i].name + "='" + elementKeys[i].value + "'";
            }
        }
        return null;
    }

    // 获取src="http://xxx.com"
    getSrc(element) {
        var elementKeys = element.attributes;
        if (elementKeys == null) {
            return null;
        }
        for (var i = 0; i < elementKeys.length; i++) {
            var key = elementKeys[i].name.toLowerCase();
            var value = elementKeys[i].value;
            if (key == "src" && value.indexOf("data:image") != 0) {
                var idenIndex = value.indexOf("?");
                if (idenIndex != -1) {
                    value = value.substring(0, idenIndex + 1);
                }

                // 从 URL 中提取文件名
                const filename = value.substring(value.lastIndexOf('/') + 1);
                // 从文件名中提取后缀部分
                const fileExtension = filename.substring(filename.lastIndexOf('.') + 1);
                if (fileExtension == "jpg" || fileExtension == "png" || fileExtension == "gif") {
                    // 直接是静态文件，无法作为规则
                    return null;
                }
                if (/\d/.test(value)) {
                    // 存在数字则可能是时间戳之类得，尝试获取上级目录
                    const lastSlashIndex = value.lastIndexOf('/');
                    if (lastSlashIndex !== -1) {
                        let truncateURL = value.substring(0, lastSlashIndex);
                        if (truncateURL.indexOf("blob:") == 0) {
                            truncateURL = truncateURL.substring(5, truncateURL.length);
                        }
                        if (truncateURL.indexOf("http") != 0) {
                            truncateURL = "http:" + truncateURL;
                        }
                        try {
                            const url = new URL(value);
                            if (url.pathname != "/") {
                                value = truncateURL;
                            }
                        } catch (e) {
                            //非标准url，不需要处理，直接返回即可
                        }
                    }
                }
                return elementKeys[i].name + "^='" + value + "'";
            }
        }

        return null;
    }

    // 判断name是否只有一个
    getElementName(element) {
        var elementName = element.name;
        if (elementName == null || elementName == "") {
            return null;
        }
        var selectElement = element.localName + "[name='" + elementName + "']";
        if ($(selectElement).length == 1) {
            return selectElement;
        }
        return null;
    }

    // 判断OnClick是否只有一个
    getOnClick(element) {
        var elementKeys = element.attributes;
        if (elementKeys == null) {
            return null;
        }
        for (var i = 0; i < elementKeys.length; i++) {
            var key = elementKeys[i].name.toLowerCase();
            var value = elementKeys[i].value;
            if (key == "onclick") {
                var idenIndex = value.indexOf("(");
                if (idenIndex != -1) {
                    value = value.substring(0, idenIndex + 1);
                }
                // 转义特殊字符以避免jQuery选择器语法错误
                value = value.replace(/'/g, "\\'").replace(/"/g, '\\"');
                return elementKeys[i].name + "^='" + value + "'";
            }
        }
        return null;
    }

    // 判断ClassName是否只有一个
    getElementClassName(element) {
        var a = element.classList;
        var elementClassName = [];
        for (var i = 0; i < a.length; i++) {
            if (a[i].indexOf("hover") != -1 || a[i].indexOf("active") != -1) {
                continue
            }
            elementClassName.push("." + a[i]);
        }
        if (elementClassName.length == 0) {
            return null;
        }
        var selectElement = element.localName + Array.from(elementClassName).join('');
        if ($(selectElement).length == 1) {
            return selectElement;
        }
        return null;
    }


    // 操作webStorage 增加缓存，减少对服务端的请求
    setCapFoowwLocalStorage(key, value, ttl_ms) {
        var data = {value: value, expirse: new Date(ttl_ms).getTime()};
        sessionStorage.setItem(key, JSON.stringify(data));
    }

    getCapFoowwLocalStorage(key) {
        var data = JSON.parse(sessionStorage.getItem(key));
        if (data !== null) {
            if (data.expirse != null && data.expirse < new Date().getTime()) {
                sessionStorage.removeItem(key);
            } else {
                return data.value;
            }
        }
        return null;
    }

    delCapFoowwLocalStorage(key) {
        window.sessionStorage.removeItem(key);
    }

    // 自动添加识别错误黑名单
    addBadWeb(img, input) {
        if (Set["autoBlackList"] == "false") {
            return;
        }
        this.Hint("识别过程中发生错误，已停止识别此网站！（若验证码消失请刷新网站，需再次启用识别请在'更多设置'中删除所有规则）", 15000);
        this.captchaHostBad(img, input);
    }

    // 手动添加识别错误黑名单
    captchaHostBad(img, input) {
        this.setCapFoowwLocalStorage("err_" + img, "可能存在跨域等问题停止操作它", new Date().getTime() + (1000 * 1000));
        this.delCapFoowwLocalStorage("captchaHostQuery_" + window.location.host);
        this.Query({
            "method": "captchaHostAdd", "data": {
                "host": window.location.host,
                "path": window.location.href,
                "img": img,
                "input": input,
                "title": document.title,
                "type": 0,
                "idcard": this.IdCard()
            }
        }, null);
    }


    // 删除规则
    captchaHostDel() {
        if (!confirm("该操作会导致清除‘" + window.location.host + "’网站下含黑名单在内的所有规则，删除后您需要重新手动添加规则，是否继续？")) {
            return;
        }
        this.delCapFoowwLocalStorage("captchaHostQuery_" + window.location.host);
        this.Query({
            "method": "captchaHostDel", "data": {
                "host": window.location.host,
                "idcard": this.IdCard()
            }
        }, null);
    }

    // 设置识别识别码
    SetIdCard() {
        var that = this;
        let gmGetValue = GM_getValue("set");
        var idCard = gmGetValue["idCard"];
        if (idCard != null && idCard.length == 32) {
            return;
        }

        idCard = prompt("申请地址https://like996.icu:1205\n设置后如需修改可在更多设置中“恢复出厂设置”后重试。\n请输入您的识别码：");
        if (idCard == null || idCard == "") {
            that.Hint('取消设置');
        } else {
            if (idCard.length != 32) {
                that.Hint('识别码应为32位，请参考设置中的“查看帮助”进行自行注册！');
            } else {
                GM_setValue("set", {
                    "idCard": idCard
                });
                that.Hint('识别码设置完成刷新页面生效。');
            }

        }
        return;
    }

    // 播放音频朗读
    doWarningTone(body) {
        if (body.indexOf("，")) {
            body = body.split("，")[0];
        }
        if (body.indexOf(",")) {
            body = body.split(",")[0];
        }
        if (body.indexOf("!")) {
            body = body.split("!")[0];
        }
        var zhText = encodeURI(body);
        var text = "<audio autoplay='autoplay'>" + "<source src='https://dict.youdao.com/dictvoice?le=zh&audio=" + zhText + "' type='audio/mpeg'>" + "<embed height='0' width='0' src='https://dict.youdao.com/dictvoice?le=zh&audio=" + zhText + "'>" + "</audio>";
        return text;
    }

    // 获取元素的全部样式
    getElementStyle(element) {
        if (window.getComputedStyle) {
            return window.getComputedStyle(element, null);
        } else {
            return element.currentStyle;
        }
    }


    // 获取元素的cssPath选择器
    getElementCssPath(element) {
        if (!(element instanceof Element) || !element.parentElement) {
            return null;
        }

        const path = [];
        while (element.parentElement) {
            let selector = element.nodeName.toLowerCase();
            if (element.id && this.checkBadElemId(element.id)) {
                selector += `#${element.id}`;
                path.unshift(selector);
                break;
            } else {
                const siblings = Array.from(element.parentElement.children).filter(e => e.nodeName.toLowerCase() === selector);
                const index = siblings.indexOf(element);

                if (siblings.length > 1) {
                    selector += `:nth-of-type(${index + 1})`;
                }

                path.unshift(selector);
                element = element.parentElement;
            }
        }

        return path.join(' > ');
    }

    //检查是否为随机的Id
    checkBadElemId(idStr) {
        if (idStr.indexOf("exifviewer-img-") != -1) {
            return false;
        }
        const pattern = /[-_]\d$/;
        return !pattern.test(idStr);
    }

    // 获取指定字符串hash
    strHash(input) {
        var I64BIT_TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'.split('');
        var hash = 5381;
        var i = input.length - 1;

        if (typeof input == 'string') {
            for (; i > -1; i--) hash += (hash << 5) + input.charCodeAt(i);
        } else {
            for (; i > -1; i--) hash += (hash << 5) + input[i];
        }
        var value = hash & 0x7FFFFFFF;

        var retValue = '';
        do {
            retValue += I64BIT_TABLE[value & 0x3F];
        } while (value >>= 6);

        return retValue;
    }

    // 监控热键
    crabFacebook() {
        document.onkeydown = function () {
            if (Set["hotKeyToImgResult"] == "false") {
                return;
            }
            var keyCodeName = {
                "91": "command",
                "96": "0",
                "97": "1",
                "98": "2",
                "99": "3",
                "100": "4",
                "101": "5",
                "102": "6",
                "103": "7",
                "104": "8",
                "105": "9",
                "106": "*",
                "107": "+",
                "108": "回车",
                "109": "-",
                "110": ".",
                "111": "/",
                "112": "F1",
                "113": "F2",
                "114": "F3",
                "115": "F4",
                "116": "F5",
                "117": "F6",
                "118": "F7",
                "119": "F8",
                "120": "F9",
                "121": "F10",
                "122": "F11",
                "123": "F12",
                "8": "BackSpace",
                "9": "Tab",
                "12": "Clear",
                "13": "回车",
                "16": "Shift",
                "17": "Control",
                "18": "Alt",
                "20": "Cape Lock",
                "27": "Esc",
                "32": "空格",
                "33": "Page Up",
                "34": "Page Down",
                "35": "End",
                "36": "Home",
                "37": "←",
                "38": "↑",
                "39": "→",
                "40": "↓",
                "45": "Insert",
                "46": "Delete",
                "144": "Num Lock",
                "186": ";",
                "187": "=",
                "188": ",",
                "189": "-",
                "190": ".",
                "191": "/",
                "192": "`",
                "219": "[",
                "220": "\\",
                "221": "]",
                "222": "'",
                "65": "A",
                "66": "B",
                "67": "C",
                "68": "D",
                "69": "E",
                "70": "F",
                "71": "G",
                "72": "H",
                "73": "I",
                "74": "J",
                "75": "K",
                "76": "L",
                "77": "M",
                "78": "N",
                "79": "O",
                "80": "P",
                "81": "Q",
                "82": "R",
                "83": "S",
                "84": "T",
                "85": "U",
                "86": "V",
                "87": "W",
                "88": "X",
                "89": "Y",
                "90": "Z",
                "48": "0",
                "49": "1",
                "50": "2",
                "51": "3",
                "52": "4",
                "53": "5",
                "54": "6",
                "55": "7",
                "56": "8",
                "57": "9"
            };
            var a = window.event.keyCode;
            if (Set["hotKeyToImgResult"] == "wait" && a != undefined) {
                var keyName = keyCodeName[a + ""] == undefined ? a : keyCodeName[a + ""];
                crabCaptcha.Hint('快捷键设置成功当前快捷键为:' + keyName + "，重新打开页面生效！");
                Set["hotKeyToImgResult"] = "true";
                Set["hotKey"] = a;
                GM_setValue("set", Set);
                clearInterval(writeResultInterval);
            } else {
                if (a == Set["hotKey"]) {
                    crabCaptcha.WriteResultsInterval();
                    crabCaptcha.Hint("开始快捷键识别验证码,在当前页面刷新之前新的验证码将自动识别！");
                }
            }
        }
    }
}

//所有验证码img的对象数组
var writeResultIntervals = [];

//定时执行验证码绑定操作定时器
var writeResultInterval;


function closeButton() {
    const closebtn = document.createElement("div");
    closebtn.innerHTML = " × ";
    closebtn.style.position = "absolute";
    closebtn.style.top = "10px";
    closebtn.style.right = "10px";
    closebtn.style.cursor = "pointer";
    closebtn.style.fontWeight = 900;
    closebtn.style.fontSize = "larger";
    closebtn.setAttribute("onclick", "CKTools.modal.hideModal()");
    return closebtn;
}

async function GUISettings() {
    if (CKTools.modal.isModalShowing()) {
        CKTools.modal.hideModal();
    }
    const menuList = [{
        name: 'autoIdentification',
        title: '自动查找无规则验证码',
        hintOpen: '已开启自动查找验证码功能，请刷新网页',
        hintClose: '已关闭自动查找验证码功能，遇到新网站请自行手动添加规则!',
        desc: '对于未添加规则的页面，将自动查找页面上的验证码，有找错的可能。',
        openVul: 'true',
        closeVul: 'false'
    }, {
        name: 'showHintCheck',
        title: '提示信息',
        hintOpen: '提示功能已开启！',
        hintClose: '提示功能已关闭，再次开启前将无任何提示！',
        desc: '关闭前请确保已知晓插件的使用流程！',
        openVul: 'true',
        closeVul: 'false'
    }, {
        name: 'warningTone',
        title: '提示音',
        hintOpen: '提示音功能已开启！',
        hintClose: '提示音功能已关闭！',
        desc: '自动朗读提示信息中的文字！',
        openVul: 'true',
        closeVul: 'false'
    }, {
        name: 'autoBlackList',
        title: '识别崩溃自动拉黑网站',
        hintOpen: '崩溃自动拉黑网站功能已开启！',
        hintClose: '崩溃自动拉黑网站功能已关闭！',
        desc: '遇到跨域或其他错误导致验证码无法加载时自动将网站加到黑名单中。',
        openVul: 'true',
        closeVul: 'false'
    }, {
        name: 'hotKeyToImgResult',
        title: '快捷键查找验证码',
        hintOpen: '请直接按下您需要设置的快捷键！设置快捷键前请确保当前页面能够自动识别否则先手动添加规则！',
        hintClose: '快捷键查找验证码已关闭！',
        desc: '先手动添加规则后再开启，开启后将停止自动识别，仅由快捷键识别！',
        openVul: 'wait',
        closeVul: 'false',
        doWork: 'crabCaptcha.crabFacebook()'
    }, {
        name: 'openHelp',
        type: 'button',
        title: '查看使用帮助',
        desc: '如果您使用上遇到问题或障碍，请仔细阅读该内容！',
        hintOpen: '使用帮助说明网页已打开，若遇到您无法解决的问题，可加群联系群内志愿者！',
        doWork: 'crabCaptcha.openHelp()'
    }, {
        name: 'clearSet',
        type: 'button',
        title: '恢复出厂设置',
        hintOpen: '已成功恢复出厂设置刷新页面即可生效',
        desc: '清除所有设置，包括识别码！',
        doWork: 'crabCaptcha.clearSet()'
    },]
    CKTools.modal.openModal("万能验证码自动输入-更多设置（点击切换）", await CKTools.domHelper("div", async container => {
        container.appendChild(closeButton());
        container.style.alignItems = "stretch";
        for (var i = 0; i < menuList.length; i++) {
            container.appendChild(await CKTools.domHelper("li", async list => {
                list.classList.add("showav_menuitem");
                list.setAttribute('menuId', i);
                list.addEventListener("click", e => {
                    let targetElem = $(e.target.parentElement);
                    let menuId = targetElem.attr("menuId");
                    if (menuList[menuId].type == "button") {
                        if (eval(menuList[menuId].doWork)) {
                            crabCaptcha.Hint(menuList[menuId].hintOpen);
                        }
                    } else {
                        const label = document.querySelector("#" + menuList[menuId].name + "Tip");
                        const checkbox = document.querySelector("#" + menuList[menuId].name);
                        if (!label) return;
                        if (!checkbox.checked) {
                            label.innerHTML = "<b>[已开启]</b> " + menuList[menuId].title;
                            Set[menuList[menuId].name] = menuList[menuId].openVul;
                            GM_setValue("set", Set);
                            checkbox.checked = true;
                            crabCaptcha.Hint(menuList[menuId].hintOpen);
                            let doWork = menuList[menuId].doWork;
                            if (doWork != null) {
                                eval(doWork)
                            }
                        } else {
                            label.innerHTML = "<span>[已关闭]</span>" + menuList[menuId].title;
                            Set[menuList[menuId].name] = menuList[menuId].closeVul;
                            checkbox.checked = false;
                            GM_setValue("set", Set);
                            crabCaptcha.Hint(menuList[menuId].hintClose);
                        }
                    }
                })
                if (menuList[i].type == 'button') {
                    list.appendChild(await CKTools.domHelper("label", label => {
                        label.id = menuList[i].name + "Tip";
                        label.innerHTML = menuList[i].title;
                    }));
                } else {
                    list.appendChild(await CKTools.domHelper("input", input => {
                        input.type = "checkbox";
                        input.id = menuList[i].name;
                        input.name = menuList[i].name;
                        input.style.display = "none";
                        input.checked = Set[menuList[i].name] == 'true';
                    }));
                    list.appendChild(await CKTools.domHelper("label", label => {
                        label.id = menuList[i].name + "Tip";
                        label.setAttribute('for', menuList[i].name);
                        if (Set[menuList[i].name] == 'true') {
                            label.innerHTML = "<b>[已开启]</b>" + menuList[i].title;
                        } else {
                            label.innerHTML = "<span>[已关闭]</span>" + menuList[i].title;
                        }
                    }));
                }
                list.appendChild(await CKTools.domHelper("div", div => {
                    div.style.paddingLeft = "20px";
                    div.style.color = "#919191";
                    div.innerHTML = "说明：" + menuList[i].desc;
                }));
                list.style.lineHeight = "2em";
            }))
        }
        container.appendChild(await CKTools.domHelper("div", async btns => {
            btns.style.display = "flex";
            btns.style.alignItems = "flex-end";
            btns.appendChild(await CKTools.domHelper("button", btn => {
                btn.className = "CKTOOLS-toolbar-btns";
                btn.innerHTML = "关闭";
                btn.style.background = "#ececec";
                btn.style.color = "black";
                btn.onclick = e => {
                    CKTools.addStyle(``, "showav_lengthpreviewcss", "update");
                    CKTools.modal.hideModal();
                }
            }))
        }))
    }));
    //强制设置置顶，避免被占用
    $("#CKTOOLS-modal").css("z-index", "99999999999");
    //强制设置置顶，避免被占用
    $("#CKTOOLS-modal").height("600px");
}

async function GUIAddRule() {
    if (CKTools.modal.isModalShowing()) {
        CKTools.modal.hideModal();
    }
    const menuList = [{
        name: 'letterRule',
        title: '添加数字、字母验证码规则',
        type: 'button',
        desc: '请根据网站顶部提示：先右键验证码，再左键点击输入框！',
        doWork: 'crabCaptcha.LetterPickUp()'
    }, {
        name: 'slideRule',
        title: '添加滑动拼图验证码规则',
        type: 'button',
        desc: '请根据网站顶部提示，依次点击（左键右键均可）：大图、小图、滑块！',
        doWork: 'crabCaptcha.SlidePickUp()'
    }, {
        name: 'slideBehaviorRule',
        title: '添加滑块行为验证码规则',
        type: 'button',
        desc: '注意：该类验证码仅有一个滑块，请根据网站顶部提示点击滑块！',
        doWork: 'crabCaptcha.slideBehaviorRule()'
    }, {
        name: 'captchaHostBad',
        title: '停止识别该网站',
        type: 'button',
        desc: '停止后该网站将不再识别，如需继续识别点击下方“删除该网站全部规则”。',
        doWork: 'crabCaptcha.captchaHostBad("bad","bad")'
    }, {
        name: 'captchaHostDel',
        title: '删除该网站全部规则',
        type: 'button',
        desc: '删除当前网站用户手动添加的全部规则，含黑名单。',
        doWork: 'crabCaptcha.captchaHostDel()'
    },]
    CKTools.modal.openModal("万能验证码自动输入-规则管理（请点击您要执行的操作）", await CKTools.domHelper("div", async container => {
        container.appendChild(closeButton());
        container.style.alignItems = "stretch";
        for (var i = 0; i < menuList.length; i++) {
            container.appendChild(await CKTools.domHelper("li", async list => {
                list.classList.add("showav_menuitem");
                list.setAttribute('doWork', menuList[i].doWork);
                list.addEventListener("click", e => {
                    CKTools.modal.hideModal();
                    eval($(e.target.parentElement).attr("doWork"));
                });
                if (menuList[i].type == 'button') {
                    list.appendChild(await CKTools.domHelper("label", label => {
                        label.id = menuList[i].name + "Tip";
                        label.value = i;
                        label.setAttribute('style', "color:blue");
                        label.innerHTML = menuList[i].title;
                    }));
                }
                list.appendChild(await CKTools.domHelper("div", div => {
                    div.style.paddingLeft = "20px";
                    div.style.color = "#919191";
                    div.innerHTML = "说明：" + menuList[i].desc;
                }));
                list.style.lineHeight = "2em";
            }))
        }
        container.appendChild(await CKTools.domHelper("div", async btns => {
            btns.style.display = "flex";
            btns.style.alignItems = "flex-end";
            btns.appendChild(await CKTools.domHelper("button", btn => {
                btn.className = "CKTOOLS-toolbar-btns";
                btn.innerHTML = "关闭";
                btn.style.background = "#ececec";
                btn.style.color = "black";
                btn.onclick = e => {
                    CKTools.addStyle(``, "showav_lengthpreviewcss", "update");
                    CKTools.modal.hideModal();
                }
            }))
        }))
    }));
    //强制设置置顶，避免被占用
    $("#CKTOOLS-modal").css("z-index", "99999999999");
    $("#CKTOOLS-modal").height("400px");


}

// hook一份ctx的结果，用于跨域获取
const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
CanvasRenderingContext2D.prototype.drawImage = function (image, ...args) {
    if (image.tagName != null && image.tagName.toLowerCase() === "img" && image.src.indexOf("http") != -1) {
        $(this.canvas).attr("crab-src", image.src)
    }
    originalDrawImage.call(this, image, ...args);
};

// ==========================================
// CKTools 后备实现
// ==========================================
// 如果CKTools加载失败，使用这个后备实现
// ==========================================

const CKToolsFallback = {
    modal: {
        openModal: function(title, contentElement) {
            console.warn('[CKTools后备] 使用简化版弹窗');

            // 创建模态窗口
            const modal = document.createElement('div');
            modal.id = 'CKTOOLS-modal';
            modal.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border: 2px solid #333;
                border-radius: 8px;
                padding: 20px;
                max-width: 600px;
                max-height: 80vh;
                overflow-y: auto;
                z-index: 999999999;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            `;

            // 添加标题
            const titleDiv = document.createElement('div');
            titleDiv.style.cssText = `
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 15px;
                color: #333;
            `;
            titleDiv.textContent = title;
            modal.appendChild(titleDiv);

            // 添加内容
            const contentDiv = document.createElement('div');
            contentDiv.className = 'CKTOOLS-modal-content';
            contentDiv.appendChild(contentElement);
            modal.appendChild(contentDiv);

            // 添加背景遮罩
            const overlay = document.createElement('div');
            overlay.id = 'CKTOOLS-modal-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                z-index: 999999998;
            `;
            overlay.onclick = () => this.hideModal();

            document.body.appendChild(overlay);
            document.body.appendChild(modal);
        },

        hideModal: function() {
            const modal = document.getElementById('CKTOOLS-modal');
            const overlay = document.getElementById('CKTOOLS-modal-overlay');
            if (modal) modal.remove();
            if (overlay) overlay.remove();
        },

        isModalShowing: function() {
            return document.getElementById('CKTOOLS-modal') !== null;
        }
    },

    addStyle: function(css, id, mode, target) {
        target = target || document.head;

        // 检查是否已存在
        let styleEl = document.getElementById(id);

        if (mode === 'update' && styleEl) {
            styleEl.textContent = css;
            return;
        }

        if (mode === 'unique' && styleEl) {
            return; // 已存在，不添加
        }

        // 创建新的style元素
        styleEl = document.createElement('style');
        styleEl.id = id;
        styleEl.textContent = css;
        target.appendChild(styleEl);
    },

    domHelper: async function(tagName, callback) {
        const element = document.createElement(tagName);
        if (callback) {
            await callback(element);
        }
        return element;
    }
};

// ==========================================
// 初始化内置UI组件
// ==========================================

var crabCaptcha = new CaptchaWrite();
(function () {
    // 直接使用内置UI组件，无需远程加载
    window.CKTools = CKToolsFallback;
    GM_registerMenuCommand('规则管理', function () {
        GUIAddRule();
    }, 'a');

    // 添加 API Key 设置菜单
    GM_registerMenuCommand('🔑 设置 API Key', function () {
        crabCaptcha.SetApiKey();
    }, 'k');

    if (Set["idCard"] == '' || Set["idCard"] == undefined) {
        GM_registerMenuCommand('设置识别码', function () {
            crabCaptcha.SetIdCard();
        }, 's');
    }
    GM_registerMenuCommand('更多设置', function () {
        GUISettings();
    }, 'u');
    crabCaptcha.Start();
    CKTools.addStyle(`
    #CKTOOLS-modal{
        width: fit-content!important;
        max-width: 80%!important;
    }
    .CKTOOLS-modal-content li label b {
        color: green!important;
    }
    .CKTOOLS-modal-content li label span {
        color: red!important;
    }
    .showav_menuitem{
        line-height: 2em;
        width: 100%;
        transition: all .3s;
        cursor: pointer;
    }
    .showav_menuitem:hover{
        transform: translateX(6px);
    }
    .showav_menuitem>label{
        font-weight: bold;
        font-size: large;
        display: block;
    }
    `, 'showav_dragablecss', "unique", document.head);

    CKTools.addStyle(`
    #CKTOOLS-modal li, #CKTOOLS-modal ul{
        list-style: none !important;
    }
    `, 'showav_css_patch', 'unique', document.head);
})();