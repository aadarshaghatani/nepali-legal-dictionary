// ── State ─────────────────────────────────────────────────────────────────────
let dictionaryData   = [];
let letterCounts     = {};
let activeLetter     = null;
let activePanel      = null;
let focusedCardIndex = -1;
let currentQuery     = '';

// ── Abbreviation map ──────────────────────────────────────────────────────────
const abbreviationMap = {
    'सं.': 'संस्कृत', 'अ.': 'अरबी', 'फा.': 'फारसी', 'अङ्.': 'अङ्ग्रेजी',
    'प्रा.': 'प्राकृत', 'नेवा.': 'नेवारी', 'हि.': 'हिन्दी', 'उ.': 'उर्दू',
    'पोर्त.': 'पोर्तगाली', 'तु.': 'तुर्की', 'ना.': 'नाम', 'क्रि.': 'क्रिया',
    'वि.': 'विशेषण', 'क्रिवि.': 'क्रियाविशेषण', 'नाप.': 'नामपदावली',
    'सर्व.': 'सर्वनाम', 'संयो.': 'संयोजक', 'हे.': 'हेर्नुहोस्',
    'देखि': 'देखि', 'सम्म': 'सम्म',
};

// ── Tooltip ───────────────────────────────────────────────────────────────────
let tooltipDiv;

function showTooltip(text, x, y) {
    tooltipDiv.textContent = text;
    tooltipDiv.classList.remove('hidden');
    const tw = tooltipDiv.offsetWidth;
    const margin = 8;
    const left = Math.min(x, window.innerWidth - tw - margin);
    tooltipDiv.style.left = Math.max(margin, left) + 'px';
    tooltipDiv.style.top  = y + 'px';
}
function hideTooltip() { tooltipDiv.classList.add('hidden'); }

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

// Highlight: split on capturing group — no lastIndex bugs, works with Nepali Unicode
function highlight(text, query) {
    const container = document.createElement('span');
    if (!query || !text) { container.textContent = text || ''; return container; }
    let parts;
    try {
        const re = new RegExp('(' + escapeRE(query.trim()) + ')', 'gi');
        parts = text.split(re);
    } catch(e) {
        container.textContent = text;
        return container;
    }
    parts.forEach((part, i) => {
        if (!part) return;
        if (i % 2 === 1) {
            const mark = document.createElement('mark');
            mark.textContent = part;
            container.appendChild(mark);
        } else {
            container.appendChild(document.createTextNode(part));
        }
    });
    return container;
}

// ── Letter counts ─────────────────────────────────────────────────────────────
function buildLetterCounts() {
    document.querySelectorAll('.browse-letter').forEach(el => {
        const letter = el.dataset.letter;
        letterCounts[letter] = dictionaryData.filter(
            e => e.word && e.word.trim().startsWith(letter)
        ).length;
    });
}

function updateLetterCountBadges() {
    document.querySelectorAll('.browse-letter').forEach(el => {
        const letter = el.dataset.letter;
        let badge = el.querySelector('.letter-count');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'letter-count';
            el.appendChild(badge);
        }
        const count = letterCounts[letter] || 0;
        badge.textContent = count > 0 ? count : '';
    });
}

// ── Search ────────────────────────────────────────────────────────────────────
function searchDictionary(query) {
    if (!query || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    const tier1=[], tier2=[], tier3=[], tier4=[];
    dictionaryData.forEach(entry => {
        const word = (entry.word       || '').toLowerCase();
        const def  = (entry.definition || '').toLowerCase();
        const eng  = (entry.english    || '').toLowerCase();
        if (word === q)                         return tier1.push(entry);
        if (word.startsWith(q))                 return tier2.push(entry);
        if (word.includes(q))                   return tier3.push(entry);
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
    const orig = btn.textContent;
    const doFallback = () => {
        const ta = document.createElement('textarea');
        ta.value = word;
        ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch(e) {}
        document.body.removeChild(ta);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(word).catch(doFallback);
    } else {
        doFallback();
    }
    btn.textContent = 'copied ✓';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1800);
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderResults(results, targetId, clearId, emptyMsg, query) {
    const target = document.getElementById(targetId);
    const other  = document.getElementById(clearId);
    if (!target) return;

    target.innerHTML = '';
    if (other) other.innerHTML = '';

    const countEl = document.getElementById('result-count');
    if (countEl) {
        countEl.textContent = (targetId === 'search-results' && query && results.length)
            ? `${results.length} परिणाम फेला पर्‍यो` : '';
    }

    if (!results.length) {
        target.innerHTML = `<div class="no-results">${emptyMsg}</div>`;
        return;
    }

    const frag = document.createDocumentFragment();
    const q = query || '';

    results.forEach((entry, i) => {
        const card = document.createElement('div');
        card.className = `result-card ${entry._matchTier || ''}`;
        card.setAttribute('role', 'listitem');
        card.setAttribute('tabindex', '0');
        card.dataset.index = i;
        card.style.animationDelay = `${Math.min(i * 0.025, 0.25)}s`;

        // Copy button
        if (entry.word) {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.textContent = 'copy';
            copyBtn.setAttribute('aria-label', `Copy: ${entry.word}`);
            copyBtn.addEventListener('click', e => { e.stopPropagation(); copyWord(entry.word, copyBtn); });
            card.appendChild(copyBtn);
        }

        // Word
        const wordEl = document.createElement('div');
        wordEl.className = 'result-word';
        wordEl.appendChild(highlight(entry.word || '', q));
        card.appendChild(wordEl);

        // Meta tags
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
                if (abbr.startsWith('[') && abbr.endsWith(']')) abbr = abbr.slice(1,-1);
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
            engEl.appendChild(highlight(entry.english, q));
            card.appendChild(engEl);
        }

        // Definition
        if (entry.definition) {
            const defEl = document.createElement('div');
            defEl.className = 'result-definition';
            defEl.appendChild(highlight(entry.definition, q));
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

    // Scroll to first result when searching
    if (q && results.length > 0) {
        const first = target.querySelector('.result-card');
        if (first) setTimeout(() => first.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
    }
}

// ── Active letter ─────────────────────────────────────────────────────────────
function setActiveLetter(letter) {
    document.querySelectorAll('.browse-letter').forEach(el => {
        el.classList.toggle('active', el.dataset.letter === letter);
    });
    activeLetter = letter;
}

// ── Info panel ────────────────────────────────────────────────────────────────
const aboutHTML = `
    <p><strong>Nyayakosh (न्यायकोश)</strong> — नेपाल कानून आयोगद्वारा प्रकाशित आधिकारिक कानूनी शब्दकोशमा आधारित।</p>
    <p>नेपाली भाषामा प्रयोग हुने कानून सम्बन्धी शब्दहरूको अर्थ, श्रोत र प्रयोगलाई सरल रूपमा प्रस्तुत गर्ने प्रयत्न गरिएको छ।</p>
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

// ── Keyboard nav ──────────────────────────────────────────────────────────────
function getVisibleCards() {
    const s = [...document.querySelectorAll('#search-results .result-card')];
    const b = [...document.querySelectorAll('#browse-results .result-card')];
    return s.length ? s : b;
}
function moveFocus(dir) {
    const cards = getVisibleCards();
    if (!cards.length) return;
    focusedCardIndex = Math.max(0, Math.min(cards.length-1, focusedCardIndex + dir));
    cards[focusedCardIndex].focus();
    cards[focusedCardIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Sticky detect ─────────────────────────────────────────────────────────────
function initStickyDetect() {
    const wrapper = document.getElementById('search-sticky-wrapper');
    if (!wrapper || !window.IntersectionObserver) return;
    const sentinel = document.createElement('div');
    sentinel.style.cssText = 'height:1px;pointer-events:none;';
    wrapper.parentNode.insertBefore(sentinel, wrapper);
    new IntersectionObserver(
        ([e]) => wrapper.classList.toggle('is-stuck', !e.isIntersecting),
        { threshold: 0 }
    ).observe(sentinel);
}

// ── Back to top ───────────────────────────────────────────────────────────────
function initBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;
    const check = () => btn.classList.toggle('visible', window.scrollY > 300);
    window.addEventListener('scroll', check, { passive: true });
    check(); // run immediately on load
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    tooltipDiv = document.getElementById('abbr-tooltip');

    const searchInput = document.getElementById('search-input');
    const clearBtn    = document.getElementById('clear-search');

    if (!searchInput) { console.error('search-input not found'); return; }

    const handleSearch = debounce(() => {
        const q = searchInput.value;
        currentQuery = q;
        if (clearBtn) clearBtn.classList.toggle('visible', q.length > 0);
        focusedCardIndex = -1;

        if (!q.trim()) {
            const letter = activeLetter || 'अ';
            setActiveLetter(letter);
            renderResults(getWordsByLetter(letter), 'browse-results', 'search-results',
                'यस अक्षरमा कुनै शब्द फेला परेन।', '');
        } else {
            setActiveLetter(null);
            renderResults(searchDictionary(q), 'search-results', 'browse-results',
                'कुनै परिणाम फेला परेन।', q.trim());
        }
    }, 220);

    searchInput.addEventListener('input', handleSearch);

    // Clear button — this is what × does
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchInput.focus();
            handleSearch();
        });
    }

    document.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(-1); }
        else if (e.key === 'Escape') {
            if (searchInput.value) { searchInput.value = ''; handleSearch(); }
            searchInput.focus();
        }
    });

    document.querySelectorAll('.browse-letter').forEach(span => {
        span.addEventListener('click', function () {
            const letter = this.dataset.letter;
            setActiveLetter(letter);
            searchInput.value = '';
            currentQuery = '';
            if (clearBtn) clearBtn.classList.remove('visible');
            focusedCardIndex = -1;
            renderResults(getWordsByLetter(letter), 'browse-results', 'search-results',
                'यस अक्षरमा कुनै शब्द फेला परेन।', '');
            setTimeout(() => {
                const el = document.getElementById('browse-results');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 80);
        });
    });

    document.getElementById('show-abbr').addEventListener('click', () => togglePanel('abbr', buildAbbrHTML()));
    document.getElementById('show-about').addEventListener('click', () => togglePanel('about', aboutHTML));

    initStickyDetect();
    initBackToTop();

    fetch('dictionary.json')
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(data => {
            dictionaryData = data;
            console.log(`Nyayakosh: ${dictionaryData.length} entries loaded.`);
            buildLetterCounts();
            updateLetterCountBadges();
            setActiveLetter('अ');
            renderResults(getWordsByLetter('अ'), 'browse-results', 'search-results',
                'यस अक्षरमा कुनै शब्द फेला परेन।', '');
        })
        .catch(err => {
            console.error('dictionary.json load failed:', err);
            const el = document.getElementById('browse-results');
            if (el) el.innerHTML = `<div class="no-results">शब्दकोश लोड गर्न सकिएन।<br><small>dictionary.json फेला परेन।</small></div>`;
        });
});
