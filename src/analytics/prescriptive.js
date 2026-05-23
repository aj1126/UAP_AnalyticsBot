function buildPrescriptiveAnalytics(files, descriptiveAnalytics) {
    const missingMetadataFiles = files
        .filter((file) => file.dates.length === 0 || file.locations.length === 0)
        .map((file) => file.relativePath);

    const recommendations = [];

    if (missingMetadataFiles.length > 0) {
        recommendations.push({
            type: 'missing-data',
            message: 'Add explicit dates and locations to improve downstream correlation and forecasting accuracy.',
            files: missingMetadataFiles
        });
    }

    if (descriptiveAnalytics.locations.length > 1) {
        recommendations.push({
            type: 'folder-restructure',
            message: 'Consider grouping files into location-based subfolders to improve topic clustering and navigation.',
            locations: descriptiveAnalytics.locations
        });
    }

    if (recommendations.length === 0) {
        recommendations.push({
            type: 'status',
            message: 'No immediate prescriptive actions detected from the current dataset.'
        });
    }

    return {
        recommendations
    };
}

module.exports = {
    buildPrescriptiveAnalytics
};
