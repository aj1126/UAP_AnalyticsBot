function monthKey(dateString) { return dateString.slice(0, 7); }

// ✨ Nonlinear Forecasting Tweaks (Weighted Moving Average)
function forecastNextValue(series) {
    if (series.length === 0) return 0;
    if (series.length === 1) return series[0].count;

    const deltas = [];
    for (let index = 1; index < series.length; index += 1) {
        deltas.push(series[index].count - series[index - 1].count);
    }

    let weightedSum = 0;
    let weightTotal = 0;
    for (let i = 0; i < deltas.length; i++) {
        const weight = i + 1; // More recent intervals gain higher weight
        weightedSum += deltas[i] * weight;
        weightTotal += weight;
    }

    const wma = weightTotal === 0 ? 0 : weightedSum / weightTotal;
    return Math.max(0, Math.round(series[series.length - 1].count + wma));
}

function addMonth(month) {
    const [year, monthNumber] = month.split('-').map(Number);
    const nextDate = new Date(Date.UTC(year, monthNumber, 1));
    return nextDate.toISOString().slice(0, 7);
}

// ✨ Support empty intervals
function fillEmptyIntervals(orderedMonths, timeline) {
    if (orderedMonths.length === 0) return [];
    const filledSeries = [];
    let currentMonth = orderedMonths[0];
    const lastMonth = orderedMonths[orderedMonths.length - 1];

    while (currentMonth <= lastMonth) {
        filledSeries.push({
            month: currentMonth,
            count: timeline[currentMonth] ? timeline[currentMonth].totalWords : 0
        });
        currentMonth = addMonth(currentMonth);
    }
    return filledSeries;
}

function buildKeywordSeries(files) {
    const timeline = {};
    for (const file of files) {
        // 🚨 FIX: Extract historical dates first, fallback to OS modification if none exist
        const documentDate = (file.dates && file.dates.length > 0) ? file.dates[0] : file.modifiedAt;
        if (!documentDate) continue;

        const key = monthKey(documentDate);
        if (!timeline[key]) timeline[key] = { totalWords: 0, locations: {} };

        timeline[key].totalWords += file.totalWords || (file.words || []).length;
        for (const location of (file.locations || [])) {
            timeline[key].locations[location] = (timeline[key].locations[location] ?? 0) + 1;
        }
    }
    return timeline;
}

function buildPredictiveAnalytics(files) {
    const timeline = buildKeywordSeries(files);
    const orderedMonths = Object.keys(timeline).sort();
    
    const keywordSeries = fillEmptyIntervals(orderedMonths, timeline);
    const nextMonth = orderedMonths.length > 0 ? addMonth(orderedMonths[orderedMonths.length - 1]) : new Date().toISOString().slice(0, 7);

    const locationTotals = {};
    for (const month of orderedMonths) {
        for (const [location, count] of Object.entries(timeline[month]?.locations || {})) {
            locationTotals[location] = (locationTotals[location] ?? 0) + count;
        }
    }

    const topLocation = Object.entries(locationTotals)
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? null;

    return {
        keywordFrequencyForecast: { basis: keywordSeries, forecastMonth: nextMonth, forecastWordCount: forecastNextValue(keywordSeries) },
        locationClusterForecast: { basis: locationTotals, likelyNextHotspot: topLocation }
    };
}

module.exports = { buildPredictiveAnalytics };