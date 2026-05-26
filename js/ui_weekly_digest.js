// ==========================================
// js/ui_weekly_digest.js  —  Weekly AI Digest
// ==========================================

// Returns the Monday of the current week as YYYY-MM-DD (used as cache key)
function _wdWeekLabel() {
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    return monday.toISOString().split('T')[0];
}

// ──────────────────────────────────────────
// Toggle: open / close the digest panel
// ──────────────────────────────────────────
async function toggleWeeklyDigest() {
    const panel = document.getElementById('wdPanel');
    const btn   = document.getElementById('wdToggleBtn');
    if (!panel) return;

    // Close if already open
    if (!panel.classList.contains('hidden')) {
        panel.classList.add('hidden');
        if (btn) btn.textContent = 'Generate Weekly Digest';
        return;
    }

    panel.classList.remove('hidden');
    if (btn) btn.textContent = 'Hide Digest';

    // Already rendered — just show
    if (panel.querySelector('.wd-digest-content')) return;

    // First open: check cache
    await _wdLoadOrPrompt();
}

// ──────────────────────────────────────────
// Check cache via Edge Function
// ──────────────────────────────────────────
async function _wdLoadOrPrompt() {
    const panel = document.getElementById('wdPanel');
    if (!panel) return;

    panel.innerHTML = _wdSpinner('Checking for this week\'s digest...');

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
// Show "no digest yet" prompt
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
                <p class="text-xs text-gray-400 text-center max-w-sm">
                    Available after the weekly data upload. Check back soon.
                </p>
            </div>`;
    }
}

// ──────────────────────────────────────────
// Generate: call Edge Function
// ──────────────────────────────────────────
async function generateWeeklyDigest() {
    const panel  = document.getElementById('wdPanel');
    const genBtn = document.getElementById('wdGenerateBtn');
    if (!panel) return;

    if (genBtn) { genBtn.disabled = true; genBtn.textContent = 'Generating...'; }
    panel.innerHTML = _wdSpinner('Analyzing all client data across every account… (15–30 sec)');

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
                class="mt-3 text-sm text-violet-600 font-bold underline block text-center">
                Try again
            </button>`;
    }
}

// ──────────────────────────────────────────
// Regenerate: delete cache then re-generate
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
        // Clear rendered content so generateWeeklyDigest doesn't short-circuit
        panel.innerHTML = '';
        await generateWeeklyDigest();
    } catch (e) {
        panel.innerHTML = _wdError('Regenerate failed: ' + (e.message || String(e)));
    }
}

// ──────────────────────────────────────────
// Render digest text as styled HTML
// ──────────────────────────────────────────
function _wdRender(digestText, generatedAt) {
    const panel = document.getElementById('wdPanel');
    if (!panel) return;

    const d = new Date(generatedAt);
    const dateStr = d.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });

    panel.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <p class="text-xs text-violet-500 font-bold">Generated: ${dateStr}</p>
            ${window._isAdmin ? `
            <button onclick="regenerateDigest()"
                class="text-xs text-violet-600 hover:text-violet-800 font-bold border border-violet-300 rounded-md px-2.5 py-1 hover:bg-violet-50 transition-colors">
                ↻ Regenerate
            </button>` : ''}
        </div>
        <div class="wd-digest-content bg-white rounded-xl border border-gray-200 shadow-sm p-6 md:p-8">
            ${_wdParseToHtml(digestText)}
        </div>`;
}

// ──────────────────────────────────────────
// Convert plain-text digest → styled HTML
// ──────────────────────────────────────────
function _wdParseToHtml(text) {
    const lines = text.split('\n');
    let html = '';
    let lastWasEmpty = false;

    for (const raw of lines) {
        const line = raw.trimEnd();
        const trimmed = line.trim();

        // Section divider ────────────────
        if (/^─{8,}/.test(trimmed)) {
            html += '<hr class="border-gray-200 my-6">';
            lastWasEmpty = false;
            continue;
        }

        // Empty line
        if (!trimmed) {
            if (!lastWasEmpty) html += '<div class="mb-3"></div>';
            lastWasEmpty = true;
            continue;
        }
        lastWasEmpty = false;

        // Section headers: ALL CAPS lines (e.g. "LAST WEEK PERFORMANCE", "AT RISK — …")
        if (/^[A-Z][A-Z\s\-—–]+$/.test(trimmed) && trimmed.length >= 4 && trimmed.length <= 80) {
            html += `<h3 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 mt-1">${_esc(trimmed)}</h3>`;
            continue;
        }

        // → Recommended action / → Action
        if (/^→\s*(Recommended action|Action):/.test(trimmed)) {
            html += `<p class="text-teal-700 font-bold text-sm mt-3 mb-1">${_esc(trimmed)}</p>`;
            continue;
        }

        // Talking point (may be indented)
        if (/^\s*Talking point:/.test(line)) {
            html += `<p class="text-violet-700 text-sm italic border-l-2 border-violet-300 pl-3 mb-3">${_esc(trimmed)}</p>`;
            continue;
        }

        // → Other → lines
        if (trimmed.startsWith('→')) {
            html += `<p class="text-teal-700 font-bold text-sm mt-2 mb-1">${_esc(trimmed)}</p>`;
            continue;
        }

        // SKU header line: "SKU XXXXX" (short, starts with SKU)
        if (/^SKU\s+\S+(\s+[-—].*)?$/.test(trimmed)) {
            html += `<p class="font-black text-gray-900 text-sm mt-5 mb-1 tracking-wide">${_esc(trimmed)}</p>`;
            continue;
        }

        // Bullet or numbered list item
        if (/^[•\-\*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
            html += `<p class="text-sm text-gray-700 pl-4 mb-1.5">${_esc(trimmed)}</p>`;
            continue;
        }

        // Client name line: a short line that looks like a proper noun (title case, no colon, short)
        // Heuristic: <= 60 chars, starts capital, no : or = or numbers at start
        if (
            trimmed.length <= 60 &&
            /^[A-Z]/.test(trimmed) &&
            !trimmed.includes(':') &&
            !trimmed.includes('=') &&
            !/^\d/.test(trimmed) &&
            !/^(The|This|These|In|For|Note|As|If|When|With|Each|All|No )/.test(trimmed)
        ) {
            html += `<p class="font-bold text-gray-900 text-sm mt-5 mb-1">${_esc(trimmed)}</p>`;
            continue;
        }

        // Default: regular paragraph
        html += `<p class="text-sm text-gray-700 mb-2 leading-relaxed">${_esc(trimmed)}</p>`;
    }

    return html;
}

// ──────────────────────────────────────────
// Utility helpers
// ──────────────────────────────────────────
function _esc(str) {
    return String(str)
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
