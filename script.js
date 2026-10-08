// DOM elements
const container = document.getElementById('posts-container');
const loading = document.getElementById('loading');
const infiniteLoading = document.getElementById('infinite-loading');
const emptyState = document.getElementById('empty-state');
const postCountElement = document.getElementById('post-count');
const searchSection = document.getElementById('search-section');
const searchInput = document.getElementById('search-input');
const clearButton = document.getElementById('clear-search');
const searchResults = document.getElementById('search-results');

// Date filter elements
const toggleDateFilter = document.getElementById('toggle-date-filter');
const dateFilterControls = document.getElementById('date-filter-controls');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const applyDateFilter = document.getElementById('apply-date-filter');
const clearDateFilter = document.getElementById('clear-date-filter');
const presetButtons = document.querySelectorAll('.preset-btn');

// Global variables
let allPosts = [];
let filteredPosts = [];
let currentSearchTerm = '';
let currentStartDate = null;
let currentEndDate = null;
let observer;
const POSTS_PER_PAGE = 25;
let currentPage = 0;
let isLoading = false;

// Enhanced search functionality with stopwords and stemming
const STOPWORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in', 'is', 'it',
    'its', 'of', 'on', 'that', 'the', 'to', 'was', 'will', 'with', 'would', 'i', 'you', 'we', 'they',
    'she', 'her', 'him', 'his', 'my', 'our', 'your', 'their', 'this', 'these', 'those', 'but', 'or',
    'not', 'can', 'do', 'have', 'had', 'been', 'were', 'am', 'all', 'any', 'some', 'if', 'so', 'what',
    'when', 'where', 'who', 'why', 'how', 'there', 'here', 'then', 'than', 'more', 'most', 'much',
    'many', 'very', 'just', 'only', 'also', 'even', 'still', 'now', 'get', 'got', 'go', 'going', 'come',
    'came', 'see', 'saw', 'know', 'knew', 'think', 'thought', 'say', 'said', 'tell', 'told', 'ask',
    'asked', 'give', 'gave', 'take', 'took', 'make', 'made', 'want', 'wanted', 'need', 'needed', 'try',
    'tried', 'look', 'looked', 'feel', 'felt', 'seem', 'seemed', 'find', 'found', 'work', 'worked',
    'use', 'used', 'call', 'called', 'way', 'ways', 'time', 'times', 'day', 'days', 'year', 'years',
    'new', 'old', 'first', 'last', 'long', 'good', 'great', 'little', 'own', 'other', 'right', 'left',
    'high', 'low', 'big', 'small', 'large', 'next', 'early', 'young', 'important', 'few', 'public',
    'bad', 'same', 'able'
]);

// Simple stemming rules
const STEMMING_RULES = [
    { pattern: /ies$/, replacement: 'y' },
    { pattern: /ied$/, replacement: 'y' },
    { pattern: /ying$/, replacement: 'y' },
    { pattern: /ing$/, replacement: '' },
    { pattern: /ly$/, replacement: '' },
    { pattern: /ed$/, replacement: '' },
    { pattern: /ies$/, replacement: 'y' },
    { pattern: /ied$/, replacement: 'y' },
    { pattern: /ies$/, replacement: 'y' },
    { pattern: /s$/, replacement: '' }
];

// Normalize text for searching (remove accents, etc.)
function normalizeText(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Simple stemming function
function stemWord(word) {
    if (word.length <= 3) return word;
    
    for (let rule of STEMMING_RULES) {
        if (rule.pattern.test(word)) {
            let stemmed = word.replace(rule.pattern, rule.replacement);
            if (stemmed.length >= 2) {
                return stemmed;
            }
        }
    }
    return word;
}

// Process search terms (normalize, remove stopwords, stem)
function processSearchTerms(searchText) {
    if (!searchText || typeof searchText !== 'string') {
        return [];
    }
    
    const normalized = normalizeText(searchText.trim());
    if (normalized.length === 0) {
        return [];
    }
    
    const words = normalized.split(/\s+/).filter(word => word.length > 0);
    
    return words
        .filter(word => !STOPWORDS.has(word) && word.length > 0)
        .map(word => ({
            original: word,
            stemmed: stemWord(word)
        }));
}

// Check if word matches (exact match or meaningful partial match)
function wordMatch(word, target) {
    if (word === target) return true;
    
    // Only check meaningful partial matches for words of reasonable length
    if (word.length >= 3 && target.length >= 3) {
        // Only match if one word starts with the other (prefix matching)
        // This prevents "iran" from matching "ran" but allows "child" to match "childcare"
        if (target.startsWith(word) || word.startsWith(target)) return true;
    }
    
    // For shorter words, only allow exact matches
    if (word.length < 3 || target.length < 3) {
        return word === target;
    }
    
    return false;
}

// Get all searchable text from a post
function getSearchableText(post) {
    const fields = [
        post.text || '',
        post.user_screen_name || '',
        post.user_name || ''
        // Removed potentially empty/undefined fields that might cause issues
    ];
    
    return fields.filter(field => field && field.trim()).join(' ').toLowerCase();
}

// Enhanced search function
function enhancedSearch(posts, searchTerms) {
    if (!searchTerms || searchTerms.length === 0) {
        return posts;
    }
    
    return posts.filter(post => {
        const searchableText = normalizeText(getSearchableText(post));
        const searchableWords = searchableText.split(/\s+/).filter(word => word.length > 0);
        
        // All search terms must match (AND logic)
        return searchTerms.every(term => {
            // Skip empty terms
            if (!term.original || term.original.length === 0) {
                return true;
            }
            
            // Check exact match first
            if (searchableText.includes(term.original)) {
                return true;
            }
            
            // Check stemmed match
            if (searchableWords.some(word => stemWord(word) === term.stemmed)) {
                return true;
            }
            
            // Check word match (exact or partial)
            return searchableWords.some(word => {
                // Only do matching if both words are meaningful length
                if (word.length >= 2 && term.original.length >= 2) {
                    return wordMatch(term.original, word) || 
                           wordMatch(term.stemmed, stemWord(word));
                }
                return false;
            });
        });
    });
}

// Enhanced highlighting function
function highlightSearchTerm(text, searchTerm) {
    if (!searchTerm || !text) return escapeHTML(text);
    
    const processedTerms = processSearchTerms(searchTerm);
    if (processedTerms.length === 0) return escapeHTML(text);
    
    let highlightedText = escapeHTML(text);
    const normalizedText = normalizeText(text);
    
    // Create a map of positions to highlight
    const highlights = [];
    
    processedTerms.forEach(term => {
        // Find exact matches
        let index = 0;
        while ((index = normalizedText.indexOf(term.original, index)) !== -1) {
            highlights.push({ start: index, end: index + term.original.length });
            index += term.original.length;
        }
        
        // Find partial matches
        const words = normalizedText.split(/(\s+)/);
        let currentPos = 0;
        
        words.forEach(word => {
            const cleanWord = word.replace(/[^\w]/g, '');
            if (cleanWord.length > 0) {
                if (wordMatch(term.original, cleanWord) || 
                    wordMatch(term.stemmed, stemWord(cleanWord))) {
                    highlights.push({ 
                        start: currentPos, 
                        end: currentPos + word.length 
                    });
                }
            }
            currentPos += word.length;
        });
    });
    
    // Sort highlights by position and merge overlapping ones
    highlights.sort((a, b) => a.start - b.start);
    const mergedHighlights = [];
    
    highlights.forEach(highlight => {
        const last = mergedHighlights[mergedHighlights.length - 1];
        if (last && highlight.start <= last.end) {
            last.end = Math.max(last.end, highlight.end);
        } else {
            mergedHighlights.push(highlight);
        }
    });
    
    // Apply highlights from right to left to preserve positions
    mergedHighlights.reverse().forEach(highlight => {
        const before = highlightedText.substring(0, highlight.start);
        const match = highlightedText.substring(highlight.start, highlight.end);
        const after = highlightedText.substring(highlight.end);
        
        highlightedText = before + 
            '<mark style="background: #fef08a; padding: 0.125rem 0.25rem; border-radius: 0.25rem; font-weight: 600;">' + 
            match + 
            '</mark>' + 
            after;
    });
    
    return highlightedText;
}

// Escape regex special characters
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Initialize search functionality
function initializeSearch() {
    searchInput.addEventListener('input', debounce(handleSearch, 300));
    clearButton.addEventListener('click', clearSearch);
    
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSearch();
        }
    });
    
    // Initialize search help
    const searchHelpButton = document.getElementById('search-help');
    const searchHelpPanel = document.getElementById('search-help-panel');
    
    if (searchHelpButton && searchHelpPanel) {
        searchHelpButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            searchHelpPanel.classList.toggle('show');
        });
        
        // Close help panel when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchHelpPanel.contains(e.target) && !searchHelpButton.contains(e.target)) {
                searchHelpPanel.classList.remove('show');
            }
        });
        
        // Close help panel when starting to type
        searchInput.addEventListener('focus', () => {
            searchHelpPanel.classList.remove('show');
        });
    }
}

// Handle search input with enhanced search
function handleSearch() {
    const searchTerm = searchInput.value.trim();
    currentSearchTerm = searchTerm;
    
    clearButton.style.display = searchTerm ? 'block' : 'none';
    
    applyFilters();
    updatePostCount();
    postCountElement.style.display = 'block';
    displayPosts(filteredPosts, true);
    updateSearchResults(searchTerm);
}

// Clear search
function clearSearch() {
    searchInput.value = '';
    currentSearchTerm = '';
    clearButton.style.display = 'none';
    applyFilters();
    updatePostCount();
    displayPosts(filteredPosts, true);
    searchResults.textContent = '';
}

// Initialize date filter functionality
function initializeDateFilter() {
    // Toggle date filter visibility
    toggleDateFilter.addEventListener('click', () => {
        const isExpanded = dateFilterControls.classList.contains('expanded');
        dateFilterControls.classList.toggle('expanded');
        toggleDateFilter.classList.toggle('expanded');
    });

    // Apply date filter
    applyDateFilter.addEventListener('click', handleDateFilter);
    
    // Clear date filter
    clearDateFilter.addEventListener('click', clearDateFilters);
    
    // Date preset buttons
    presetButtons.forEach(button => {
        button.addEventListener('click', () => {
            const days = parseInt(button.dataset.days);
            applyDatePreset(days);
            button.classList.add('active');
            
            // Remove active class from other preset buttons
            presetButtons.forEach(btn => {
                if (btn !== button) btn.classList.remove('active');
            });
        });
    });
    
    // Date input changes
    startDateInput.addEventListener('change', validateDateInputs);
    endDateInput.addEventListener('change', validateDateInputs);
}

// Apply all filters (enhanced search + date)
function applyFilters() {
    let filtered = [...allPosts];
    
    // Apply enhanced search filter
    if (currentSearchTerm) {
        const searchTerms = processSearchTerms(currentSearchTerm);
        filtered = enhancedSearch(filtered, searchTerms);
    }
    
    // Apply date filter
    if (currentStartDate || currentEndDate) {
        filtered = filtered.filter(post => {
            const postDate = parsePostDate(post.created_at);
            if (!postDate) return false;
            
            if (currentStartDate && postDate < currentStartDate) return false;
            if (currentEndDate && postDate > currentEndDate) return false;
            
            return true;
        });
    }
    
    filteredPosts = filtered;
}

// Load and display posts
async function loadPosts() {
    try {
        const response = await fetch('rr.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const posts = await response.json();
        
        // Process posts to handle BOM characters and map fields correctly
        allPosts = posts.map(post => {
            // Handle BOM character in keys and map to expected field names
            const postIdKey = Object.keys(post).find(key => key.includes('POST ID')) || 'POST ID';
            const textKey = Object.keys(post).find(key => key.includes('TEXT')) || 'TEXT';
            const typeKey = Object.keys(post).find(key => key.includes('TYPE')) || 'TYPE';
            const dateCreatedKey = Object.keys(post).find(key => key.includes('DATE CREATED')) || 'DATE CREATED';
            const timeKey = Object.keys(post).find(key => key.includes('TIME')) || 'TIME';
            
            return {
                id: post[postIdKey] || '',
                text: post[textKey] || '',
                type: post[typeKey] || 'Post',
                user_screen_name: 'Ryan Routh',
                user_name: 'Ryan Routh',
                created_at: `${post[dateCreatedKey] || ''} ${post[timeKey] || ''}`.trim(),
                bookmarks: post['BOOKMARKS'] || 0,
                favorites: post['FAVORITES'] || 0,
                reposts: post['REPOSTS'] || 0,
                replies: post['REPLIES'] || 0,
                views: post['VIEWS'] || 0
            };
        }).filter(post => post.text && post.text.trim() !== "");
        
        filteredPosts = [...allPosts];
        
        loading.style.display = 'none';
        
        if (allPosts.length === 0) {
            emptyState.style.display = 'flex';
            postCountElement.textContent = '0 posts';
            postCountElement.style.display = 'block';
            return;
        }
        
        searchSection.style.display = 'block';
        container.style.display = 'grid';
        
        updatePostCount();
        postCountElement.style.display = 'block';
        setupIntersectionObserver();
        loadMorePosts();
        
        initializeSearch();
        initializeDateFilter();
        
    } catch (error) {
        console.error('Error loading posts:', error);
        showError(error.message);
    }
}

function setupIntersectionObserver() {
    const options = {
        root: null,
        rootMargin: '200px',
        threshold: 0.1
    };

    observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !isLoading) {
                loadMorePosts();
            }
        });
    }, options);
}

function loadMorePosts() {
    if (isLoading) return;
    
    const start = currentPage * POSTS_PER_PAGE;
    const end = start + POSTS_PER_PAGE;
    const postsToRender = filteredPosts.slice(start, end);

    if (postsToRender.length === 0 && currentPage > 0) {
        // No more posts to load
        infiniteLoading.style.display = 'none';
        if (observer) {
            observer.disconnect();
        }
        return;
    }
    
    isLoading = true;
    
    // Show loading indicator for subsequent loads
    if (currentPage > 0) {
        infiniteLoading.style.display = 'block';
    }
    
    requestAnimationFrame(() => {
        displayPosts(postsToRender);
        currentPage++;
        isLoading = false;
        
        // Hide loading indicator
        infiniteLoading.style.display = 'none';

        const lastPost = container.querySelector('.post:last-child');
        if (lastPost && observer && currentPage * POSTS_PER_PAGE < filteredPosts.length) {
            observer.observe(lastPost);
        }
    });
}

// Display posts with animation
function displayPosts(posts, isSearch = false) {
    if (isSearch) {
        container.innerHTML = '';
        currentPage = 0;
        isLoading = false;
        if (observer) {
            observer.disconnect();
        }
        setupIntersectionObserver();
        loadMorePosts();
        return;
    }

    if (posts.length === 0 && currentPage === 0) {
        showNoResults();
        return;
    }
    
    const fragment = document.createDocumentFragment();
    
    posts.forEach((post, index) => {
        const postElement = createPostElement(post, (currentPage * POSTS_PER_PAGE) + index, isSearch);
        fragment.appendChild(postElement);
    });
    
    container.appendChild(fragment);
}

// Create individual post element
function createPostElement(post, index, isSearch = false) {
    const postDiv = document.createElement('div');
    postDiv.className = 'post';
    
    const formattedDate = formatDate(post.created_at);
    
    const highlightedText = highlightSearchTerm(post.text, currentSearchTerm);
    const highlightedHandle = highlightSearchTerm(post.user_screen_name || 'Ryan Routh', currentSearchTerm);

    const fullDate = formatFullDate(post.created_at);
    
    // Create the post link if available
    const postLink = post.link || '#';
    
    // Get post type and create type indicator
    const postType = post.type || 'Post';
    const typeClass = postType.toLowerCase();
    const typeIcon = postType === 'Reply' ? 'reply' : (postType === 'Repost' ? 'repeat' : 'edit_note');
    
    postDiv.innerHTML = `
        <div class="post-avatar">
            <img src="profile.png" alt="Profile" />
        </div>
        <div class="post-content">
            <div class="meta">
                <span class="handle">${highlightedHandle}</span>
                <div class="separator"></div>
                <a href="${postLink}" target="_blank" rel="noopener noreferrer" class="date" title="${fullDate}">${formattedDate}</a>
                <div class="separator"></div>
                <span class="post-type ${typeClass}">
                    <span class="material-symbols-outlined">${typeIcon}</span>
                    <span>${postType}</span>
                </span>
                <div class="separator"></div>
                <a href="${postLink}" target="_blank" rel="noopener noreferrer" class="post-link-inline" title="View post on X">
                    <span class="material-symbols-outlined">open_in_new</span>
                </a>
            </div>
            <div class="text">${highlightedText}</div>
        </div>
    `;
    
    // Make the entire post clickable except for links
    postDiv.addEventListener('click', (e) => {
        // Don't trigger if clicking on a link or button
        if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || e.target.closest('a')) {
            return;
        }
        
        // Open the post in a new tab
        if (postLink && postLink !== '#') {
            window.open(postLink, '_blank', 'noopener,noreferrer');
        }
    });
    
    return postDiv;
}

// Parse post date from string format "M/D/YYYY H:MM"
function parsePostDate(dateString) {
    if (!dateString) return null;
    
    try {
        // Handle format like "6/28/2025 10:56"
        const [datePart, timePart] = dateString.split(' ');
        const [month, day, year] = datePart.split('/');
        const [hour, minute] = timePart ? timePart.split(':') : ['0', '0'];
        
        return new Date(year, month - 1, day, hour, minute);
    } catch (error) {
        console.warn('Failed to parse date:', dateString);
        return null;
    }
}

// Handle date filter application
function handleDateFilter() {
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    
    currentStartDate = startDate ? new Date(startDate) : null;
    currentEndDate = endDate ? new Date(endDate + 'T23:59:59') : null; // End of day
    
    applyFilters();
    updatePostCount();
    displayPosts(filteredPosts, true);
    updateDateFilterResults();
}

// Clear date filters
function clearDateFilters() {
    startDateInput.value = '';
    endDateInput.value = '';
    currentStartDate = null;
    currentEndDate = null;
    
    // Remove active class from preset buttons
    presetButtons.forEach(btn => btn.classList.remove('active'));
    
    applyFilters();
    updatePostCount();
    displayPosts(filteredPosts, true);
    updateDateFilterResults();
}

// Apply date preset (last N days)
function applyDatePreset(days) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    // Set input values
    startDateInput.value = startDate.toISOString().split('T')[0];
    endDateInput.value = endDate.toISOString().split('T')[0];
    
    // Apply filter
    currentStartDate = startDate;
    currentEndDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1); // End of day
    
    applyFilters();
    updatePostCount();
    displayPosts(filteredPosts, true);
    updateDateFilterResults();
}

// Validate date inputs
function validateDateInputs() {
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    
    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (start > end) {
            startDateInput.setCustomValidity('Start date must be before end date');
            endDateInput.setCustomValidity('End date must be after start date');
        } else {
            startDateInput.setCustomValidity('');
            endDateInput.setCustomValidity('');
        }
    }
}

// Update date filter results display
function updateDateFilterResults() {
    if (!currentStartDate && !currentEndDate) return;
    
    const hasSearch = !!currentSearchTerm;
    const dateRange = formatDateRange(currentStartDate, currentEndDate);
    
    if (hasSearch) {
        searchResults.innerHTML += ` <span style="color: var(--text-muted);">• Filtered by date: ${dateRange}</span>`;
    } else {
        searchResults.innerHTML = `Showing posts from ${dateRange}`;
    }
}

// Format date range for display
function formatDateRange(startDate, endDate) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    
    if (startDate && endDate) {
        return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
    } else if (startDate) {
        return `${startDate.toLocaleDateString('en-US', options)} onwards`;
    } else if (endDate) {
        return `up to ${endDate.toLocaleDateString('en-US', options)}`;
    }
    
    return '';
}

// Update search results text with enhanced search info
function updateSearchResults(searchTerm) {
    if (!searchTerm) {
        searchResults.textContent = '';
        return;
    }
    
    const count = filteredPosts.length;
    const totalCount = allPosts.length;
    const processedTerms = processSearchTerms(searchTerm);
    
    if (count === 0) {
        searchResults.innerHTML = `No results found for "<strong>${escapeHTML(searchTerm)}</strong>"`;
    } else if (count === totalCount) {
        searchResults.innerHTML = `All ${count} posts match "<strong>${escapeHTML(searchTerm)}</strong>"`;
    } else {
        const searchInfo = processedTerms.length > 0 ? 
            `<br><span style="color: var(--text-muted); font-size: 0.875rem;">
                Searching for: ${processedTerms.map(t => `"${t.original}"`).join(', ')}${processedTerms.some(t => t.original !== t.stemmed) ? ' (including word variations)' : ''}
            </span>` : '';
        
        searchResults.innerHTML = `Found ${count} of ${totalCount} posts matching "<strong>${escapeHTML(searchTerm)}</strong>"${searchInfo}`;
    }
}

// Update post count
function updatePostCount() {
    const count = filteredPosts.length;
    const total = allPosts.length;
    
    updateExportButton();
    
    if (currentSearchTerm && count !== total) {
        postCountElement.textContent = `${count} / ${total} posts`;
    } else {
        postCountElement.textContent = `${total} posts`;
    }
}

// Show no results message
function showNoResults() {
    container.innerHTML = `
        <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px 16px;
            text-align: center;
            color: var(--text-secondary);
            min-height: 300px;
        ">
            <span class="material-symbols-outlined" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">search_off</span>
            <h3 style="margin-bottom: 8px; color: var(--text-primary); font-weight: 800; font-size: 20px;">No posts found</h3>
            <p style="font-size: 15px; color: var(--text-secondary); margin: 0;">Try adjusting your search terms or <button onclick="clearSearch()" style="background: none; border: none; color: var(--primary-color); cursor: pointer; text-decoration: underline; font: inherit;">clear the search</button></p>
        </div>
    `;
}

// Debounce function for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Format date string
function formatDate(dateString) {
    if (!dateString) return 'Unknown date';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffMinutes = Math.floor(diffTime / (1000 * 60));
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffMinutes < 60) {
            return diffMinutes === 0 ? 'now' : `${diffMinutes}m`;
        } else if (diffHours < 24) {
            return `${diffHours}h`;
        } else if (diffDays < 30) {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
        } else {
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
    } catch (error) {
        return dateString;
    }
}

// Format full date with time for hover title
function formatFullDate(dateString) {
    if (!dateString) return 'Unknown date';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    } catch (error) {
        return dateString;
    }
}

// Show error message
function showError(message) {
    loading.style.display = 'none';
    container.innerHTML = '';
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-state';
    errorDiv.innerHTML = `
        <span class="material-symbols-outlined">error</span>
        <h2>Failed to Load Posts</h2>
        <p>There was an issue fetching the posts. Please try again later.</p>
        <small>Error: ${escapeHTML(message)}</small>
    `;
    container.appendChild(errorDiv);
    container.style.display = 'block';
}

// Enhanced HTML escape function
function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Add smooth scrolling for better UX
function addSmoothScrolling() {
    document.documentElement.style.scrollBehavior = 'smooth';
}

// Handle responsive placeholder text
function updateSearchPlaceholder() {
    const searchInput = document.getElementById('search-input');
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        searchInput.placeholder = "Search posts...";
    } else {
        searchInput.placeholder = "Search posts (try: 'rent freeze', 'childcare', 'buses')...";
    }
}

// ===== EXPORT FUNCTIONALITY =====

const exportButton = document.getElementById('export-button');
const exportDialog = document.getElementById('export-dialog');
const exportDialogSummary = document.getElementById('export-dialog-summary');

const EXPORT_ACCOUNT = { name: 'Ryan Routh', handle: '@RyanRouth' };

function initializeExport() {
    if (!exportButton || !exportDialog) return;

    exportButton.disabled = true;

    exportButton.addEventListener('click', () => {
        if (filteredPosts.length === 0) return;
        const count = filteredPosts.length;
        exportDialogSummary.textContent =
            `${count} post${count === 1 ? '' : 's'} from the current results will be exported. Choose a format:`;
        exportDialog.returnValue = '';
        exportDialog.showModal();
    });

    // Close when clicking the backdrop
    exportDialog.addEventListener('click', (e) => {
        if (e.target === exportDialog) exportDialog.close('cancel');
    });

    exportDialog.addEventListener('close', () => {
        const format = exportDialog.returnValue;
        if (format === 'txt' || format === 'json') {
            exportPosts(format);
        }
    });
}

function updateExportButton() {
    if (exportButton) exportButton.disabled = filteredPosts.length === 0;
}

// Decode the few HTML entities present in the source text
function decodeEntities(text) {
    return text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
}

// Convert "M/D/YYYY h:mm:ss AM" to "YYYY-MM-DDTHH:MM:SS" (no timezone, the source data has none)
function toISODateTime(dateString) {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i.exec(dateString || '');
    if (!match) return null;

    const [, month, day, year, rawHour = '0', minute = '00', second = '00', meridiem] = match;
    let hour = parseInt(rawHour, 10);
    if (meridiem) {
        const isPM = meridiem.toUpperCase() === 'PM';
        if (hour === 12) hour = isPM ? 12 : 0;
        else if (isPM) hour += 12;
    }

    const pad = (n) => String(n).padStart(2, '0');
    return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${minute}:${second}`;
}

function toISODate(date) {
    if (!date) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function buildExportData() {
    const posts = filteredPosts.map((post, index) => ({
        index: index + 1,
        id: String(post.id),
        url: post.id ? `https://x.com/i/status/${post.id}` : null,
        created_at: toISODateTime(post.created_at),
        type: post.type,
        text: decodeEntities(post.text.trim()),
        metrics: {
            views: post.views,
            favorites: post.favorites,
            reposts: post.reposts,
            replies: post.replies,
            bookmarks: post.bookmarks
        }
    }));

    const dates = posts.map(p => p.created_at).filter(Boolean).sort();

    return {
        metadata: {
            description: `Posts by ${EXPORT_ACCOUNT.name} (${EXPORT_ACCOUNT.handle} on X/Twitter), exported from the filtered results of a post archive viewer.`,
            account: EXPORT_ACCOUNT,
            exported_at: new Date().toISOString(),
            filters: {
                search_query: currentSearchTerm || null,
                date_from: toISODate(currentStartDate),
                date_to: toISODate(currentEndDate)
            },
            post_count: posts.length,
            total_posts_in_archive: allPosts.length,
            date_range: dates.length ? { earliest: dates[0], latest: dates[dates.length - 1] } : null,
            order: 'Newest first, same order as displayed',
            field_notes: {
                created_at: 'ISO 8601 local date and time as recorded in the source data; timezone not specified',
                type: 'Tweet = original post, Reply = reply to another post, Retweet = repost of another post',
                text: 'Verbatim post text; @mentions at the start of a reply indicate who was being replied to',
                metrics: 'Engagement counts at the time the archive was collected'
            }
        },
        posts
    };
}

function formatExportAsText(data) {
    const { metadata, posts } = data;
    const { filters } = metadata;
    const lines = [];

    lines.push(`POSTS BY ${metadata.account.name.toUpperCase()} (${metadata.account.handle} on X/Twitter)`);
    lines.push('');
    lines.push('== EXPORT INFO ==');
    lines.push(`Exported at: ${metadata.exported_at}`);
    lines.push(`Posts in this export: ${metadata.post_count} (of ${metadata.total_posts_in_archive} in the full archive)`);
    lines.push(`Search query: ${filters.search_query ? `"${filters.search_query}"` : 'none'}`);
    lines.push(`Date filter: ${filters.date_from || filters.date_to ? `${filters.date_from || 'any'} to ${filters.date_to || 'any'}` : 'none'}`);
    if (metadata.date_range) {
        lines.push(`Date range of posts: ${metadata.date_range.earliest} to ${metadata.date_range.latest}`);
    }
    lines.push(`Order: ${metadata.order}`);
    lines.push('');
    lines.push('== FIELD NOTES ==');
    Object.entries(metadata.field_notes).forEach(([field, note]) => {
        lines.push(`- ${field}: ${note}`);
    });
    lines.push('');
    lines.push('== POSTS ==');

    posts.forEach(post => {
        const m = post.metrics;
        lines.push('');
        lines.push(`--- POST ${post.index} of ${posts.length} ---`);
        lines.push(`id: ${post.id}`);
        lines.push(`created_at: ${post.created_at || 'unknown'}`);
        lines.push(`type: ${post.type}`);
        lines.push(`url: ${post.url || 'unknown'}`);
        lines.push(`metrics: views=${m.views}, favorites=${m.favorites}, reposts=${m.reposts}, replies=${m.replies}, bookmarks=${m.bookmarks}`);
        lines.push('text:');
        lines.push(post.text);
        lines.push(`--- END POST ${post.index} ---`);
    });

    lines.push('');
    lines.push('== END OF EXPORT ==');
    return lines.join('\n') + '\n';
}

function exportPosts(format) {
    if (filteredPosts.length === 0) return;

    const data = buildExportData();
    const isFiltered = !!(currentSearchTerm || currentStartDate || currentEndDate);
    const filename = `ryan-routh-posts${isFiltered ? '-filtered' : ''}-${toISODate(new Date())}.${format}`;

    const content = format === 'json'
        ? JSON.stringify(data, null, 2) + '\n'
        : formatExportAsText(data);
    const mimeType = format === 'json' ? 'application/json' : 'text/plain';

    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Initialize the application
function init() {
    addSmoothScrolling();
    loadPosts();
    initializeSearch();
    initializeDateFilter();
    updateSearchPlaceholder();
    initializeTabSwitching();
    initializeDonorDatabase();
    initializeExport();
    
    // Update placeholder on window resize
    window.addEventListener('resize', updateSearchPlaceholder);
}

// ===== DONOR DATABASE FUNCTIONALITY =====

// Donor database variables
let allDonors = [];
let filteredDonors = [];
let currentDonorSearchTerm = '';
let currentFilters = {
    amount: '',
    borough: '',
    intermediary: '',
    sort: 'date-desc'
};

// Initialize tab switching
function initializeTabSwitching() {
    const navLinks = document.querySelectorAll('.nav-link');
    const tabContents = document.querySelectorAll('.tab-content');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = link.getAttribute('data-tab');
            
            // Update active nav link
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Show target tab content
            tabContents.forEach(tab => {
                if (tab.id === `${targetTab}-tab`) {
                    tab.style.display = 'block';
                } else {
                    tab.style.display = 'none';
                }
            });
            
            // Load donor data if switching to donors tab
            if (targetTab === 'donors' && allDonors.length === 0) {
                loadDonorData();
            }
        });
    });
}

// Initialize donor database
function initializeDonorDatabase() {
    // Search functionality
    const donorSearchInput = document.getElementById('donors-search-input');
    const clearDonorSearch = document.getElementById('clear-donors-search');
    
    if (donorSearchInput) {
        donorSearchInput.addEventListener('input', debounce(handleDonorSearch, 300));
    }
    
    if (clearDonorSearch) {
        clearDonorSearch.addEventListener('click', clearDonorSearchHandler);
    }
    
    // Filter functionality
    const filters = ['amount-filter', 'borough-filter', 'intermediary-filter', 'sort-filter'];
    filters.forEach(filterId => {
        const filterElement = document.getElementById(filterId);
        if (filterElement) {
            filterElement.addEventListener('change', handleDonorFilters);
        }
    });
    
    // Reset filters functionality
    const resetFiltersBtn = document.getElementById('reset-filters');
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', resetAllFilters);
    }
    
    // Initialize filters toggle functionality
    initializeFiltersToggle();
}

// Initialize filters toggle functionality
function initializeFiltersToggle() {
    const toggleButton = document.getElementById('toggle-donor-filters');
    const filtersContainer = document.getElementById('donors-filters-container');
    
    if (toggleButton && filtersContainer) {
        toggleButton.addEventListener('click', () => {
            const isExpanded = toggleButton.classList.contains('expanded');
            
            if (isExpanded) {
                // Collapse filters
                toggleButton.classList.remove('expanded');
                filtersContainer.classList.remove('expanded');
                filtersContainer.classList.add('collapsed');
            } else {
                // Expand filters
                toggleButton.classList.add('expanded');
                filtersContainer.classList.remove('collapsed');
                filtersContainer.classList.add('expanded');
            }
        });
        
        // Set initial state on mobile
        if (window.innerWidth <= 768) {
            filtersContainer.classList.add('collapsed');
        } else {
            filtersContainer.classList.add('expanded');
        }
        
        // Handle window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                // On desktop, always show filters
                filtersContainer.classList.remove('collapsed');
                filtersContainer.classList.add('expanded');
                toggleButton.classList.remove('expanded');
            } else {
                // On mobile, respect the current toggle state
                if (!toggleButton.classList.contains('expanded')) {
                    filtersContainer.classList.add('collapsed');
                    filtersContainer.classList.remove('expanded');
                }
            }
        });
    }
}



// Start the application when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
