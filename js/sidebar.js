import { supabase } from './supabase.js';

export async function loadSidebar() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) return;

        const { data: profile } = await supabase
            .from('employees')
            .select('system_role, email')
            .eq('id', session.user.id)
            .single();

        const isAdmin = profile && profile.system_role === 'Admin';
        const userEmail = profile ? profile.email : session.user.email;
        const initial = userEmail.charAt(0).toUpperCase();
        
        const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';

        // Sasarkan elemen yang akan digantikan (Header atau Container Menu)
        const headerContainer = document.querySelector('.topbar') || document.getElementById('sidebar-container');
        if (!headerContainer) return;

        let navHtml = '';

        // -- BAHAGIAN KIRI: BRANDING --
        navHtml += '<a class="brand" href="dashboard.html" aria-label="WORKTIMESYS">' +
                        '<div class="brand-mark"></div>' +
                        '<div class="brand-copy">' +
                            '<strong>WORKTIME<span>SYS</span></strong>' +
                            '<small>TIME | PROJECT | TEAM</small>' +
                        '</div>' +
                    '</a>';

        // -- BAHAGIAN TENGAH: NAVIGATION LINKS --
        navHtml += '<nav class="nav" id="mainNav">';
        
        // 1. TIMESHEET
        navHtml += '<a class="nav-link ' + (currentPage.includes('timesheet') ? 'active' : '') + '" href="timesheet.html"><span class="nav-icon">▣</span>TIMESHEET</a>';
        
        // 2. CALENDAR
        navHtml += '<a class="nav-link ' + (currentPage.includes('calendar') ? 'active' : '') + '" href="calendar.html"><span class="nav-icon">▦</span>CALENDAR</a>';
        
        // 3. TRACKING
        navHtml += '<a class="nav-link ' + (currentPage.includes('tracker') || currentPage.includes('tracking') ? 'active' : '') + '" href="tracker.html"><span class="nav-icon">◷</span>TRACKING</a>';
        
        // 4. OVERVIEW (Dashboard)
        navHtml += '<a class="nav-link ' + (currentPage.includes('dashboard') ? 'active' : '') + '" href="dashboard.html"><span class="nav-icon">⌂</span>OVERVIEW</a>';
        
        // 5. ANALYTICS (Reports)
        navHtml += '<a class="nav-link ' + (currentPage.includes('reports') ? 'active' : '') + '" href="reports.html"><span class="nav-icon">▥</span>ANALYTICS</a>';

        // Menu Admin Sahaja
        if (isAdmin) {
            navHtml += '<a class="nav-link ' + (currentPage.includes('projects') ? 'active' : '') + '" href="projects.html"><span class="nav-icon">📁</span>PROJECT</a>';
            navHtml += '<a class="nav-link ' + (currentPage.includes('tags') ? 'active' : '') + '" href="tags.html"><span class="nav-icon">🏷️</span>TAGS</a>';
            navHtml += '<a class="nav-link ' + (currentPage.includes('employee') ? 'active' : '') + '" href="employees.html"><span class="nav-icon">♧</span>EMPLOYEES</a>';
            navHtml += '<a class="nav-link ' + (currentPage.includes('clients') ? 'active' : '') + '" href="clients.html"><span class="nav-icon">♙</span>CLIENTS</a>';
        }
        navHtml += '</nav>';

        // -- BAHAGIAN KANAN: ACTIONS & PROFILE --
        navHtml += '<div class="top-actions">' +
                        '<button class="icon-btn relative" type="button" title="Notifications">' +
                            '🔔' +
                            '<span class="notification-dot absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full border border-white">3</span>' +
                        '</button>' +

                        '<div class="profile relative group">' +
                            '<div class="avatar" id="avatarInitial">' + initial + '</div>' +
                            '<div class="profile-text hidden sm:block">' +
                                '<strong id="profileName">' + userEmail.split('@')[0].toUpperCase() + '</strong>' +
                                '<small id="profileRole">' + (isAdmin ? 'Administrator' : profile.system_role) + '</small>' +
                            '</div>' +
                            '<span class="ml-1 text-gray-400">⌄</span>' +
                            
                            '<div class="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 overflow-hidden">' +
                                '<button id="logoutBtn" class="w-full text-left px-4 py-3 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors">⏻ Logout</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>';

        // Render ke dalam header
        headerContainer.innerHTML = navHtml;
        
        // Bind fungsi Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                supabase.auth.signOut().then(() => window.location.href = '../pages/login.html');
            });
        }

    } catch (err) {
        console.error("Menu Navigation Load Error:", err);
    }
}

document.addEventListener('DOMContentLoaded', loadSidebar);
