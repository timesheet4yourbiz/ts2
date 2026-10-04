import { supabase } from './supabase.js';

export async function loadSidebar() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) return;

        // KEMAS KINI: Tambah 'name' di dalam carian select()
        const { data: profiles } = await supabase
            .from('employees')
            .select('name, system_role, email')
            .ilike('email', session.user.email.trim())
            .limit(1);

        const profile = profiles && profiles.length > 0 ? profiles[0] : null;

        const isAdmin = profile && profile.system_role && profile.system_role.toLowerCase() === 'admin';
        const userEmail = profile ? profile.email : session.user.email;
        
        // KEMAS KINI: Paparkan Nama sebenar, jika tiada baru gunakan e-mel
        const displayName = profile && profile.name ? profile.name : userEmail.split('@')[0];
        const initial = displayName.charAt(0).toUpperCase();
        const fullName = displayName.toUpperCase();
        
        const roleText = isAdmin ? 'Administrator' : (profile && profile.system_role ? profile.system_role : 'User');
        
        const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';

        const headerContainer = document.getElementById('topbarContainer') || document.querySelector('.topbar');
        if (!headerContainer) return;

        let navHtml = '';

        navHtml += '<a class="flex items-center gap-2.5 min-w-[195px] no-underline text-slate-800" href="dashboard.html" aria-label="WORKTIMESYS">' +
                        '<div class="w-8 h-9 relative flex items-center justify-center flex-none">' +
                            '<div class="absolute w-[19px] h-[19px] bg-gradient-to-br from-blue-600 to-amber-500 rounded transform rotate-[30deg] -skew-x-[4deg] top-[3px] left-[3px]"></div>' +
                            '<div class="absolute w-[19px] h-[19px] bg-gradient-to-br from-blue-900 to-red-500 rounded transform rotate-[30deg] -skew-x-[4deg] bottom-[3px] right-[1px]"></div>' +
                        '</div>' +
                        '<div>' +
                            '<strong class="block text-[19px] leading-[18px] tracking-[-0.8px] font-extrabold">WORKTIME<span class="text-blue-600">SYS</span></strong>' +
                            '<small class="block mt-[3px] text-[9px] font-extrabold tracking-[0.35px] text-slate-500">TIME | PROJECT | TEAM</small>' +
                        '</div>' +
                    '</a>';

        navHtml += '<nav class="flex flex-1 items-center gap-1.5 min-w-0" id="mainNav">';
        navHtml += '<a class="nav-link ' + (currentPage.includes('timesheet') ? 'active' : '') + '" href="timesheet.html">TIMESHEET</a>';
        navHtml += '<a class="nav-link ' + (currentPage.includes('calendar') ? 'active' : '') + '" href="calendar.html">CALENDAR</a>';
        
/*      navHtml += '<a class="nav-link ' + (currentPage.includes('tracker') || currentPage.includes('tracking') ? 'active' : '') + '" href="tracker.html">TRACKING</a>'; */ 
        
        navHtml += '<a class="nav-link ' + (currentPage.includes('dashboard') ? 'active' : '') + '" href="dashboard.html">OVERVIEW</a>';
        navHtml += '<a class="nav-link ' + (currentPage.includes('reports') ? 'active' : '') + '" href="reports.html">ANALYTICS</a>';

        if (isAdmin) {
            navHtml += '<a class="nav-link ' + (currentPage.includes('projects') ? 'active' : '') + '" href="projects.html">PROJECT</a>';
            navHtml += '<a class="nav-link ' + (currentPage.includes('tags') ? 'active' : '') + '" href="tags.html">TAGS</a>';
            navHtml += '<a class="nav-link ' + (currentPage.includes('employee') || currentPage.includes('team') ? 'active' : '') + '" href="employees.html">TEAM</a>';
            navHtml += '<a class="nav-link ' + (currentPage.includes('clients') ? 'active' : '') + '" href="clients.html">CLIENTS</a>';
        }
        navHtml += '</nav>';

        navHtml += '<div class="flex items-center gap-4 flex-none ml-4">' +
                        '<button class="relative text-slate-400 hover:text-blue-600 transition-colors flex items-center justify-center" title="Notifications">' +
                            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                                '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>' +
                                '<path d="M13.73 21a2 2 0 0 1-3.46 0"></path>' +
                            '</svg>' +
                            '<span class="absolute -top-1 -right-1 bg-red-500 w-2 h-2 rounded-full border-2 border-white"></span>' +
                        '</button>' +
                        '<div class="w-px h-6 bg-slate-200"></div>' +
                        '<div class="flex items-center gap-3">' +
                            '<div class="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">' + initial + '</div>' +
                            '<div class="flex flex-col hidden sm:flex">' +
                                '<span class="text-[11px] font-extrabold text-slate-700 max-w-[130px] truncate" title="' + fullName + '">' + fullName + '</span>' +
                                '<span class="text-[9px] font-bold tracking-wide text-slate-400 uppercase mt-0.5">' + roleText + '</span>' +
                            '</div>' +
                        '</div>' +
                        '<div class="w-px h-6 bg-slate-200"></div>' +
                        '<div class="flex items-center gap-1.5">' +
                            '<a href="profile.html" title="Update Profile" class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition-colors">' +
                                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                                    '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>' +
                                    '<circle cx="12" cy="7" r="4"></circle>' +
                                '</svg>' +
                            '</a>' +
                            '<button id="logoutBtn" title="Logout" class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">' +
                                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                                    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>' +
                                    '<polyline points="16 17 21 12 16 7"></polyline>' +
                                    '<line x1="21" y1="12" x2="9" y2="12"></line>' +
                                '</svg>' +
                            '</button>' +
                        '</div>' +
                    '</div>';

        headerContainer.innerHTML = navHtml;
        
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
