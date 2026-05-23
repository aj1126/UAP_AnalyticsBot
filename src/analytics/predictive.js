function monthKey(dateString) {
    return dateString.slice(0, 7);
}

function average(values) {
    if (values.length === 0) {
        return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function forecastNextValue(series) {
    if (series.length === 0) {
        return 0;
    }

    if (series.length === 1) {
        return series[0].count;
    }

    const deltas = [];
    for (let index = 1; index < series.length; index += 1) {
        deltas.push(series[index].count - series[index - 1].count);
    }

    return Math.max(0, Math.round(series[series.length - 1].count + average(deltas)));
}

function addMonth(month) {
    const [year, monthNumber] = month.split('-').map(Number);
    const nextDate = new Date(Date.UTC(year, monthNumber, 1));
    return nextDate.toISOString().slice(0, 7);
}

function buildKeywordSeries(files) {
    const timeline = {};

    for (const file of files) {
        const key = monthKey(file.modifiedAt);
        if (!timeline[key]) {
            timeline[key] = { totalWords: 0, locations: {} };
        }

        timeline[key].totalWords += file.words.length;
        for (const location of file.locations) {
            timeline[key].locations[location] = (timeline[key].locations[location] ?? 0) + 1;
        }
    }

    return timeline;
}

function buildPredictiveAnalytics(files) {
    const timeline = buildKeywordSeries(files);
    const orderedMonths = Object.keys(timeline).sort();
    const keywordSeries = orderedMonths.map((month) => ({ month, count: timeline[month].totalWords }));
    const nextMonth = orderedMonths.length > 0 ? addMonth(orderedMonths[orderedMonths.length - 1]) : new Date().toISOString().slice(0, 7);

    const locationTotals = {};
    for (const month of orderedMonths) {
        for (const [location, count] of Object.entries(timeline[month].locations)) {
            locationTotals[location] = (locationTotals[location] ?? 0) + count;
        }
    }

    const topLocation = Object.entries(locationTotals)
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? null;

    return {
        keywordFrequencyForecast: {
            basis: keywordSeries,
            forecastMonth: nextMonth,
            forecastWordCount: forecastNextValue(keywordSeries)
        },
        locationClusterForecast: {
            basis: locationTotals,
            likelyNextHotspot: topLocation
        }
    };
}

module.exports = {
    buildPredictiveAnalytics
};
