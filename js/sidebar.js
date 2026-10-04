import { supabase } from './supabase.js';

export async function loadSidebar() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) return;

        const { data: profile } = await supabase
            .from('employees')
            .select('system_role')
            .eq('id', session.user.id)
            .single();

        const isAdmin = profile && profile.system_role === 'Admin';
        const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';

        const nav = document.getElementById('mainNav');
        if (!nav) return;

        let navHtml = '';

        // 1. TIMESHEET
        navHtml += '<a class="nav-link ' + (currentPage.includes('timesheet') ? 'active' : '') + '" href="timesheet.html"><span class="nav-icon">▣</span>TIMESHEET</a>';
        
        // 2. CALENDAR
        navHtml += '<a class="nav-link ' + (currentPage.includes('calendar') ? 'active' : '') + '" href="calendar.html"><span class="nav-icon">▦</span>CALENDAR</a>';
        
        // 3. TRACKING
        navHtml += '<a class="nav-link ' + (currentPage.includes('tracking') ? 'active' : '') + '" href="tracking.html"><span class="nav-icon">◷</span>TRACKING</a>';
        
        // 4. OVERVIEW
        navHtml += '<a class="nav-link ' + (currentPage.includes('dashboard') ? 'active' : '') + '" href="dashboard.html"><span class="nav-icon">⌂</span>OVERVIEW</a>';
        
        // 5. ANALYTICS
        navHtml += '<a class="nav-link ' + (currentPage.includes('reports') ? 'active' : '') + '" href="reports.html"><span class="nav-icon">▥</span>ANALYTICS</a>';

        if (isAdmin) {
            // 6. PROJECT
            navHtml += '<a class="nav-link ' + (currentPage.includes('projects') ? 'active' : '') + '" href="projects.html"><span class="nav-icon">📁</span>PROJECT</a>';
            
            // 7. TAGS
            navHtml += '<a class="nav-link ' + (currentPage.includes('tags') ? 'active' : '') + '" href="tags.html"><span class="nav-icon">🏷️</span>TAGS</a>';
            
            // 8. EMPLOYEES
            navHtml += '<a class="nav-link ' + (currentPage.includes('employee') ? 'active' : '') + '" href="employee.html"><span class="nav-icon">♧</span>EMPLOYEES</a>';
            
            // 9. CLIENTS
            navHtml += '<a class="nav-link ' + (currentPage.includes('clients') ? 'active' : '') + '" href="clients.html"><span class="nav-icon">♙</span>CLIENTS</a>';
        }

        nav.innerHTML = navHtml;

    } catch (err) {
        console.error("Menu Navigation Load Error:", err);
    }
}

document.addEventListener('DOMContentLoaded', loadSidebar);
