function incrementNestedCount(target, firstKey, secondKey, amount = 1) {
    if (!target[firstKey]) target[firstKey] = {};
    target[firstKey][secondKey] = (target[firstKey][secondKey] ?? 0) + amount;
}

function buildUsageRates(files, groupSelector) {
    const groupedCounts = {};

    for (const file of files) {
        const groups = groupSelector(file);
        if (!groups || groups.length === 0 || !file.words || file.words.length === 0) continue;

        const uniqueWords = new Set(file.words);
        for (const group of groups) {
            for (const word of uniqueWords) {
                incrementNestedCount(groupedCounts, group, word);
            }
        }
    }

    return Object.fromEntries(
        Object.entries(groupedCounts).map(([group, counts]) => {
            const total = Object.values(counts).reduce((sum, count) => sum + count, 0) || 1;
            const topWords = Object.entries(counts)
                .map(([word, count]) => ({ word, usageRate: Number((count / total).toFixed(4)) }))
                .sort((left, right) => right.usageRate - left.usageRate || left.word.localeCompare(right.word))
                .slice(0, 5);
            return [group, topWords];
        })
    );
}

// ✨ TF-IDF Engine
function calculateTFIDF(files) {
    const fileCount = files.length;
    const documentFrequencies = {};

    files.forEach(file => {
        if(!file.words) return;
        const uniqueWords = new Set(file.words.map(w => w.toLowerCase()));
        uniqueWords.forEach(word => { documentFrequencies[word] = (documentFrequencies[word] || 0) + 1; });
    });

    return files.map(file => {
        if(!file.words) return { ...file, topKeywords: [] };
        const tf = {};
        const totalWords = file.words.length;
        
        file.words.forEach(word => { tf[word] = (tf[word] || 0) + 1; });

        const tfidf = Object.keys(tf).map(word => {
            const termFrequency = tf[word] / totalWords;
            const inverseDocumentFrequency = Math.log(fileCount / (1 + documentFrequencies[word]));
            return { word, weight: termFrequency * inverseDocumentFrequency };
        }).sort((a, b) => b.weight - a.weight);

        return { ...file, topKeywords: tfidf.slice(0, 5).map(t => t.word) };
    });
}

function buildDiagnosticAnalytics(files) {
    const filesWithTFIDF = calculateTFIDF(files);
    
    return {
        wordUsageByDate: buildUsageRates(files, (file) => file.dates || []),
        wordUsageByLocation: buildUsageRates(files, (file) => file.locations || []),
        tfIdfAnalysis: filesWithTFIDF.map(f => ({ file: f.fileName, topKeywords: f.topKeywords }))
    };
}

module.exports = { buildDiagnosticAnalytics };