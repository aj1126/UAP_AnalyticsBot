const fs = require('node:fs/promises');
const path = require('node:path');

async function generateCsvReport(report, exportsDir) {
    await fs.mkdir(exportsDir, { recursive: true });
    const csvPath = path.join(exportsDir, `report-${Date.now()}.csv`);
    
    let csvContent = "Category,Metric,Value\n";
    csvContent += `Descriptive,FileCount,${report.descriptive.fileCount}\n`;
    
    const locations = report.descriptive.locations || report.locations || [];
    csvContent += `Descriptive,UniqueLocations,"${locations.join(', ')}"\n`;
    
    if (report.predictive?.locationClusterForecast) {
         csvContent += `Predictive,LikelyNextHotspot,${report.predictive.locationClusterForecast.likelyNextHotspot}\n`;
    }
    if (report.predictive?.keywordFrequencyForecast) {
         csvContent += `Predictive,ForecastMonth,${report.predictive.keywordFrequencyForecast.forecastMonth}\n`;
         csvContent += `Predictive,ForecastWordCount,${report.predictive.keywordFrequencyForecast.forecastWordCount}\n`;
    }

    await fs.writeFile(csvPath, csvContent, 'utf-8');
    return csvPath;
}

module.exports = { generateCsvReport };