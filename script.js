// ── State ─────────────────────────────────────────────────────────────────────
let dictionaryData = [];
let letterCounts   = {};
let activeLetter   = null;
let activePanel    = null; // 'abbr' | 'about' | null
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

// ── Theme ──────────────────────────────────────────────────────────────────────
function initTheme() {
    const saved = localStorage.getItem('nyayakosh-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('nyayakosh-theme', next);
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
let tooltipDiv;

function showTooltip(text, x, y) {
    tooltipDiv.textContent = text;
    // Keep tooltip within viewport
    const margin = 8;
    const tw = tooltipDiv.offsetWidth || 120;
    const left = Math.min(x, window.innerWidth - tw - margin);
    tooltipDiv.style.left = Math.max(margin, left) + 'px';
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

function escapeRE(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Wrap occurrences of `query` inside `text` with <mark> tags.
 * Returns a <span> element.
 *
 * BUG FIX: Using split() instead of RegExp.test() inside forEach
 * to avoid lastIndex sticky issues.
 */
function highlight(text, query) {
    const span = document.createElement('span');
    if (!query || !text) {
        span.textContent = text || '';
        return span;
    }
    const re = new RegExp(`(${escapeRE(query)})`, 'gi');
    const parts = text.split(re);
    // After split with capturing group, matches appear at odd indices
    parts.forEach((part, i) => {
        if (i % 2 === 1) {
            // This is a matched segment
            const mark = document.createElement('mark');
            mark.textContent = part;
            span.appendChild(mark);
        } else if (part) {
            span.appendChild(document.createTextNode(part));
        }
    });
    return span;
}

// ── Build letter counts ───────────────────────────────────────────────────────
function buildLetterCounts() {
    letterCounts = {};
    const letters = [...document.querySelectorAll('.browse-letter')].map(el => el.dataset.letter);
    letters.forEach(letter => {
        letterCounts[letter] = dictionaryData.filter(
            e => e.word && e.word.trim().startsWith(letter)
        ).length;
    });
}

function updateLetterCountBadges() {
    document.querySelectorAll('.browse-letter').forEach(el => {
        const letter = el.dataset.letter;
        const count = letterCounts[letter] || 0;
        let badge = el.querySelector('.letter-count');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'letter-count';
            el.appendChild(badge);
        }
        badge.textContent = count > 0 ? count : '';
    });
}

// ── Ranked search ─────────────────────────────────────────────────────────────
function searchDictionary(query) {
    if (!query || !query.trim()) return [];
    const q = query.trim().toLowerCase();

    const tier1 = [], tier2 = [], tier3 = [], tier4 = [];

    dictionaryData.forEach(entry => {
        const word = (entry.word || '').toLowerCase();
        const def  = (entry.definition || '').toLowerCase();
        const eng  = (entry.english || '').toLowerCase();

        if (word === q)               return tier1.push(entry);
        if (word.startsWith(q))       return tier2.push(entry);
        if (word.includes(q))         return tier3.push(entry);
        if (def.includes(q) || eng.includes(q)) return tier4.push(entry);
    });

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

// ── Copy word ─────────────────────────────────────────────────────────────────
function copyWord(word, btn) {
    navigator.clipboard.writeText(word).then(() => {
        const orig = btn.textContent;
        btn.textContent = 'copied ✓';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = orig;
            btn.classList.remove('copied');
        }, 1800);
    }).catch(() => {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = word;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
    });
}

// ── Render cards ──────────────────────────────────────────────────────────────
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
        // Staggered animation delay
        card.style.animationDelay = `${Math.min(i * 0.03, 0.3)}s`;

        // Copy button
        if (entry.word) {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.textContent = 'copy';
            copyBtn.setAttribute('aria-label', `Copy ${entry.word}`);
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                copyWord(entry.word, copyBtn);
            });
            card.appendChild(copyBtn);
        }

        // Word
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

    // Smooth scroll to first result when searching
    if (query && results.length > 0) {
        const firstCard = target.querySelector('.result-card');
        if (firstCard) {
            setTimeout(() => {
                firstCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 60);
        }
    }
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
    <p>Nyayakosh (न्यायकोश) यो कानूनी शब्दकोश नेपाल कानून आयोगद्वारा प्रकाशित आधिकारिक कानूनी शब्दकोशमा आधारित छ।</p>
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
    const infoPanel = document.getElementById('info-panel');
    const abbrBtn   = document.getElementById('show-abbr');
    const aboutBtn  = document.getElementById('show-about');

    if (activePanel === panel) {
        infoPanel.classList.add('hidden');
        infoPanel.innerHTML = '';
        activePanel = null;
        abbrBtn.classList.remove('active');
        aboutBtn.classList.remove('active');
    } else {
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
    cards[focusedCardIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Sticky header detection ───────────────────────────────────────────────────
function initStickyDetect() {
    const wrapper = document.getElementById('search-sticky-wrapper');
    if (!wrapper) return;
    const sentinel = document.createElement('div');
    sentinel.style.cssText = 'height:1px;margin-top:-1px;pointer-events:none;';
    wrapper.parentNode.insertBefore(sentinel, wrapper);

    const obs = new IntersectionObserver(
        ([entry]) => {
            wrapper.classList.toggle('is-stuck', !entry.isIntersecting);
        },
        { threshold: 0 }
    );
    obs.observe(sentinel);
}

// ── Back to top ───────────────────────────────────────────────────────────────
function initBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;

    window.addEventListener('scroll', () => {
        btn.classList.toggle('visible', window.scrollY > 320);
    }, { passive: true });

    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    tooltipDiv = document.getElementById('abbr-tooltip');

    const searchInput = document.getElementById('search-input');
    const clearBtn    = document.getElementById('clear-search');

    // Theme toggle
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    // Search handler
    const handleSearch = debounce(() => {
        const q = searchInput.value;
        clearBtn && clearBtn.classList.toggle('visible', q.length > 0);
        focusedCardIndex = -1;

        if (!q.trim()) {
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
    }, 220);

    searchInput.addEventListener('input', handleSearch);

    // Clear button
    clearBtn && clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchInput.focus();
        handleSearch();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            moveFocus(1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            moveFocus(-1);
        } else if (e.key === 'Escape') {
            if (document.activeElement !== searchInput) {
                searchInput.focus();
            } else {
                searchInput.value = '';
                handleSearch();
            }
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
            // Scroll to browse results
            setTimeout(() => {
                document.getElementById('browse-results').scrollIntoView({
                    behavior: 'smooth', block: 'start'
                });
            }, 60);
        });
    });

    // Info panel
    document.getElementById('show-abbr').addEventListener('click', () => {
        togglePanel('abbr', buildAbbrHTML());
    });
    document.getElementById('show-about').addEventListener('click', () => {
        togglePanel('about', aboutHTML);
    });

    // Sticky search + back to top
    initStickyDetect();
    initBackToTop();

    // Load dictionary
    fetch('dictionary.json')
        .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        })
        .then(data => {
            dictionaryData = data;
            console.log(`Loaded ${dictionaryData.length} entries.`);
            buildLetterCounts();
            updateLetterCountBadges();
            setActiveLetter('अ');
            const initial = getWordsByLetter('अ');
            renderResults(initial, 'browse-results', 'search-results',
                'यस अक्षरमा कुनै शब्द फेला परेन।', '');
        })
        .catch(err => {
            console.error('Failed to load dictionary:', err);
            const browseDiv = document.getElementById('browse-results');
            if (browseDiv) {
                browseDiv.innerHTML = '<div class="no-results">शब्दकोश लोड गर्न सकिएन। <br><small>dictionary.json फाइल फेला परेन।</small></div>';
            }
        });
});
