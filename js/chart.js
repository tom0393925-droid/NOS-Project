// ==========================================
// js/chart.js: Chart configuration and Future Prediction Plugin
// ==========================================

// ── Simulation state ──
let _simAvg = null;          // null = use real avg; number = user override
let _realAvg = 0;            // computed 12-week average
let _simNumFutureWeeks = 0;  // how many future weeks are extended on the chart
let _simLatestQty = 0;       // inventory qty at the last historical week
let _simBaseDate = null;     // Date object for the last historical week
let _prevChartSKU = null;    // detect SKU switches to auto-reset sim
let _isDragging = false;
let _dragStartClientY = 0;
let _dragStartAvg = 0;
let _chartDragInitialized = false;

const futureLinesPlugin = {
    id: 'futureLines',
    afterDraw: (chart) => {
        const ctx = chart.ctx;
        const xAxis = chart.scales.x;
        const yAxis = chart.scales.y1; 
        const options = chart.config.options.plugins.futureLines;
        if(!options) return;

        if (options.safetyStock > 0) {
            const y = yAxis.getPixelForValue(options.safetyStock);
            if(y >= yAxis.top && y <= yAxis.bottom) {
                ctx.save();
                ctx.beginPath();
                ctx.setLineDash([5, 5]);
                ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
                ctx.lineWidth = 2;
                ctx.moveTo(xAxis.left, y);
                ctx.lineTo(xAxis.right, y);
                ctx.stroke();
                
                ctx.fillStyle = 'rgba(239, 68, 68, 1)';
                ctx.font = 'bold 11px sans-serif';
                ctx.fillText('Safety Stock', xAxis.right - 70, y - 6);
                ctx.restore();
            }
        }

        const drawVerticalLine = (dateStr, labelText, color) => {
            if (!dateStr) return;
            const tDate = new Date(dateStr).getTime();
            let xPos = null;
            
            for (let i = 0; i < chart.data.labels.length; i++) {
                let l = chart.data.labels[i];
                if (!l.includes('/')) continue;
                const parts = l.split('/');
                const lDate = new Date(`20${parts[0]}/${parts[1]}/${parts[2]}`).getTime();
                
                if (i < chart.data.labels.length - 1) {
                    const nextL = chart.data.labels[i+1];
                    if (nextL.includes('/')) {
                        const nextParts = nextL.split('/');
                        const nextDate = new Date(`20${nextParts[0]}/${nextParts[1]}/${nextParts[2]}`).getTime();
                        if (tDate >= lDate && tDate <= nextDate) {
                            const ratio = (tDate - lDate) / (nextDate - lDate);
                            const x1 = xAxis.getPixelForValue(i);
                            const x2 = xAxis.getPixelForValue(i+1);
                            xPos = x1 + (x2 - x1) * ratio;
                            break;
                        }
                    }
                } else if (tDate >= lDate && tDate <= lDate + 604800000*4) {
                    const ratio = (tDate - lDate) / 604800000;
                    const dx = xAxis.getPixelForValue(i) - xAxis.getPixelForValue(i-1);
                    xPos = xAxis.getPixelForValue(i) + (dx * ratio);
                }
            }

            if (xPos && xPos >= xAxis.left && xPos <= xAxis.right) {
                ctx.save();
                ctx.beginPath();
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.moveTo(xPos, yAxis.top);
                ctx.lineTo(xPos, yAxis.bottom);
                ctx.stroke();

                ctx.fillStyle = color;
                ctx.fillRect(xPos - 25, yAxis.top + 2, 50, 16);
                ctx.fillStyle = 'white';
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(labelText, xPos, yAxis.top + 13);
                ctx.restore();
            }
        };

        drawVerticalLine(options.tNext,  'Next',     'rgba(147, 51, 234, 0.8)');
        drawVerticalLine(options.tNext2, '2nd Next', 'rgba(37, 99, 235, 0.8)');
        drawVerticalLine(options.tNext3, '3rd Next', 'rgba(234, 88, 12, 0.8)');
    }
};

function updateChartPeriod() {
    if (!currentSelectedSKU) return;

    let totalSalesTrend = new Array(loadedWeeks).fill(0);
    let totalQtysTrend = new Array(loadedWeeks).fill(0);

    for (const key in historyData) {
        const h = historyData[key];
        if (h.code === currentSelectedSKU) {
            for(let i = 0; i < loadedWeeks; i++) {
                totalSalesTrend[i] += (h.sales[i] || 0);
                totalQtysTrend[i] += (h.qtys[i] || 0);
            }
        }
    }

    let past12WSalesSum = 0;
    const checkWeeks12 = Math.min(12, loadedWeeks);
    for(let i = loadedWeeks - checkWeeks12; i < loadedWeeks; i++) past12WSalesSum += (totalSalesTrend[i] || 0);
    const past12WAvg = checkWeeks12 > 0 ? (past12WSalesSum / checkWeeks12) : 0;

    // Reset sim when switching SKUs; keep sim avg when just changing zoom
    if (currentSelectedSKU !== _prevChartSKU) {
        _simAvg = null;
        _prevChartSKU = currentSelectedSKU;
    }
    _realAvg = past12WAvg;
    const avgToUse = (_simAvg !== null) ? _simAvg : past12WAvg;
    _simNumFutureWeeks = 0; // reset; set inside block below if future extension exists

    let extendedLabels = loadedFiles.map((filename, i) => {
        // Sheets API format: "W/2026-03-24"
        const isoMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) return `${isoMatch[1].slice(-2)}/${isoMatch[2]}/${isoMatch[3]}`;
        // Old Excel filename format: "YYMMDD"
        const match = filename.match(/(\d{6})/);
        if (match) return `20${match[0].slice(0,2)}/${match[0].slice(2,4)}/${match[0].slice(4,6)}`;
        return `Wk ${i + 1}`;
    });

    let predictionData = new Array(loadedWeeks).fill(null);
    const latestQty = totalQtysTrend[loadedWeeks - 1] || 0;
    predictionData[loadedWeeks - 1] = latestQty; 

    const masterData = skuMaster[currentSelectedSKU] || { storageType: "Dry", safetyStock: 0 };
    const stType = masterData.storageType || 'Dry';
    // ★ セーフティストックは常に週平均×8週（約2ヶ月）で統一
    const safetyStock = Math.round(past12WAvg * safetyWeeks);

    let tNext  = (stType === 'Frozen') ? globalFrozenNext  : globalDryNext;
    let tNext2 = (stType === 'Frozen') ? globalFrozenNext2 : globalDryNext2;
    let tNext3 = (stType === 'Frozen') ? globalFrozenNext3 : globalDryNext3;

    // グラフは設定されている中で一番遠い日付まで伸ばす
    const tFarthest = tNext3 || tNext2;
    if (tFarthest) {
        const baseDate = getLatestDataDate();
        const diffDays = (new Date(tFarthest) - baseDate) / 86400000;
        let extendWeeks = Math.ceil(diffDays / 7) + 1;
        if (extendWeeks > 0 && extendWeeks <= 78) {
            // Store simulation state
            _simLatestQty = latestQty;
            _simBaseDate = baseDate;
            _simNumFutureWeeks = extendWeeks;

            const skuShipments = (window.shipmentOrders && window.shipmentOrders[currentSelectedSKU]) || [];
            let runningQty = latestQty;
            for (let i = 1; i <= extendWeeks; i++) {
                const wStart = new Date(baseDate); wStart.setDate(baseDate.getDate() + ((i - 1) * 7));
                const wEnd   = new Date(baseDate); wEnd.setDate(baseDate.getDate() + (i * 7));
                // 発注済み分を加算（未入荷のみ）
                skuShipments.forEach(s => {
                    if (s.status === 'arrived') return;
                    const sd = new Date(s.arrivalDate);
                    if (sd > wStart && sd <= wEnd) runningQty += s.orderQty;
                });
                // 週平均販売分を減算（simAvgまたはreal avgを使用）
                runningQty = Math.max(0, runningQty - avgToUse);
                extendedLabels.push(`${wEnd.getFullYear().toString().slice(-2)}/${('0'+(wEnd.getMonth()+1)).slice(-2)}/${('0'+wEnd.getDate()).slice(-2)}`);
                predictionData.push(runningQty);
            }
        }
    }

    const periodSelect = document.getElementById('chartPeriod');
    const periodVal = periodSelect ? periodSelect.value : 'all';
    
    let baseWeeksToDisplay = extendedLabels.length;
    if (periodVal === '12') baseWeeksToDisplay = 12;
    if (periodVal === '24') baseWeeksToDisplay = 24;

    const chartContainer = document.getElementById('chartContainer');
    if (periodVal === 'all') {
        chartContainer.style.width = extendedLabels.length > 52 ? `${(extendedLabels.length / 52) * 100}%` : '100%';
    } else {
        const ratio = extendedLabels.length / baseWeeksToDisplay;
        chartContainer.style.width = ratio > 1 ? `${ratio * 100}%` : '100%';
    }

    const maxSales = Math.max(...totalSalesTrend, 10) * 1.1;
    const maxQtys = Math.max(...totalQtysTrend, safetyStock * 1.2, 10) * 1.1;

    setSafeText('yLeftMax', Math.round(maxSales).toLocaleString());
    setSafeText('yLeftMid', Math.round(maxSales / 2).toLocaleString());
    setSafeText('yRightMax', Math.round(maxQtys).toLocaleString());
    setSafeText('yRightMid', Math.round(maxQtys / 2).toLocaleString());

    const ctxMain = document.getElementById('skuChart').getContext('2d');
    if (skuChartInstance) skuChartInstance.destroy();

    skuChartInstance = new Chart(ctxMain, {
        type: 'line',
        data: {
            labels: extendedLabels, 
            datasets: [
                { label: 'Sales', data: totalSalesTrend, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', yAxisID: 'y', fill: true, tension: 0.3 },
                { label: 'Inventory', data: totalQtysTrend, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', yAxisID: 'y1', fill: true, tension: 0.3 },
                { label: 'Prediction', data: predictionData, borderColor: '#f59e0b', borderDash: [5, 5], yAxisID: 'y1', fill: false, tension: 0, pointRadius: 0 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, layout: { padding: { top: 20, bottom: 45, left: 10, right: 10 } },
            interaction: { mode: 'index', intersect: false },
            plugins: { 
                legend: { display: false },
                futureLines: { safetyStock: safetyStock, tNext: tNext, tNext2: tNext2, tNext3: tNext3 }
            },
            scales: {
                x: { ticks: { maxRotation: 45, minRotation: 45, autoSkip: true, maxTicksLimit: 50 } }, 
                y: { display: false, min: 0, max: maxSales }, y1: { display: false, min: 0, max: maxQtys }
            }
        },
        plugins: [futureLinesPlugin] 
    });

    const scrollWrapper = document.getElementById('chartScrollWrapper');
    if(scrollWrapper) setTimeout(() => { scrollWrapper.scrollLeft = scrollWrapper.scrollWidth; }, 100);

    // Show/update simulation control bar
    const simBar = document.getElementById('simControlBar');
    if (simBar) {
        if (_simNumFutureWeeks > 0) {
            simBar.classList.remove('hidden');
            _syncSimUI(avgToUse);
        } else {
            simBar.classList.add('hidden');
        }
    }

    _initChartDrag();
}

// ==========================================
// Simulation helpers
// ==========================================

function _syncSimUI(currentAvg) {
    const input   = document.getElementById('simAvgInput');
    const deltaEl = document.getElementById('simAvgDelta');
    const realEl  = document.getElementById('simRealAvg');
    if (realEl)  realEl.textContent  = _realAvg.toFixed(1);
    if (input)   input.value         = currentAvg.toFixed(1);
    if (deltaEl) {
        const diff = currentAvg - _realAvg;
        const pct  = _realAvg > 0 ? (diff / _realAvg * 100) : 0;
        const sign = diff >= 0 ? '+' : '';
        if (Math.abs(diff) < 0.05) {
            deltaEl.textContent  = '—';
            deltaEl.className    = 'text-gray-400 text-xs min-w-[140px]';
        } else {
            deltaEl.textContent  = `${sign}${diff.toFixed(1)} pcs/wk (${sign}${pct.toFixed(0)}%)`;
            deltaEl.className    = diff > 0
                ? 'text-red-500 font-bold text-xs min-w-[140px]'
                : 'text-green-600 font-bold text-xs min-w-[140px]';
        }
    }
    const resetBtn = document.getElementById('btnSimReset');
    if (resetBtn) resetBtn.disabled = (_simAvg === null);
}

function _rebuildPrediction(newAvg) {
    if (!skuChartInstance || _simNumFutureWeeks <= 0) return;
    const ds = skuChartInstance.data.datasets[2].data;
    // Clear historical nulls and reset anchor
    for (let i = 0; i < loadedWeeks - 1; i++) ds[i] = null;
    ds[loadedWeeks - 1] = _simLatestQty;
    // Rebuild future data points with new avg
    const skuShipments = (window.shipmentOrders && window.shipmentOrders[currentSelectedSKU]) || [];
    let runningQty = _simLatestQty;
    for (let i = 1; i <= _simNumFutureWeeks; i++) {
        const wStart = new Date(_simBaseDate); wStart.setDate(_simBaseDate.getDate() + ((i - 1) * 7));
        const wEnd   = new Date(_simBaseDate); wEnd.setDate(_simBaseDate.getDate() + (i * 7));
        skuShipments.forEach(s => {
            if (s.status === 'arrived') return;
            const sd = new Date(s.arrivalDate);
            if (sd > wStart && sd <= wEnd) runningQty += s.orderQty;
        });
        runningQty = Math.max(0, runningQty - newAvg);
        ds[loadedWeeks - 1 + i] = runningQty;
    }
    skuChartInstance.update('none');
    _syncSimUI(newAvg);
}

function _onSimAvgInput(value) {
    const v = parseFloat(value);
    if (isNaN(v) || v < 0) return;
    _simAvg = v;
    _rebuildPrediction(v);
}

function resetSimAvg() {
    _simAvg = null;
    updateChartPeriod();
}

function _initChartDrag() {
    if (_chartDragInitialized) return;
    _chartDragInitialized = true;
    const canvas = document.getElementById('skuChart');
    if (!canvas) return;

    canvas.addEventListener('mousedown', (e) => {
        if (!skuChartInstance || _simNumFutureWeeks <= 0) return;
        const y1   = skuChartInstance.scales.y1;
        if (!y1) return;
        const rect = canvas.getBoundingClientRect();
        const y    = e.clientY - rect.top;
        if (y < y1.top || y > y1.bottom) return;
        _isDragging      = true;
        _dragStartClientY = e.clientY;
        _dragStartAvg    = (_simAvg !== null) ? _simAvg : _realAvg;
        canvas.style.cursor = 'ns-resize';
        e.preventDefault();
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!skuChartInstance) return;
        const y1   = skuChartInstance.scales.y1;
        const rect = canvas.getBoundingClientRect();
        const y    = e.clientY - rect.top;

        if (!_isDragging) {
            if (_simNumFutureWeeks > 0 && y1 && y >= y1.top && y <= y1.bottom) {
                canvas.style.cursor = 'ns-resize';
            } else {
                canvas.style.cursor = 'default';
            }
            return;
        }

        if (!y1 || _simNumFutureWeeks <= 0) return;
        const chartHeight = y1.bottom - y1.top;
        const pixelDelta  = e.clientY - _dragStartClientY;
        // Dragging down (positive pixelDelta) → prediction endpoint goes down → higher avg
        const newAvg = Math.max(0, _dragStartAvg + (pixelDelta * (y1.max / chartHeight)) / _simNumFutureWeeks);
        _simAvg = newAvg;
        _rebuildPrediction(newAvg);
    });

    const endDrag = () => {
        if (_isDragging) {
            _isDragging = false;
            const c = document.getElementById('skuChart');
            if (c) c.style.cursor = 'default';
        }
    };
    canvas.addEventListener('mouseup', endDrag);
    document.addEventListener('mouseup', endDrag);
}