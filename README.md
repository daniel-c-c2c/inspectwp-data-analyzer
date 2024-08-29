
# Website Data Analyzer

This project is a Node.js script that automates the process of fetching and analyzing website data using Puppeteer. It allows you to analyze HTML content from a website, save the results as a JSON file, and convert the JSON data into an Excel file (XLSX).

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
  - [Fetch and Analyze Website Data](#fetch-and-analyze-website-data)
  - [Load and Analyze Local HTML File](#load-and-analyze-local-html-file)
  - [Run the Script](#run-the-script)
- [Output](#output)

## Features

- Fetch and analyze data from a target website.
- Load and analyze data from an existing HTML file.
- Save the analysis results as a JSON file.
- Automatically convert the JSON data to an XLSX file.
- Generate custom file names for the XLSX output based on the website URL or a provided name.

## Prerequisites

Before running this script, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v14 or higher)
- [npm](https://www.npmjs.com/) (Node Package Manager)

## Installation

1. Clone the repository:

   ```bash
   git clone git@github.com:daniel-c-c2c/inspectwp-data-analyzer.git
   cd inspectwp-data-analyzer
   ```

2. Install the necessary dependencies:

   ```bash
   npm install
   ```

## Usage

### Fetch and Analyze Website Data

To fetch data from a website, analyze it, and save the results as JSON and XLSX files, run:

```bash
node index.js
```

This will:

- Fetch data from the target website specified by the `URL_TO_TEST` constant.
- Analyze the website content.
- Save the analysis results as `finalResult.json`.
- Convert the JSON data to an XLSX file and save it in the `/reports/` directory.

### Load and Analyze Local HTML File

To load and analyze an existing HTML file, then save the results as JSON and XLSX files, run:

```bash
node index.js load data.html
```

This will:

- Load the HTML content from `data.html`.
- Analyze the content.
- Save the analysis results as `finalResult.json`.
- Convert the JSON data to `data_file.xlsx` and save it in the `/reports/` directory.

### Run the Script

To execute the script:

1. **Fetch and Analyze**: This mode fetches and analyzes data from the website.

   ```bash
   node index.js
   ```

2. **Load and Analyze**: This mode loads data from an HTML file and performs the analysis.

   ```bash
   node index.js load data.html
   ```

   Replace `data.html` with the path to your HTML file.

## Output

### JSON Output

The script saves the analysis results as a JSON file named `finalResult.json` in the project directory.

### XLSX Output

- When fetching data directly from a website, the XLSX file is saved in the `/reports/` directory with a name based on the website URL (e.g., `example_com.xlsx`).
- When loading from an existing HTML file, the XLSX file is saved as `data_file.xlsx` in the `/reports/` directory.
