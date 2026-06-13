function sortEntriesDescending(record) {
    return Object.entries(record).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

function buildDescriptiveAnalytics(files) {
    const allDates = files.flatMap((file) => file.dates || []);
    const allLocations = files.flatMap((file) => file.locations || []);

    const globalWordFrequency = {};
    const glossarySet = new Set();

    // Iterate through files using the new memory-efficient object format
    files.forEach((file) => {
        if (file.wordFrequency) {
            for (const [word, count] of Object.entries(file.wordFrequency)) {
                globalWordFrequency[word] = (globalWordFrequency[word] || 0) + count;
                glossarySet.add(word);
            }
        } else if (file.words) { 
            // Backwards compatibility layer
            for (const word of file.words) {
                globalWordFrequency[word] = (globalWordFrequency[word] || 0) + 1;
                glossarySet.add(word);
            }
        }
    });

    return {
        fileCount: files.length,
        glossary: [...glossarySet].sort(),
        wordFrequency: globalWordFrequency,
        topWords: sortEntriesDescending(globalWordFrequency).slice(0, 10).map(([word, count]) => ({ word, count })),
        dates: [...new Set(allDates)].sort(),
        locations: [...new Set(allLocations)].sort(),
        files: files.map((file) => ({
            path: file.relativePath,
            extension: file.extension, 
            size: file.size,
            modifiedAt: file.modifiedAt,
            wordCount: file.totalWords || (file.words ? file.words.length : 0),
            dates: file.dates,
            locations: file.locations,
            metadata: file.metadata || {} 
        }))
    };
}

module.exports = {
    buildDescriptiveAnalytics
};