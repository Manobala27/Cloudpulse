/* eslint-disable no-unused-vars */
const Utils = {
    formatDate(isoString) {
        if (!isoString) return '-';
        const date = new Date(isoString);
        return date.toLocaleString(undefined, { 
            year: 'numeric', month: 'short', day: 'numeric', 
            hour: '2-digit', minute:'2-digit', second:'2-digit'
        });
    },

    getBadgeClass(level) {
        const mapping = {
            'INFO': 'badge-info',
            'WARNING': 'badge-warning',
            'ERROR': 'badge-error',
            'CRITICAL': 'badge-critical'
        };
        return mapping[level] || '';
    },

    createBadge(level) {
        return `<span class="badge ${this.getBadgeClass(level)}">${level}</span>`;
    },
    
    highlightText(text, searchStr) {
        if (!searchStr || !text) return text;
        const regex = new RegExp(`(${searchStr})`, 'gi');
        return text.toString().replace(regex, '<span class="search-highlight">$1</span>');
    },

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    },
    
    showSkeletons(selectors) {
        selectors.forEach(sel => {
            const el = document.getElementById(sel);
            if (el) {
                if (el.tagName === 'DIV' && el.classList.contains('chart-container')) {
                    el.classList.add('skeleton-box');
                    const canvas = el.querySelector('canvas');
                    if (canvas) canvas.style.opacity = '0';
                } else {
                    el.classList.add('skeleton-text');
                    // Reset to '0' only for numeric count indicators
                    if (['kpi-total', 'kpi-info', 'kpi-warning', 'kpi-error', 'kpi-critical', 'kpi-recent-errors', 'kpi-auth-failures'].includes(sel)) {
                        el.textContent = '0';
                    }
                }
            }
        });
    },
    
    hideSkeletons(selectors) {
        selectors.forEach(sel => {
            const el = document.getElementById(sel);
            if (el) {
                if (el.tagName === 'DIV' && el.classList.contains('chart-container')) {
                    el.classList.remove('skeleton-box');
                    const canvas = el.querySelector('canvas');
                    if (canvas) canvas.style.opacity = '1';
                } else {
                    el.classList.remove('skeleton-text');
                }
            }
        });
    },

    createTableSkeletonRow() {
        return `
            <tr>
                <td><div class="skeleton-text" style="width: 120px;">0</div></td>
                <td><div class="skeleton-text" style="width: 100px;">0</div></td>
                <td><div class="skeleton-text" style="width: 60px;">0</div></td>
                <td><div class="skeleton-text" style="width: 250px;">0</div></td>
                <td><div class="skeleton-text" style="width: 200px;">0</div></td>
            </tr>
        `;
    }
};
