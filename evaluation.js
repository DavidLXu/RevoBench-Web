(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const number = new Intl.NumberFormat('zh-CN');
  const repo = 'https://github.com/BrainCoTech/RevoBench/blob/main/';

  async function readJson(file) {
    const response = await fetch(file);
    if (!response.ok) throw new Error(response.statusText);
    return response.json();
  }

  function element(tag, text) {
    const node = document.createElement(tag);
    node.textContent = text;
    return node;
  }

  function showBudgets(groups) {
    const source = byId('budget-source');
    const time = byId('budget-time');
    const tokens = byId('budget-tokens');
    const table = byId('budget-records');

    function render() {
      const example = source.value === 'example';
      const runs = groups[source.value];
      const within = runs.filter(run =>
        Number.isFinite(run.seconds) && Number.isFinite(run.tokens) &&
        run.seconds <= Number(time.value) && run.tokens <= Number(tokens.value)
      );
      const passed = within.filter(run => run.success === true).length;
      byId('time-value').textContent = number.format(time.value) + ' 秒';
      byId('token-value').textContent = number.format(tokens.value);
      time.setAttribute('aria-valuetext', time.value + ' 秒');
      tokens.setAttribute('aria-valuetext', number.format(tokens.value) + ' token');
      byId('budget-percent').textContent = runs.length ? number.format(100 * passed / runs.length) + '%' : '—';
      byId('budget-count').textContent = runs.length
        ? passed + ' / ' + runs.length + (example ? ' 次示例运行在预算内成功' : ' 个测试初态在预算内成功')
        : '尚无可计算的正式解题率';
      table.tBodies[0].replaceChildren();
      for (const run of within) {
        const tr = table.tBodies[0].insertRow();
        for (const value of [run.id, run.seconds.toFixed(2) + ' 秒', number.format(run.tokens), run.success ? '成功' : '失败']) {
          tr.insertCell().textContent = value;
        }
      }
      table.hidden = !within.length;
      const empty = byId('budget-empty');
      empty.hidden = within.length > 0 || runs.length === 0;
      empty.textContent = '当前预算内没有记录。';
    }

    function selectSource() {
      const example = source.value === 'example';
      const runs = groups[source.value];
      byId('budget-scope').textContent = example
        ? '示例取自 AgenticDexterity 的 PiPER 夹爪抓放。四次重复运行使用同一模型、环境相机和初态（seed 3016723238）。拖动滑杆，查看同时满足时间与 token 上限的记录。百分比的分母始终是四次运行，失败也计入。'
        : '正式口径以冻结的测试初态为分母，每个初态最多计一次成功。当前公开参考轨迹缺少与规划用量配对的实际总用时，待发布完整的逐初态评测记录。';
      for (const [input, key, marks] of [[time, 'seconds', 'budget-time-marks'], [tokens, 'tokens', 'budget-token-marks']]) {
        input.disabled = !runs.length;
        const ticks = runs.filter(run => Number.isFinite(run[key])).map(run => {
          const tick = document.createElement('option');
          tick.value = Math.ceil(run[key] / Number(input.step)) * Number(input.step);
          return tick;
        });
        byId(marks).replaceChildren(...ticks);
      }
      render();
    }
    source.addEventListener('change', selectSource);
    time.addEventListener('input', render);
    tokens.addEventListener('input', render);
    selectSource();
  }

  function showProtocols(tasks) {
    const select = byId('protocol-task');
    const status = {accepted: '已通过物理与数据验收', in_progress: '开发中', not_started: '未开始'};
    select.replaceChildren(...tasks.map(task => new Option(task.title + ' · ' + task.id, task.id)));
    function render() {
      const task = tasks.find(item => item.id === select.value);
      const dl = document.createElement('dl');
      function field(label, value) {
        const dd = document.createElement('dd');
        dd.append(value);
        dl.append(element('dt', label), dd);
      }
      field('任务目标 · ' + status[task.status], task.goal);
      if (task.criteria.length) {
        const list = document.createElement('ul');
        for (const criterion of task.criteria) list.append(element('li', criterion));
        field(task.oracle ? '判据说明' : '设计中的验收条件', list);
      }
      if (task.oracle) {
        const [moduleName, symbol] = task.oracle.split(':');
        const link = element('a', moduleName + ':' + symbol);
        link.href = repo + 'src/' + moduleName.replaceAll('.', '/') + '.py';
        field('已登记的评分入口', link);
      } else {
        field('评分脚本', '尚未登记可执行的物理评分入口。');
      }
      field('物体摆位', task.gate
        ? '仅在 reset 时整组平移，X、Y 各自均匀采样 ' + (100 * task.range[0]) + ' 至 ' + (100 * task.range[1]) + ' cm。已验收随机实例的 seed 为 ' + task.seed + '。'
        : '尚未启用经过可达性与碰撞检查的物体摆位随机化。');
      if (task.gate) {
        field('已验证的摆放实例', task.group.join('、') + ' 共同移动。实际偏移 X = ' + task.offsetMm[0] + ' mm，Y = ' + task.offsetMm[1] + ' mm。');
      }
      byId('protocol-detail').replaceChildren(dl);
    }
    select.value = 'insert_peg';
    select.disabled = false;
    select.addEventListener('change', render);
    render();
  }

  readJson('./budget-runs.json').then(showBudgets).catch(() => {
    byId('budget-scope').textContent = '运行记录加载失败，请刷新重试。';
    ['budget-source','budget-time','budget-tokens'].forEach(id => { byId(id).disabled = true; });
  });
  readJson('./task-protocols.json').then(showProtocols).catch(() => {
    byId('protocol-task').replaceChildren(new Option('任务标准加载失败，请刷新重试'));
  });
})();
