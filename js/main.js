/* ==========================================================================
   洛天依主题站 · 全站交互脚本
   文件：js/main.js
   --------------------------------------------------------------------------
   职责
     1. 移动端导航折叠（汉堡按钮）
     2. 页脚年份自动更新
     3. 推荐页：fetch 读取 _data/recommendations.json 并渲染卡片

   说明：全部功能都做了「元素不存在就跳过」的判断，
        所以同一个 js 文件可以被所有页面安全引用，不会报错。
   ========================================================================== */

(function () {
  'use strict';

  /* ========================================================================
     1. 移动端导航折叠
     ======================================================================== */
  function initNavToggle() {
    var toggle = document.getElementById('navToggle');
    var links  = document.getElementById('navLinks');

    if (!toggle || !links) return;   // 页面上没有导航就直接跳过

    // 点击汉堡按钮：展开 / 收起
    toggle.addEventListener('click', function () {
      var isOpen = links.classList.toggle('open');
      toggle.classList.toggle('open', isOpen);
      // 同步无障碍状态，读屏软件才能正确播报
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      toggle.setAttribute('aria-label', isOpen ? '关闭导航菜单' : '打开导航菜单');
    });

    // 点击任意导航链接后自动收起（移动端体验更好）
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') closeNav();
    });

    // 点击页面其它地方也收起
    document.addEventListener('click', function (e) {
      if (!links.classList.contains('open')) return;
      if (links.contains(e.target) || toggle.contains(e.target)) return;
      closeNav();
    });

    // 按 Esc 收起
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeNav();
    });

    // 窗口放大回桌面尺寸时，清掉展开状态，避免残留
    window.addEventListener('resize', function () {
      if (window.innerWidth > 860) closeNav();
    });

    function closeNav() {
      links.classList.remove('open');
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', '打开导航菜单');
    }
  }


  /* ========================================================================
     2. 页脚年份
     ======================================================================== */
  function initYear() {
    var el = document.getElementById('year');
    if (el) el.textContent = String(new Date().getFullYear());
  }


  /* ========================================================================
     3. 推荐页：加载并渲染歌单数据
     ------------------------------------------------------------------------
     数据有两条来源，按顺序尝试：

       来源 1  fetch 读取 _data/recommendations.json
               —— 部署到服务器、或本地起了 http 服务时走这条。这是主来源。

       来源 2  退回到 _data/recommendations.js
               —— 直接双击打开网页时是 file:// 协议，浏览器会硬性拦截 fetch
                  读本地文件，这是同源策略，没有任何前端写法能绕过。
                  所以额外提供一份 .js 镜像，用 <script> 标签加载（不受此限制）。

     .js 镜像由「更新推荐数据.bat」从 JSON 自动生成 ——
     你平时只需要编辑 JSON，改完双击一下那个 bat 即可。
     ======================================================================== */

  var REC_JSON = '_data/recommendations.json';
  var REC_JS   = '_data/recommendations.js';

  /** 把两种来源的数据统一成歌曲数组 */
  function normalize(data) {
    var list = Array.isArray(data) ? data : (data && data.songs);
    if (!Array.isArray(list)) throw new Error('数据结构不对，应为数组或 { "songs": [...] }');
    return list;
  }

  /** 来源 1：fetch 读 JSON */
  function loadFromJson() {
    return fetch(REC_JSON, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(normalize);
  }

  /** 来源 2：用 script 标签加载 .js 镜像（file:// 下也能用） */
  function loadFromJs() {
    return new Promise(function (resolve, reject) {
      // 能走到这里说明是本地双击打开（file://），fetch 被同源策略拦了。
      // 这条提示只出现在开发者控制台，不影响正常访客 ——
      // 留给自己排查「改完 JSON 没同步、以为改错了」这种问题。
      if (window.console && console.info) {
        console.info(
          '[歌单] 本地 file:// 环境无法 fetch JSON，已改用 _data/recommendations.js 镜像。\n' +
          '       刚改过 recommendations.json 的话，请先双击「更新推荐数据.bat」同步一次。\n' +
          '       部署到服务器后页面会直接读 JSON，不受此影响。'
        );
      }

      var s = document.createElement('script');
      s.src = REC_JS;
      s.onload = function () {
        var d = window.RECOMMENDATIONS;
        if (!d) { reject(new Error('recommendations.js 中没有 RECOMMENDATIONS 变量')); return; }
        try { resolve(normalize(d)); } catch (e) { reject(e); }
      };
      s.onerror = function () { reject(new Error('无法加载 ' + REC_JS)); };
      document.head.appendChild(s);
    });
  }

  /**
   * 转义 HTML，防止 JSON 里的内容破坏页面结构
   */
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * 判断 URL 协议是否安全。
   * 只放行 http / https 和相对路径（没有协议的），
   * 挡掉 javascript:、data:、vbscript: 这类伪协议 ——
   * 否则一旦 JSON 被写入恶意链接，访客点一下就会执行脚本。
   *
   * 注意：必须先按浏览器的规则做归一化，否则会被绕过 ——
   * 浏览器解析 href 时会去掉首尾空白与 C0 控制字符，
   * 并删除 URL 中任意位置的制表符和换行符。
   * 所以 "  javascript:..." 和 "java\tscript:..." 在真实浏览器里都会执行。
   */
  function isSafeUrl(url) {
    var u = String(url)
      .replace(/^[\u0000-\u0020]+/, '')   // 去掉开头的空白和控制字符
      .replace(/[\t\n\r]/g, '');          // 删掉任意位置的制表符 / 换行

    var m = /^([a-z][a-z0-9+.\-]*):/i.exec(u);   // 取出开头的协议名
    if (!m) return true;                          // 没有协议 = 相对路径，安全
    var scheme = m[1].toLowerCase();
    return scheme === 'http' || scheme === 'https';
  }

  /**
   * 外链安全属性：新窗口打开 + 阻断 referrer
   * （占位链接 "#" 时不需要 target，否则会白开一个标签页）
   * 协议不安全的一律降级成 "#"，宁可点不动也不让它执行脚本。
   */
  function linkAttrs(url) {
    if (!url || url === '#' || !isSafeUrl(String(url))) return 'href="#"';
    return 'href="' + esc(url) + '" target="_blank" rel="noopener noreferrer"';
  }

  /**
   * 渲染单张推荐卡片
   * @param {Object} item  JSON 中的一条数据
   * @param {number} index 序号，从 0 开始
   */
  function renderCard(item, index) {
    var title  = esc(item.title  || '未命名');
    var credit = esc(item.credit || '');          // 原曲投稿账号，用于署名
    var cover  = esc(item.cover  || 'images/rec1.jpg');
    var note   = esc(item.note   || '');
    var url    = item.url || '#';

    return '' +
      '<article class="work-card">' +
        '<img class="work-cover" src="' + cover + '" ' +
             'alt="《' + title + '》曲绘" loading="lazy">' +
        '<div class="work-body">' +
          '<h3 class="work-title">' +
            '<span class="work-index">' + String(index + 1).padStart(2, '0') + '</span>' +
            title +
          '</h3>' +
          (credit ? '<p class="work-credit">' + credit + '</p>' : '') +
          (note   ? '<p class="rec-quote">'  + note   + '</p>' : '') +
          '<a class="btn" ' + linkAttrs(url) + '>在 B 站观看</a>' +
        '</div>' +
      '</article>';
  }

  /**
   * 主流程：先试 JSON，读不到就退回 .js 镜像，都失败才提示错误
   */
  function initRecommendations() {
    var box = document.getElementById('recList');
    if (!box) return;                 // 不是推荐页，直接跳过

    loadFromJson()
      .catch(function () { return loadFromJs(); })
      .then(function (list) {
        if (list.length === 0) {
          box.innerHTML = '<p class="loading">歌单还是空的，去 _data/recommendations.json 里加几首吧 ♪</p>';
          return;
        }
        box.innerHTML = list.map(renderCard).join('');
      })
      .catch(function (err) {
        showError(box,
          '推荐歌单加载失败：' + esc(err.message) + '<br>' +
          '请确认 <code>_data/recommendations.json</code> ' +
          '或 <code>_data/recommendations.js</code> 存在。');
      });
  }

  function showError(box, html) {
    box.innerHTML = '<p class="load-error">' + html + '</p>';
  }


  /* ========================================================================
     启动
     ======================================================================== */
  function init() {
    initNavToggle();
    initYear();
    initRecommendations();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
