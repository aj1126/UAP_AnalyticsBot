# System Architecture: File Analytics Bot

## Core Pipeline
1.  **Ingestion Engine:** A directory watcher or manual trigger that scans the source folder, identifying supported file types.
2.  **Extraction Node:** Parses files to strip raw text, creation/modification dates, and embedded metadata. 
3.  **NLP & Entity Recognition Pipeline:** Tokenizes text to build the word glossary, calculates usage rates, and runs Named Entity Recognition (NER) to pull geographic locations and date formats.
4.  **Analytics Engine:** * *Descriptive Sub-system:* Compiles the raw data tables.
    * *Diagnostic Sub-system:* Runs correlation matrices between variables (e.g., Term X spikes when Location Y is mentioned).
    * *Predictive Sub-system:* Utilizes time-series analysis on file dates to forecast future content trends.
    * *Prescriptive Sub-system:* Generates an automated summary report with actionable recommendations.
5.  **Output Layer:** Serializes the final data into a clean JSON format or a visual dashboard.