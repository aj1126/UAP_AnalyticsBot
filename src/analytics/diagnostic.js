function incrementNestedCount(target, firstKey, secondKey, amount = 1) {
    if (!target[firstKey]) target[firstKey] = {};
    target[firstKey][secondKey] = (target[firstKey][secondKey] ?? 0) + amount;
}

function buildUsageRates(files, groupSelector) {
    const groupedCounts = {};
    for (const file of files) {
        const groups = groupSelector(file);
        const uniqueWords = file.uniqueWords || (file.words ? [...new Set(file.words)] : []);
        
        if (!groups || groups.length === 0 || uniqueWords.length === 0) continue;

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

function calculateCosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (const word in vecA) {
        dotProduct += (vecA[word] || 0) * (vecB[word] || 0);
        normA += Math.pow(vecA[word], 2);
    }
    for (const word in vecB) {
        normB += Math.pow(vecB[word], 2);
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function calculateTFIDF(files) {
    const fileCount = files.length;
    const documentFrequencies = {};

    files.forEach(file => {
        const unique = file.uniqueWords || (file.words ? [...new Set(file.words)] : []);
        unique.forEach(word => { documentFrequencies[word] = (documentFrequencies[word] || 0) + 1; });
    });

    // Pass 1: Build Multidimensional Vectors
    const vectorizedFiles = files.map(file => {
        let tf = file.wordFrequency || {};
        let totalWords = file.totalWords || 1;

        // Backwards compatibility layer for un-cleared caches
        if (!file.wordFrequency && file.words) {
            file.words.forEach(word => { tf[word] = (tf[word] || 0) + 1; });
            totalWords = file.words.length || 1;
        }

        const vector = {};
        const tfidf = Object.keys(tf).map(word => {
            const termFrequency = tf[word] / totalWords;
            const inverseDocumentFrequency = Math.log(fileCount / (1 + documentFrequencies[word]));
            const weight = termFrequency * inverseDocumentFrequency;
            vector[word] = weight;
            return { word, weight };
        }).sort((a, b) => b.weight - a.weight);

        return { ...file, topKeywords: tfidf.slice(0, 5).map(t => t.word), vector };
    });

    // ✨ Pass 2: Semantic Cross-Linking Loop (🚀 Optimised to prevent thread blocking)
    const MAX_CROSS_REF = 500;
    const targetFiles = vectorizedFiles.slice(0, MAX_CROSS_REF);
    const relatedByIndex = Array.from({ length: vectorizedFiles.length }, () => []);

    const getFileLabel = (file) => file.fileName || file.relativePath || 'unknown';
    
    for (let indexA = 0; indexA < targetFiles.length; indexA += 1) {
        for (let indexB = indexA + 1; indexB < targetFiles.length; indexB += 1) {
            const fileA = targetFiles[indexA];
            const fileB = targetFiles[indexB];
            const score = calculateCosineSimilarity(fileA.vector, fileB.vector);

            if (score > 0.05) {
                const correlationScore = Number(score.toFixed(4));
                relatedByIndex[indexA].push({ match: getFileLabel(fileB), correlationScore });
                relatedByIndex[indexB].push({ match: getFileLabel(fileA), correlationScore });
            }
        }
    }

    return vectorizedFiles.map((file, index) => {
        const related = relatedByIndex[index]
            ? relatedByIndex[index].sort((left, right) => right.correlationScore - left.correlationScore).slice(0, 3)
            : [];

        return {
            fileName: getFileLabel(file),
            topKeywords: file.topKeywords,
            relatedDocuments: related
        };
    });
}

function buildDiagnosticAnalytics(files) {
    const tfIdfAnalysis = calculateTFIDF(files);
    
    return {
        wordUsageByDate: buildUsageRates(files, (file) => file.dates || []),
        wordUsageByLocation: buildUsageRates(files, (file) => file.locations || []),
        semanticAnalysis: tfIdfAnalysis
    };
}

module.exports = { buildDiagnosticAnalytics };