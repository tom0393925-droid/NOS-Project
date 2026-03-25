// ==========================================
// js/chart.js: Chart configuration and Future Prediction Plugin
// ==========================================

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

        drawVerticalLine(options.tNext, 'Next', 'rgba(147, 51, 234, 0.8)');
        drawVerticalLine(options.tNext2, '2nd Next', 'rgba(37, 99, 235, 0.8)');
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
    const safetyStock = masterData.safetyStock || 0;

    let tNext = (stType === 'Frozen') ? globalFrozenNext : globalDryNext;
    let tNext2 = (stType === 'Frozen') ? globalFrozenNext2 : globalDryNext2;

    if (tNext2) {
        const baseDate = getLatestDataDate();
        const diffDays = (new Date(tNext2) - baseDate) / 86400000;
        let extendWeeks = Math.ceil(diffDays / 7) + 1;
        if (extendWeeks > 0 && extendWeeks <= 78) {
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
                // 週平均販売分を減算
                runningQty = Math.max(0, runningQty - past12WAvg);
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
                futureLines: { safetyStock: safetyStock, tNext: tNext, tNext2: tNext2 }
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
}