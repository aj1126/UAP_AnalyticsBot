function incrementNestedCount(target, firstKey, secondKey, amount = 1) {
    if (!target[firstKey]) {
        target[firstKey] = {};
    }

    target[firstKey][secondKey] = (target[firstKey][secondKey] ?? 0) + amount;
}

function buildUsageRates(files, groupSelector) {
    const groupedCounts = {};

    for (const file of files) {
        const groups = groupSelector(file);
        if (groups.length === 0 || file.words.length === 0) {
            continue;
        }

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

function buildDiagnosticAnalytics(files) {
    return {
        wordUsageByDate: buildUsageRates(files, (file) => file.dates),
        wordUsageByLocation: buildUsageRates(files, (file) => file.locations)
    };
}

module.exports = {
    buildDiagnosticAnalytics
};
