function countBy(items) {
    return items.reduce((counts, item) => {
        counts[item] = (counts[item] ?? 0) + 1;
        return counts;
    }, {});
}

function sortEntriesDescending(record) {
    return Object.entries(record).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

function buildDescriptiveAnalytics(files) {
    const allWords = files.flatMap((file) => file.words);
    const allDates = files.flatMap((file) => file.dates);
    const allLocations = files.flatMap((file) => file.locations);

    const wordFrequency = countBy(allWords);

    return {
        fileCount: files.length,
        glossary: [...new Set(allWords)].sort(),
        wordFrequency,
        topWords: sortEntriesDescending(wordFrequency).slice(0, 10).map(([word, count]) => ({ word, count })),
        dates: [...new Set(allDates)].sort(),
        locations: [...new Set(allLocations)].sort(),
        files: files.map((file) => ({
            path: file.relativePath,
            extension: file.extension, // <-- FIX: Added extension propagation
            size: file.size,
            modifiedAt: file.modifiedAt,
            wordCount: file.words.length,
            dates: file.dates,
            locations: file.locations,
            metadata: file.metadata || {} 
        }))
    };
}

module.exports = {
    buildDescriptiveAnalytics
};