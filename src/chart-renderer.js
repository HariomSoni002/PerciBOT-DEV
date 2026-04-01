/**
 * PerciBot — Frontend Chart Renderer
 * ===================================
 * ES module. Dynamically loads Chart.js from CDN (once), then exposes a single
 * function:
 *
 *   renderChart(container, chartData) → Chart instance | null
 *
 * `container`  — a plain DOM element (div). The renderer owns its contents.
 * `chartData`  — the `chart_data` object sent by the backend (see CONTRACT below).
 *
 * ── Backend payload contract ────────────────────────────────────────────────
 *
 * The backend should add a `chart_data` key alongside `answer` in its response
 * JSON. Remove `chart_base64`, `mime_type`, and `chart_filename` entirely.
 *
 * Example payload (what the backend must now send):
 *
 * {
 *   "answer":          "Revenue for March 2025 was ₹1.2 Cr across 5 regions.",
 *   "pipeline_status": "COMPLETED",
 *   "response_type":   "SQL",
 *   "chart_data": {
 *     "chart_type":    "bar",          // "bar" | "line" | "pie" | "area"
 *     "title":         "Revenue by Region — Mar 2025",
 *     "x_axis_title":  "Region",       // optional, used for bar/line/area
 *     "y_axis_title":  "Revenue (₹ Cr)", // optional
 *     "data_mapping": {
 *       "x":     "REGION",             // column name for x-axis / pie labels
 *       "y":     ["REVENUE"],          // array — supports multi-series
 *       "color": null                  // optional grouping column (string | null)
 *     },
 *     "rows": [                        // flat array of row objects
 *       { "REGION": "North", "REVENUE": 12000000 },
 *       { "REGION": "South", "REVENUE": 9800000  }
 *     ]
 *   },
 *   "meta": { ... }
 * }
 *
 * ── Backend migration guide ─────────────────────────────────────────────────
 *
 * In `pipeline/l3_chain_charts.py`, the function `invoke_chart_json_chain`
 * currently calls `generate_plots_from_json_spec` and returns a PNG path +
 * base64. Replace that entire section to instead return:
 *
 *   return (
 *       chart_spec,          # the JSON spec dict the LLM produced
 *       flat_rows,           # list[dict] — the augmented flat rows
 *       inference_sec,
 *       cb.prompt_tokens,
 *       cb.completion_tokens,
 *   )
 *
 * In `pipeline/orchestrator.py`, wherever chart_base64 / chart_filename are
 * assembled into PipelineResult, replace with:
 *
 *   chart_data = {
 *       "chart_type":   chart_spec.get("chart_type"),
 *       "title":        chart_spec.get("title"),
 *       "x_axis_title": chart_spec.get("x_axis_title", ""),
 *       "y_axis_title": chart_spec.get("y_axis_title", ""),
 *       "data_mapping": chart_spec.get("data_mapping", {}),
 *       "rows":         flat_rows,
 *   }
 *
 * And in the FastAPI response, return `chart_data=chart_data` instead of
 * `chart_base64`, `mime_type`, and `chart_filename`.
 *
 * ── Design notes ────────────────────────────────────────────────────────────
 *
 * • Chart.js is loaded once from cdnjs and cached on `window.__percibotChartJs`.
 * • Each call to renderChart() destroys any previous Chart instance on the
 *   container before creating a new one, preventing canvas memory leaks.
 * • Human-readable number formatting (K / M / B / Cr) is applied automatically
 *   to y-axis tick labels and tooltip values.
 * • Colors are auto-assigned from a hand-picked palette; no color config needed
 *   from the backend.
 * • The `color` grouping column causes the data to be pivoted into multiple
 *   datasets (one per unique color-column value) before passing to Chart.js.
 * • Shadow DOM safe: no document.querySelector — the caller passes the container.
 */

// ── CDN ───────────────────────────────────────────────────────────────────────
const CHARTJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'

// ── Palette — Percipere-flavoured, vivid but professional ────────────────────
const PALETTE = [
  '#3A86FF', // vivid blue        (primary)
  '#FF6B6B', // coral red
  '#06D6A0', // emerald green
  '#FFD166', // amber yellow
  '#8338EC', // electric violet
  '#FF9F1C', // saffron orange
  '#2EC4B6', // teal
  '#E63946', // crimson
  '#457B9D', // steel blue
  '#A8DADC', // powder blue
  '#C77DFF', // lavender purple
  '#80B918', // lime green
]

// ── Lazy CDN loader ───────────────────────────────────────────────────────────
let _chartJsPromise = null

function _loadChartJs () {
  if (_chartJsPromise) return _chartJsPromise
  if (window.Chart) { _chartJsPromise = Promise.resolve(window.Chart); return _chartJsPromise }

  _chartJsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src   = CHARTJS_CDN
    s.async = true
    s.onload  = () => resolve(window.Chart)
    s.onerror = () => reject(new Error('Failed to load Chart.js from CDN.'))
    document.head.appendChild(s)
  })
  return _chartJsPromise
}

// ── Number formatting ─────────────────────────────────────────────────────────
function _fmt (n) {
  const v = Number(n)
  if (isNaN(v)) return String(n)
  const abs = Math.abs(v)
  if (abs >= 1e7)  return (v / 1e7).toFixed(2).replace(/\.?0+$/, '')  + ' Cr'
  if (abs >= 1e6)  return (v / 1e6).toFixed(2).replace(/\.?0+$/, '')  + 'M'
  if (abs >= 1e3)  return (v / 1e3).toFixed(1).replace(/\.?0+$/, '')  + 'K'
  return v % 1 === 0 ? String(v) : v.toFixed(2)
}

// ── Column normalizer — matches backend's lower-case normalization ─────────────
function _norm (s) { return String(s || '').trim().toLowerCase() }

function _normaliseRows (rows, mapping) {
  // Build a lookup from normalised column name → original column name in first row
  if (!rows || !rows.length) return { rows: [], mapping }
  const sample     = rows[0]
  const colMap     = {}  // normalised → actual
  Object.keys(sample).forEach(k => { colMap[_norm(k)] = k })

  const resolve = col => colMap[_norm(col)] || col   // best-effort

  const normMapping = {
    x:     resolve(mapping.x),
    y:     (mapping.y || []).map(resolve),
    color: mapping.color ? resolve(mapping.color) : null,
  }

  return { rows, mapping: normMapping }
}

// ── Pivot rows into Chart.js datasets ─────────────────────────────────────────
//
// Case A — no color column:
//   Each entry in `y` becomes one dataset. x labels from `x` column.
//
// Case B — color column present:
//   y[0] is the value column. Each unique color-column value becomes a dataset.
//   x labels are the union of all x values in insertion order.
//
function _buildDatasets (rows, mapping) {
  const { x: xCol, y: yCols, color: colorCol } = mapping

  // ── Case A: no grouping ─────────────────────────────────────────────────────
  if (!colorCol || !rows.some(r => r[colorCol] !== undefined)) {
    const labels = rows.map(r => r[xCol])

    const datasets = yCols.map((yCol, i) => ({
      label:           yCol,
      data:            rows.map(r => Number(r[yCol]) || 0),
      backgroundColor: PALETTE[i % PALETTE.length],
      borderColor:     PALETTE[i % PALETTE.length],
      borderWidth:     2,
    }))

    return { labels, datasets }
  }

  // ── Case B: group by color column ──────────────────────────────────────────
  const yCol = yCols[0]

  const labelsOrdered = []
  const labelSet      = new Set()
  rows.forEach(r => {
    const lbl = String(r[xCol])
    if (!labelSet.has(lbl)) { labelsOrdered.push(lbl); labelSet.add(lbl) }
  })

  const groupsOrdered = []
  const groupSet      = new Set()
  rows.forEach(r => {
    const g = String(r[colorCol])
    if (!groupSet.has(g)) { groupsOrdered.push(g); groupSet.add(g) }
  })

  const datasets = groupsOrdered.map((group, i) => {
    const groupRows = rows.filter(r => String(r[colorCol]) === group)
    const lookup    = {}
    groupRows.forEach(r => { lookup[String(r[xCol])] = Number(r[yCol]) || 0 })

    return {
      label:           group,
      data:            labelsOrdered.map(lbl => lookup[lbl] ?? 0),
      backgroundColor: PALETTE[i % PALETTE.length],
      borderColor:     PALETTE[i % PALETTE.length],
      borderWidth:     2,
    }
  })

  return { labels: labelsOrdered, datasets }
}

// ── Common tooltip config ──────────────────────────────────────────────────────
function _tooltip () {
  return {
    callbacks: {
      label (ctx) {
        const val = ctx.parsed.y ?? ctx.parsed
        return ` ${ctx.dataset.label}: ${_fmt(val)}`
      },
    },
    backgroundColor: 'rgba(15,20,50,0.88)',
    titleColor:      '#fff',
    bodyColor:       '#d0d8f0',
    borderColor:     'rgba(100,130,255,0.2)',
    borderWidth:     1,
    padding:         10,
    cornerRadius:    8,
    titleFont:       { weight: 'bold', size: 12 },
    bodyFont:        { size: 12 },
  }
}

// ── Common y-axis tick formatter ───────────────────────────────────────────────
function _yTicks () {
  return {
    callback: v => _fmt(v),
    color:    '#7a80a0',
    font:     { size: 11 },
  }
}

function _xTicks () {
  return {
    color: '#7a80a0',
    font:  { size: 11 },
    maxRotation: 40,
    autoSkip:    true,
    maxTicksLimit: 18,
  }
}

// ── Chart builders ─────────────────────────────────────────────────────────────

function _buildBar (Chart, { labels, datasets }, spec) {
  const ds = datasets.map(d => ({
    ...d,
    backgroundColor: d.backgroundColor + 'cc',  // slight transparency
    hoverBackgroundColor: d.backgroundColor,
    borderRadius: 5,
    borderSkipped: false,
  }))

  return {
    type: 'bar',
    data: { labels, datasets: ds },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend:  { position: 'top', labels: { color: '#4a5280', font: { size: 12 } } },
        tooltip: _tooltip(),
        title:   { display: !!spec.title, text: spec.title, color: '#1a1f36', font: { size: 14, weight: 'bold' } },
      },
      scales: {
        x: {
          grid:  { display: false },
          ticks: _xTicks(),
          title: {
            display: !!spec.x_axis_title,
            text:    spec.x_axis_title || '',
            color:   '#7a80a0', font: { size: 11 },
          },
        },
        y: {
          grid:  { color: 'rgba(0,0,0,.05)' },
          ticks: _yTicks(),
          title: {
            display: !!spec.y_axis_title,
            text:    spec.y_axis_title || '',
            color:   '#7a80a0', font: { size: 11 },
          },
        },
      },
      animation: { duration: 500, easing: 'easeOutQuart' },
    },
  }
}

function _buildLine (Chart, { labels, datasets }, spec) {
  const ds = datasets.map(d => ({
    ...d,
    fill:        false,
    tension:     0.35,
    pointRadius: 4,
    pointHoverRadius: 7,
    pointBackgroundColor: d.borderColor,
  }))

  return {
    type: 'line',
    data: { labels, datasets: ds },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend:  { position: 'top', labels: { color: '#4a5280', font: { size: 12 } } },
        tooltip: { ...(_tooltip()), mode: 'index', intersect: false },
        title:   { display: !!spec.title, text: spec.title, color: '#1a1f36', font: { size: 14, weight: 'bold' } },
      },
      scales: {
        x: {
          grid:  { color: 'rgba(0,0,0,.04)' },
          ticks: _xTicks(),
          title: {
            display: !!spec.x_axis_title,
            text:    spec.x_axis_title || '',
            color:   '#7a80a0', font: { size: 11 },
          },
        },
        y: {
          grid:  { color: 'rgba(0,0,0,.05)' },
          ticks: _yTicks(),
          title: {
            display: !!spec.y_axis_title,
            text:    spec.y_axis_title || '',
            color:   '#7a80a0', font: { size: 11 },
          },
        },
      },
      hover:     { mode: 'index', intersect: false },
      animation: { duration: 500, easing: 'easeOutQuart' },
    },
  }
}

function _buildArea (Chart, { labels, datasets }, spec) {
  const ds = datasets.map((d, i) => ({
    ...d,
    fill:             true,
    tension:          0.4,
    backgroundColor:  PALETTE[i % PALETTE.length] + '30',  // very transparent fill
    borderColor:      PALETTE[i % PALETTE.length],
    pointRadius:      3,
    pointHoverRadius: 6,
  }))

  return {
    type: 'line',
    data: { labels, datasets: ds },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend:  { position: 'top', labels: { color: '#4a5280', font: { size: 12 } } },
        tooltip: { ...(_tooltip()), mode: 'index', intersect: false },
        title:   { display: !!spec.title, text: spec.title, color: '#1a1f36', font: { size: 14, weight: 'bold' } },
      },
      scales: {
        x: {
          grid:  { display: false },
          ticks: _xTicks(),
          title: {
            display: !!spec.x_axis_title,
            text:    spec.x_axis_title || '',
            color:   '#7a80a0', font: { size: 11 },
          },
        },
        y: {
          grid:  { color: 'rgba(0,0,0,.05)' },
          ticks: _yTicks(),
          title: {
            display: !!spec.y_axis_title,
            text:    spec.y_axis_title || '',
            color:   '#7a80a0', font: { size: 11 },
          },
        },
      },
      hover:     { mode: 'index', intersect: false },
      animation: { duration: 500, easing: 'easeOutQuart' },
    },
  }
}

function _buildPie (Chart, { labels, datasets }, spec) {
  // For pie, y[0] is the values column — datasets[0].data is already built.
  const values = datasets[0] ? datasets[0].data : []
  const colors = labels.map((_, i) => PALETTE[i % PALETTE.length])

  return {
    type: 'doughnut',   // doughnut looks better than flat pie; can be changed to 'pie'
    data: {
      labels,
      datasets: [{
        data:                  values,
        backgroundColor:       colors.map(c => c + 'cc'),
        hoverBackgroundColor:  colors,
        borderColor:           '#fff',
        borderWidth:           2,
        hoverOffset:           8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels:   {
            color:     '#4a5280',
            font:      { size: 12 },
            padding:   14,
            boxWidth:  14,
            boxHeight: 14,
          },
        },
        tooltip: {
          callbacks: {
            label (ctx) {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0)
              const pct   = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) + '%' : '–'
              return ` ${ctx.label}: ${_fmt(ctx.parsed)} (${pct})`
            },
          },
          backgroundColor: 'rgba(15,20,50,0.88)',
          titleColor:      '#fff',
          bodyColor:       '#d0d8f0',
          borderColor:     'rgba(100,130,255,0.2)',
          borderWidth:     1,
          padding:         10,
          cornerRadius:    8,
        },
        title: {
          display: !!spec.title,
          text:    spec.title,
          color:   '#1a1f36',
          font:    { size: 14, weight: 'bold' },
          padding: { bottom: 16 },
        },
      },
      animation: { animateRotate: true, duration: 600, easing: 'easeOutQuart' },
      cutout:    '55%',
    },
  }
}

// ── Type router ───────────────────────────────────────────────────────────────
function _makeConfig (Chart, type, builtData, spec) {
  switch (type) {
    case 'bar':   return _buildBar(Chart, builtData, spec)
    case 'line':  return _buildLine(Chart, builtData, spec)
    case 'area':  return _buildArea(Chart, builtData, spec)
    case 'pie':   return _buildPie(Chart, builtData, spec)
    default:
      throw new Error(`PerciBot chart-renderer: unsupported chart_type "${type}".`)
  }
}

// ── Shimmer skeleton (shown while Chart.js CDN loads) ─────────────────────────
function _injectShimmer (container) {
  container.innerHTML = `
    <div style="
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:14px; padding:32px 20px; background:#f8f9fc; border-radius:10px; height:100%;
    ">
      <div style="
        display:flex; align-items:flex-end; gap:6px; height:64px; width:80%;
      ">
        ${[40,70,55,90,65,45,80].map((h,i) => `
          <div style="
            flex:1; border-radius:4px 4px 0 0; height:${h}%;
            background:linear-gradient(90deg,#e8ecf8 25%,#d0d6f0 50%,#e8ecf8 75%);
            background-size:300% 100%;
            animation:pbShimBar 1.4s ease-in-out infinite ${i * 0.1}s;
          "></div>
        `).join('')}
      </div>
      <style>
        @keyframes pbShimBar {
          0%,100% { opacity:.4 }
          50%     { opacity:1  }
        }
      </style>
    </div>
  `
}

// ── Error display ─────────────────────────────────────────────────────────────
function _showError (container, msg) {
  container.innerHTML = `
    <div style="
      display:flex; align-items:center; gap:8px; padding:10px 14px;
      border-radius:9px; background:#fff7f7; border:1px solid #ffd5d5;
      font-size:12px; color:#9b3030; font-family:inherit;
    ">
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round">
        <circle cx="10" cy="10" r="8"/>
        <line x1="10" y1="6" x2="10" y2="10"/>
        <circle cx="10" cy="14" r=".5" fill="currentColor"/>
      </svg>
      ${msg}
    </div>
  `
}

// ── Store Chart instances keyed by container to allow destroy-on-rerender ──────
const _instances = new WeakMap()

// ── Public API ────────────────────────────────────────────────────────────────
/**
 * renderChart(container, chartData)
 *
 * @param {HTMLElement}  container  — A div the caller has already appended to the DOM.
 * @param {Object}       chartData  — The `chart_data` object from the backend response.
 *
 * @returns {Promise<Chart|null>}   — The Chart.js instance, or null on error.
 */
export async function renderChart (container, chartData) {
  if (!container || !chartData) return null

  const { chart_type, data_mapping, rows } = chartData

  // Basic validation
  if (!chart_type || !data_mapping || !rows || !rows.length) {
    _showError(container, 'Chart data is incomplete or missing.')
    return null
  }

  // Destroy previous chart on this container if any
  const prev = _instances.get(container)
  if (prev) { try { prev.destroy() } catch (_) {} }

  // Show shimmer while CDN loads
  _injectShimmer(container)

  let Chart
  try {
    Chart = await _loadChartJs()
  } catch (err) {
    _showError(container, 'Could not load chart library. Check your network connection.')
    return null
  }

  // Normalise row/column names to match backend's lower-casing
  let normResult
  try {
    normResult = _normaliseRows(rows, data_mapping)
  } catch (err) {
    _showError(container, 'Failed to read chart data columns.')
    return null
  }

  const { rows: normRows, mapping: normMapping } = normResult

  let builtData
  try {
    builtData = _buildDatasets(normRows, normMapping)
  } catch (err) {
    _showError(container, `Chart data error: ${err.message}`)
    return null
  }

  let config
  try {
    config = _makeConfig(Chart, chart_type, builtData, chartData)
  } catch (err) {
    _showError(container, err.message)
    return null
  }

  // Clear shimmer, inject canvas
  container.innerHTML = ''
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'display:block; width:100%; height:100%;'
  container.appendChild(canvas)

  let instance
  try {
    instance = new Chart(canvas, config)
    _instances.set(container, instance)
  } catch (err) {
    _showError(container, `Chart render failed: ${err.message}`)
    return null
  }

  return instance
}

/**
 * destroyChart(container)
 *
 * Explicit cleanup — call this if you remove the container from the DOM
 * to prevent Canvas memory leaks.
 */
export function destroyChart (container) {
  const inst = _instances.get(container)
  if (inst) { try { inst.destroy() } catch (_) {} _instances.delete(container) }
}
