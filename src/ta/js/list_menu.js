const CMenu = (function () {
    return {
        $container: null,
        sys_dom: null,
        dom: null,
        editor: null,
        codeTemplate: '',

        // 指标数据存储
        sys_datas: [],
        datas: [],

        // 左侧指标节点
        sys_item_doms: [],
        item_doms: {},

        // 删除对话框
        $trashModal: null,

        editing: {},
        doing: '', // edit / new / copy
    };
}());

CMenu.init = function (div) {
    // 初始化对象
    CMenu.$container = $('table#' + div);
    CMenu.sys_dom = CMenu.$container.find('#system-indicators');
    CMenu.sys_dom.append($('<div><h5>Loading...</h5></div>'));
    CMenu.dom = CMenu.$container.find('#custom-indicators');
    CMenu.dom.append($('<div><h5>Loading...</h5></div>'));

    // 初始化系统指标
    // 初始化时默认选中第一个系统指标
    let promiseSys = CMenu.initSysIndicators();

    // 初始化用户自定义指标
    CMenu.$trashModal = $('#TrashModal');
    let promiseCus = CMenu.initCustomIndicators();

    Promise.all([promiseCus, promiseSys]).then(function () {
        //初始化指标类
        register_all_indicators();
    });

    // 初始化代码编辑区域
    CMenu.editor = ace.edit('editor');
    CMenu.editor.getSession().setMode('ace/mode/javascript');
    ace.require('ace/ext/language_tools');
    CMenu.editor.$blockScrolling = Infinity;
    let session = CMenu.editor.getSession();
    var interval = setInterval(() => {
        if (session.$worker) {
            session.$worker.send('changeOptions', [{
                strict: false,
            },]);
            clearInterval(interval);
        }
    }, 50);

    CMenu.editor.setOptions({
        enableBasicAutocompletion: true,
        enableSnippets: true,
        enableLiveAutocompletion: true,
        enableLinking: true,
    });

    /*************** breakpoints ***************/

    CMenu.editor.on('guttermousedown', function (e) {
        if (CMenu.editor.getReadOnly()) return;

        var target = e.domEvent.target;

        if (target.className.indexOf('ace_gutter-cell') == -1) return;

        if (!CMenu.editor.isFocused()) return;

        if (e.clientX > 25 + target.getBoundingClientRect().left) return;

        var row = e.getDocumentPosition().row;
        var breakpointsArray = e.editor.session.getBreakpoints();
        if (!(row in breakpointsArray)) {
            e.editor.session.setBreakpoint(row);
        } else {
            e.editor.session.clearBreakpoint(row);
        }

        e.stop();
    });

    /*************** keywords link Click ***************/
    CMenu.editor.on('linkClick', function (data) {
        var types = ['support.function.tianqin', 'constant.language.function'];
        var functype = ['cfunc', 'efunc'];
        var index = types.indexOf(data.token.type);
        if (data && data.token && index > -1) {
            let lowerCase = data.token.value.toLowerCase();
            window.open(`http://doc.tq18.cn/ta/latest/${functype[index]}/${lowerCase}.html`);
        }

    });

    /*************** mousemove + tooltips ***************/

    CMenu.editor.on('mousemove', function (e) {
        var position = e.getDocumentPosition();
        var token = CMenu.editor.getSession().getTokenAt(position.row, position.column);
        if (position && token) {
            var types = Object.keys(CMenu.tooltips);
            if (types.indexOf(token.type) > -1) {
                let pixelPosition = CMenu.editor.renderer.textToScreenCoordinates(position);
                pixelPosition.pageY += CMenu.editor.renderer.lineHeight;
                CMenu.updateTooltip(pixelPosition, token);
            } else {
                CMenu.updateTooltip(CMenu.editor.renderer.textToScreenCoordinates(position));
            }
        }
    });

    /*************** Command-S / Ctrl-S ***************/
    CMenu.editor.commands.addCommand({
        name: 'saverun',
        bindKey: { win: 'Ctrl-Shift-S', mac: 'Command-Shift-S', sender: 'editor|cli' },
        exec: function (editor) {
            $('#btn_editor_run').click();
        },

        readOnly: false,
    });

    CMenu.editor.commands.addCommand({
        name: 'saverun',
        bindKey: { win: 'Ctrl-S', mac: 'Command-S', sender: 'editor|cli' },
        exec: function (editor) {
            $('#btn_editor_run').click();
        },

        readOnly: false,
    });

    CMenu.editor.commands.addCommand({
        name: 'saverun',
        bindKey: { win: 'Ctrl-S', mac: 'Command-S', sender: 'editor|cli' },
        exec: function (editor) {
            $('#btn_editor_run').click();
        },

        readOnly: false,
    });

    CMenu.initThemeContainer();
};

CMenu.updateTooltip = function (position, token) {
    //example with container creation via JS
    var div = document.getElementById('tooltip_0');
    if (div === null) {
        div = document.createElement('div');
        div.setAttribute('id', 'tooltip_0');
        div.setAttribute('class', 'seecoderun_tooltip'); // and make sure myclass has some styles in css
        document.body.appendChild(div);
    }

    div.style.display = 'block';
    div.style.left = position.pageX + 'px';
    div.style.top = position.pageY + 'px';
    div.style.visibility = 'hidden';

    var types = ['support.function.tianqin', 'constant.language.function'];


    if (token) {
        var color = CMenu.getTooltipColor(token);
        var typeIndex = types.indexOf(token.type);
        if (color) {
            div.style.backgroundColor = color;
            div.style.visibility = 'visible';
            div.innerText = '   ';
        } else {
            div.style.backgroundColor = '#FFFFFF';
            var text = CMenu.getTooltipText(token);

            if (text && text.length > 0) {
                if (typeIndex > -1) text = text += ' (按住Ctrl单击打开链接)';
                div.style.visibility = 'visible';
                div.innerText = text;
            }
        }

    }
};

CMenu.selectCallback = function (tr, data) {
    for (let k in CMenu.sys_item_doms) {
        CMenu.sys_item_doms[k][0].classList.remove('active');
    }

    for (let k in CMenu.item_doms) {
        CMenu.item_doms[k][0].classList.remove('active');
    }

    tr.classList.add('active');
    if (data.type === 'system') {
        $('#btn_editor_save').attr('disabled', true);
        $('#btn_editor_run').attr('disabled', true);
        $('#btn_editor_reset').attr('disabled', true);
        CMenu.editing = data;
        CMenu.editor.setValue(data.draft.code, 1);
        CMenu.editor.setReadOnly(true);
    } else {
        $('#btn_editor_save').attr('disabled', false);
        $('#btn_editor_run').attr('disabled', false);
        $('#btn_editor_reset').attr('disabled', false);
        IStore.getByKey(data.key).then(function (result) {
            CMenu.editing = result;
            if (data.type === 'custom') {
                CMenu.editor.setValue('', 1);
                CMenu.editor.insertSnippet(result.draft.code);
            } else {
                CMenu.editor.setValue(result.draft.code, 1);
            }
            CMenu.editor.setReadOnly(false);
        });
    }

    CMenu.editor.focus();
    // 清空全部断点
    CMenu.editor.session.clearBreakpoints();
    if (data.type === 'system' || data.type === 'custom') {
        let center = $('div.main-container div.content-container')[0];
        center.classList.remove('col-xs-6');
        center.classList.add('col-xs-9');
        $('div.main-container div.right-menu')[0].classList.add('hide');
    }
};

CMenu.initSysIndicators = function () {
    return new Promise((resolve, reject) => {
        $.get('/libs/ind/defaults.json').then(function (response) {
            for (let name in response) {
                if (name === 'template') {
                    CMenu.codeTemplate = response[name];
                } else {
                    CMenu.sys_datas.push({
                        name: name,
                        type: 'system',
                        draft: {
                            code: response[name]
                        }
                    });
                }
            }

            // 初始化界面
            CMenu.sys_dom.empty();
            for (let i = 0; i < CMenu.sys_datas.length; i++) {
                let tr = CMenuUtils.getIndicatorTr(CMenu.sys_datas[i], {
                    select: CMenu.selectCallback,
                    copy: CMenu.copyCallback,
                });
                CMenu.sys_item_doms.push(tr);
                CMenu.sys_dom.append(tr);
            }

            // 初始化时默认选中第一个系统指标
            CMenu.sys_item_doms[0].find('td:first').click();
            resolve();
        });
    });

};

CMenu.initCustomIndicators = function () {
    return new Promise((resolve, reject) => {
        IStore.init().then(function () {
            IStore.getAll().then(function (list) {
                // 显示UI
                CMenu.datas = list;
                CMenu.dom.empty();
                CMenu.updateUI();
                resolve();
            }, function (e) {
                console.error(e);
            });
        });

    });

};

CMenu.addAction = function () {
    CMenu.doing = 'new';

    let name = 'untitled';
    let codeDefault = CMenu.codeTemplate.replace('${1:indicator_name}', name);
    let type = 'custom'; // 没有文华，只保留天勤 @20180409

    IStore.add({
        name: name,
        type: type,
        draft: {
            code: codeDefault,
        },
    }).then(function (i) {
        CMenu.update(() => {
            CMenu.dom.find('tr.' + name + ' td')[0].click();
        });
    }, function (e) {
        if (e === 'ConstraintError') {
            name = name + '_' + RandomStr(4);
            IStore.add({
                name: name,
                type: type,
                draft: {
                    code:  CMenu.codeTemplate.replace('${1:function_name}', name)
                },
            }).then(function (i) {
                CMenu.update(() => {
                    CMenu.dom.find('tr.' + name + ' td')[0].click();
                });
            }, function (e) {
                if (e === 'ConstraintError') {
                    Notify.error('指标名称重复');
                } else {
                    Notify.error(e);
                }
            });
        } else {
            Notify.error(e);
        }
    });
};

CMenu.copyCallback = function (tr, data) {
    CMenu.doing = 'copy';

    let name = data.name + '_copy';
    let code = data.draft.code.trim();
    let re = /^(function\s*\*\s*).*(\s*\(\s*C\s*\)\s*\{[\s\S]*\})$/g;
    let type = 'custom'; // 没有文华，只保留天勤 @20180409

    IStore.add({
        name: name,
        type: type,
        draft: {
            code: code.replace(re, '$1' + name + '$2'),
        },
    }).then(function (i) {
        CMenu.update(() => {
            CMenu.dom.find('tr.' + name + ' td')[0].click();
        });
    }, function (e) {
        if (e === 'ConstraintError') {
            name += '_' + RandomStr(4);
            IStore.add({
                name: name,
                type: type,
                draft: {
                    code: code.replace(re, '$1' + name + '$2'),
                },
            }).then(function (i) {
                CMenu.update(() => {
                    CMenu.dom.find('tr.' + name + ' td')[0].click();
                });
            }, function (e) {
                if (e === 'ConstraintError') {
                    Notify.error('指标名称重复');
                } else {
                    Notify.error(e);
                }
            });
        } else {
            Notify.error(e);
        }
    });
};

// 检查 系统指标 和 用户自定义指标 是否有指标名称是 name
CMenu.hasClassName = function (name) {
    let lists = ['sys_datas', 'datas'];
    for (let i = 0; i < lists.length; i++) {
        for (let j = 0; j < CMenu[lists[i]].length; j++) {
            if (name === CMenu[lists[i]][j].name) return true;
        }
    }

    return false;
};

// 删除当前编辑的指标
CMenu.trashIndicator = function (e) {
    let indicatorName = CMenu.editing.name;

    // UI界面 删除DOM
    let $nextTr = CMenu.item_doms[CMenu.editing.key].next('tr');
    if ($nextTr.length === 0) {
        $nextTr = CMenu.item_doms[CMenu.editing.key].prev('tr');
        if ($nextTr.length === 0) $nextTr = null;
    };

    CMenu.item_doms[CMenu.editing.key].remove();

    // 删除内存数据
    delete CMenu.item_doms[CMenu.editing.key];

    // 删除数据库存储数据
    IStore.remove(CMenu.editing.key).then(function (i) {
        // 更新界面
        CMenu.update(() => {
            if ($nextTr) {
                $nextTr.find('td:first').click();
            } else {
                CMenu.sys_item_doms[0].find('td:first').click();
            }
        });

        // 关闭确认框
        CMenu.$trashModal.modal('hide');

        // 通知webworker unregister_indicator_class
        worker.postMessage({ cmd: 'unregister_indicator_class', content: indicatorName });
    },        function (e) {
            Notify.error(e.toString());
        });
};

CMenu.saveDraftIndicator = function (e) {
    IStore.saveDraft({
        key: CMenu.editing.key,
        name: CMenu.editing.name,
        draft: {
            code: CMenu.editor.getValue(),
        }
    }).then(function (result) {
        CMenu.editing = result;
        worker.postMessage({ cmd: 'indicator', content: result });
    }, function (e) {

        Notify.error(e);
    });
};

CMenu.saveFinalIndicator = function (e) {
    IStore.saveFinal({
        key: CMenu.editing.key,
        name: CMenu.editing.name,
        draft: {
            code: CMenu.editor.getValue(),
        }
    }).then(function (result) {
        CMenu.update()
    }, function (e) {
        Notify.error(e);
    });
};

CMenu.resetIndicator = function (e) {
    IStore.reset(CMenu.editing.key).then(function (result) {
        CMenu.editing = result;
        CMenu.editor.setValue(result.draft.code, 1);
        CMenu.editor.focus();
    });
};

CMenu.trashCallback = function (tr, key) {
    CMenu.doing = 'edit';
    IStore.getByKey(key).then(function (result) {
        CMenu.$trashModal.find('#trash-indicator-name').text(result.name);
        CMenu.$trashModal.modal('show');
    });
};

CMenu.update = function (fun) {
    IStore.getAll().then(function (list) {
        CMenu.datas = list;
        CMenu.updateUI();
        if (fun) fun();
    }, function (e) {
        console.log(e);
    });
};

CMenu.updateUI = function (indicator) {
    for (let i = 0; i < CMenu.datas.length; i++) {
        if (indicator && CMenu.datas[i].key === indicator.key) {
            CMenu.datas[i] = indicator;
            CMenu.editing = indicator;
        } else {
            indicator = CMenu.datas[i];
            if (indicator.key === CMenu.editing.key) {
                CMenu.editing = indicator;
            }
        }

        if (!CMenu.item_doms[indicator.key]) {
            CMenu.item_doms[indicator.key] = CMenuUtils.getIndicatorTr(indicator, {
                select: CMenu.selectCallback,
                trash: CMenu.trashCallback,
            });
            CMenu.dom.append(CMenu.item_doms[indicator.key]);
        } else {
            let type = CMenuUtils.getBrandTag(indicator.type);
            CMenu.item_doms[indicator.key].find('td:first').empty().append(type).append(indicator.name);
            CMenu.item_doms[indicator.key].find('td:first').empty().append(indicator.name);
        }

        if (ErrorHandlers.has(indicator.name)) {
            let timeout = CMenuUtils.getBrandTag('timeout');
            CMenu.item_doms[indicator.key].find('td:first').append(timeout);
        }
    }
};

CMenu.initThemeContainer = function () {
    let themes = [
        'ambiance',
        'chaos',
        'chrome',
        'clouds',
        'clouds_midnight',
        'cobalt',
        'crimson_editor',
        'dawn',
        'dreamweaver',
        'eclipse',
        'github',
        'gruvbox',
        'idle_fingers',
        'iplastic',
        'katzenmilch',
        'kr_theme',
        'kuroir',
        'merbivore',
        'merbivore_soft',
        'mono_industrial',
        'monokai',
        'pastel_on_dark',
        'solarized_dark',
        'solarized_light',
        'sqlserver',
        'terminal',
        'textmate',
        'tomorrow',
        'tomorrow_night',
        'tomorrow_night_blue',
        'tomorrow_night_bright',
        'tomorrow_night_eighties',
        'twilight',
        'vibrant_ink',
        'xcode',
    ];
    let the = localStorage.getItem('theme');
    if (the === null) {
        the = 'textmate';
        localStorage.setItem('theme', the);
    }

    $('.theme-container .show-theme').text(the);
    CMenu.editor.setTheme('ace/theme/' + the);
    let str = '';
    let $ul = $('.theme-container .dropdown-menu');
    for (let i = 0; i < themes.length; i++) {
        str += ('<li><a href="#" class="' + themes[i] + '">' + themes[i] + '</a></li>');
    }

    $ul.html(str);
    $ul.css({
        height: '200px',
        overflow: 'scroll',
    });
    $ul.on('click', function (e) {
        CMenu.changeEditorTheme(e.target.className);
    });
};

CMenu.changeEditorTheme = function (the) {
    $('.theme-container .show-theme').text(the);
    CMenu.editor.setTheme('ace/theme/' + the);
    localStorage.setItem('theme', the);
};

CMenuUtils = (function () {
    let validVariableName = function (name) {
        // 匹配变量名的正则
        // 长度1-20，数字、字母、_、$ 组成，数字不能开头
        let regExp = /^[a-zA-Z\_\$][0-9a-zA-Z\_\$]{0,19}$/;
        return regExp.test(name);
    };

    let getBrandTag = function (type) {
        let setting = {
            system: {
                label_name: 'danger',
                label_text: '天',
            },
            custom: {
                label_name: 'danger',
                label_text: '天',
            },
            custom_wh: {
                label_name: 'info',
                label_text: '文',
            },
            timeout: {
                label_name: 'danger',
                label_text: '错误',
            }
        };
        let $d = $('<span></span>');

        $d.addClass('label label-brand label-' + setting[type].label_name);
        $d.append(setting[type].label_text);
        return $d;
    };

    let getNameTd = function (data) {
        let $td = $('<td>' + data.name + '</td>');
        return $td;
    };

    let getIconBtn = function (type) {
        let $btn = $('<span class="glyphicon glyphicon-' + type + '"></span>');
        return ($('<td width="10%"></td>').append($btn));
    };

    let getIndicatorTr = function (data, callbacks) {
        // data.type 'system' callbacks[select edit trash]
        // data.type 'custom-*' callbacks[select copy]
        let $tr = $('<tr class="' + data.name + '"></tr>');
        $tr.on('click', function (e) {
            let $tr = e.target.parentElement;
            if (e.target.parentElement.parentElement.nodeName === 'TR') {
                $tr = e.target.parentElement.parentElement;
            }

            callbacks.select($tr, data);
        });

        $tr.append(getNameTd(data));
        if (data.type === 'system') {
            let copyBtn = CMenuUtils.getIconBtn('duplicate');
            copyBtn.on('click', function (e) {
                callbacks.copy($tr, data);
            });

            return $tr.append(copyBtn);
        } else {
            let trashBtn = CMenuUtils.getIconBtn('trash');
            trashBtn.on('click', function (e) {
                callbacks.trash($tr, data.key);
            });

            return $tr.append(trashBtn);
        }
    };

    return {
        validVariableName: validVariableName,
        getBrandTag: getBrandTag,
        getIconBtn: getIconBtn,
        getIndicatorTr: getIndicatorTr,
    };
}());

class COLOR {
    constructor(r, g, b) {
        this.r = r;
        this.g = g;
        this.b = b;
    }

    toString() {
        return '#' + this.r.toString(16).padStart(2, '0') + this.g.toString(16).padStart(2, '0') + this.b.toString(16).padStart(2, '0');
    }
}

CMenu.tooltips = {
    'support.function.tianqin': {
        DEFINE: '定义技术指标属性',
        PARAM: '定义指标参数',
        SERIAL: '定义输入序列',
        OUTS: '定义输出序列',
    },
    'constant.language.context': {
        C: '系统核心函数提供者',
    },
    'constant.language.color': {
        RED: new COLOR(0xFF, 0, 0),
        GREEN: new COLOR(0, 0xFF, 0),
        BLUE: new COLOR(0, 0, 0xFF),
        CYAN: new COLOR(0, 0xFF, 0xFF),
        BLACK: new COLOR(0, 0, 0),
        WHITE: new COLOR(0xFF, 0xFF, 0xFF),
        GRAY: new COLOR(0x80, 0x80, 0x80),
        MAGENTA: new COLOR(0xFF, 0, 0xFF),
        YELLOW: new COLOR(0xFF, 0xFF, 0),
        LIGHTGRAY: new COLOR(0xD3, 0xD3, 0xD3),
        LIGHTRED: new COLOR(0xF0, 0x80, 0x80),
        LIGHTGREEN: new COLOR(0x90, 0xEE, 0x90),
        LIGHTBLUE: new COLOR(0x8C, 0xCE, 0xFA),
    },
    'constant.language.function': {
        MA: '求一个序列中连续N项的平均值',
        STDEV: '求一个序列中连续N项的标准差',
        SUM: '求一个序列中连续N项的和',
    },
    'support.keyword.tianqin': {
        PARAMS: '参数对象',
        OUTS: '定义输出序列',
        cname: '可选，指定技术指标的中文名称。默认为技术指标名',
        type: '必填，“MAIN” 或 “SUB”, MAIN=主图技术指标, SUB=副图技术指标',
        state: '必填，“KLINE” 或 “TICK”',
        color: '设置颜色',
        memo: '可选，设定此技术指标的文字说明。',
        yaxis: '可选, 描述此指标所需要使用的Y坐标轴',
    },
};

CMenu.getTooltipColor = function (token) {
    if (token.type === 'constant.language.color') {
        return CMenu.tooltips[token.type][token.value].toString();
    } else {
        return false;
    }
};

CMenu.getTooltipText = function (token) {
    return CMenu.tooltips[token.type][token.value];
};
