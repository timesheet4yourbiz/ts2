import { supabase } from './supabase.js';

export async function loadSidebar() {
    try {
        const currentPath = window.location.pathname.split('/').pop() || 'dashboard.html';
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === currentPath) {
                link.classList.add('active');
            }
        });

        // 1. BAIKI ISU TARIKH LOADING (Sokong semua jenis ID)
        const topDateText = document.getElementById('dashDateRangeText') || document.getElementById('topDateText');
        if (topDateText) {
            const today = new Date();
            const day = today.getDay();
            const diffToMonday = day === 0 ? -6 : 1 - day;
            const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diffToMonday);
            const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diffToMonday + 6);
            topDateText.textContent = start.toLocaleDateString('en-US', {month:'short', day:'numeric'}) + ' - ' + end.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) return window.location.href = '../pages/login.html';

        const userEmail = session.user.email;
        const dropEmail = document.getElementById('dropdownEmail');
        const avatarInit = document.getElementById('avatarInitial');
        const profName = document.getElementById('profileName');
        const profRole = document.getElementById('profileRole');

        if (dropEmail) dropEmail.textContent = userEmail;
        if (avatarInit) avatarInit.textContent = userEmail.charAt(0).toUpperCase();

        // 2. BAIKI ISU PROFIL LOADING (Auto letak 'User' jika gagal)
        try {
            const { data: emp } = await supabase.from('employees').select('name, system_role').eq('id', session.user.id).single();
            if (emp) {
                if (profName) profName.textContent = (emp.name || userEmail.split('@')[0]).toUpperCase();
                if (profRole) profRole.textContent = emp.system_role || 'User';
            }
        } catch(e) {
            if (profName) profName.textContent = userEmail.split('@')[0].toUpperCase();
            if (profRole) profRole.textContent = 'User';
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await supabase.auth.signOut();
                window.location.href = '../pages/login.html';
            });
        }

    } catch (err) {
        console.error('Ralat Enjin Top Menu:', err);
    }
}
