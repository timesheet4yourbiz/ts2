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
        navHtml += '(BUKA)a class="nav-link ' + (currentPage.includes('timesheet') ? 'active' : '') + '" href="timesheet.html"(TUTUP)(BUKA)span class="nav-icon"(TUTUP)▣(BUKA)/span(TUTUP)TIMESHEET(BUKA)/a(TUTUP)';
        
        // 2. CALENDAR
        navHtml += '(BUKA)a class="nav-link ' + (currentPage.includes('calendar') ? 'active' : '') + '" href="calendar.html"(TUTUP)(BUKA)span class="nav-icon"(TUTUP)▦(BUKA)/span(TUTUP)CALENDAR(BUKA)/a(TUTUP)';
        
        // 3. TRACKING
        navHtml += '(BUKA)a class="nav-link ' + (currentPage.includes('tracking') ? 'active' : '') + '" href="tracking.html"(TUTUP)(BUKA)span class="nav-icon"(TUTUP)◷(BUKA)/span(TUTUP)TRACKING(BUKA)/a(TUTUP)';
        
        // 4. OVERVIEW
        navHtml += '(BUKA)a class="nav-link ' + (currentPage.includes('dashboard') ? 'active' : '') + '" href="dashboard.html"(TUTUP)(BUKA)span class="nav-icon"(TUTUP)⌂(BUKA)/span(TUTUP)OVERVIEW(BUKA)/a(TUTUP)';
        
        // 5. ANALYTICS
        navHtml += '(BUKA)a class="nav-link ' + (currentPage.includes('reports') ? 'active' : '') + '" href="reports.html"(TUTUP)(BUKA)span class="nav-icon"(TUTUP)▥(BUKA)/span(TUTUP)ANALYTICS(BUKA)/a(TUTUP)';

        if (isAdmin) {
            // 6. PROJECT
            navHtml += '(BUKA)a class="nav-link ' + (currentPage.includes('projects') ? 'active' : '') + '" href="projects.html"(TUTUP)(BUKA)span class="nav-icon"(TUTUP)📁(BUKA)/span(TUTUP)PROJECT(BUKA)/a(TUTUP)';
            
            // 7. TAGS
            navHtml += '(BUKA)a class="nav-link ' + (currentPage.includes('tags') ? 'active' : '') + '" href="tags.html"(TUTUP)(BUKA)span class="nav-icon"(TUTUP)🏷️(BUKA)/span(TUTUP)TAGS(BUKA)/a(TUTUP)';
            
            // 8. EMPLOYEES
            navHtml += '(BUKA)a class="nav-link ' + (currentPage.includes('employee') ? 'active' : '') + '" href="employee.html"(TUTUP)(BUKA)span class="nav-icon"(TUTUP)♧(BUKA)/span(TUTUP)EMPLOYEES(BUKA)/a(TUTUP)';
            
            // 9. CLIENTS
            navHtml += '(BUKA)a class="nav-link ' + (currentPage.includes('clients') ? 'active' : '') + '" href="clients.html"(TUTUP)(BUKA)span class="nav-icon"(TUTUP)♙(BUKA)/span(TUTUP)CLIENTS(BUKA)/a(TUTUP)';
        }

        nav.innerHTML = navHtml;

    } catch (err) {
        console.error("Menu Navigation Load Error:", err);
    }
}

document.addEventListener('DOMContentLoaded', loadSidebar);
