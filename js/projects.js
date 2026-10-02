import { supabase } from './supabase.js';

let isAdmin = false;
let projectsData = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) return window.location.href = '../pages/login.html';
        
        // Avatar & Tarikh Header
        const avatarInitial = document.getElementById('avatarInitial');
        if (avatarInitial) avatarInitial.textContent = session.user.email.charAt(0).toUpperCase();

        const topDateText = document.getElementById('topDateText');
        if (topDateText) {
            const today = new Date();
            const start = new Date(today.setDate(today.getDate() - today.getDay() + 1));
            const end = new Date(today.setDate(today.getDate() + 6));
            topDateText.textContent = start.toLocaleDateString('en-US', {month:'short', day:'numeric'}) + ' - ' + end.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
        }

        // Semak Role
        const { data: profile } = await supabase.from('employees').select('system_role').eq('id', session.user.id).single();
        if (profile && profile.system_role === 'Admin') isAdmin = true;

        // BINDING MODAL & SEARCH
        setupModal();
        setupSearchAndFilter();

        // FETCH DATA
        await loadClientsDropdown();
        await loadProjects();

    } catch (err) {
        console.error("Projects Init Error:", err);
    }
});

function setupSearchAndFilter() {
    const sInput = document.getElementById('searchProjectInput');
    const fClient = document.getElementById('filterClient');

    const doFilter = () => {
        const term = (sInput.value || '').toLowerCase().trim();
        const cid = fClient.value;
        const filtered = projectsData.filter(p => {
            const matchName = (p.project_name || '').toLowerCase().includes(term);
            const matchClient = cid === '' || p.client_id === cid;
            return matchName && matchClient;
        });
        renderProjectsTable(filtered);
    };

    if(sInput) sInput.addEventListener('input', doFilter);
    if(fClient) fClient.addEventListener('change', doFilter);
}

async function loadClientsDropdown() {
    const cSelect = document.getElementById('clientSelect');
    const fClient = document.getElementById('filterClient');
    
    const { data, error } = await supabase.from('clients').select('id, client_name').order('client_name');
    if (!error && data) {
        const opts = data.map(c => '<option value="' + c.id + '">' + c.client_name + '</option>').join('');
        if(cSelect) cSelect.innerHTML = '<option value="">Select client</option>' + opts;
        if(fClient) fClient.innerHTML = '<option value="">All Clients</option>' + opts;
    }
}

async function loadProjects() {
    const tbody = document.getElementById('projectsList');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="10" class="text-center py-10 text-gray-400">Loading projects...</td></tr>';
    
    const { data: pData, error } = await supabase.from('projects').select('*, clients(client_name)').order('project_name', { ascending: true });

    if (error) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center py-10 text-red-500">Ralat: ' + error.message + '</td></tr>';
        return;
    }

    // MENGATASI HAD 1000 BARIS (PAGINATION LOOP) UNTUK TIME ENTRIES
    let allTimeEntries = [];
    let from = 0;
    const step = 999;
    let hasMore = true;

    while (hasMore) {
        const { data: tData, error: tErr } = await supabase
            .from('time_entries')
            .select('project_id, duration_seconds')
            .eq('status', 'STOPPED')
            .range(from, from + step);

        if (tErr) break;
        if (tData && tData.length > 0) {
            allTimeEntries = allTimeEntries.concat(tData);
            if (tData.length <= step) hasMore = false;
            else from += step + 1;
        } else {
            hasMore = false;
        }
    }

    let projectHours = {};
    allTimeEntries.forEach(entry => {
        const pid = entry.project_id;
        if (pid) {
            if (!projectHours[pid]) projectHours[pid] = 0;
            projectHours[pid] += (entry.duration_seconds || 0);
        }
    });

    // Simpan dalam memori secara telus
    projectsData = (pData || []).map(p => {
        p.tracked_seconds = projectHours[p.id] || 0;
        p.tracked_hours = (p.tracked_seconds / 3600).toFixed(1);
        return p;
    });

    renderProjectsTable(projectsData);
}

function renderProjectsTable(data) {
    const tbody = document.getElementById('projectsList');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center py-10 text-gray-400">No projects found.</td></tr>';
        updateKPIs([]);
        return;
    }

    let html = '';
    const dotColors = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-orange-500', 'bg-sky-500'];

    data.forEach((p, idx) => {
        const cName = p.clients ? p.clients.client_name : '-';
        const color = dotColors[idx % dotColors.length];
        const totalHours = p.tracked_hours || '0.0';
        
        // Simulasi Progress & Status (Mengikut Mockup)
        let progVal = 0; let statText = 'Not Started'; let statColor = 'bg-slate-100 text-slate-600'; let statDot = 'bg-slate-400';
        if(idx % 4 === 1) { progVal = 40; statText = 'In Progress'; statColor = 'bg-blue-50 text-blue-600 border border-blue-100'; statDot = 'bg-blue-500'; }
        else if(idx % 4 === 2) { progVal = 75; statText = 'On Track'; statColor = 'bg-emerald-50 text-emerald-600 border border-emerald-100'; statDot = 'bg-emerald-500'; }

        const actionHtml = isAdmin 
            ? '<button class="text-slate-400 hover:text-red-500 font-bold transition-colors text-lg del-project-btn" data-id="' + p.id + '" title="Delete">⋮</button>'
            : '<span class="text-slate-300 text-xs font-semibold cursor-not-allowed">View Only</span>';

        html += '<tr class="hover:bg-slate-50 transition-colors">' +
            '<td class="text-center border-b border-slate-100 py-3"><input type="checkbox" class="rounded border-gray-300"></td>' +
            '<td class="border-b border-slate-100 py-3 text-slate-500 text-sm font-medium">' + (idx + 1) + '</td>' +
            '<td class="border-b border-slate-100 py-3 font-semibold text-slate-800">' +
                '<div class="flex items-center gap-3">' +
                    '<div class="w-2.5 h-2.5 rounded-full ' + color + '"></div>' +
                    '<a href="project-details.html?id=' + p.id + '" class="hover:text-blue-600 transition-colors">' + (p.project_name || p.project_code || 'Tiada Nama').toUpperCase() + '</a>' +
                '</div>' +
            '</td>' +
            '<td class="border-b border-slate-100 py-3 text-slate-600 text-xs font-bold">' + cName + '</td>' +
            '<td class="border-b border-slate-100 py-3 text-blue-600 text-sm font-bold">' + totalHours + 'h</td>' +
            '<td class="border-b border-slate-100 py-3 text-slate-500 text-sm">0.00</td>' +
            '<td class="border-b border-slate-100 py-3">' +
                '<div class="flex items-center gap-3">' +
                    '<div class="w-24 bg-slate-100 rounded-full h-1.5">' +
                        '<div class="bg-' + (progVal>50?'emerald':'blue') + '-500 h-1.5 rounded-full" style="width: ' + progVal + '%"></div>' +
                    '</div>' +
                    '<span class="text-xs text-slate-500 font-semibold">' + progVal + '%</span>' +
                '</div>' +
            '</td>' +
            '<td class="border-b border-slate-100 py-3 text-slate-500 text-xs font-semibold flex items-center gap-1">🌐 Public</td>' +
            '<td class="border-b border-slate-100 py-3">' +
                '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide flex items-center gap-1.5 w-max ' + statColor + '">' +
                    '<div class="w-1.5 h-1.5 rounded-full ' + statDot + '"></div>' +
                    statText +
                '</span>' +
            '</td>' +
            '<td class="text-center border-b border-slate-100 py-3">' + actionHtml + '</td>' +
        '</tr>';
    });

    tbody.innerHTML = html;
    updateKPIs(data);

    if (isAdmin) {
        document.querySelectorAll('.del-project-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Adakah anda pasti mahu memadam projek ini?')) {
                    await supabase.from('projects').delete().eq('id', e.target.getAttribute('data-id'));
                    await loadProjects();
                }
            });
        });
    }
}

function updateKPIs(data) {
    const total = data.length;
    document.getElementById('kpiTotal').textContent = total;
    
    // Anggaran Active Projects
    const kpiActive = document.getElementById('kpiActive');
    if (kpiActive) kpiActive.textContent = total > 0 ? total : 0; 
    
    document.getElementById('tableTitleCount').textContent = total;
    document.getElementById('paginationInfo').textContent = 'Showing 1 to ' + total + ' of ' + total + ' projects';

    // Kira jumlah keseluruhan jam tracked
    let grandTotalSeconds = 0;
    data.forEach(p => { grandTotalSeconds += (p.tracked_seconds || 0); });
    const grandTotalHrs = (grandTotalSeconds / 3600).toFixed(1);

    // Update Kad KPI Tracked Hours
    const kpiCards = document.querySelectorAll('.glass-card .text-3xl');
    if (kpiCards.length > 1) {
        kpiCards[1].innerHTML = grandTotalHrs + '<span class="text-sm text-gray-500 ml-1">hrs</span>';
    }
}

function setupModal() {
    const modal = document.getElementById('projectModal');
    const openBtn = document.getElementById('openModalBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const saveBtn = document.getElementById('saveProjectBtn');
    
    if (openBtn) {
        if (!isAdmin) {
            openBtn.style.backgroundColor = '#e2e8f0'; openBtn.style.color = '#94a3b8';
            openBtn.style.cursor = 'not-allowed'; openBtn.title = 'Hanya Admin dibenarkan menambah projek';
            openBtn.addEventListener('click', () => alert('Akses Terhad: Hanya Admin yang dibenarkan menambah projek.'));
        } else {
            openBtn.addEventListener('click', () => {
                document.getElementById('projectNameInput').value = '';
                document.getElementById('clientSelect').value = '';
                modal.style.display = 'flex';
            });
        }
    }

    const closeModal = () => { modal.style.display = 'none'; };
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const pName = document.getElementById('projectNameInput').value.trim();
            const pClient = document.getElementById('clientSelect').value; 
            
            if (!pName) return alert('Sila masukkan nama projek.');
            
            saveBtn.disabled = true; saveBtn.textContent = 'CREATING...';
            
            const payload = { project_name: pName, status: 'ACTIVE' };
            if (pClient && pClient !== "") payload.client_id = pClient;
            
            const { error } = await supabase.from('projects').insert([payload]);
            
            saveBtn.disabled = false; saveBtn.textContent = 'Create Project';
            if (error) {
                alert('Ralat mencipta projek: ' + error.message);
            } else {
                closeModal();
                await loadProjects(); 
            }
        });
    }
}
