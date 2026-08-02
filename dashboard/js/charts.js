/* eslint-disable no-unused-vars */
class ChartManager {
    constructor() {
        this.pieChart = null;
        this.barChart = null;
        this.timelineChart = null;
    }

    getThemeColors() {
        const style = getComputedStyle(document.body);
        return {
            textSecondary: style.getPropertyValue('--text-secondary').trim() || '#94A3B8',
            borderColor: style.getPropertyValue('--border-color').trim() || 'rgba(255, 255, 255, 0.08)',
            colorPrimary: style.getPropertyValue('--color-primary').trim() || '#E11D48',
            colorPrimaryHover: style.getPropertyValue('--color-primary-hover').trim() || '#F43F5E',
            colorSecondary: style.getPropertyValue('--color-secondary').trim() || '#FB7185',
            
            colorSuccess: style.getPropertyValue('--color-success').trim() || '#10B981',
            colorWarning: style.getPropertyValue('--color-warning').trim() || '#F59E0B',
            colorDanger: style.getPropertyValue('--color-danger').trim() || '#EF4444',
            colorCritical: '#B91C1C'
        };
    }

    applyGlobalDefaults(colors) {
        Chart.defaults.color = colors.textSecondary;
        Chart.defaults.borderColor = colors.borderColor;
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.font.size = 11;
        Chart.defaults.animation.duration = 800;
        Chart.defaults.animation.easing = 'easeOutQuart';
    }

    destroyAll() {
        if (this.pieChart) this.pieChart.destroy();
        if (this.barChart) this.barChart.destroy();
        if (this.timelineChart) this.timelineChart.destroy();
    }

    renderPieChart(ctx, data) {
        if (!ctx) return;
        if (this.pieChart) this.pieChart.destroy();
        
        const colors = this.getThemeColors();
        this.applyGlobalDefaults(colors);

        const counts = { INFO: 0, WARNING: 0, ERROR: 0, CRITICAL: 0 };
        data.forEach(log => {
            if (counts[log.level] !== undefined) counts[log.level]++;
        });

        this.pieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['INFO', 'WARNING', 'ERROR', 'CRITICAL'],
                datasets: [{
                    data: [counts.INFO, counts.WARNING, counts.ERROR, counts.CRITICAL],
                    backgroundColor: [colors.colorSuccess, colors.colorWarning, colors.colorDanger, colors.colorCritical],
                    borderWidth: 2.5,
                    borderColor: document.body.classList.contains('light-theme') ? '#FFFFFF' : '#0f1422',
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '80%',
                plugins: {
                    legend: { 
                        position: 'right',
                        labels: {
                            padding: 16,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: {
                                size: 11,
                                weight: '600'
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#090d16',
                        titleColor: '#FFFFFF',
                        bodyColor: '#F8FAFC',
                        padding: 10,
                        cornerRadius: 8,
                        boxPadding: 6,
                        borderColor: colors.borderColor,
                        borderWidth: 1
                    }
                }
            }
        });
    }

    renderBarChart(ctx, data) {
        if (!ctx) return;
        if (this.barChart) this.barChart.destroy();
        
        const colors = this.getThemeColors();
        this.applyGlobalDefaults(colors);

        const services = {};
        data.forEach(log => {
            services[log.service_name] = (services[log.service_name] || 0) + 1;
        });

        const canvasCtx = ctx.getContext ? ctx.getContext('2d') : null;
        let barBg = colors.colorPrimary;
        if (canvasCtx) {
            const gradient = canvasCtx.createLinearGradient(0, 0, 0, ctx.clientHeight || 200);
            gradient.addColorStop(0, colors.colorPrimary);
            gradient.addColorStop(1, 'rgba(244, 63, 94, 0.25)');
            barBg = gradient;
        }

        this.barChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(services),
                datasets: [{
                    label: 'Log Count',
                    data: Object.values(services),
                    backgroundColor: barBg,
                    hoverBackgroundColor: colors.colorPrimaryHover,
                    borderRadius: 6,
                    borderSkipped: false,
                    barPercentage: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#090d16',
                        titleColor: '#FFFFFF',
                        bodyColor: '#F8FAFC',
                        padding: 10,
                        cornerRadius: 8,
                        borderColor: colors.borderColor,
                        borderWidth: 1
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        ticks: { stepSize: 1, padding: 8, color: colors.textSecondary },
                        grid: {
                            color: colors.borderColor,
                            drawBorder: false
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { padding: 8, color: colors.textSecondary }
                    }
                }
            }
        });
    }

    renderTimelineChart(ctx, data) {
        if (!ctx) return;
        if (this.timelineChart) this.timelineChart.destroy();
        
        const colors = this.getThemeColors();
        this.applyGlobalDefaults(colors);

        const sortedData = [...data].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        const labels = sortedData.map(log => {
            const d = new Date(log.timestamp);
            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
        });
        
        const levelValues = { 'INFO': 1, 'WARNING': 2, 'ERROR': 3, 'CRITICAL': 4 };
        const points = sortedData.map(log => levelValues[log.level] || 0);

        const canvasCtx = ctx.getContext ? ctx.getContext('2d') : null;
        let lineBg = 'rgba(251, 113, 133, 0.06)';
        if (canvasCtx) {
            const gradient = canvasCtx.createLinearGradient(0, 0, 0, ctx.clientHeight || 200);
            gradient.addColorStop(0, 'rgba(244, 63, 94, 0.2)');
            gradient.addColorStop(1, 'rgba(244, 63, 94, 0.0)');
            lineBg = gradient;
        }

        this.timelineChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Severity Level',
                    data: points,
                    borderColor: colors.colorSecondary,
                    backgroundColor: lineBg,
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointHoverRadius: 6,
                    pointBackgroundColor: colors.colorSecondary,
                    pointBorderColor: 'transparent'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#090d16',
                        titleColor: '#FFFFFF',
                        bodyColor: '#F8FAFC',
                        padding: 10,
                        cornerRadius: 8,
                        borderColor: colors.borderColor,
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                const map = {1: 'INFO', 2: 'WARNING', 3: 'ERROR', 4: 'CRITICAL'};
                                return 'Level: ' + (map[context.raw] || 'Unknown');
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        min: 0,
                        max: 5,
                        ticks: {
                            stepSize: 1,
                            padding: 8,
                            color: colors.textSecondary,
                            callback: function(value) {
                                const map = {1: 'INFO', 2: 'WARN', 3: 'ERROR', 4: 'CRIT'};
                                return map[value] || '';
                            }
                        },
                        grid: {
                            color: colors.borderColor,
                            drawBorder: false
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { maxTicksLimit: 10, padding: 8, color: colors.textSecondary }
                    }
                }
            }
        });
    }
}
