(function () {
  const BASE = '..';
  let currentDate = todayStr();
  let currentData = null;
  var closeTimer = null;

  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function formatDateLong(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function formatDateShort(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  async function init() {
    document.getElementById('contentDate').textContent = formatDateLong(todayStr());
    loadSettings();
    setupEventListeners();
    setupDrag();
    setupResize();
    await loadHistory();
    await loadDay(todayStr());
  }

  // ---- History ----

  async function loadHistory() {
    try {
      const res = await fetch(BASE + '/data/dates.json');
      if (!res.ok) return;
      const dates = await res.json();
      const list = document.getElementById('historyList');
      const empty = document.getElementById('historyEmpty');
      list.innerHTML = '';

      if (dates.length === 0) {
        empty.style.display = '';
        return;
      }
      empty.style.display = 'none';

      for (const date of dates) {
        const li = document.createElement('li');
        li.className = 'history-item';
        if (date === currentDate) li.classList.add('active');
        li.textContent = formatDateShort(date);
        li.dataset.date = date;
        li.addEventListener('click', function () {
          loadDay(this.dataset.date);
        });
        list.appendChild(li);
      }
    } catch (_) {
      // dates.json doesn't exist yet
    }
  }

  // ---- Load Day ----

  async function loadDay(dateStr) {
    currentDate = dateStr;

    document.querySelectorAll('.history-item').forEach(function (item) {
      item.classList.toggle('active', item.dataset.date === dateStr);
    });

    var title = document.getElementById('pageTitle');
    var dateEl = document.getElementById('contentDate');
    title.textContent = dateStr === todayStr() ? "Today's Ideas" : formatDateShort(dateStr);
    dateEl.textContent = formatDateLong(dateStr);

    document.getElementById('cardsContainer').style.display = 'none';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('loadingState').style.display = '';

    try {
      var res = await fetch(BASE + '/data/prototypes/' + dateStr + '.json');
      if (!res.ok) throw new Error('Not found');
      currentData = await res.json();
      renderCards(currentData.ideas);
      document.getElementById('loadingState').style.display = 'none';
      document.getElementById('cardsContainer').style.display = '';
    } catch (_) {
      currentData = null;
      document.getElementById('loadingState').style.display = 'none';
      document.getElementById('emptyState').style.display = '';
    }
  }

  // ---- Cards ----

  function renderCards(ideas) {
    var container = document.getElementById('cardsContainer');
    container.innerHTML = '';

    ideas.forEach(function (idea, index) {
      var card = document.createElement('div');
      card.className = 'idea-card';

      var featuresHtml = '';
      if (idea.coreFeatures && idea.coreFeatures.length) {
        featuresHtml = idea.coreFeatures
          .map(function (f) {
            return '<li>' + escapeHtml(f) + '</li>';
          })
          .join('');
      }

      card.innerHTML =
        '<div class="card-header">' +
        '  <span class="card-number">' + (index + 1) + '</span>' +
        '  <h3 class="card-title">' + escapeHtml(idea.name) + '</h3>' +
        '  <span class="card-badge">' + escapeHtml(idea.niche) + '</span>' +
        '</div>' +
        '<div class="card-body">' +
        '  <div class="card-field">' +
        '    <span class="field-label">Problem</span>' +
        '    <p>' + escapeHtml(idea.problem) + '</p>' +
        '  </div>' +
        '  <div class="card-field">' +
        '    <span class="field-label">Target User</span>' +
        '    <p>' + escapeHtml(idea.targetUser) + '</p>' +
        '  </div>' +
        '  <div class="card-field">' +
        '    <span class="field-label">Core Features</span>' +
        '    <ul class="features-list">' + featuresHtml + '</ul>' +
        '  </div>' +
        '</div>' +
        '<div class="card-footer">' +
        '  <button class="btn-demo" data-index="' + index + '">Open Demo</button>' +
        '</div>';

      container.appendChild(card);
    });

    container.querySelectorAll('.btn-demo').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(this.dataset.index);
        openDemo(ideas[idx]);
      });
    });
  }

  // ---- Demo Modal ----

  function openDemo(idea) {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }

    var overlay = document.getElementById('modalOverlay');
    var iframe = document.getElementById('modalIframe');
    var title = document.getElementById('modalTitle');
    var win = document.getElementById('modalWindow');

    title.textContent = idea.name;
    iframe.srcdoc = idea.html;

    win.style.left = '';
    win.style.top = '';
    win.style.width = '';
    win.style.height = '';
    win.style.transform = '';
    win.classList.remove('fullscreen');

    overlay.style.display = '';
    requestAnimationFrame(function () {
      overlay.classList.add('visible');
    });
  }

  function closeDemo() {
    var overlay = document.getElementById('modalOverlay');
    overlay.classList.remove('visible');
    closeTimer = setTimeout(function () {
      overlay.style.display = 'none';
      document.getElementById('modalIframe').srcdoc = '';
      closeTimer = null;
    }, 200);
  }

  // ---- Drag ----

  function setupDrag() {
    var titlebar = document.getElementById('modalTitlebar');
    var win = document.getElementById('modalWindow');
    var dragging = false;
    var startX, startY, origLeft, origTop;

    titlebar.addEventListener('mousedown', function (e) {
      if (e.target.closest('.modal-controls')) return;
      if (win.classList.contains('fullscreen')) return;
      dragging = true;
      var rect = win.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      origLeft = rect.left;
      origTop = rect.top;
      win.style.transition = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      win.style.left = origLeft + (e.clientX - startX) + 'px';
      win.style.top = origTop + (e.clientY - startY) + 'px';
      win.style.transform = 'none';
    });

    document.addEventListener('mouseup', function () {
      if (dragging) {
        dragging = false;
        win.style.transition = '';
      }
    });
  }

  // ---- Resize ----

  function setupResize() {
    var handle = document.getElementById('modalResize');
    var win = document.getElementById('modalWindow');
    var resizing = false;
    var startX, startY, origW, origH;

    handle.addEventListener('mousedown', function (e) {
      if (win.classList.contains('fullscreen')) return;
      resizing = true;
      startX = e.clientX;
      startY = e.clientY;
      origW = win.offsetWidth;
      origH = win.offsetHeight;
      win.style.transition = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!resizing) return;
      win.style.width = Math.max(420, origW + (e.clientX - startX)) + 'px';
      win.style.height = Math.max(320, origH + (e.clientY - startY)) + 'px';
    });

    document.addEventListener('mouseup', function () {
      if (resizing) {
        resizing = false;
        win.style.transition = '';
      }
    });
  }

  // ---- Settings ----

  function loadSettings() {
    document.getElementById('settingsRepo').value =
      localStorage.getItem('mi_gh_repo') || '';
    document.getElementById('settingsToken').value =
      localStorage.getItem('mi_gh_token') || '';
  }

  function saveSettings() {
    localStorage.setItem(
      'mi_gh_repo',
      document.getElementById('settingsRepo').value.trim()
    );
    localStorage.setItem(
      'mi_gh_token',
      document.getElementById('settingsToken').value.trim()
    );
    document.getElementById('settingsOverlay').style.display = 'none';
  }

  // ---- Regenerate ----

  async function triggerRegenerate() {
    var repo = localStorage.getItem('mi_gh_repo');
    var token = localStorage.getItem('mi_gh_token');

    if (!repo || !token) {
      document.getElementById('settingsOverlay').style.display = '';
      return;
    }

    var btn = document.getElementById('regenerateBtn');
    btn.disabled = true;
    btn.textContent = 'Triggering...';

    try {
      var res = await fetch(
        'https://api.github.com/repos/' +
          repo +
          '/actions/workflows/generate.yml/dispatches',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            Accept: 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({ ref: 'main' }),
        }
      );

      if (res.status === 204) {
        btn.textContent = 'Triggered!';
      } else {
        throw new Error('Status ' + res.status);
      }
    } catch (e) {
      console.error('Failed to trigger workflow:', e);
      btn.textContent = 'Failed';
    }

    setTimeout(function () {
      btn.textContent = 'Regenerate';
      btn.disabled = false;
    }, 3000);
  }

  // ---- Event Listeners ----

  function setupEventListeners() {
    document
      .getElementById('modalClose')
      .addEventListener('click', closeDemo);

    document
      .getElementById('modalOverlay')
      .addEventListener('click', function (e) {
        if (e.target === this) closeDemo();
      });

    document
      .getElementById('modalFullscreen')
      .addEventListener('click', function () {
        var win = document.getElementById('modalWindow');
        win.classList.toggle('fullscreen');
        if (win.classList.contains('fullscreen')) {
          win.style.left = '';
          win.style.top = '';
          win.style.width = '';
          win.style.height = '';
          win.style.transform = '';
        }
      });

    document
      .getElementById('regenerateBtn')
      .addEventListener('click', triggerRegenerate);

    document
      .getElementById('settingsBtn')
      .addEventListener('click', function () {
        document.getElementById('settingsOverlay').style.display = '';
      });

    document
      .getElementById('settingsCancel')
      .addEventListener('click', function () {
        document.getElementById('settingsOverlay').style.display = 'none';
      });

    document
      .getElementById('settingsSave')
      .addEventListener('click', saveSettings);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeDemo();
        document.getElementById('settingsOverlay').style.display = 'none';
      }
    });
  }

  init();
})();
