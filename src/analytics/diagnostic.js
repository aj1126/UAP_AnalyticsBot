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

// ✨ SPRINT 2 Task 2: Vector Cross-Referencing Math Engine
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
        if(!file.words) return;
        const uniqueWords = new Set(file.words.map(w => w.toLowerCase()));
        uniqueWords.forEach(word => { documentFrequencies[word] = (documentFrequencies[word] || 0) + 1; });
    });

    // Pass 1: Build Multidimensional Vectors
    const vectorizedFiles = files.map(file => {
        if(!file.words) return { ...file, topKeywords: [], vector: {} };
        const tf = {};
        const totalWords = file.words.length;
        
        file.words.forEach(word => { tf[word] = (tf[word] || 0) + 1; });

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

    // ✨ Pass 2: Semantic Cross-Linking Loop
    return vectorizedFiles.map(fileA => {
        const related = [];
        vectorizedFiles.forEach(fileB => {
            if (fileA.fileName !== fileB.fileName) {
                const score = calculateCosineSimilarity(fileA.vector, fileB.vector);
                if (score > 0.05) { // Threshold for correlation relevancy
                    related.push({ match: fileB.fileName, correlationScore: Number(score.toFixed(4)) });
                }
            }
        });
        
        related.sort((a, b) => b.correlationScore - a.correlationScore);
        
        return { 
            fileName: fileA.fileName, 
            topKeywords: fileA.topKeywords,
            relatedDocuments: related.slice(0, 3) // Return Top 3 Matches
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