const fs = require('node:fs/promises');
const path = require('node:path');

function escapeCsvCell(value) {
    const stringValue = String(value ?? '');
    const sanitizedValue = /^[=+\-@]/.test(stringValue) ? `'${stringValue}` : stringValue;
    return `"${sanitizedValue.replace(/"/g, '""')}"`;
}

function buildCsvRow(...cells) {
    return `${cells.map(escapeCsvCell).join(',')}\n`;
}

async function generateCsvReport(report, exportsDir) {
    await fs.mkdir(exportsDir, { recursive: true });
    const csvPath = path.join(exportsDir, `report-${Date.now()}.csv`);
    
    let csvContent = buildCsvRow('Category', 'Metric', 'Value');
    csvContent += buildCsvRow('Descriptive', 'FileCount', report.descriptive.fileCount);
    
    const locations = report.descriptive.locations || report.locations || [];
    csvContent += buildCsvRow('Descriptive', 'UniqueLocations', locations.join(', '));
    
    if (report.predictive?.locationClusterForecast) {
         csvContent += buildCsvRow('Predictive', 'LikelyNextHotspot', report.predictive.locationClusterForecast.likelyNextHotspot);
    }
    if (report.predictive?.keywordFrequencyForecast) {
         csvContent += buildCsvRow('Predictive', 'ForecastMonth', report.predictive.keywordFrequencyForecast.forecastMonth);
         csvContent += buildCsvRow('Predictive', 'ForecastWordCount', report.predictive.keywordFrequencyForecast.forecastWordCount);
    }

    await fs.writeFile(csvPath, csvContent, 'utf-8');
    return csvPath;
}

module.exports = { generateCsvReport };