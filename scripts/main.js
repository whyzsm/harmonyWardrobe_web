/* 衣不缺 Web 版 — 启动入口 / Bootstrap
   初始化数据库后挂载应用外壳。 */
(function (global) {
  'use strict';

  var HW = global.HW;

  function showBootError(message, onRetry) {
    var app = document.getElementById('app');
    if (!app) {
      return;
    }
    app.innerHTML = '';
    var canvas = document.createElement('div');
    canvas.className = 'app-canvas';

    var column = document.createElement('div');
    column.className = 'page';
    column.style.justifyContent = 'center';
    column.style.alignItems = 'center';
    column.style.textAlign = 'center';
    column.style.padding = '24px';

    var title = document.createElement('div');
    title.textContent = '衣不缺';
    title.style.fontSize = '28px';
    title.style.color = 'var(--text-primary)';
    column.appendChild(title);

    var error = document.createElement('div');
    error.textContent = message;
    error.style.fontSize = '14px';
    error.style.color = 'var(--danger)';
    error.style.marginTop = '12px';
    column.appendChild(error);

    var retry = document.createElement('button');
    retry.className = 'btn btn--sm';
    retry.style.width = 'auto';
    retry.style.padding = '0 24px';
    retry.style.marginTop = '16px';
    retry.textContent = '重试';
    retry.addEventListener('click', onRetry);
    column.appendChild(retry);

    canvas.appendChild(column);
    app.appendChild(canvas);
  }

  function boot() {
    if (!HW || !HW.App) {
      showBootError('应用脚本加载失败，请刷新页面重试。', boot);
      return;
    }

    /* 先打开数据库，确认本地存储可用后再挂载 UI */
    HW.Db.open()
      .then(function () {
        HW.App.init();
      })
      .catch(function (error) {
        var message =
          error && error.message
            ? HW.utils.userFacingError(error, '初始化应用失败')
            : '初始化应用失败';
        showBootError(message, boot);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
