/**
 * WakeTrack Core Logic
 */

// --- Router ---
const router = {
    pages: ['dashboard', 'tracker', 'tasks', 'routines', 'settings'],
    navigate: (targetId) => {
        // Hide all pages
        document.querySelectorAll('.page-section').forEach(el => el.classList.add('hidden'));
        // Show target
        document.getElementById(targetId).classList.remove('hidden');

        // Update Nav
        document.querySelectorAll('.nav-btn').forEach(btn => {
            if (btn.dataset.target === targetId) {
                btn.classList.add('active', 'text-primary', 'dark:text-white');
                btn.classList.remove('text-gray-500');
            } else {
                btn.classList.remove('active', 'text-primary', 'dark:text-white');
                btn.classList.add('text-gray-500');
            }
        });

        // Trigger specific page loads
        if (targetId === 'dashboard') app.renderDashboard();
        if (targetId === 'tracker') app.renderTracker();
    }
};

// --- App State & Logic ---
const app = {
    data: {
        wakeUps: [], // Array of { date: 'YYYY-MM-DD', time: 'HH:MM' }
        tasks: [], // Array of { id: ts, text: string, completed: bool }
        routines: { morning: '', evening: '' },
        settings: { darkMode: false }
    },
    chartInstance: null,

    init: () => {
        app.loadData();
        app.applySettings();
        app.renderDashboard();

        // Initial route
        router.navigate('dashboard');

        // Clock / Date update
        app.updateTime();
        setInterval(app.updateTime, 60000);
    },

    loadData: () => {
        const stored = localStorage.getItem('waketrack_data');
        if (stored) {
            app.data = JSON.parse(stored);
        }
    },

    saveData: () => {
        localStorage.setItem('waketrack_data', JSON.stringify(app.data));
    },

    // --- Dashboard ---
    updateTime: () => {
        const now = new Date();
        const hour = now.getHours();
        const greetingSpan = document.getElementById('greeting-time');

        if (hour < 12) greetingSpan.textContent = 'Morning';
        else if (hour < 18) greetingSpan.textContent = 'Afternoon';
        else greetingSpan.textContent = 'Evening';

        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('current-date').textContent = now.toLocaleDateString(undefined, options);
    },

    saveWakeUpTime: () => {
        const input = document.getElementById('wake-time-input');
        if (!input.value) return alert('Please set a time first!');

        const today = new Date().toISOString().split('T')[0];
        // Check if already logged for today
        const existingIndex = app.data.wakeUps.findIndex(w => w.date === today);

        if (existingIndex >= 0) {
            if (!confirm('You already logged a time for today. Overwrite?')) return;
            app.data.wakeUps[existingIndex].time = input.value;
        } else {
            app.data.wakeUps.push({ date: today, time: input.value });
        }

        app.data.wakeUps.sort((a, b) => a.date.localeCompare(b.date)); // Keep sorted
        app.saveData();
        alert('Wake up time saved!');
        app.renderDashboard();
    },

    renderDashboard: () => {
        // Calculate Stats
        const logs = app.data.wakeUps;
        let avgTime = '--:--';
        let streak = 0;

        if (logs.length > 0) {
            // Avg Time
            let totalMinutes = 0;
            logs.forEach(log => {
                const [h, m] = log.time.split(':').map(Number);
                totalMinutes += h * 60 + m;
            });
            const avgMins = Math.round(totalMinutes / logs.length);
            const avgH = Math.floor(avgMins / 60);
            const avgM = avgMins % 60;
            avgTime = `${String(avgH).padStart(2, '0')}:${String(avgM).padStart(2, '0')}`;

            // Streak (Naive implementation: consecutive days ending today/yesterday)
            let currentStreak = 0;
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

            // Check if last entry is today or yesterday to even start counting streak
            const lastEntry = logs[logs.length - 1];
            if (lastEntry.date === today || lastEntry.date === yesterday) {
                currentStreak = 1;
                for (let i = logs.length - 2; i >= 0; i--) {
                    const curr = new Date(logs[i + 1].date);
                    const prev = new Date(logs[i].date);
                    const diffTime = Math.abs(curr - prev);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays === 1) {
                        currentStreak++;
                    } else {
                        break;
                    }
                }
            }
            streak = currentStreak;
        }

        document.getElementById('dash-avg-time').textContent = avgTime;
        document.getElementById('dash-streak').textContent = `${streak} days`;

        // Render Tasks Preview (First 3 incomplete)
        const list = document.getElementById('dash-task-list');
        list.innerHTML = '';
        const pending = app.data.tasks.filter(t => !t.completed).slice(0, 3);

        if (pending.length === 0) {
            list.innerHTML = '<li class="text-gray-500 italic text-sm">No pending tasks for today.</li>';
        } else {
            pending.forEach(t => {
                const li = document.createElement('li');
                li.className = 'flex items-center';
                li.innerHTML = `<span class="w-3 h-3 bg-primary rounded-full mr-2"></span><span class="text-gray-700 dark:text-gray-300 truncate">${t.text}</span>`;
                list.appendChild(li);
            });
        }
    },

    // --- Tracker (Charts) ---
    renderTracker: () => {
        const ctx = document.getElementById('wakeChart').getContext('2d');
        const logs = app.data.wakeUps.slice(-7); // Last 7 entries

        const labels = logs.map(l => l.date);
        const data = logs.map(l => {
            const [h, m] = l.time.split(':').map(Number);
            return h + (m / 60); // Decimal hours
        });

        if (app.chartInstance) app.chartInstance.destroy();

        app.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Wake Up Time (Hour)',
                    data: data,
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(79, 70, 229, 0.2)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: function (value) {
                                const h = Math.floor(value);
                                const m = Math.round((value - h) * 60);
                                return `${h}:${String(m).padStart(2, '0')}`;
                            }
                        }
                    }
                }
            }
        });

        // History List
        const list = document.getElementById('history-list');
        list.innerHTML = '';
        [...app.data.wakeUps].reverse().forEach(log => {
            const li = document.createElement('li');
            li.className = 'flex justify-between p-2 border-b border-gray-100 dark:border-gray-700';
            li.innerHTML = `<span>${log.date}</span> <span class="font-bold font-mono">${log.time}</span>`;
            list.appendChild(li);
        });
    },

    // --- Task Manager ---
    renderTasks: () => {
        const list = document.getElementById('main-task-list');
        list.innerHTML = '';

        app.data.tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm ${task.completed ? 'opacity-50' : ''}`;

            let dateHtml = '';
            if (task.dueDate) {
                const dateObj = new Date(task.dueDate);
                const displayDate = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                // Check if overdue (only if not completed)
                const isOverdue = !task.completed && new Date().toISOString().split('T')[0] > task.dueDate;
                const dateClass = isOverdue ? 'text-red-500 font-bold' : 'text-gray-400 text-xs';
                dateHtml = `<span class="${dateClass} mr-3"><i class="far fa-calendar-alt mr-1"></i>${displayDate}</span>`;
            }

            li.innerHTML = `
                <div class="flex items-center flex-grow">
                     <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="app.toggleTask(${task.id})" class="w-5 h-5 mr-3 text-primary rounded focus:ring-primary">
                     <span class="${task.completed ? 'line-through text-gray-500' : ''} mr-2">${task.text}</span>
                </div>
                ${dateHtml}
                <button onclick="app.deleteTask(${task.id})" class="text-red-400 hover:text-red-600 ml-2"><i class="fas fa-trash"></i></button>
            `;
            list.appendChild(li);
        });
    },

    addTask: () => {
        const input = document.getElementById('new-task-input');
        const dateInput = document.getElementById('new-task-date');
        const text = input.value.trim();
        const date = dateInput.value;

        if (!text) return;

        app.data.tasks.push({
            id: Date.now(),
            text: text,
            dueDate: date,
            completed: false
        });
        app.saveData();
        input.value = '';
        dateInput.value = '';
        app.renderTasks();
        app.renderDashboard(); // Update dashboard preview
    },

    toggleTask: (id) => {
        const task = app.data.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            app.saveData();
            app.renderTasks();
            app.renderDashboard();
        }
    },

    deleteTask: (id) => {
        app.data.tasks = app.data.tasks.filter(t => t.id !== id);
        app.saveData();
        app.renderTasks();
        app.renderDashboard();
    },

    clearCompletedTasks: () => {
        if (!confirm('Remove all completed tasks?')) return;
        app.data.tasks = app.data.tasks.filter(t => !t.completed);
        app.saveData();
        app.renderTasks();
    },

    // --- Routines ---
    saveRoutines: () => {
        const morning = document.getElementById('routine-morning').value;
        const evening = document.getElementById('routine-evening').value;
        app.data.routines = { morning, evening };
        app.saveData();
        alert('Routines saved!');
    },

    loadRoutines: () => {
        document.getElementById('routine-morning').value = app.data.routines.morning || '';
        document.getElementById('routine-evening').value = app.data.routines.evening || '';
    },

    // --- Settings ---
    applySettings: () => {
        const isDark = app.data.settings.darkMode;
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        // Update toggle UI matches state
    },

    toggleDarkMode: () => {
        app.data.settings.darkMode = !app.data.settings.darkMode;
        app.saveData();
        app.applySettings();
    },

    requestNotificationPermission: () => {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                alert('Notifications enabled!');
                new Notification('WakeTrack', { body: 'Notifications are working!' });
            } else {
                alert('Permission denied or dismissed.');
            }
        });
    },

    exportData: () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(app.data));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "waketrack_backup.json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    },

    importData: (input) => {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                app.data = json;
                app.saveData();
                alert('Data imported successfully! Reloading...');
                location.reload();
            } catch (err) {
                alert('Invalid JSON file.');
            }
        };
        reader.readAsText(file);
    },

    resetData: () => {
        if (confirm('Are you sure you want to delete ALL data? This cannot be undone.')) {
            localStorage.removeItem('waketrack_data');
            location.reload();
        }
    }
};

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    app.init();
    app.loadRoutines(); // Pre-fill routines

    // Explicit render tasks if needed (e.g., if starting on tasks page, though router handles it)
    router.navigate('dashboard');
});
