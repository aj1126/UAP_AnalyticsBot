# Copilot System Instructions: File Analytics Bot

## Project Overview
This application scans a designated local source folder, extracts text and metadata, and generates a comprehensive data analysis covering descriptive, diagnostic, predictive, and prescriptive analytics.

## Architectural Rules
* **Modular Design:** Separate the file ingestion logic from the data processing and analytics engines.
* **Non-Destructive Operations:** The bot must operate with strict read-only access to the source folder. Never modify, move, or delete the original ingested files.
* **Modern Paradigms:** Default to asynchronous file reading streams to handle large datasets without memory blocking. 

## Analytics Implementation Requirements
When writing analytical functions, categorize them strictly into these four tiers:
1.  **Descriptive:** Word glossaries, frequency counters, and extraction of hard dates/locations (What happened?).
2.  **Diagnostic:** Correlation maps linking specific word usage rates to specific dates or locations (Why did it happen?).
3.  **Predictive:** Trend forecasting based on historical file timestamps, projecting future keyword frequencies or location clusters (What is likely to happen?).
4.  **Prescriptive:** Actionable output generation, such as recommending folder restructuring based on topic clusters or flagging missing data points (What should we do?).