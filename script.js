// ── State ────────────────────────────────────────────────────────────────────
let dictionaryData = [];
let activeLetter = null;
let activePanel = null; // 'abbr' | 'about' | null
let focusedCardIndex = -1;

// ── Abbreviation map ──────────────────────────────────────────────────────────
const abbreviationMap = {
    'सं.':     'संस्कृत',
    'अ.':      'अरबी',
    'फा.':     'फारसी',
    'अङ्.':    'अङ्ग्रेजी',
    'प्रा.':   'प्राकृत',
    'नेवा.':   'नेवारी',
    'हि.':     'हिन्दी',
    'उ.':      'उर्दू',
    'पोर्त.':  'पोर्तगाली',
    'तु.':     'तुर्की',
    'ना.':     'नाम',
    'क्रि.':   'क्रिया',
    'वि.':     'विशेषण',
    'क्रिवि.': 'क्रियाविशेषण',
    'नाप.':    'नामपदावली',
    'सर्व.':   'सर्वनाम',
    'संयो.':   'संयोजक',
    'हे.':     'हेर्नुहोस्',
    'देखि':    'देखि',
    'सम्म':    'सम्म',
};

// ── Tooltip ───────────────────────────────────────────────────────────────────
let tooltipDiv;

function showTooltip(text, x, y) {
    tooltipDiv.textContent = text;
    tooltipDiv.style.left = x + 'px';
    tooltipDiv.style.top  = y + 'px';
    tooltipDiv.classList.remove('hidden');
}

function hideTooltip() {
    tooltipDiv.classList.add('hidden');
}

function attachTooltip(el, abbr) {
    const meaning = abbreviationMap[abbr];
    if (!meaning) return;
    el.addEventListener('mouseenter', e => {
        const r = e.target.getBoundingClientRect();
        showTooltip(meaning, r.left, r.bottom + 6);
    });
    el.addEventListener('mouseleave', hideTooltip);
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/**
 * Escape a string for use in a RegExp.
 */
function escapeRE(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Wrap occurrences of `query` inside `text` with <mark> tags.
 * Returns a document fragment built from the marked-up string.
 */
function highlight(text, query) {
    if (!query || !text) {
        const span = document.createElement('span');
        span.textContent = text || '';
        return span;
    }
    const re = new RegExp(`(${escapeRE(query)})`, 'gi');
    const parts = text.split(re);
    const frag = document.createDocumentFragment();
    parts.forEach(part => {
        if (re.test(part)) {
            const mark = document.createElement('mark');
            mark.textContent = part;
            frag.appendChild(mark);
        } else {
            frag.appendChild(document.createTextNode(part));
        }
        re.lastIndex = 0; // reset after .test()
    });
    return frag;
}

// ── Ranked search ─────────────────────────────────────────────────────────────
/**
 * Search returns entries ranked by match quality:
 *   1 — exact word match
 *   2 — word starts with query
 *   3 — word contains query (not at start)
 *   4 — english/definition contains query
 * Within each tier, original order is preserved.
 */
function searchDictionary(query) {
    if (!query || !query.trim()) return [];
    const q = query.trim().toLowerCase();

    const tier1 = [], tier2 = [], tier3 = [], tier4 = [];

    dictionaryData.forEach(entry => {
        const word = (entry.word || '').toLowerCase();
        const def  = (entry.definition || '').toLowerCase();
        const eng  = (entry.english || '').toLowerCase();

        if (word === q)                    return tier1.push(entry);
        if (word.startsWith(q))            return tier2.push(entry);
        if (word.includes(q))              return tier3.push(entry);
        if (def.includes(q) || eng.includes(q)) return tier4.push(entry);
    });

    // Tag each entry with match class so CSS can optionally style by tier
    tier1.forEach(e => e._matchTier = 'match-word');
    tier2.forEach(e => e._matchTier = 'match-word-start');
    tier3.forEach(e => e._matchTier = 'match-word');
    tier4.forEach(e => e._matchTier = 'match-content');

    return [...tier1, ...tier2, ...tier3, ...tier4];
}

function getWordsByLetter(letter) {
    if (!letter) return [];
    return dictionaryData.filter(e => e.word && e.word.trim().startsWith(letter));
}

// ── Render cards ──────────────────────────────────────────────────────────────
/**
 * Single unified render function.
 * @param {Array}   results  - array of entries
 * @param {string}  targetId - 'search-results' or 'browse-results'
 * @param {string}  clearId  - the other container to empty
 * @param {string}  emptyMsg - message when results is empty
 * @param {string}  query    - current search query (for highlighting); pass '' to skip
 */
function renderResults(results, targetId, clearId, emptyMsg, query = '') {
    const target = document.getElementById(targetId);
    const other  = document.getElementById(clearId);
    if (!target) return;

    target.innerHTML = '';
    if (other) other.innerHTML = '';

    updateResultCount(targetId, results.length, query);

    if (!results.length) {
        target.innerHTML = `<div class="no-results">${emptyMsg}</div>`;
        return;
    }

    const frag = document.createDocumentFragment();

    results.forEach((entry, i) => {
        const card = document.createElement('div');
        card.className = `result-card ${entry._matchTier || ''}`;
        card.setAttribute('role', 'listitem');
        card.setAttribute('tabindex', '0');
        card.dataset.index = i;

        // Word (with highlight)
        const wordEl = document.createElement('div');
        wordEl.className = 'result-word';
        wordEl.appendChild(highlight(entry.word || '', query));
        card.appendChild(wordEl);

        // Meta
        const metaParts = [];
        if (entry.part_of_speech) metaParts.push(entry.part_of_speech);
        if (entry.source_lang)    metaParts.push(`[${entry.source_lang}]`);

        if (metaParts.length) {
            const metaEl = document.createElement('div');
            metaEl.className = 'result-meta';
            metaParts.join(' ').split(' ').forEach(token => {
                const span = document.createElement('span');
                span.className = 'result-pos abbr-trigger';
                span.textContent = token;
                let abbr = token;
                if (abbr.startsWith('[') && abbr.endsWith(']')) abbr = abbr.slice(1, -1);
                span.setAttribute('data-abbr', abbr);
                attachTooltip(span, abbr);
                metaEl.appendChild(span);
                metaEl.appendChild(document.createTextNode(' '));
            });
            card.appendChild(metaEl);
        }

        // English
        if (entry.english && entry.english.trim()) {
            const engEl = document.createElement('div');
            engEl.className = 'result-english';
            engEl.appendChild(highlight(entry.english, query));
            card.appendChild(engEl);
        }

        // Definition
        if (entry.definition) {
            const defEl = document.createElement('div');
            defEl.className = 'result-definition';
            defEl.appendChild(highlight(entry.definition, query));
            card.appendChild(defEl);
        }

        // Source
        if (entry.source_citation && entry.source_citation.trim()) {
            const srcEl = document.createElement('div');
            srcEl.className = 'result-source';
            srcEl.textContent = entry.source_citation;
            card.appendChild(srcEl);
        }

        frag.appendChild(card);
    });

    target.appendChild(frag);
}

// ── Result count ──────────────────────────────────────────────────────────────
function updateResultCount(targetId, count, query) {
    const countEl = document.getElementById('result-count');
    if (!countEl) return;

    if (targetId === 'search-results' && query) {
        countEl.textContent = count
            ? `${count} परिणाम फेला पर्‍यो`
            : '';
    } else {
        countEl.textContent = '';
    }
}

// ── Active letter state ───────────────────────────────────────────────────────
function setActiveLetter(letter) {
    document.querySelectorAll('.browse-letter').forEach(el => {
        el.classList.toggle('active', el.dataset.letter === letter);
    });
    activeLetter = letter;
}

// ── Info panel ────────────────────────────────────────────────────────────────
const aboutHTML = `
    <p>यो कानूनी शब्दकोश नेपाल कानून आयोगद्वारा प्रकाशित आधिकारिक कानूनी शब्दकोशमा आधारित छ।</p>
    <p>यस एपद्वारा नेपाली भाषामा प्रयोग हुने कानून सम्बन्धी शब्दहरूको अर्थ, श्रोत र प्रयोगलाई सरल रूपमा प्रस्तुत गर्ने प्रयत्न गरिएको छ।</p>
`;

function buildAbbrHTML() {
    let html = '<ul class="abbr-list">';
    Object.entries(abbreviationMap).forEach(([abbr, meaning]) => {
        html += `<li><span class="abbr-term">${abbr}</span>${meaning}</li>`;
    });
    return html + '</ul>';
}

function togglePanel(panel, contentHTML) {
    const infoPanel   = document.getElementById('info-panel');
    const abbrBtn     = document.getElementById('show-abbr');
    const aboutBtn    = document.getElementById('show-about');

    if (activePanel === panel) {
        // Close
        infoPanel.classList.add('hidden');
        infoPanel.innerHTML = '';
        activePanel = null;
        abbrBtn.classList.remove('active');
        aboutBtn.classList.remove('active');
    } else {
        // Open (or switch)
        infoPanel.innerHTML = contentHTML;
        infoPanel.classList.remove('hidden');
        activePanel = panel;
        abbrBtn.classList.toggle('active', panel === 'abbr');
        aboutBtn.classList.toggle('active', panel === 'about');
    }
}

// ── Keyboard navigation ───────────────────────────────────────────────────────
function getVisibleCards() {
    const searchCards = [...document.querySelectorAll('#search-results .result-card')];
    const browseCards = [...document.querySelectorAll('#browse-results .result-card')];
    return searchCards.length ? searchCards : browseCards;
}

function moveFocus(direction) {
    const cards = getVisibleCards();
    if (!cards.length) return;
    focusedCardIndex = Math.max(0, Math.min(cards.length - 1, focusedCardIndex + direction));
    cards[focusedCardIndex].focus();
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    tooltipDiv = document.getElementById('abbr-tooltip');

    const searchInput = document.getElementById('search-input');
    const clearBtn    = document.getElementById('clear-btn') || document.getElementById('clear-search');

    // Search input handler
    const handleSearch = debounce(() => {
        const q = searchInput.value;
        clearBtn && clearBtn.classList.toggle('visible', q.length > 0);
        focusedCardIndex = -1;

        if (!q.trim()) {
            // Reset to active letter or default 'अ'
            const letter = activeLetter || 'अ';
            const results = getWordsByLetter(letter);
            renderResults(results, 'browse-results', 'search-results',
                'यस अक्षरमा कुनै शब्द फेला परेन।', '');
        } else {
            setActiveLetter(null);
            const results = searchDictionary(q);
            renderResults(results, 'search-results', 'browse-results',
                'कुनै परिणाम फेला परेन।', q.trim());
        }
    }, 250);

    searchInput.addEventListener('input', handleSearch);

    // Clear button
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchInput.focus();
            handleSearch();
        });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            moveFocus(1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            moveFocus(-1);
        } else if (e.key === 'Escape' && document.activeElement !== searchInput) {
            searchInput.focus();
        }
    });

    // Letter browse
    document.querySelectorAll('.browse-letter').forEach(span => {
        span.addEventListener('click', function () {
            const letter = this.dataset.letter;
            setActiveLetter(letter);
            searchInput.value = '';
            clearBtn && clearBtn.classList.remove('visible');
            focusedCardIndex = -1;
            const results = getWordsByLetter(letter);
            renderResults(results, 'browse-results', 'search-results',
                'यस अक्षरमा कुनै शब्द फेला परेन।', '');
        });
    });

    // Info panel buttons
    document.getElementById('show-abbr').addEventListener('click', () => {
        togglePanel('abbr', buildAbbrHTML());
    });

    document.getElementById('show-about').addEventListener('click', () => {
        togglePanel('about', aboutHTML);
    });

    // Load dictionary
    fetch('dictionary.json')
        .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        })
        .then(data => {
            dictionaryData = data;
            console.log(`Loaded ${dictionaryData.length} entries.`);
            setActiveLetter('अ');
            const initial = getWordsByLetter('अ');
            renderResults(initial, 'browse-results', 'search-results',
                'यस अक्षरमा कुनै शब्द फेला परेन।', '');
        })
        .catch(err => {
            console.error('Failed to load dictionary:', err);
            const browseDiv = document.getElementById('browse-results');
            if (browseDiv) {
                browseDiv.innerHTML = '<div class="no-results">शब्दकोश लोड गर्न सकिएन।</div>';
            }
        });
});
