const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const chalk = require('chalk');
const xlsx = require('xlsx');  // Importing xlsx for JSON to XLSX conversion

//* EDIT THIS CONST URL_TO_TEST TO REPORT WEBSITE *//
const URL_TO_TEST = 'https://ambiscale.com';
const TARGET_URL = 'https://inspectwp.com/en';
const CURRENT_WP_VERSION = '6.6.1';

(async () => {
    const args = process.argv.slice(2);
    const mode = args[0] || 'fetch'; // Default mode is 'fetch'
    const inputFilePath = args[1]; // Path to the HTML file, if in 'load' mode

    let finalResult = [];

    if (mode === 'fetch') {
        finalResult = await fetchDataAndAnalyze();
    } else if (mode === 'load') {
        if (!inputFilePath) {
            console.error(chalk.red('Please provide a path to the HTML file.'));
            process.exit(1);
        }
        finalResult = await analyzeContent(inputFilePath);
        const jsonFilePath = saveJsonToFile(finalResult, 'finalResult.json');
        convertJsonToXlsx(jsonFilePath, 'data_file.xlsx'); // Save as data_file.xlsx if loading from an HTML file
    } else {
        console.error(chalk.red('Invalid mode. Use "fetch" to fetch data from the website or "load" to load data from an existing HTML file.'));
        process.exit(1);
    }
})();

/**
 * Fetches data from the target URL, analyzes the content, and returns the results.
 * @returns {Promise<Object[]>} The analyzed results as an array of objects.
 */
async function fetchDataAndAnalyze() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    let finalResult = [];

    try {
        await loadPage(page, TARGET_URL);
        await enterUrlAndSubmit(page, URL_TO_TEST);
        await waitForSections(page);

        const pageContent = await getPageContent(page);
        const dataFilePath = saveContentToFile(pageContent, 'data.html');

        finalResult = await analyzeContent(dataFilePath);
    } catch (error) {
        console.error(chalk.red('Error:', error));
    } finally {
        await browser.close();
    }

    const jsonFilePath = saveJsonToFile(finalResult, 'finalResult.json');
    convertJsonToXlsx(jsonFilePath); // Convert the JSON file to XLSX immediately after saving it
}

/**
 * Loads the specified URL in the provided Puppeteer page instance.
 * @param {puppeteer.Page} page - The Puppeteer page instance.
 * @param {string} url - The URL to load.
 */
async function loadPage(page, url) {
    await page.goto(url, { waitUntil: 'networkidle2' });
    console.log(chalk.green('Page loaded'));
}

/**
 * Enters a URL into the form input and submits the form.
 * @param {puppeteer.Page} page - The Puppeteer page instance.
 * @param {string} url - The URL to enter into the form.
 */
async function enterUrlAndSubmit(page, url) {
    const inputSelector = '#inspectwp-checker-form-url-input';
    await page.type(inputSelector, url);
    console.log(chalk.green('URL entered'));

    await page.evaluate((inputSelector) => {
        document.querySelector(inputSelector).form.submit();
    }, inputSelector);
    console.log(chalk.green('Form submitted'));

    try {
        await Promise.race([
            page.waitForSelector('#sectionWordpress', { timeout: 120000 }), // Wait for the main section to load
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 120000 }), // Wait for the page to navigate
        ]);

        const currentUrl = page.url();
        if (currentUrl.includes('/limit-reached')) {
            console.log(chalk.hex('#FFA500')('Wykorzystano dzienny limit raportów na https://inspectwp.com')); // Display the limit message in orange
            process.exit(1); // Exit the script as no further actions are needed
        } else {
            console.log(chalk.green('Navigation successful, content loaded.'));
        }
    } catch (error) {
        console.error(chalk.red('Error during navigation:', error));
        process.exit(1); // Exit if there's an error
    }
}

/**
 * Waits for specific sections to be loaded on the page.
 * @param {puppeteer.Page} page - The Puppeteer page instance.
 */
async function waitForSections(page) {
    const sections = getSections();
    for (const section of sections) {
        await page.waitForSelector(section);
    }
}

/**
 * Returns an array of CSS selectors for the sections to be analyzed.
 * @returns {string[]} An array of CSS selectors for the sections.
 */
function getSections() {
    return [
        '#sectionWordpress',
        '#sectionSecurity',
        '#sectionGdpr',
        '#sectionSeo',
        '#sectionHtml',
        '#sectionContent',
        '#sectionPerformance',
        '#sectionTools',
    ];
}

/**
 * Retrieves the entire content of the currently loaded page.
 * @param {puppeteer.Page} page - The Puppeteer page instance.
 * @returns {Promise<string>} The HTML content of the page.
 */
async function getPageContent(page) {
    return await page.content();
}

/**
 * Saves the provided content to a file and returns the file path.
 * @param {string} content - The content to save.
 * @param {string} filename - The name of the file to save the content to.
 * @returns {string} The file path of the saved content.
 */
function saveContentToFile(content, filename) {
    const filePath = path.join(__dirname, filename);
    fs.writeFileSync(filePath, content);
    console.log(chalk.green(`Page content saved to ${filePath}`));
    return filePath;
}

/**
 * Analyzes the content of the provided HTML file and returns the results.
 * @param {string} filePath - The path to the HTML file to analyze.
 * @returns {Promise<Object[]>} The analyzed results as an array of objects.
 */
async function analyzeContent(filePath) {
    const htmlContent = fs.readFileSync(filePath, 'utf-8');
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;

    const sectionMapping = getSectionMapping();
    const finalResult = [];

    for (const section of getSections()) {
        const sectionElement = document.querySelector(section);
        if (!sectionElement) {
            console.log(chalk.red(`Section ${section} not found`));
            continue;
        }
        console.log(chalk.green(`Analysis completed for ${section}`));

        const result = analyzeSection(sectionElement, section, sectionMapping);
        finalResult.push(...result);

        // Add an empty item between sections
        finalResult.push({ name: '--', note: '--' });
    }

    return finalResult;
}

/**
 * Returns a mapping of section selectors to the corresponding fields to be analyzed.
 * @returns {Object} A mapping of section selectors to their respective fields.
 */
function getSectionMapping() {
    return {
        '#sectionWordpress': [
            'Aktualna wersja Wordpressa? <= WordPress version',
            'Domyślny motyw WordPressa <= WordPress default theme',
            'Stare domyślne motywy WordPressa <= Old WordPress default themes',
            'Włączony skrypt Emoji WordPress <= WordPress Emoji Script',
            'Biblioteka bloków WordPress Gutenberg <= WordPress Gutenberg Block Library',
            'Włączony Gravatar <= Gravatar',
            'Wtyczki, które nie były dalej rozwijane od ponad roku? <= Are plugins used that have not been further developed for more than a year?'
        ],
        '#sectionSecurity': [
            'Plik debug.log WordPress jest widoczny? <= WordPress debug.log file viewable?',
            'Wersja WordPressa widoczna publicznie? <= WordPress version publicly visible?',
            'API REST WordPress publicznie dostępne? <= WordPress REST API publicly available?',
            'Nagłówek Content-Security-Policy <= Content-Security-Policy-Header',
            'Nagłówek Access-Control-Allow-Methods <= Access-Control-Allow-Methods-Header',
            'Nagłówek Access-Control-Allow-Origins <= Access-Control-Allow-Origins-Header',
            'Nagłówek Strict-Transport-Security <= Strict-Transport-Security-Header',
            'Nagłówek Expect-CT <= Expect-CT-Header',
            'Nagłówek Permissions-Policy <= Permissions-Policy-Header',
            'Nagłówek Feature-Policy <= Feature-Policy-Header',
            'Nagłówek Referrer-Policy <= Referrer-Policy-Header',
            'Nagłówek X-Content-Type-Options <= X-Content-Type-Options-Header',
            'Nagłówek X-Frame-Options <= X-Frame-Options-Header',
            'Nagłówek X-XSS-Protection <= X-XSS-Protection-Header'
        ],
        '#sectionGdpr': [
            'Czy jest używany Gravatar? <= Is Gravatar used?',
            'Czy czcionki Google są ładowane z serwerów Google bez zgody? <= Are Google fonts loaded from Google servers without consent?',
            'Czy Google Analytics jest ładowany bez zgody? <= Is Google Analytics loaded without consent?',
            'Czy Mapy Google są ładowane bez zgody? <= Is Google Maps loaded without consent?',
            'Czy Facebook Pixel jest ładowany bez zgody? <= Is Facebook Pixel loaded without consent?',
            'Czy Facebook JavaScript SDK jest ładowany bez zgody? <= Is the Facebook JavaScript SDK loading without consent?',
            'Czy Font Awesome ładuje się z serwerów Font Awesome? <= Does Font Awesome load from the Font Awesome servers?',
            'Czy Font Awesome ładuje się z serwerów Cloudflare? <= Does Font Awesome load from the Cloudflare servers?',
            'Czy czcionki Adobe są ładowane z serwerów Typekit bez zgody? <= Are Adobe fonts loaded from Typekit servers without consent?',
            'Czy Mailchimp jest ładowany z ich serwerów bez zgody? <= Is Mailchimp loaded from their servers without consent?',
            'Czy Intercom jest ładowany bez zgody? <= Is Intercom loaded without consent?',
            'Czy używana jest wtyczka Akismet Anti-Spam? <= Is plugin Akismet Anti-Spam used?',
            'Czy używana jest wtyczka Jetpack? <= Is plugin Jetpack used?',
            'Czy używana jest Google Recaptcha? <= Is Google Recaptcha used?',
            'Czy używane są oficjalne przyciski udostępniania Xing? <= Are the official Xing share buttons used?',
            'Czy jQuery jest ładowane z Google Server/CDN? <= Is jQuery loaded from Google Server/CDN?',
            'Czy jQuery jest ładowane z Microsoft Server/CDN? <= Is jQuery loaded from Microsoft Server/CDN?',
            'Czy czcionki są ładowane z serwerów myfonts.net? <= Are fonts loaded from the myfonts.net servers?'
        ],
        '#sectionSeo': [
            'Liczba obrazów z atrybutem alt <= Number of images with alt attribute',
            'Liczba obrazów bez atrybutu alt <= Number of images without alt attribute',
            'Liczba znaków w tytule <= Title character count',
            'Liczba znaków meta opisu <= Meta Description character count',
            'Kanoniczny adres URL <= Canonical URL',
            'Robots',
            'Znaleziono wiele meta robotów? <= Found multiple meta robots?',
            'Znaleziono wiele tytułów? <= Found multiple titles?',
            'Znaleziono wiele meta opisów? <= Found multiple meta descriptions?',
            'Meta słowa kluczowe w kodzie źródłowym <= Meta Keywords in source code',
            'Znaleziono wiele nagłówków h1? <= Found multiple h1 headings?',
            'Mapa witryny XML <= XML Sitemap',
            'Używana jest wtyczka WordPress SEO? <= Using a WordPress SEO Plugin?',
            'Czy wszystkie warianty protokołu HTTP są przekierowywane do jednego wariantu?'
        ],
        '#sectionHtml': [
            'Doctype',
            'Czy jest użyte HTML5?',
            'Widok',
            'Przestarzałe znaczniki HTML',
            'Favicon',
            'Ikona Apple Touch URL'
        ],
        '#sectionContent': [
            'Hierarchia nagłówków'
        ],
        '#sectionPerformance': [
            'Wersja HTTP <= HTTP version',
            'Kompresja <= Compression'
        ],
        '#sectionTools': []
    };
}

/**
 * Analyzes a specific section of the document based on the section's content.
 * @param {Element} sectionElement - The DOM element of the section to analyze.
 * @param {string} section - The CSS selector of the section.
 * @param {Object} sectionMapping - The mapping of section fields to be analyzed.
 * @returns {Object[]} The analyzed results as an array of objects.
 */
function analyzeSection(sectionElement, section, sectionMapping) {
    if (section === '#sectionContent') {
        return analyzeContentSection(sectionElement);
    } else if (section === '#sectionHtml') {
        return analyzeHtmlSection(sectionElement);
    } else if (section === '#sectionTools') {
        return analyzeToolsSection(sectionElement);
    } else {
        return mapResults(sectionElement, sectionMapping[section]);
    }
}

/**
 * Maps the results of a section analysis to the corresponding fields.
 * @param {Element} sectionElement - The DOM element of the section to analyze.
 * @param {string[]} mappings - The mapping of fields for the section.
 * @returns {Object[]} The mapped results as an array of objects.
 */
function mapResults(sectionElement, mappings) {
    const result = [];
    const tables = sectionElement.querySelectorAll('table');
    for (const table of tables) {
        const rows = table.querySelectorAll('tbody tr');
        for (const row of rows) {
            const cells = row.querySelectorAll('td');
            const item = {
                name: (cells[0]?.textContent.trim()) || '',
            };
            if (cells[1]?.classList.contains('bg-danger')) {
                item.note = 'wymaga poprawy';
            } else if (cells[1]?.classList.contains('bg-success')) {
                item.note = 'wszystko ok';
            } else if (cells[1]?.classList.contains('bg-warning')) {
                item.note = 'wymaga uwagi';
            }
            result.push(item);
        }
    }

    return mappings.map((name) => {
        const [plName, enName] = name.split(' <= ');
        const item = result.find(r => r.name === enName || r.name === plName);

        if (plName === 'Aktualna wersja Wordpressa?') {
            return checkWordPressVersion(sectionElement, plName);
        }

        if (plName === 'Stare domyślne motywy WordPressa') {
            return checkOldDefaultThemes(sectionElement, plName);
        }

        return {
            name: plName,
            note: item ? item.note : 'wszystko ok'
        };
    });
}

/**
 * Checks the WordPress version in the section and returns the analysis result.
 * @param {Element} sectionElement - The DOM element of the section to analyze.
 * @param {string} plName - The name of the field in Polish.
 * @returns {Object} The analysis result for the WordPress version.
 */
function checkWordPressVersion(sectionElement, plName) {
    const wpVersionBadge = Array.from(sectionElement.querySelectorAll('.badge'))
        .find(el => el.textContent.includes('WordPress version'));

    if (wpVersionBadge) {
        const nextSpan = wpVersionBadge.nextElementSibling;
        if (nextSpan?.classList.contains('text-danger')) {
            return { name: plName, note: nextSpan.textContent.trim() === CURRENT_WP_VERSION ? 'wszystko ok' : 'wymaga poprawy' };
        } else {
            return { name: plName, note: 'wersja WP ukryta' };
        }
    }
    return { name: plName, note: 'wersja WP ukryta' };
}

/**
 * Checks for old default WordPress themes and returns the analysis result.
 * @param {Element} sectionElement - The DOM element of the section to analyze.
 * @param {string} plName - The name of the field in Polish.
 * @returns {Object} The analysis result for old default WordPress themes.
 */
function checkOldDefaultThemes(sectionElement, plName) {
	const defaultThemesH3 = Array.from(sectionElement.querySelectorAll('h3'))
		.find(h3 => h3.textContent.includes('WordPress default themes'));

	if (defaultThemesH3) {
		const closestRow = defaultThemesH3.closest('.row');
		const table = closestRow?.querySelector('table');
		if (table) {
			if (table.querySelector('.bg-danger')) {
				return { name: plName, note: 'wymaga poprawy' };
			} else if (table.querySelector('.bg-warning')) {
				return { name: plName, note: 'wymaga uwagi' };
			} else {
				return { name: plName, note: 'wszystko ok' };
			}
		}
	}
	// If no table is found or no relevant elements are found, return 'wszystko ok'
	return { name: plName, note: 'wszystko ok' };
}

/**
 * Analyzes the content section of the document and returns the analysis result.
 * @param {Element} sectionElement - The DOM element of the content section.
 * @returns {Object[]} The analysis result for the content section.
 */
function analyzeContentSection(sectionElement) {
    const headingRows = sectionElement.querySelectorAll('.heading-hierarchy-row');
    let note = 'wszystko ok';
    for (const row of headingRows) {
        if (row.querySelector('.bg-danger')) {
            note = 'wymaga poprawy';
            break;
        } else if (row.querySelector('.bg-warning')) {
            note = 'wymaga uwagi';
        }
    }
    return [{
        name: 'Hierarchia nagłówków',
        note: note
    }];
}

/**
 * Analyzes the HTML section of the document and returns the analysis result.
 * @param {Element} sectionElement - The DOM element of the HTML section.
 * @returns {Object[]} The analysis result for the HTML section.
 */
function analyzeHtmlSection(sectionElement) {
    const result = [];

    // Find and add Doctype
    let item = findBadgeByText(sectionElement, 'Doctype');
    if (item) result.push(item);

    // Find and add HTML5 usage
    item = findBadgeByText(sectionElement, 'Is HTML5 used?');
    if (item) result.push(item);

    // Find and add Viewport
    item = findBadgeByText(sectionElement, 'Viewport');
    if (item) result.push(item);

    // Add Deprecated HTML Tags
    result.push({
        name: 'Przestarzałe znaczniki HTML',
        note: checkDeprecatedHtmlTags(sectionElement)
    });

    // Find and add Favicon
    item = findBadgeByText(sectionElement, 'Favicon');
    if (item) result.push(item);

    // Find and add Apple Touch Icon URL
    item = findBadgeByText(sectionElement, 'Apple Touch Icon URL');
    if (item) result.push(item);

    return result;
}

/**
 * Finds a badge element by its text content and returns the analysis result.
 * @param {Element} sectionElement - The DOM element of the section to analyze.
 * @param {string} searchText - The text to search for in the badge elements.
 * @returns {Object|null} The analysis result for the badge, or null if not found.
 */
function findBadgeByText(sectionElement, searchText) {
    const badges = sectionElement.querySelectorAll('.badge');
    for (const badge of badges) {
        if (badge.textContent.includes(searchText)) {
            return analyzeHtmlBadge(badge);
        }
    }
    return null; // Return null if no matching badge is found
}

/**
 * Analyzes an HTML badge element and returns the result.
 * @param {Element} badgeElement - The DOM element of the badge to analyze.
 * @returns {Object} The analysis result for the badge.
 */
function analyzeHtmlBadge(badgeElement) {
    const textContent = badgeElement.textContent;
    let name, note = 'wszystko ok';

    if (textContent.includes('Doctype')) {
        name = 'Doctype';
    } else if (textContent.includes('Is HTML5 used?')) {
        name = 'Czy jest użyte HTML5?';
    } else if (textContent.includes('Viewport')) {
        name = 'Widok';
    } else if (textContent.includes('Favicon')) {
        name = 'Favicon';
    } else if (textContent.includes('Apple Touch Icon URL')) {
        name = 'Ikona Apple Touch URL';
    }

    if (name) {
        const sibling = badgeElement.nextElementSibling;

        if (name === 'Favicon' || name === 'Ikona Apple Touch URL') {
            // Check for <img> tag only for Favicon and Apple Touch Icon URL
            if (!sibling.querySelector('img')) {
                note = 'wymaga poprawy';
            }
        } else {
            // Check for text-danger or text-warning class for other cases
            if (sibling?.classList.contains('text-danger')) {
                note = 'wymaga poprawy';
            } else if (sibling?.classList.contains('text-warning')) {
                note = 'wymaga uwagi';
            }
        }

        return { name, note };
    }

    return null; // Return null if no matching badge is found
}

/**
 * Checks for deprecated HTML tags in the section and returns the analysis result.
 * @param {Element} sectionElement - The DOM element of the section to analyze.
 * @returns {string} The analysis result for deprecated HTML tags.
 */
function checkDeprecatedHtmlTags(sectionElement) {
    const deprecatedHTMLTags = Array.from(sectionElement.querySelectorAll('h3'))
        .filter(h3 => h3.textContent.includes('Deprecated HTML'));

    let note = 'wszystko ok';

    if (deprecatedHTMLTags.length > 0) {
        const deprecatedHTMLTagsLabel = deprecatedHTMLTags[0].closest('.col-12')?.nextElementSibling;

        if (deprecatedHTMLTagsLabel?.classList.contains('col-12')) {
            const labelSpan = deprecatedHTMLTagsLabel.querySelector('span');

            if (labelSpan?.classList.contains('text-danger')) {
                note = 'wymaga poprawy';
            } else if (labelSpan?.classList.contains('text-warning')) {
                note = 'wymaga uwagi';
            }
        }
    }

    return note;
}

/**
 * Analyzes the tools section of the document and returns the analysis result.
 * @param {Element} sectionElement - The DOM element of the tools section.
 * @returns {Object[]} The analysis result for the tools section.
 */
function analyzeToolsSection(sectionElement) {
    const tools = [];
    const h5Elements = sectionElement.querySelectorAll('h5');
    for (const h5 of h5Elements) {
        tools.push({
            name: '--',
            note: h5.textContent.trim()
        });
    }
    return tools;
}

/**
 * Saves the provided JSON data to a file.
 * @param {Object} jsonData - The JSON data to save.
 * @param {string} filename - The name of the file to save the JSON data to.
 * @returns {string} The file path of the saved JSON file.
 */
function saveJsonToFile(jsonData, filename) {
    const filePath = path.join(__dirname, filename);
    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
    console.log(chalk.green(`JSON output saved to ${filePath}`));
    return filePath;
}

/**
 * Converts a JSON file to an XLSX file and saves it in the /reports/ directory.
 * @param {string} jsonFilePath - The path to the JSON file to convert.
 * @param {string} [xlsxFileName] - Optional custom XLSX file name.
 */
function convertJsonToXlsx(jsonFilePath, xlsxFileName = null) {
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
    
    const worksheet = xlsx.utils.json_to_sheet(jsonData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Report');

    const fileName = xlsxFileName || `${URL_TO_TEST.replace(/https?:\/\//, '').replace(/[\/:]/g, '_')}.xlsx`;
    const xlsxFilePath = path.join(__dirname, 'reports', fileName);

    // Ensure the /reports/ directory exists
    if (!fs.existsSync(path.join(__dirname, 'reports'))) {
        fs.mkdirSync(path.join(__dirname, 'reports'));
    }

    xlsx.writeFile(workbook, xlsxFilePath);
    console.log(chalk.green(`XLSX output saved to ${xlsxFilePath}`));
}
