const fs = require('node:fs/promises');
const path = require('node:path');

async function generateMarkdownReport(report, outputDirectory) {
    const lines = [
        `# Analytics Report: ${path.basename(report.sourceDirectory)}`,
        '',
        `**Source Directory:** \`${report.sourceDirectory}\``,
        `**Total Files Processed:** ${report.descriptive.fileCount}`,
        '',
        '## 📊 Descriptive Analytics',
        `**Top Locations Detected:** ${report.descriptive.locations.join(', ') || 'None'}`,
        `**Dates Referenced:** ${report.descriptive.dates.join(', ') || 'None'}`,
        '',
        '### Top Keywords',
        ...report.descriptive.topWords.map(w => `- **${w.word}**: ${w.count}`),
        '',
        '## 🔮 Predictive Analytics',
        `**Forecasted Next Hotspot:** ${report.predictive.locationClusterForecast.likelyNextHotspot || 'Unknown'}`,
        `**Next Month Keyword Volume:** ${report.predictive.keywordFrequencyForecast.forecastWordCount} total words expected.`,
        '',
        '## 🛠 Prescriptive Recommendations',
        ...report.prescriptive.recommendations.map(r => `- **[${r.type.toUpperCase()}]**: ${r.message}`)
    ];

    const content = lines.join('\n');
    
    // Ensure the data_exports directory exists safely
    await fs.mkdir(outputDirectory, { recursive: true });
    
    // Create a unique filename based on the current timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(outputDirectory, `report-${timestamp}.md`);
    
    await fs.writeFile(outputPath, content, 'utf8');
    return outputPath;
}

module.exports = { 
    generateMarkdownReport 
};