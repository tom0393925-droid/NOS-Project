// ==========================================
// js/ui_weekly_digest.js  —  Weekly AI Digest
// ==========================================

function _wdWeekLabel() {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    return monday.toISOString().split('T')[0];
}

// ──────────────────────────────────────────
// Toggle
// ──────────────────────────────────────────
async function toggleWeeklyDigest() {
    const panel = document.getElementById('wdPanel');
    const btn   = document.getElementById('wdToggleBtn');
    if (!panel) return;

    if (!panel.classList.contains('hidden')) {
        panel.classList.add('hidden');
        if (btn) btn.textContent = 'Generate Weekly Digest';
        return;
    }

    panel.classList.remove('hidden');
    if (btn) btn.textContent = 'Hide Digest';

    if (panel.querySelector('.wd-digest-content')) return;

    await _wdLoadOrPrompt();
}

// ──────────────────────────────────────────
// Check cache
// ──────────────────────────────────────────
async function _wdLoadOrPrompt() {
    const panel = document.getElementById('wdPanel');
    if (!panel) return;

    panel.innerHTML = _wdSpinner("Checking for this week's digest...");

    try {
        const weekLabel = _wdWeekLabel();
        const { data, error } = await _sb.functions.invoke('weekly-digest', {
            body: { action: 'get_cache', week_label: weekLabel },
        });
        if (error) throw new Error(error.message || String(error));

        if (data.cached) {
            _wdRender(data.digest_text, data.generated_at);
        } else {
            _wdShowGeneratePrompt();
        }
    } catch (e) {
        panel.innerHTML = _wdError('Cache check failed: ' + (e.message || String(e)));
    }
}

// ──────────────────────────────────────────
// Generate prompt (admin only)
// ──────────────────────────────────────────
function _wdShowGeneratePrompt() {
    const panel = document.getElementById('wdPanel');
    if (!panel) return;

    if (window._isAdmin) {
        panel.innerHTML = `
            <div class="flex flex-col items-center py-10 gap-3">
                <p class="text-sm font-bold text-gray-600">No digest generated for this week yet.</p>
                <p class="text-xs text-gray-400 text-center max-w-sm">
                    Analyzes all client data and generates a detailed briefing.<br>Takes about 15–30 seconds.
                </p>
                <button id="wdGenerateBtn" onclick="generateWeeklyDigest()"
                    class="mt-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm">
                    Generate Now
                </button>
            </div>`;
    } else {
        panel.innerHTML = `
            <div class="flex flex-col items-center py-10 gap-3">
                <p class="text-sm font-bold text-gray-600">This week's digest hasn't been generated yet.</p>
                <p class="text-xs text-gray-400 text-center max-w-sm">Available after the weekly data upload. Check back soon.</p>
            </div>`;
    }
}

// ──────────────────────────────────────────
// Generate
// ──────────────────────────────────────────
async function generateWeeklyDigest() {
    const panel  = document.getElementById('wdPanel');
    const genBtn = document.getElementById('wdGenerateBtn');
    if (!panel) return;

    if (genBtn) { genBtn.disabled = true; genBtn.textContent = 'Generating...'; }
    panel.innerHTML = _wdSpinner('Analyzing all client data… (15–30 sec)');

    try {
        const weekLabel = _wdWeekLabel();
        const { data, error } = await _sb.functions.invoke('weekly-digest', {
            body: { action: 'generate', week_label: weekLabel },
        });
        if (error) throw new Error(error.message || String(error));

        _wdRender(data.digest_text, data.generated_at);
        const btn = document.getElementById('wdToggleBtn');
        if (btn) btn.textContent = 'Hide Digest';
    } catch (e) {
        panel.innerHTML = _wdError('Generation failed: ' + (e.message || String(e))) +
            `<button onclick="_wdShowGeneratePrompt()"
                class="mt-3 text-sm text-violet-600 font-bold underline block text-center w-full">
                Try again
            </button>`;
    }
}

// ──────────────────────────────────────────
// Regenerate (admin only)
// ──────────────────────────────────────────
async function regenerateDigest() {
    const panel = document.getElementById('wdPanel');
    if (!panel) return;
    panel.innerHTML = _wdSpinner('Clearing cache...');
    try {
        const weekLabel = _wdWeekLabel();
        await _sb.functions.invoke('weekly-digest', {
            body: { action: 'delete_cache', week_label: weekLabel },
        });
        panel.innerHTML = '';
        await generateWeeklyDigest();
    } catch (e) {
        panel.innerHTML = _wdError('Regenerate failed: ' + (e.message || String(e)));
    }
}

// ──────────────────────────────────────────
// Render wrapper: parse JSON → card UI
// ──────────────────────────────────────────
function _wdRender(digestText, generatedAt) {
    const panel = document.getElementById('wdPanel');
    if (!panel) return;

    const d = new Date(generatedAt);
    const dateStr = d.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });

    let bodyHtml;
    try {
        const parsed = JSON.parse(digestText);
        bodyHtml = _wdRenderJson(parsed);
    } catch {
        // Fallback: plain text (old cache entries)
        bodyHtml = `<pre class="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">${_esc(digestText)}</pre>`;
    }

    panel.innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <p class="text-xs text-violet-500 font-bold">Generated: ${dateStr}</p>
            ${window._isAdmin ? `
            <button onclick="regenerateDigest()"
                class="text-xs text-violet-600 hover:text-violet-800 font-bold border border-violet-300 rounded-md px-2.5 py-1 hover:bg-violet-50 transition-colors">
                ↻ Regenerate
            </button>` : ''}
        </div>
        <div class="wd-digest-content space-y-6">
            ${bodyHtml}
        </div>`;
}

// ──────────────────────────────────────────
// JSON → card-based HTML
// ──────────────────────────────────────────
function _wdRenderJson(d) {
    const perf   = d.performance || {};
    const atRisk = d.at_risk     || [];
    const pitch  = d.pitch       || [];

    const isUp      = perf.direction !== 'down';
    const chgAbs    = Math.abs(Number(perf.change_pct || 0)).toFixed(1);
    const arrow     = isUp ? '▲' : '▼';
    const chgColor  = isUp ? 'text-green-600' : 'text-red-500';
    const chgBadge  = isUp ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600';

    let html = '';

    // ── PERFORMANCE ──────────────────────
    html += `
    <div>
        <div class="flex items-center gap-2 mb-3">
            <div class="w-1 h-5 bg-gray-300 rounded-full"></div>
            <span class="text-xs font-black text-gray-400 uppercase tracking-widest">Last Week Performance</span>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <!-- Metric bar -->
            <div class="flex items-center gap-5 px-6 py-5 border-b border-gray-100">
                <div class="text-4xl font-black ${chgColor}">${arrow} ${chgAbs}%</div>
                <div>
                    <p class="text-sm font-bold text-gray-700">vs prior 4-week average</p>
                    <p class="text-xs text-gray-400 mt-0.5">
                        $${_wdFmt(perf.avg_prior)}/wk &nbsp;→&nbsp; $${_wdFmt(perf.avg_recent)}/wk
                    </p>
                </div>
            </div>
            <!-- Summary -->
            <div class="px-6 py-5 border-b border-gray-100">
                ${_wdParagraphs(perf.summary || '')}
            </div>
            <!-- Weekly bars -->
            <div class="px-6 py-5 bg-gray-50">
                <p class="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">8-Week Revenue</p>
                <div class="space-y-2">
                    ${(perf.weekly_figures || []).map((w) => {
                        const max = Math.max(...(perf.weekly_figures || []).map((x) => x.amount), 1);
                        const pct = Math.max(Math.round(w.amount / max * 100), 3);
                        return `
                        <div class="flex items-center gap-3">
                            <span class="text-xs text-gray-400 w-24 shrink-0 font-mono">${_esc(w.week)}</span>
                            <div class="flex-1 bg-gray-200 rounded-full h-1.5">
                                <div class="h-1.5 rounded-full bg-violet-400 transition-all" style="width:${pct}%"></div>
                            </div>
                            <span class="text-xs font-bold text-gray-600 w-20 text-right">$${_wdFmt(w.amount)}</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        </div>
    </div>`;

    // ── AT RISK ───────────────────────────
    html += `
    <div>
        <div class="flex items-center gap-2 mb-3">
            <div class="w-1 h-5 bg-red-400 rounded-full"></div>
            <span class="text-xs font-black text-gray-400 uppercase tracking-widest">AT RISK — Clients to contact this week</span>
            <span class="ml-auto text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">${atRisk.length} clients</span>
        </div>
        ${atRisk.length === 0
            ? '<p class="text-sm text-gray-400 bg-white rounded-xl border border-gray-100 p-5 text-center">No at-risk clients this week.</p>'
            : atRisk.map((c) => `
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-red-400 overflow-hidden mb-4">
            <div class="flex items-start justify-between px-5 pt-5 pb-3">
                <div>
                    <h4 class="font-black text-gray-900 text-base leading-tight">${_esc(c.name)}</h4>
                    <span class="text-xs text-gray-400 font-mono">${_esc(c.code)}</span>
                </div>
                <span class="text-xs font-bold bg-red-100 text-red-600 px-2.5 py-1 rounded-full shrink-0 ml-4">
                    📞 ${_esc(c.action || 'Call')}
                </span>
            </div>
            <div class="px-5 pb-4">
                ${_wdParagraphs(c.context || '')}
            </div>
            <div class="mx-5 mb-5 bg-red-50 rounded-lg p-4 border border-red-100">
                <p class="text-xs font-black text-red-500 uppercase tracking-wider mb-2">Talking Point</p>
                <p class="text-sm text-gray-700 italic leading-relaxed">"${_esc(c.talking_point || '')}"</p>
            </div>
        </div>`).join('')}
    </div>`;

    // ── PITCH ─────────────────────────────
    html += `
    <div>
        <div class="flex items-center gap-2 mb-3">
            <div class="w-1 h-5 bg-teal-400 rounded-full"></div>
            <span class="text-xs font-black text-gray-400 uppercase tracking-widest">This Week's Pitch Opportunities</span>
            <span class="ml-auto text-xs font-bold bg-teal-100 text-teal-600 px-2 py-0.5 rounded-full">${pitch.length} SKUs</span>
        </div>
        ${pitch.length === 0
            ? '<p class="text-sm text-gray-400 bg-white rounded-xl border border-gray-100 p-5 text-center">No strong trends this week.</p>'
            : pitch.map((s) => `
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-teal-400 overflow-hidden mb-4">
            <div class="flex items-start justify-between px-5 pt-5 pb-3">
                <h4 class="font-black text-gray-900 text-base">SKU ${_esc(s.sku_code)}</h4>
                <span class="text-xs font-bold bg-teal-100 text-teal-600 px-2.5 py-1 rounded-full shrink-0 ml-4">
                    📈 Trending
                </span>
            </div>
            <div class="px-5 pb-4">
                ${_wdParagraphs(s.context || '')}
            </div>
            <div class="mx-5 mb-5 bg-teal-50 rounded-lg p-4 border border-teal-100">
                <p class="text-xs font-black text-teal-600 uppercase tracking-wider mb-2">Talking Point</p>
                <p class="text-sm text-gray-700 italic leading-relaxed">"${_esc(s.talking_point || '')}"</p>
            </div>
        </div>`).join('')}
    </div>`;

    return html;
}

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────
function _wdParagraphs(text) {
    return text
        .split(/\n\n+/)
        .map(p => p.trim())
        .filter(Boolean)
        .map(p => `<p class="text-sm text-gray-700 leading-relaxed mb-2">${_esc(p).replace(/\n/g, '<br>')}</p>`)
        .join('');
}

function _wdFmt(n) {
    return Number(n || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function _esc(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function _wdSpinner(msg) {
    return `
        <div class="flex items-center justify-center gap-3 py-10">
            <svg class="animate-spin h-5 w-5 text-violet-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
            </svg>
            <p class="text-sm font-bold text-gray-500">${_esc(msg)}</p>
        </div>`;
}

function _wdError(msg) {
    return `<p class="text-red-500 text-sm font-bold px-4 py-3 bg-red-50 rounded-xl border border-red-200">${_esc(msg)}</p>`;
}
