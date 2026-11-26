# RevoBench: An Agent-Native Benchmark for Tactile Dexterity

公开地址：https://davidlxu.github.io/RevoBench-Web/

以视频为主的静态任务集，视觉参考 SuperMimic 的大标题、留白、圆角媒体和简洁导航。支持状态筛选、关键词搜索、视频回放与任务深链接，例如 `#task=insert_pen`。

## 本地预览

在网站仓库根目录运行 `python3 -m http.server 8000`，打开 `http://localhost:8000/`。无需安装依赖或构建；GitHub Pages 直接发布这些静态文件。

## 内容与维护

- `snapshot.json` 是本站独立的展示数据，不轮询 GitHub，也不自动读取开发仓库。
- `media/` 保存所有展示视频及封面，页面只请求本站资源。`media/provenance.json` 保留导入视频的来源记录。
- 当前内容快照日期为 2026-10-27：36 项任务、29 段视频、21 条已登记验收参考轨迹。21 项已验收、8 项开发中、7 项未开始。这是历史展示快照，不是实时工作进度。
- 修改任务时手动更新 `snapshot.json`，新增视频与封面放入 `media/`，随本站提交发布即可。首页统计和筛选数量根据快照计算。项目介绍和首页主视频位于 `index.html`。
- 每项任务包含 `id`、`title`、`status`、`category`、`description`、`trajectory_count` 和 `videos`。状态值为 `accepted`、`in_progress` 或 `not_started`。视频沿用来源标记 `kind` 与 `sampling`，不能把调试视频标成验收结果。
- “已验收”仅指物理与数据验收；默认姿态回归、轨迹连续、整体姿态仿人、有效内侧接触四项动作质量另行复核。尚未录制的任务显示占位提示，不补造视频。

## 检查

运行 `node --check app.js`；预览时检查状态筛选、搜索、视频播放、弹窗关闭、手机布局。展示视频统一为相对仿真时间的 1.5 倍速，页面按文件时间播放；尊重减少动态效果偏好。

## 独立待开发任务图册

- 地址：https://davidlxu.github.io/RevoBench-Web/pending/ 。首页导航与独立入口链接到该页面。
- 50 项待开发提案与原有 36 项历史展示分开，不改变已有验收或轨迹数量。
- `pending/` 是静态发布副本，包含 50 张桌面陈列图、87 张资产预览、任务 JSON 和检查记录。
- 主源码和完整文档：https://github.com/BrainCoTech/RevoBench/tree/main/docs/tabletop_task_proposals_50_20261103 。
- 在主仓库提案目录修改并运行 `python write_documents.py`，再用旧版 `export_site.py` 导出到含有 `RevoBench/index.html` 的临时站点目录。将生成的 `RevoBench/pending/` 同步到本仓库的 `pending/`，更新生成文件里的旧站链接，再提交到本仓库的 `main` 分支。不要直接修改网站副本中的任务定义。
- 每项任务支持深链接、复制任务链接与复制交接说明；静态图片不代表仿真验收。

## 预算筛选与任务标准

首页的 `#budget-explorer` 同时按真实经过秒数和规划总 token（含思考 token）筛选。`budget-runs.json` 的 `example` 保存 AgenticDexterity 在 2026-11-27 的四份单回合报告摘要，选择条件为 PiPER 夹爪、6.1 Terra、实时末端控制、仅环境相机、无特权输入、seed 3016723238。每个 ID 对应原报告文件名。用时取该回合的 `wall_s`，token 为逐次调用回执之和，包含失败记录。该示例按运行计数。

`revobench` 留给一组同模型、同运行模式、同测试清单的正式数据，每个初态一行。字段为 `id`、`success`、`seconds`、`tokens`。成功时的秒数和用量累计到首次完整物理验收，包含此前的重试；失败时累计至终止。缺失用量用 null 表示。全部初态保留在分母，只有物理通过且两项成本均可核实、均在预算内的初态计入分子。

`#task-protocols` 读取 `task-protocols.json`。更新该快照时对齐 175 项任务注册中的目标、验收说明、oracle 和物体摆位门控，以及逐任务看板状态。首批十项的组成员、已验收 seed 和实际平移来自开发仓库 `docs/randomization_validation.json`；验收说明和阈值来自 `docs/VALIDATION.md` 与对应的 `metrics.py`。设计中的判据与已登记的脚本分别展示。
