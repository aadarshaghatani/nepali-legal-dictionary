// Global variable to hold dictionary data
let dictionaryData = [];

// Abbreviation mapping (you can expand this list)
const abbreviationMap = {
    // Source languages
    'सं.': 'संस्कृत',
    'अ.': 'अरबी',
    'फा.': 'फारसी',
    'अङ्.': 'अङ्ग्रेजी',
    'प्रा.': 'प्राकृत',
    'नेवा.': 'नेवारी',
    'हि.': 'हिन्दी',
    'उ.': 'उर्दू',
    'पोर्त.': 'पोर्तगाली',
    'तु.': 'तुर्की',
    // Parts of speech
    'ना.': 'नाम',
    'क्रि.': 'क्रिया',
    'वि.': 'विशेषण',
    'क्रिवि.': 'क्रियाविशेषण',
    'नाप.': 'नामपदावली',
    'सर्व.': 'सर्वनाम',
    'संयो.': 'संयोजक',
    // Others
    'हे.': 'हेर्नुहोस्',
    'देखि': 'देखि',
    'सम्म': 'सम्म',
};

// Tooltip elements
let tooltipDiv;

// Function to show tooltip
function showTooltip(text, x, y) {
    if (!tooltipDiv) {
        tooltipDiv = document.getElementById('abbr-tooltip');
    }
    tooltipDiv.textContent = text;
    tooltipDiv.style.left = x + 'px';
    tooltipDiv.style.top = y + 'px';
    tooltipDiv.classList.remove('hidden');
}

// Function to hide tooltip
function hideTooltip() {
    if (!tooltipDiv) {
        tooltipDiv = document.getElementById('abbr-tooltip');
    }
    tooltipDiv.classList.add('hidden');
}

// Attach tooltip events to a given element
function attachTooltip(element, abbr) {
    if (!abbr) return;
    const meaning = abbreviationMap[abbr];
    if (!meaning) return; // only show if we have a meaning

    element.addEventListener('mouseenter', (e) => {
        const rect = e.target.getBoundingClientRect();
        showTooltip(meaning, rect.left, rect.bottom + 5); // position below
    });
    element.addEventListener('mouseleave', hideTooltip);
}

/**
 * Debounce function
 */
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Search function
 */
function searchDictionary(query) {
    if (!query || query.trim() === '') return [];
    const lowerQuery = query.toLowerCase();
    return dictionaryData.filter(entry => 
        entry.word && entry.word.toLowerCase().includes(lowerQuery)
    );
}

/**
 * Display search results
 */
function displaySearchResults(results) {
    const resultsDiv = document.getElementById('search-results');
    const browseDiv = document.getElementById('browse-results');
    if (!resultsDiv) return;

    resultsDiv.innerHTML = '';
    if (browseDiv) browseDiv.innerHTML = '';

    if (!results || results.length === 0) {
        resultsDiv.innerHTML = '<div class="no-results">कुनै परिणाम फेला परेन।</div>';
        return;
    }

    results.forEach(entry => {
        // Build the part of speech and source language string, but we'll wrap each abbreviation
        let metaParts = [];
        if (entry.part_of_speech) metaParts.push(entry.part_of_speech);
        if (entry.source_lang) metaParts.push(`[${entry.source_lang}]`);
        const metaString = metaParts.join(' ');

        const card = document.createElement('div');
        card.className = 'result-card';

        // Word
        const wordElement = document.createElement('div');
        wordElement.className = 'result-word';
        wordElement.textContent = entry.word || '';
        card.appendChild(wordElement);

        // Meta (abbreviations)
        if (metaString) {
            const metaElement = document.createElement('div');
            metaElement.className = 'result-meta';
            // Split metaString into individual tokens (abbreviations)
            const tokens = metaString.split(' ');
            tokens.forEach(token => {
                const span = document.createElement('span');
                span.className = 'result-pos abbr-trigger';
                span.textContent = token;
                // Extract pure abbreviation (remove brackets if any)
                let abbr = token;
                if (abbr.startsWith('[') && abbr.endsWith(']')) {
                    abbr = abbr.slice(1, -1);
                }
                span.setAttribute('data-abbr', abbr);
                attachTooltip(span, abbr);
                metaElement.appendChild(span);
                metaElement.appendChild(document.createTextNode(' ')); // space between
            });
            card.appendChild(metaElement);
        }

        // English equivalent
        if (entry.english && entry.english.trim() !== '') {
            const englishElement = document.createElement('div');
            englishElement.className = 'result-english';
            englishElement.textContent = entry.english;
            card.appendChild(englishElement);
        }

        // Definition
        if (entry.definition) {
            const defElement = document.createElement('div');
            defElement.className = 'result-definition';
            defElement.textContent = entry.definition;
            card.appendChild(defElement);
        }

        // Source citation
        if (entry.source_citation && entry.source_citation.trim() !== '') {
            const sourceElement = document.createElement('div');
            sourceElement.className = 'result-source';
            sourceElement.textContent = entry.source_citation;
            card.appendChild(sourceElement);
        }

        resultsDiv.appendChild(card);
    });
}

/**
 * Get words by first letter
 */
function getWordsByLetter(letter) {
    if (!letter || letter.trim() === '') return [];
    return dictionaryData.filter(entry => 
        entry.word && entry.word.trim().startsWith(letter)
    );
}

/**
 * Display browse results (same as search results layout)
 */
function displayBrowseResults(results) {
    const browseDiv = document.getElementById('browse-results');
    const resultsDiv = document.getElementById('search-results');
    if (!browseDiv) return;

    browseDiv.innerHTML = '';
    if (resultsDiv) resultsDiv.innerHTML = '';

    if (!results || results.length === 0) {
        browseDiv.innerHTML = '<div class="no-results">यस अक्षरमा कुनै शब्द फेला परेन।</div>';
        return;
    }

    results.forEach(entry => {
        let metaParts = [];
        if (entry.part_of_speech) metaParts.push(entry.part_of_speech);
        if (entry.source_lang) metaParts.push(`[${entry.source_lang}]`);
        const metaString = metaParts.join(' ');

        const card = document.createElement('div');
        card.className = 'result-card';

        const wordElement = document.createElement('div');
        wordElement.className = 'result-word';
        wordElement.textContent = entry.word || '';
        card.appendChild(wordElement);

        if (metaString) {
            const metaElement = document.createElement('div');
            metaElement.className = 'result-meta';
            const tokens = metaString.split(' ');
            tokens.forEach(token => {
                const span = document.createElement('span');
                span.className = 'result-pos abbr-trigger';
                span.textContent = token;
                let abbr = token;
                if (abbr.startsWith('[') && abbr.endsWith(']')) {
                    abbr = abbr.slice(1, -1);
                }
                span.setAttribute('data-abbr', abbr);
                attachTooltip(span, abbr);
                metaElement.appendChild(span);
                metaElement.appendChild(document.createTextNode(' '));
            });
            card.appendChild(metaElement);
        }

        if (entry.english && entry.english.trim() !== '') {
            const englishElement = document.createElement('div');
            englishElement.className = 'result-english';
            englishElement.textContent = entry.english;
            card.appendChild(englishElement);
        }

        if (entry.definition) {
            const defElement = document.createElement('div');
            defElement.className = 'result-definition';
            defElement.textContent = entry.definition;
            card.appendChild(defElement);
        }

        if (entry.source_citation && entry.source_citation.trim() !== '') {
            const sourceElement = document.createElement('div');
            sourceElement.className = 'result-source';
            sourceElement.textContent = entry.source_citation;
            card.appendChild(sourceElement);
        }

        browseDiv.appendChild(card);
    });
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    tooltipDiv = document.getElementById('abbr-tooltip');

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        const handleSearch = () => {
            const query = searchInput.value;
            if (query.trim() === '') {
                const initialResults = getWordsByLetter('अ');
                displayBrowseResults(initialResults);
            } else {
                const results = searchDictionary(query);
                displaySearchResults(results);
            }
        };
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }

    // Alphabetical browse click listeners
    const letterSpans = document.querySelectorAll('.browse-letter');
    letterSpans.forEach(span => {
        span.addEventListener('click', function() {
            const letter = this.getAttribute('data-letter');
            if (letter) {
                const results = getWordsByLetter(letter);
                displayBrowseResults(results);
                if (searchInput) searchInput.value = '';
            }
        });
    });

    // Info panel toggles
    const showAbbrBtn = document.getElementById('show-abbr');
    const showAboutBtn = document.getElementById('show-about');
    const infoPanel = document.getElementById('info-panel');

    // Build abbreviation list from the map
    const abbreviations = Object.entries(abbreviationMap).map(([abbr, meaning]) => ({ abbr, meaning }));

    const aboutText = `
        <p>यो कानूनी शब्दकोश नेपाल कानून आयोगद्वारा प्रकाशित आधिकारिक कानूनी शब्दकोशमा आधारित छ।</p>
        <p>यस एपद्लेवारा नेपाली भाषामा प्रयोग हुने कानून सम्बन्धी शब्दहरूको अर्थ, श्रोत र प्रयोगलाई सरल रूपमा प्रस्तुत गर्ने प्रयत्न गरिएको छ ।</p>
    `;

    function showAbbreviations() {
        let html = '<ul class="abbr-list">';
        abbreviations.forEach(item => {
            html += `<li><span class="abbr-term">${item.abbr}</span> – ${item.meaning}</li>`;
        });
        html += '</ul>';
        infoPanel.innerHTML = html;
        infoPanel.classList.remove('hidden');
    }

    function showAbout() {
        infoPanel.innerHTML = aboutText;
        infoPanel.classList.remove('hidden');
    }

    showAbbrBtn.addEventListener('click', () => {
        if (infoPanel.classList.contains('hidden') || !infoPanel.innerHTML.includes('abbr-list')) {
            showAbbreviations();
        } else {
            infoPanel.classList.add('hidden');
        }
    });

    showAboutBtn.addEventListener('click', () => {
        if (infoPanel.classList.contains('hidden') || infoPanel.innerHTML.includes('about')) {
            showAbout();
        } else {
            infoPanel.classList.add('hidden');
        }
    });

    // Fetch dictionary.json
    fetch('dictionary.json')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            dictionaryData = data;
            console.log(`Loaded ${dictionaryData.length} entries.`);
            const initialResults = getWordsByLetter('अ');
            displayBrowseResults(initialResults);
        })
        .catch(error => {
            console.error('Failed to load dictionary:', error);
            const browseDiv = document.getElementById('browse-results');
            if (browseDiv) {
                browseDiv.innerHTML = '<div class="no-results">शब्दकोश लोड गर्न सकिएन।</div>';
            }
        });

});
