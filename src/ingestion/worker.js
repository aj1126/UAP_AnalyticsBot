const { parentPort } = require('node:worker_threads');
const fs = require('node:fs/promises');

parentPort.on('message', async (task) => {
    try {
        const content = await fs.readFile(task.filePath, 'utf-8');
        const stats = await fs.stat(task.filePath);
        
        const dates = [];
        const locations = [];
        const words = content.replace(/[^\w\s]/g, '').toLowerCase().split(/\s+/).filter(Boolean);

        const dateMatch = content.match(/Date:\s*(\d{4}-\d{2}-\d{2})/i);
        if (dateMatch) dates.push(dateMatch[1]);

        const locMatch = content.match(/Location:\s*([A-Za-z]+)/i);
        if (locMatch) {
            // SPRINT 2 Task 1: Named Entity Token Unification (Force Title Case to prevent ROSWELL vs roswell fragmentation)
            const loc = locMatch[1].charAt(0).toUpperCase() + locMatch[1].slice(1).toLowerCase();
            locations.push(loc);
        }

        parentPort.postMessage({
            success: true,
            filePath: task.filePath,
            fingerprint: task.fingerprint,
            result: {
                fileName: task.filePath.split(/[/\\]/).pop(),
                modifiedAt: stats.mtime.toISOString(),
                content,
                words,
                dates,
                locations
            }
        });
    } catch (error) {
        parentPort.postMessage({ success: false, filePath: task.filePath, error: error.message });
    }
});