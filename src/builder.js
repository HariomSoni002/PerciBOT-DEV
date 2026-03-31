/* PerciBot — Builder Panel
   Sections: Connection | Prompts | Memory | Theme
   Test Connection routes to /datasphere or /sap based on active toggle.
*/
(function () {

  const BACKEND_URL = 'https://percibot.cfapps.us10-001.hana.ondemand.com'
  const CRYPTO_KEY  = 'percibot-default-key'

  function xorEncrypt (plaintext) {
    const enc   = new TextEncoder()
    const ptB   = enc.encode(plaintext)
    const keyB  = enc.encode(CRYPTO_KEY)
    const xored = ptB.map((b, i) => b ^ keyB[i % keyB.length])
    return btoa(String.fromCharCode(...xored))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }

  // ─── Template ──────────────────────────────────────────────────────────────
  const tpl = document.createElement('template')
  tpl.innerHTML = `
    <style>
      :host{display:block; font:14px/1.5 var(--sapFontFamily,"72",Arial); color:var(--sapTextColor,#0b1221)}
      *{box-sizing:border-box}
      .panel{padding:14px 16px}
      .section{margin:14px 0 18px}
      .title{font-weight:700; font-size:13px; letter-spacing:.2px; text-transform:uppercase; opacity:.7; margin:6px 0 10px}
      .grid{display:grid; grid-template-columns:1fr 1fr; gap:12px}
      .f{display:flex; flex-direction:column; gap:6px}
      label{font-weight:600}
      input, select, textarea{
        width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid var(--sapList_BorderColor,#d0d3da);
        border-radius:8px; background:#fff; outline:none; font:inherit;
      }
      input:focus, select:focus, textarea:focus{border-color:#4d9aff; box-shadow:0 0 0 2px rgba(77,154,255,.15)}
      input[type="color"]{ padding:6px; height:40px }
      textarea{resize:vertical}
      textarea.prompt{min-height:120px}
      .hint{font-size:12px; opacity:.65}
      .toolbar{display:flex; justify-content:flex-end; align-items:center; gap:10px; margin-top:16px; padding-top:12px; border-top:1px solid #e7eaf0}
      button{ padding:10px 14px; border:1px solid #d0d3da; border-radius:10px; background:#fff; cursor:pointer; font-size:13px; font:inherit }
      button[disabled]{opacity:.5; cursor:not-allowed}
      .primary{ background:#1f4fbf; color:#fff; border-color:#1f4fbf }
      .btn-test{ padding:9px 16px; font-size:12px; font-weight:600; border-radius:9px; white-space:nowrap }
      .chip{display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border-radius:999px; background:#f5f7fb; border:1px solid #e7eaf0; font-size:12px}
      .keywrap{position:relative}
      .reveal{ position:absolute; right:8px; top:50%; transform:translateY(-50%); background:transparent; border:none; cursor:pointer; opacity:.7; font-size:12px; padding:4px }
      .divider{border:none; border-top:1px solid #e7eaf0; margin:18px 0}
      .danger{color:#b00020; font-size:12px}

      /* ── System toggle ── */
      .sys-toggle-wrap{
        display:flex; align-items:center; gap:0; background:#f0f2f8;
        border:1px solid #dde1ee; border-radius:10px; padding:3px; margin-bottom:14px;
      }
      .sys-tab{
        flex:1; text-align:center; padding:8px 12px; border-radius:8px;
        font-size:12px; font-weight:700; letter-spacing:.1px; cursor:pointer;
        border:none; background:transparent; color:#6b7280;
        transition:all .18s ease;
      }
      .sys-tab.active{
        background:#fff; color:#1f4fbf;
        box-shadow:0 1px 4px rgba(31,79,191,.15), 0 0 0 1px rgba(31,79,191,.12);
      }
      .sys-tab.active.sap-tab{ color:#0a7f59; box-shadow:0 1px 4px rgba(10,127,89,.15), 0 0 0 1px rgba(10,127,89,.12) }

      /* ── System panel visibility ── */
      .sys-panel{ display:none }
      .sys-panel.active{ display:block }

      /* ── Pair list ── */
      .pairs-header{
        display:flex; align-items:center; justify-content:space-between;
        margin-bottom:8px;
      }
      .pairs-label{ font-weight:600; font-size:13px }
      .btn-add-pair{
        display:inline-flex; align-items:center; gap:5px;
        padding:5px 10px; border-radius:7px; font-size:12px; font-weight:600;
        border:1.5px solid #c8d0e8; background:#f4f6fc; color:#1f4fbf; cursor:pointer;
        transition:background .13s, border-color .13s;
      }
      .btn-add-pair:hover{ background:#e8edfc; border-color:#a8b4d8 }
      .btn-add-pair svg{ width:12px; height:12px }

      .pair-list{ display:flex; flex-direction:column; gap:8px; margin-bottom:10px }

      .pair-row{
        display:flex; align-items:flex-start; gap:8px;
        background:#fafbfe; border:1px solid #e3e6f0; border-radius:10px;
        padding:10px 10px 10px 12px;
        transition:border-color .15s, box-shadow .15s;
        position:relative;
      }
      .pair-row:hover{ border-color:#c8d0e8; box-shadow:0 2px 8px rgba(31,79,191,.06) }

      .pair-idx{
        flex-shrink:0; width:20px; height:20px; border-radius:50%;
        background:#e8edfc; color:#1f4fbf; font-size:11px; font-weight:700;
        display:flex; align-items:center; justify-content:center; margin-top:11px;
      }
      .pair-idx.sap-idx{ background:#e6f7f2; color:#0a7f59 }

      .pair-fields{ flex:1; display:grid; grid-template-columns:1fr 1fr; gap:8px }
      .pair-fields.single{ grid-template-columns:1fr }

      .pair-fields input{
        padding:8px 10px; font-size:12.5px; border-radius:7px;
      }

      .btn-del-pair{
        flex-shrink:0; width:26px; height:26px; border-radius:6px; margin-top:9px;
        border:1.5px solid #e0e3ec; background:#fff; color:#9ba3be; cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        transition:background .13s, border-color .13s, color .13s;
      }
      .btn-del-pair:hover{ background:#fff0f0; border-color:#f0a0a0; color:#c94040 }
      .btn-del-pair svg{ width:12px; height:12px }

      /* ── Connection status ── */
      .conn-status{
        display:none; font-size:12px; font-weight:700; padding:6px 10px;
        border-radius:7px; align-items:center; gap:6px;
      }
      .conn-status.show{ display:inline-flex }
      .conn-status.ok      { background:#d1fae5; color:#065f46 }
      .conn-status.err     { background:#fee2e2; color:#991b1b }
      .conn-status.partial { background:#fef3c7; color:#92400e }
      .conn-status.checking{ background:#eff6ff; color:#1e40af }

      /* ── Result detail panel ── */
      .conn-detail{
        display:none; margin-top:10px; border-radius:10px; overflow:hidden;
        border:1px solid #e3e6f0;
      }
      .conn-detail.show{ display:block }

      .cd-openai{
        display:flex; align-items:center; gap:8px;
        padding:9px 12px; font-size:12px; font-weight:600;
        border-bottom:1px solid #e3e6f0; background:#f9fafb;
      }
      .cd-openai .ok-val { color:#065f46 }
      .cd-openai .err-val{ color:#991b1b }

      .cd-pairs-title{
        padding:7px 12px; font-size:11.5px; font-weight:700; letter-spacing:.15px;
        text-transform:uppercase; opacity:.55; background:#f9fafb;
        border-bottom:1px solid #e3e6f0;
      }

      .cd-pair{
        display:flex; align-items:center; gap:10px;
        padding:9px 12px; font-size:12px; border-bottom:1px solid #f0f2f8;
        background:#fff;
      }
      .cd-pair:last-child{ border-bottom:none }

      .cd-badge{
        flex-shrink:0; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700;
      }
      .cd-badge.found    { background:#d1fae5; color:#065f46 }
      .cd-badge.not_found{ background:#fee2e2; color:#991b1b }
      .cd-badge.error    { background:#fef3c7; color:#92400e }

      .cd-pair-name{ font-weight:600; color:#1a1f36 }
      .cd-pair-detail{ font-size:11.5px; color:#6b7280; margin-top:1px }

      .cd-summary{
        padding:8px 12px; font-size:11.5px; font-weight:600; background:#f4f6fc;
        border-top:1px solid #e3e6f0; color:#4a5280;
      }

      /* ── Memory ── */
      .toggle-row{
        display:flex; align-items:center; justify-content:space-between;
        gap:12px; margin-bottom:10px;
      }
      .toggle{
        width:42px; height:24px; appearance:none; border-radius:999px;
        border:1px solid #cfd5e3; background:#e5e9f2; cursor:pointer;
        position:relative; outline:none; transition:all .2s ease;
      }
      .toggle::after{
        content:''; position:absolute; width:18px; height:18px; border-radius:50%;
        background:#fff; top:2px; left:2px; transition:transform .2s ease;
        box-shadow:0 1px 2px rgba(0,0,0,.2);
      }
      .toggle:checked{ background:#1f4fbf; border-color:#1f4fbf }
      .toggle:checked::after{ transform:translateX(18px) }
      .memory-options{ display:none; margin-top:10px }
      .memory-options.show{ display:block }

      /* ── Palettes ── */
      .palettes{display:grid; grid-template-columns:repeat(3,1fr); gap:10px}
      .pal-card{display:flex; align-items:center; gap:10px; padding:10px; border:1px solid #e7eaf0; border-radius:10px; cursor:pointer; background:#fff}
      .pal-s{width:18px; height:18px; border-radius:4px; border:1px solid #d0d3da}
      .pal-sw{display:flex; gap:4px}
      .pal-name{font-size:12px; opacity:.8; margin-left:auto}
      .pal-card:hover{box-shadow:0 4px 12px rgba(0,0,0,.06)}

      /* ── Toast ── */
      .toast{
        position:fixed; right:18px; bottom:18px; padding:10px 14px; background:#0b8a3e; color:#fff;
        border-radius:10px; box-shadow:0 6px 18px rgba(0,0,0,.12); opacity:0; transform:translateY(8px);
        transition:all .25s ease; z-index:999; font-size:13px;
      }
      .toast.show{opacity:1; transform:translateY(0)}
    </style>

    <div class="panel">

      <!-- ════ SECTION 1 — Connection ════ -->
      <div class="section">
        <div class="title">Connection</div>

        <!-- API Key -->
        <div class="f keywrap" style="margin-bottom:12px">
          <label>OpenAI API Key</label>
          <input id="apiKey" type="password" placeholder="sk-..." />
          <button class="reveal" id="toggleKey" tabindex="-1">Show</button>
          <div class="hint">Stored with the story — never sent to any third party directly.</div>
        </div>

        <!-- Model + Welcome Text -->
        <div class="grid" style="margin-bottom:14px">
          <div class="f">
            <label>Model</label>
            <select id="model">
              <option value="gpt-4o-mini">gpt-4o-mini</option>
              <option value="gpt-4o">gpt-4o</option>
              <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
            </select>
          </div>
          <div class="f">
            <label>Welcome Text</label>
            <input id="welcomeText" type="text" placeholder="Hello, I'm PerciBOT!" />
          </div>
        </div>

        <!-- ── System toggle ── -->
        <div class="sys-toggle-wrap">
          <button class="sys-tab active" id="tabDatasphere" type="button">
            🗄️ &nbsp;SAP Datasphere
          </button>
          <button class="sys-tab sap-tab" id="tabSap" type="button">
            🔷 &nbsp;SAP System
          </button>
        </div>

        <!-- ── Datasphere panel ── -->
        <div class="sys-panel active" id="panelDatasphere">
          <div class="pairs-header">
            <span class="pairs-label">View Pairs</span>
            <button class="btn-add-pair" id="btnAddDsPair" type="button">
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                <line x1="7" y1="1" x2="7" y2="13"/><line x1="1" y1="7" x2="13" y2="7"/>
              </svg>
              Add pair
            </button>
          </div>
          <div class="pair-list" id="dsPairList"></div>
          <div class="hint" style="margin-bottom:10px">
            Each row is a Schema + View pair validated on Test Connection.
            Incomplete rows are ignored.
          </div>
        </div>

        <!-- ── SAP panel ── -->
        <div class="sys-panel" id="panelSap">
          <div class="pairs-header">
            <span class="pairs-label">SAP Tables</span>
            <button class="btn-add-pair" id="btnAddSapPair" type="button">
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                <line x1="7" y1="1" x2="7" y2="13"/><line x1="1" y1="7" x2="13" y2="7"/>
              </svg>
              Add table
            </button>
          </div>
          <div class="pair-list" id="sapPairList"></div>
          <div class="hint" style="margin-bottom:10px">
            SAP table names to validate on Test Connection. SAP backend coming soon.
          </div>
        </div>

        <!-- Test Connection controls -->
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:4px">
          <button id="testConnBtn" class="btn-test primary" type="button">Test Connection</button>
          <span id="connStatus" class="conn-status"></span>
        </div>

        <!-- Result detail -->
        <div id="connDetail" class="conn-detail" style="margin-top:10px"></div>
      </div>

      <hr class="divider" />

      <!-- ════ SECTION 2 — Prompts ════ -->
      <div class="section">
        <div class="title">Prompts</div>
        <div class="f" style="margin-bottom:12px">
          <label>Client ID</label>
          <input id="clientId" type="text" placeholder="e.g. smartstream, futuroot, demo-finance" />
          <div class="hint">Identifier for the active client / demo context.</div>
        </div>
        <div class="f" style="margin-bottom:12px">
          <label>User Prompt</label>
          <textarea id="answerPrompt" class="prompt" placeholder="Describe how answers should be presented.&#10;e.g. Always respond in a formal tone.&#10;     Highlight the top performer in bold.&#10;     Show currency values in USD."></textarea>
          <div class="hint">Optional — leave blank to use default formatting.</div>
        </div>
        <div class="f" style="margin-bottom:12px">
          <label>System Prompt</label>
          <textarea id="behaviourPrompt" class="prompt" placeholder="Describe what this assistant does and what topics it covers.&#10;e.g. This assistant answers questions about regional sales performance.&#10;     It covers revenue, volume, and target vs. actual comparisons.&#10;     Metrics are reported in INR crores."></textarea>
          <div class="hint">Describe the assistant's domain, scope, and any metric definitions.</div>
        </div>
        <div class="f">
          <label>Table Prompt</label>
          <textarea id="schemaPrompt" class="prompt" placeholder='View: "SCHEMA_NAME"."VIEW_NAME"(PARAMETER_NAME => &apos;VALUE&apos;)&#10;&#10;Columns:&#10;- COLUMN_NAME   DataType — what this column represents'></textarea>
          <div class="hint">Include the view name, what the parameter filters, and a description of each column.</div>
        </div>
      </div>

      <hr class="divider" />

      <!-- ════ SECTION 3 — Memory ════ -->
      <div class="section">
        <div class="title">Memory</div>
        <div class="toggle-row">
          <label for="memoryEnabled">Enable Context Memory</label>
          <input id="memoryEnabled" class="toggle" type="checkbox" />
        </div>
        <div id="memoryOptions" class="memory-options">
          <div class="f" style="margin-bottom:8px">
            <label>Memory Type</label>
            <select id="memoryMode">
              <option value="session">Session memory</option>
              <option value="hana_db">HANA DB</option>
            </select>
          </div>
          <div class="hint" id="memoryHint"></div>
        </div>
      </div>

      <hr class="divider" />

      <!-- ════ SECTION 4 — Theme ════ -->
      <div class="section">
        <div class="title">Theme</div>
        <div id="palettes" class="palettes" style="margin-bottom:12px"></div>
        <div class="grid">
          <div class="f"><label>Header Gradient Start</label><input id="primaryColor" type="color" /></div>
          <div class="f"><label>Header Gradient End</label>  <input id="primaryDark"  type="color" /></div>
          <div class="f"><label>Background</label>           <input id="surfaceColor" type="color" /></div>
          <div class="f"><label>Chat Panel Background</label><input id="surfaceAlt"   type="color" /></div>
          <div class="f"><label>Text Color</label>           <input id="textColor"    type="color" /></div>
        </div>
        <div id="themeError" class="danger" style="margin-top:6px; display:none"></div>
      </div>

      <!-- Toolbar -->
      <div class="toolbar">
        <span class="chip" id="statusChip">No changes</span>
        <button id="resetBtn" type="button">Reset</button>
        <button id="updateBtn" class="primary" disabled type="button">Update</button>
      </div>
    </div>

    <div class="toast" id="toast">Saved</div>
  `

  const HEX = /^#([0-9a-fA-F]{6})$/

  // ─── SVG helpers ──────────────────────────────────────────────────────────
  function _delIcon () {
    return `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
      <line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>
    </svg>`
  }

  // ─── Component ────────────────────────────────────────────────────────────
  class PerciBotBuilder extends HTMLElement {
    constructor () {
      super()
      this.attachShadow({ mode: 'open' })
      this.shadowRoot.appendChild(tpl.content.cloneNode(true))
      this.$ = id => this.shadowRoot.getElementById(id)

      // Which system is active
      this._activeSystem = 'datasphere'  // 'datasphere' | 'sap'

      // Pair lists — each entry is { id, el }  (el = DOM .pair-row)
      this._dsPairs  = []   // datasphere: { id, schemaInput, viewInput, el }
      this._sapPairs = []   // sap:        { id, tableInput, el }
      this._pairSeq  = 0

      this.keys = [
        'apiKey', 'model', 'welcomeText',
        'memoryMode',
        'primaryColor', 'primaryDark', 'surfaceColor', 'surfaceAlt', 'textColor',
        'clientId', 'answerPrompt', 'behaviourPrompt', 'schemaPrompt',
      ]
      this.inputs = this.keys.map(k => this.$(k)).filter(Boolean)

      this._wire()
      this._renderPalettes()

      // Start with one empty Datasphere pair
      this._addDsPair()
    }

    // ── SAC lifecycle ──────────────────────────────────────────────────────

    onCustomWidgetBuilderInit (host) {
      this._apply((host && host.properties) || {})
      if (!this._initial) this._initial = JSON.parse(JSON.stringify(this._snapshot()))
    }

    onCustomWidgetAfterUpdate (changedProps) {
      this._apply(changedProps, true)
      if (!this._initial) this._initial = JSON.parse(JSON.stringify(this._snapshot()))
    }

    // ── Wiring ────────────────────────────────────────────────────────────

    _wire () {
      // Reveal API key
      this.$('toggleKey').addEventListener('click', () => {
        const inp = this.$('apiKey')
        inp.type = inp.type === 'password' ? 'text' : 'password'
        this.$('toggleKey').textContent = inp.type === 'password' ? 'Show' : 'Hide'
      })

      // Dirty on any standard input change
      const markDirty = () => this._setDirty(true)
      this.inputs.forEach(el => {
        el.addEventListener('input',  markDirty)
        el.addEventListener('change', markDirty)
      })

      // System tabs
      this.$('tabDatasphere').addEventListener('click', () => this._switchSystem('datasphere'))
      this.$('tabSap').addEventListener('click',        () => this._switchSystem('sap'))

      // Add pair buttons
      this.$('btnAddDsPair').addEventListener('click',  () => { this._addDsPair();  this._setDirty(true) })
      this.$('btnAddSapPair').addEventListener('click', () => { this._addSapPair(); this._setDirty(true) })

      // Memory toggle
      this.$('memoryEnabled').addEventListener('change', () => { this._syncMemoryUI(); this._setDirty(true) })
      this.$('memoryMode').addEventListener('change',    () => { this._syncMemoryUI(); this._setDirty(true) })

      // Toolbar
      this.$('resetBtn').addEventListener('click',    () => this._reset())
      this.$('updateBtn').addEventListener('click',   () => this._update())
      this.$('testConnBtn').addEventListener('click', () => this._testConnection())
    }

    // ── System toggle ──────────────────────────────────────────────────────

    _switchSystem (sys) {
      this._activeSystem = sys
      this.$('tabDatasphere').classList.toggle('active', sys === 'datasphere')
      this.$('tabSap').classList.toggle('active', sys === 'sap')
      this.$('panelDatasphere').classList.toggle('active', sys === 'datasphere')
      this.$('panelSap').classList.toggle('active', sys === 'sap')
      // Clear results when switching
      this._clearConnResult()
      this._setDirty(true)
    }

    // ── Datasphere pair management ─────────────────────────────────────────

    _addDsPair (schema = '', view = '') {
      const id     = ++this._pairSeq
      const row    = document.createElement('div')
      row.className = 'pair-row'
      row.dataset.id = id

      const idx = document.createElement('div')
      idx.className = 'pair-idx'
      idx.textContent = this._dsPairs.length + 1

      const fields = document.createElement('div')
      fields.className = 'pair-fields'

      const schemaInp = document.createElement('input')
      schemaInp.type        = 'text'
      schemaInp.placeholder = 'Schema name (e.g. DEMO)'
      schemaInp.value       = schema
      schemaInp.addEventListener('input', () => this._setDirty(true))

      const viewInp = document.createElement('input')
      viewInp.type        = 'text'
      viewInp.placeholder = 'View name (e.g. VW_SALES_DATA)'
      viewInp.value       = view
      viewInp.addEventListener('input', () => this._setDirty(true))

      fields.appendChild(schemaInp)
      fields.appendChild(viewInp)

      const del = document.createElement('button')
      del.className = 'btn-del-pair'
      del.type      = 'button'
      del.title     = 'Remove pair'
      del.innerHTML = _delIcon()
      del.addEventListener('click', () => { this._removeDsPair(id) })

      row.appendChild(idx)
      row.appendChild(fields)
      row.appendChild(del)

      this.$('dsPairList').appendChild(row)
      this._dsPairs.push({ id, el: row, schemaInp, viewInp })
      this._reindexDs()
    }

    _removeDsPair (id) {
      const i = this._dsPairs.findIndex(p => p.id === id)
      if (i === -1) return
      this._dsPairs[i].el.remove()
      this._dsPairs.splice(i, 1)
      // Always keep at least one row
      if (this._dsPairs.length === 0) this._addDsPair()
      this._reindexDs()
      this._setDirty(true)
    }

    _reindexDs () {
      this._dsPairs.forEach((p, i) => {
        p.el.querySelector('.pair-idx').textContent = i + 1
      })
    }

    // ── SAP pair management ────────────────────────────────────────────────

    _addSapPair (table = '') {
      const id     = ++this._pairSeq
      const row    = document.createElement('div')
      row.className = 'pair-row'
      row.dataset.id = id

      const idx = document.createElement('div')
      idx.className = 'pair-idx sap-idx'
      idx.textContent = this._sapPairs.length + 1

      const fields = document.createElement('div')
      fields.className = 'pair-fields single'

      const tableInp = document.createElement('input')
      tableInp.type        = 'text'
      tableInp.placeholder = 'Table name (e.g. MARA, VBAK, KNA1)'
      tableInp.value       = table
      tableInp.addEventListener('input', () => this._setDirty(true))

      fields.appendChild(tableInp)

      const del = document.createElement('button')
      del.className = 'btn-del-pair'
      del.type      = 'button'
      del.title     = 'Remove table'
      del.innerHTML = _delIcon()
      del.addEventListener('click', () => { this._removeSapPair(id) })

      row.appendChild(idx)
      row.appendChild(fields)
      row.appendChild(del)

      this.$('sapPairList').appendChild(row)
      this._sapPairs.push({ id, el: row, tableInp })
      this._reindexSap()
    }

    _removeSapPair (id) {
      const i = this._sapPairs.findIndex(p => p.id === id)
      if (i === -1) return
      this._sapPairs[i].el.remove()
      this._sapPairs.splice(i, 1)
      if (this._sapPairs.length === 0) this._addSapPair()
      this._reindexSap()
      this._setDirty(true)
    }

    _reindexSap () {
      this._sapPairs.forEach((p, i) => {
        p.el.querySelector('.pair-idx').textContent = i + 1
      })
    }

    // ── Collect valid pairs ────────────────────────────────────────────────

    _collectDsPairs () {
      return this._dsPairs
        .map(p => ({ schema: p.schemaInp.value.trim(), view: p.viewInp.value.trim() }))
        .filter(p => p.schema && p.view)
    }

    _collectSapTables () {
      return this._sapPairs
        .map(p => p.tableInp.value.trim())
        .filter(t => t.length > 0)
    }

    // ── Test Connection ────────────────────────────────────────────────────

    async _testConnection () {
      const apiKey = (this.$('apiKey').value || '').trim()
      const model  = (this.$('model').value  || '').trim()

      const statusEl = this.$('connStatus')
      const detailEl = this.$('connDetail')

      this._clearConnResult()

      if (!apiKey) {
        statusEl.className   = 'conn-status err show'
        statusEl.textContent = '✗ API key is empty'
        return
      }

      statusEl.className   = 'conn-status checking show'
      statusEl.textContent = '⧗ Checking…'
      this.$('testConnBtn').disabled = true

      try {
        if (this._activeSystem === 'datasphere') {
          await this._testDatasphere(apiKey, model, statusEl, detailEl)
        } else {
          await this._testSap(apiKey, model, statusEl, detailEl)
        }
      } catch (e) {
        statusEl.className   = 'conn-status err show'
        statusEl.textContent = `✗ ${e.message}`
        detailEl.classList.remove('show')
      } finally {
        this.$('testConnBtn').disabled = false
      }
    }

    async _testDatasphere (apiKey, model, statusEl, detailEl) {
      const pairs = this._collectDsPairs()

      const body = { api_key_encrypted: xorEncrypt(apiKey), model }
      if (pairs.length) {
        body.view_pairs = pairs.map(p => ({ schema_name: p.schema, view_name: p.view }))
      }

      const res  = await fetch(`${BACKEND_URL}/presales/test-connection/datasphere`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      // ── OpenAI row ──
      const openaiOk = data.openai === 'ok'
      const openaiHtml = `<div class="cd-openai">
        <span class="${openaiOk ? 'ok-val' : 'err-val'}">
          ${openaiOk ? '✓' : '✗'} OpenAI
          ${openaiOk ? `— connected (${data.model || model})` : `— ${data.openai_detail || 'Failed'}`}
        </span>
      </div>`

      // ── HANA pairs ──
      let pairsHtml = ''
      const hana = data.hana
      if (hana && hana.pairs && hana.pairs.length) {
        const rows = hana.pairs.map(p => {
          const badgeClass = p.status === 'found' ? 'found' : (p.status === 'error' ? 'error' : 'not_found')
          const badgeLabel = p.status === 'found' ? 'Found' : (p.status === 'error' ? 'Error' : 'Not found')
          const detail     = p.detail ? `<div class="cd-pair-detail">${this._esc(p.detail)}</div>` : ''
          return `<div class="cd-pair">
            <span class="cd-badge ${badgeClass}">${badgeLabel}</span>
            <div>
              <div class="cd-pair-name">${this._esc(p.schema_name)}.${this._esc(p.view_name)}</div>
              ${detail}
            </div>
          </div>`
        }).join('')

        const overall   = hana.overall || ''
        const summaryTxt = `${hana.found} of ${hana.checked} view${hana.checked !== 1 ? 's' : ''} found`
          + (hana.not_found ? ` · ${hana.not_found} not found` : '')
          + (hana.errors    ? ` · ${hana.errors} error${hana.errors !== 1 ? 's' : ''}` : '')

        pairsHtml = `<div class="cd-pairs-title">HANA / Datasphere Views</div>${rows}
          <div class="cd-summary">${summaryTxt}</div>`
      } else if (hana && (hana.overall === 'skipped' || hana.overall === 'no_pairs_given' || !pairs.length)) {
        pairsHtml = `<div class="cd-pairs-title">HANA / Datasphere Views</div>
          <div class="cd-pair"><span style="font-size:12px; color:#6b7280">Skipped — no view pairs configured</span></div>`
      }

      detailEl.innerHTML = openaiHtml + pairsHtml
      detailEl.classList.add('show')

      const overall  = data.status || (openaiOk ? 'ok' : 'error')
      statusEl.className   = `conn-status show ${overall === 'ok' ? 'ok' : overall === 'partial' ? 'partial' : 'err'}`
      statusEl.textContent = overall === 'ok'
        ? '✓ All checks passed'
        : overall === 'partial'
          ? '⚠ Partial — some views not found'
          : '✗ One or more checks failed'
    }

    async _testSap (apiKey, model, statusEl, detailEl) {
      const tables = this._collectSapTables()

      const body = {
        api_key_encrypted: xorEncrypt(apiKey),
        model,
        ...(tables.length ? { tables } : {}),
      }

      const res  = await fetch(`${BACKEND_URL}/presales/test-connection/sap`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      const openaiOk = data.openai === 'ok'
      let html = `<div class="cd-openai">
        <span class="${openaiOk ? 'ok-val' : 'err-val'}">
          ${openaiOk ? '✓' : '✗'} OpenAI
          ${openaiOk ? `— connected (${data.model || model})` : `— ${data.openai_detail || 'Failed'}`}
        </span>
      </div>`

      // SAP result (stub-aware)
      const sap = data.sap
      if (sap) {
        const isStub = sap.overall === 'not_implemented'
        html += `<div class="cd-pairs-title">SAP System</div>
          <div class="cd-pair">
            <span class="cd-badge ${isStub ? 'not_found' : (sap.overall === 'ok' ? 'found' : 'error')}">
              ${isStub ? 'Pending' : (sap.overall === 'ok' ? 'OK' : 'Error')}
            </span>
            <div>
              <div class="cd-pair-name">${isStub ? 'SAP connectivity' : 'SAP system'}</div>
              <div class="cd-pair-detail">${this._esc(sap.detail || '')}</div>
            </div>
          </div>`
      }

      detailEl.innerHTML = html
      detailEl.classList.add('show')

      statusEl.className   = `conn-status show ${openaiOk ? 'ok' : 'err'}`
      statusEl.textContent = openaiOk ? '✓ OpenAI connected' : '✗ Connection failed'
    }

    _clearConnResult () {
      const statusEl = this.$('connStatus')
      const detailEl = this.$('connDetail')
      statusEl.className   = 'conn-status'
      statusEl.textContent = ''
      detailEl.innerHTML   = ''
      detailEl.classList.remove('show')
    }

    _esc (s = '') {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    }

    // ── Apply properties ───────────────────────────────────────────────────

    _apply (p = {}, external = false) {
      this._props = {
        apiKey:          p.apiKey          ?? '',
        model:           p.model           ?? 'gpt-4o-mini',
        welcomeText:     p.welcomeText     ?? 'Hello, I\u2019m PerciBOT! How can I assist you?',
        schemaName:      p.schemaName      ?? '',
        viewName:        p.viewName        ?? '',
        memoryMode:      p.memoryMode      ?? 'disabled',
        primaryColor:    p.primaryColor    ?? '#1f4fbf',
        primaryDark:     p.primaryDark     ?? '#163a8a',
        surfaceColor:    p.surfaceColor    ?? '#ffffff',
        surfaceAlt:      p.surfaceAlt      ?? '#f6f8ff',
        textColor:       p.textColor       ?? '#0b1221',
        clientId:        p.clientId        ?? '',
        answerPrompt:    p.answerPrompt    ?? '',
        behaviourPrompt: p.behaviourPrompt ?? '',
        schemaPrompt:    p.schemaPrompt    ?? '',
      }

      // Standard inputs
      this.keys.forEach(k => { if (this.$(k)) this.$(k).value = this._props[k] })

      // Back-compat: if schemaName/viewName exist in stored props, seed the first DS pair
      const sn = this._props.schemaName
      const vn = this._props.viewName
      if ((sn || vn) && this._dsPairs.length > 0) {
        this._dsPairs[0].schemaInp.value = sn
        this._dsPairs[0].viewInp.value   = vn
      }

      // Memory
      const enabledMemory = this._props.memoryMode === 'session' || this._props.memoryMode === 'hana_db'
      this.$('memoryEnabled').checked = enabledMemory
      this.$('memoryMode').value = this._props.memoryMode === 'hana_db' ? 'hana_db' : 'session'
      this._syncMemoryUI()

      if (!external) this._setDirty(false)
      this._validateTheme()
    }

    // ── Snapshot for reset ─────────────────────────────────────────────────

    _snapshot () {
      return {
        ...this._props,
        dsPairs:  this._dsPairs.map(p => ({ schema: p.schemaInp.value, view: p.viewInp.value })),
        sapPairs: this._sapPairs.map(p => ({ table: p.tableInp.value })),
        activeSystem: this._activeSystem,
      }
    }

    // ── Memory UI ─────────────────────────────────────────────────────────

    _syncMemoryUI () {
      const enabled = this.$('memoryEnabled').checked
      const mode    = this.$('memoryMode').value === 'hana_db' ? 'hana_db' : 'session'
      this.$('memoryOptions').classList.toggle('show', enabled)
      if (!enabled) { this.$('memoryHint').textContent = ''; return }
      this.$('memoryHint').textContent = mode === 'hana_db'
        ? 'Stores context in HANA so conversations can continue across sessions.'
        : 'Keeps context during this chat session only and resets for a new session.'
    }

    // ── Theme ─────────────────────────────────────────────────────────────

    _validateTheme () {
      const ids = ['primaryColor', 'primaryDark', 'surfaceColor', 'surfaceAlt', 'textColor']
      const bad = ids.filter(id => !HEX.test((this.$(id).value || '').trim().toLowerCase()))
      const err = this.$('themeError')
      if (bad.length) { err.textContent = 'Please choose valid colors.'; err.style.display = 'block' }
      else            { err.style.display = 'none' }
      return bad.length === 0
    }

    // ── Palettes ──────────────────────────────────────────────────────────

    _renderPalettes () {
      const pals = [
        { name: 'SAC Blue',  primaryColor: '#1f4fbf', primaryDark: '#163a8a', surfaceColor: '#ffffff', surfaceAlt: '#f6f8ff', textColor: '#0b1221' },
        { name: 'Emerald',   primaryColor: '#0fb37d', primaryDark: '#0a7f59', surfaceColor: '#ffffff', surfaceAlt: '#f2fbf7', textColor: '#0a1b14' },
        { name: 'Sunset',    primaryColor: '#ff8a00', primaryDark: '#e53670', surfaceColor: '#ffffff', surfaceAlt: '#fff8f0', textColor: '#131212' },
        { name: 'Slate',     primaryColor: '#4a5568', primaryDark: '#2d3748', surfaceColor: '#f7f9fc', surfaceAlt: '#eef2f7', textColor: '#0b1221' },
        { name: 'Indigo',    primaryColor: '#5a67d8', primaryDark: '#434190', surfaceColor: '#ffffff', surfaceAlt: '#f3f4ff', textColor: '#0b1221' },
        { name: 'Carbon',    primaryColor: '#2b2b2b', primaryDark: '#0f0f0f', surfaceColor: '#ffffff', surfaceAlt: '#f6f6f6', textColor: '#111111' },
      ]
      const root = this.$('palettes')
      const mk   = (t, c) => { const e = document.createElement(t); if (c) e.className = c; return e }
      pals.forEach(p => {
        const card = mk('div', 'pal-card')
        const sw   = mk('div', 'pal-sw')
        ;['primaryColor', 'primaryDark', 'surfaceColor', 'surfaceAlt', 'textColor'].forEach(k => {
          const s = mk('div', 'pal-s'); s.style.background = p[k]; sw.appendChild(s)
        })
        const name = mk('div', 'pal-name'); name.textContent = p.name
        card.appendChild(sw); card.appendChild(name)
        card.addEventListener('click', () => {
          Object.entries(p).forEach(([k, v]) => { if (k !== 'name' && this.$(k)) this.$(k).value = v })
          this._setDirty(true)
        })
        root.appendChild(card)
      })
    }

    // ── Dirty / update state ───────────────────────────────────────────────

    _setDirty (dirty) {
      this._dirty = !!dirty
      this.$('updateBtn').disabled = !this._dirty || !this._validateTheme()
      this.$('statusChip').textContent = this._dirty ? 'Unsaved changes' : 'No changes'
    }

    // ── Collect all props for propertiesChanged ────────────────────────────

    _collect () {
      const get = id => (this.$(id) ? this.$(id).value : '')
      // For backward compat: persist first DS pair as schemaName / viewName
      const firstDs = this._dsPairs.length > 0
        ? { schema: this._dsPairs[0].schemaInp.value.trim(), view: this._dsPairs[0].viewInp.value.trim() }
        : { schema: '', view: '' }
      return {
        apiKey:          get('apiKey'),
        model:           get('model'),
        welcomeText:     get('welcomeText'),
        schemaName:      firstDs.schema,
        viewName:        firstDs.view,
        memoryMode:      this.$('memoryEnabled').checked ? (get('memoryMode') || 'session') : 'disabled',
        primaryColor:    get('primaryColor'),
        primaryDark:     get('primaryDark'),
        surfaceColor:    get('surfaceColor'),
        surfaceAlt:      get('surfaceAlt'),
        textColor:       get('textColor'),
        clientId:        get('clientId').trim(),
        answerPrompt:    get('answerPrompt'),
        behaviourPrompt: get('behaviourPrompt'),
        schemaPrompt:    get('schemaPrompt'),
      }
    }

    _update () {
      if (!this._validateTheme()) return
      const props = this._collect()
      this.dispatchEvent(new CustomEvent('propertiesChanged', {
        detail: { properties: props }, bubbles: true, composed: true,
      }))
      this._props = { ...props }
      this._setDirty(false)
      this._toast('Saved')
    }

    _reset () {
      if (!this._initial) return
      this._apply(this._initial)
      this._setDirty(true)
    }

    _toast (msg) {
      const t = this.$('toast')
      t.textContent = msg
      t.classList.add('show')
      setTimeout(() => t.classList.remove('show'), 1200)
    }
  }

  if (!customElements.get('perci-bot-builder')) {
    customElements.define('perci-bot-builder', PerciBotBuilder)
  }
}())