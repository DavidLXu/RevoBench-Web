'use strict';
const $ = (selector) => document.querySelector(selector);
const labels = { accepted: '已验收', in_progress: '开发中', not_started: '未开始' };
const kindLabels = { demo: '任务演示', accepted: '验收参考', diagnostic: '调试录像', development: '开发演示' };

const suiteInfo = {
  Coord: {short: '双臂协同', desc: '两只手怎样分工、共同承托或交接物体？例如双手搬箱、端托盘。'},
  Dex: {short: '五指灵巧', desc: '哪些动作需要手指分别发力、转向或换握？例如转旋钮、插笔。'},
  Touch: {short: '触觉反馈', desc: '触觉能否帮助对孔、判断接触或防止滑落？例如插杆、插充电器。'},
  Tool: {short: '工具使用', desc: '手怎样握住工具并控制它与目标的交互？例如锤击钉子、用壶倾倒。'},
  Long: {short: '长程组合', desc: '多个有先后依赖的步骤怎样衔接？例如转移多块食材、装袋收纳。'},
};
const batchLabels = {tabletop100: '第二批组合任务（51–100）', daily_tabletop: '日常桌面任务'};

const dimLabels = {
  coordination: {
    unimanual: '单手独立',
    stabilize_and_act: '主辅协同',
    parallel_async: '并行异步',
    closed_chain: '闭链共持',
    handover_relay: '跨手交接',
    dual_tool: '双工具协同',
  },
  tactile_mode: {
    grasp_confirmation: '接触确认',
    tight_fit_wrench: '紧公差力矩',
    occluded_exploration: '盲区探索',
    slip_force_control: '防滑与力控',
    tool_mediated: '工具传导感知',
  },
  dexterity_level: {
    power_pinch: 'L1 包络对捏',
    functional_fingers: 'L2 功能分指',
    in_hand_extrinsic: 'L3 手内/外源灵巧',
  },
  horizon: {
    atomic: '短程原子',
    sequential: '中程序列',
    long_horizon: '长程组合',
  },
};

let tasks = [];
let status = 'accepted';
let batch = null;
let suite = 'all';
let dimFilters = { coordination: 'all', tactile_mode: 'all', dexterity_level: 'all', horizon: 'all' };
let previousFocus = null;

const esc = (value) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const duration = (seconds) => `${Math.floor(Math.round(seconds) / 60)}:${String(Math.round(seconds) % 60).padStart(2, '0')}`;
const placeholder = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="m32 7 23 13v25L32 58 9 45V20Z M9 20l23 13 23-13 M32 33v25 M20 13l23 13v14"/></svg><span>等待动作录制</span><small>尚无演示视频</small>`;

const hero = $('#hero-video');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
function syncHeroButton() {
  $('#hero-toggle').setAttribute('aria-label', hero.paused ? '播放首页演示' : '暂停首页演示');
  $('#hero-toggle').innerHTML = `<span aria-hidden="true">${hero.paused ? '▶' : 'Ⅱ'}</span>`;
}
hero.addEventListener('play', syncHeroButton);
hero.addEventListener('pause', syncHeroButton);
$('#hero-toggle').addEventListener('click', () => hero.paused ? hero.play().catch(syncHeroButton) : hero.pause());
if (!motionPreference.matches) hero.play().catch(syncHeroButton);
motionPreference.addEventListener('change', e => { if (e.matches) hero.pause(); });
new IntersectionObserver(entries => { if (!entries[0].isIntersecting) hero.pause(); }, { threshold: 0.05 }).observe(hero);

function taskSearchText(t) {
  const suitesText = (t.suites || []).map(s => `${s} ${suiteInfo[s]?.short || ''}`).join(' ');
  const dimsText = `${t.coordination} ${dimLabels.coordination[t.coordination] || ''} ${t.tactile_mode} ${dimLabels.tactile_mode[t.tactile_mode] || ''} ${t.dexterity_level} ${dimLabels.dexterity_level[t.dexterity_level] || ''} ${t.horizon} ${dimLabels.horizon[t.horizon] || ''}`;
  return `${t.title} ${t.id} ${t.description} ${t.category || ''} ${suitesText} ${dimsText}`.toLowerCase();
}

function renderSuiteCards() {
  const keys = Object.keys(suiteInfo);
  $('#suite-cards').innerHTML = keys.map(key => {
    const members = tasks.filter(t => (t.suites || []).includes(key));
    const acc = members.filter(t => t.status === 'accepted').length;
    const inp = members.filter(t => t.status === 'in_progress').length;
    const total = members.length || 1;
    const accPct = ((acc / total) * 100).toFixed(1);
    const inpPct = ((inp / total) * 100).toFixed(1);
    const active = suite === key;
    return `<button type="button" class="suite-card ${active ? 'active' : ''}" data-pick-suite="${key}" aria-pressed="${active}">
      <div class="suite-card-top">
        <span class="suite-pill" data-s="${key}">${key}</span>
        <span class="suite-stat"><strong>${acc}</strong> 已验收${inp ? ` · ${inp} 开发中` : ''} / ${members.length}</span>
      </div>
      <h3>${esc(suiteInfo[key].short)}</h3>
      <p>${esc(suiteInfo[key].desc)}</p>
      <div class="suite-bar" aria-hidden="true">
        <span class="bar-acc" style="width:${accPct}%"></span>
        <span class="bar-inp" style="width:${inpPct}%"></span>
      </div>
    </button>`;
  }).join('');
}

function syncFilterControls() {
  document.querySelectorAll('[data-status]').forEach(b => {
    const active = b.dataset.status === status;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('[data-suite]').forEach(b => {
    const active = b.dataset.suite === suite;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('[data-pick-suite]').forEach(b => {
    const active = b.dataset.pickSuite === suite;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  $('#filter-coordination').value = dimFilters.coordination;
  $('#filter-tactile').value = dimFilters.tactile_mode;
  $('#filter-dexterity').value = dimFilters.dexterity_level;
  $('#filter-horizon').value = dimFilters.horizon;
  const hasFilter = status !== 'all' || suite !== 'all' || $('#search').value.trim() !== '' || Object.values(dimFilters).some(v => v !== 'all');
  $('#reset-filters').hidden = !hasFilter;
}

function render() {
  syncFilterControls();
  const query = $('#search').value.trim().toLowerCase();
  const visible = tasks.filter(t =>
    (status === 'all' || t.status === status) &&
    (!batch || t.batch === batch) &&
    (suite === 'all' || (t.suites || []).includes(suite)) &&
    (dimFilters.coordination === 'all' || t.coordination === dimFilters.coordination) &&
    (dimFilters.tactile_mode === 'all' || t.tactile_mode === dimFilters.tactile_mode) &&
    (dimFilters.dexterity_level === 'all' || t.dexterity_level === dimFilters.dexterity_level) &&
    (dimFilters.horizon === 'all' || t.horizon === dimFilters.horizon) &&
    (!query || taskSearchText(t).includes(query))
  );

  const parts = [`${visible.length} 项任务`];
  if (batch) parts.push(batchLabels[batch]);
  if (suite !== 'all') parts.push(`${suite} · ${suiteInfo[suite].short}`);
  for (const [k, v] of Object.entries(dimFilters)) {
    if (v !== 'all') parts.push(dimLabels[k][v]);
  }
  $('#result-count').textContent = parts.join(' · ');
  $('#empty').hidden = visible.length > 0;

  $('#grid').innerHTML = visible.map(t => {
    const v = t.videos[0];
    const scene = t.scene_preview;
    const media = v ? `<img src="${esc(v.poster)}" alt="${esc(t.title)}仿真画面" loading="lazy" width="640" height="480">${v.kind !== 'accepted' ? `<span class="video-kind">${kindLabels[v.kind] || '开发录像'}</span>` : ''}<span class="play-icon" aria-hidden="true">▶</span>`
      : scene ? `<img src="${esc(scene.url)}" alt="RevoTron 与${esc(t.title)}的静态场景" loading="lazy" width="1200" height="900"><span class="video-kind scene-kind">静态初态</span>` : placeholder;
    const badges = (t.suites && t.suites.length)
      ? t.suites.map(s => `<span class="suite-pill small" data-s="${esc(s)}">${esc(s)}</span>`).join('')
      : `<span class="suite-pill small" data-s="Base">基础校准</span>`;
    const dimSummary = `${dimLabels.coordination[t.coordination] || t.coordination} · ${dimLabels.tactile_mode[t.tactile_mode] || t.tactile_mode}`;
    return `<button class="task-card" data-task="${esc(t.id)}" aria-label="查看${esc(t.title)}${v ? '视频' : scene ? '静态场景' : '任务介绍'}"><div class="task-media ${v || scene ? '' : 'placeholder'}">${media}</div><div class="task-copy"><div class="card-tags">${badges}<span class="card-category">${esc(dimSummary)}</span></div><h3>${esc(t.title)}</h3><div class="card-bottom"><span class="status ${t.status}">${labels[t.status]}</span><span>${v ? `${duration(v.duration_s)}${t.trajectory_count ? ` · ${t.trajectory_count} 条参考` : ''}` : scene ? '环境已摆好 · 0 条轨迹' : '等待录制'}</span></div></div></button>`;
  }).join('');
}

function openTask(id) {
  const t = tasks.find(task => task.id === id);
  if (!t) return;
  previousFocus = document.activeElement;
  hero.pause();
  const v = t.videos[0];
  const scene = t.scene_preview;
  const sceneDetail = scene ? `<div class="detail-scene"><img src="${esc(scene.url)}" alt="RevoTron 与${esc(t.title)}的静态初态" width="1200" height="900"></div>` : `<div class="task-media placeholder detail-placeholder">${placeholder}</div>`;
  const suiteBadges = (t.suites && t.suites.length)
    ? t.suites.map(s => `<span class="suite-pill" data-s="${esc(s)}">${esc(s)} · ${esc(suiteInfo[s]?.short || s)}</span>`).join('')
    : `<span class="suite-pill" data-s="Base">基础校准 · Sanity</span>`;
  const taxonomyGrid = `<div class="detail-taxonomy" aria-label="四维正交属性">
    <div><span>双手耦合</span><strong>${esc(dimLabels.coordination[t.coordination] || t.coordination)}</strong><code>${esc(t.coordination)}</code></div>
    <div><span>触觉机制</span><strong>${esc(dimLabels.tactile_mode[t.tactile_mode] || t.tactile_mode)}</strong><code>${esc(t.tactile_mode)}</code></div>
    <div><span>五指灵巧度</span><strong>${esc(dimLabels.dexterity_level[t.dexterity_level] || t.dexterity_level)}</strong><code>${esc(t.dexterity_level)}</code></div>
    <div><span>规划跨度</span><strong>${esc(dimLabels.horizon[t.horizon] || t.horizon)}</strong><code>${esc(t.horizon)}</code></div>
  </div>`;

  $('#detail-body').innerHTML = `${v ? `<div class="detail-video"><video id="task-video" controls playsinline preload="metadata" poster="${esc(v.poster)}" aria-label="${esc(t.title)}视频"><source src="${esc(v.url)}" type="video/mp4"></video></div><p class="video-error" id="video-error" hidden>视频暂时无法播放，请稍后重试。</p>` : sceneDetail}<div class="detail-copy"><div class="detail-badges"><span class="status ${t.status}">${labels[t.status]}</span>${suiteBadges}</div><h2 id="detail-title">${esc(t.title)}</h2><p>${esc(t.description)}</p>${taxonomyGrid}${t.videos.length > 1 ? `<div class="video-options" role="group" aria-label="选择视频">${t.videos.map((clip, i) => `<button data-clip="${i}" aria-pressed="${i === 0}">${esc(clip.label)}</button>`).join('')}</div>` : ''}<div class="detail-meta"><span>评测赛道：ID / Visual-OOD / Physics-OOD</span><span>${t.trajectory_count} 条已登记验收参考</span>${v ? `<span id="clip-meta">${kindLabels[v.kind]} · ${duration(v.duration_s)}</span>` : scene ? '<span>RevoTron · 静态初态</span>' : ''}</div>${t.task_spec_url ? `<a class="task-spec-link" href="${esc(t.task_spec_url)}">资产、步骤与验收标准 ↗</a>` : ''}<p class="detail-notice" id="clip-notice">${scene && !v ? '真实模型的静态场景渲染，展示机器人与道具的初始摆放。尚无动作轨迹，不代表动态接触或任务验收通过。' : clipNotice(v)}</p><span class="task-id">${esc(t.id)}</span></div>`;
  if (!$('#detail').open) $('#detail').showModal();
  if (v) {
    const video = $('#task-video');
    video.addEventListener('error', () => { $('#video-error').hidden = false; });
    video.querySelector('source').addEventListener('error', () => { $('#video-error').hidden = false; });
    video.play().catch(() => {});
    document.querySelectorAll('[data-clip]').forEach(button => button.addEventListener('click', () => {
      const clip = t.videos[Number(button.dataset.clip)];
      video.src = clip.url; video.poster = clip.poster; $('#video-error').hidden = true;
      $('#clip-meta').textContent = `${kindLabels[clip.kind]} · ${duration(clip.duration_s)}`;
      $('#clip-notice').textContent = clipNotice(clip);
      document.querySelectorAll('[data-clip]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      video.play().catch(() => {});
    }));
  }
  history.replaceState(null, '', `#task=${encodeURIComponent(id)}`);
}

function clipNotice(v) {
  if (!v) return '该任务尚未开始，暂时没有动作录像。';
  if (v.kind === 'demo') return '任务演示 · 1.5 倍速。';
  const sample = v.sampling === 'original_video' ? '原始仿真录像。' : '由稀疏真实采样帧按原生时间戳保持生成，并非逐帧连续录制。';
  return '1.5 倍速。' + sample + (v.kind === 'accepted' ? '物理与数据已验收；仿人动作质量仍需单独复核。' : '开发过程记录，不代表最终验收效果。');
}

function currentHash() {
  if (batch) return '#batch=' + batch;
  if (suite !== 'all') return `#suite=${suite}`;
  if (status === 'not_started') return '#not-started';
  return '#tasks';
}

function closeDetail() { $('#detail').close(); }
$('#close').addEventListener('click', closeDetail);
$('#detail').addEventListener('click', e => { if (e.target === $('#detail')) { const r = $('#detail').getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDetail(); } });
$('#detail').addEventListener('close', () => { $('#task-video')?.pause(); if (location.hash.startsWith('#task=')) history.replaceState(null, '', currentHash()); previousFocus?.focus({ preventScroll: true }); });
document.addEventListener('click', e => {
  const card = e.target.closest('[data-task]');
  if (card) { openTask(card.dataset.task); return; }
  const pick = e.target.closest('[data-pick-suite]');
  if (pick) {
    const next = pick.dataset.pickSuite;
    clearSelection();
    suite = next;
    render();
    history.replaceState(null, '', currentHash());
    $('#tasks').scrollIntoView();
  }
});

document.querySelectorAll('[data-status]').forEach(button => button.addEventListener('click', () => {
  batch = null;
  status = button.dataset.status;
  render();
  history.replaceState(null, '', currentHash());
}));

document.querySelectorAll('[data-suite]').forEach(button => button.addEventListener('click', () => {
  suite = button.dataset.suite;
  render();
  history.replaceState(null, '', currentHash());
}));

document.querySelectorAll('[data-task-status], [data-task-batch]').forEach(link => link.addEventListener('click', e => {
  e.preventDefault();
  clearSelection();
  status = link.dataset.taskStatus || 'not_started';
  batch = link.dataset.taskBatch || null;
  render();
  history.replaceState(null, '', currentHash());
  $('#tasks').scrollIntoView();
}));

$('#filter-coordination').addEventListener('change', e => { dimFilters.coordination = e.target.value; render(); });
$('#filter-tactile').addEventListener('change', e => { dimFilters.tactile_mode = e.target.value; render(); });
$('#filter-dexterity').addEventListener('change', e => { dimFilters.dexterity_level = e.target.value; render(); });
$('#filter-horizon').addEventListener('change', e => { dimFilters.horizon = e.target.value; render(); });

function clearSelection() {
  status = 'all';
  batch = null;
  suite = 'all';
  dimFilters = { coordination: 'all', tactile_mode: 'all', dexterity_level: 'all', horizon: 'all' };
  $('#search').value = '';
}

$('#reset-filters').addEventListener('click', () => {
  clearSelection();
  render();
  history.replaceState(null, '', '#tasks');
});

$('#search').addEventListener('input', render);

fetch('./snapshot.json?v=task-classification-v1').then(r => { if (!r.ok) throw Error('Task collection unavailable'); return r.json(); }).then(data => {
  tasks = data.tasks;
  const order = { accepted: 0, in_progress: 1, not_started: 2 };
  tasks.sort((a, b) => Number(b.batch === 'daily_tabletop') - Number(a.batch === 'daily_tabletop') || order[a.status] - order[b.status]);
  document.querySelectorAll('[data-status]').forEach(b => {
    b.querySelector('span').textContent = b.dataset.status === 'all' ? tasks.length : tasks.filter(t => t.status === b.dataset.status).length;
  });
  $('#suite-count-all').textContent = tasks.length;
  for (const key of Object.keys(suiteInfo)) {
    const el = $(`#suite-count-${key}`);
    if (el) el.textContent = tasks.filter(t => (t.suites || []).includes(key)).length;
  }
  renderSuiteCards();
  $('#hero-meta').innerHTML = `<span>${tasks.length} 项操作任务</span><span>${tasks.reduce((n,t) => n + t.videos.length, 0)} 段仿真视频</span><span>${tasks.reduce((n, t) => n + t.trajectory_count, 0)} 条验收参考轨迹</span>`;
  $('#snapshot-date').textContent = data.snapshot_date.replaceAll('-', '.');

  if (location.hash.startsWith('#suite=')) {
    const candidate = decodeURIComponent(location.hash.slice(7));
    if (Object.hasOwn(suiteInfo, candidate)) { suite = candidate; status = 'all'; }
  } else if (location.hash === '#not-started' || location.hash.startsWith('#batch=')) {
    status = 'not_started';
    batch = Object.keys(batchLabels).find(key => location.hash === '#batch=' + key) || null;
  }
  render();
  if (location.hash === '#not-started' || location.hash.startsWith('#suite=') || location.hash.startsWith('#batch=')) {
    $('#tasks').scrollIntoView();
  }
  if (location.hash.startsWith('#task=')) openTask(decodeURIComponent(location.hash.slice(6)));
}).catch(() => { $('#error').hidden = false; $('#result-count').textContent = '列表加载失败'; });
