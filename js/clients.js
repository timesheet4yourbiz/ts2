import { supabase } from './supabase.js';

let clientsData = [];
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

        // BINDING MODAL & SEARCH
        setupModal();
        setupSearchAndFilter();

        // FETCH DATA
        await fetchAllData();

    } catch (err) {
        console.error("Client Init Error:", err);
    }
});

async function fetchAllData() {
    const { data: cl, error: clErr } = await supabase.from('clients').select('*').order('client_name', { ascending: true });
    if (!clErr && cl) clientsData = cl;

    const { data: prj, error: prjErr } = await supabase.from('projects').select('id, client_id');
    if (!prjErr && prj) projectsData = prj;

    renderClients(clientsData);
}

function setupSearchAndFilter() {
    const sInput = document.getElementById('searchClient');
    const fStatus = document.getElementById('filterStatus');

    const doFilter = () => {
        const term = sInput.value.toLowerCase();
        const stat = fStatus.value;
        const filtered = clientsData.filter(c => {
            const matchName = c.client_name.toLowerCase().includes(term);
            const matchStat = stat === 'ALL' || (c.status || '').toUpperCase() === stat;
            return matchName && matchStat;
        });
        renderClients(filtered);
    };

    if(sInput) sInput.addEventListener('input', doFilter);
    if(fStatus) fStatus.addEventListener('change', doFilter);
}

function renderClients(data) {
    const tbody = document.getElementById('clientsList');
    if (!tbody) return;

    updateKPIs(data);

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-10 text-gray-400">Tiada rekod client dijumpai.</td></tr>';
        document.getElementById('paginationInfo').textContent = 'Showing 0 clients';
        return;
    }

    let html = '';
    const initialColors = ['bg-orange-100 text-orange-600', 'bg-blue-100 text-blue-600', 'bg-purple-100 text-purple-600', 'bg-emerald-100 text-emerald-600'];

    data.forEach((c, index) => {
        const pCount = projectsData.filter(p => p.client_id === c.id).length;
        const initLetter = c.client_name ? c.client_name.charAt(0).toUpperCase() : 'C';
        const colorClass = initialColors[index % initialColors.length];
        
        const isAct = (c.status || '').toUpperCase() === 'ACTIVE';
        const statHtml = isAct 
            ? '<span class="status-active"><div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>ACTIVE</span>'
            : '<span class="status-inactive"><div class="w-1.5 h-1.5 rounded-full bg-red-500"></div>INACTIVE</span>';

        const dtStr = c.created_at ? new Date(c.created_at).toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'}) : '10 Aug 2026';

        html += '<tr class="hover:bg-slate-50 transition-colors">' +
            '<td class="text-center border-b border-slate-100 py-3"><input type="checkbox" class="rounded border-gray-300"></td>' +
            '<td class="border-b border-slate-100 py-3 text-slate-500 text-sm">' + (index + 1) + '</td>' +
            '<td class="border-b border-slate-100 py-3">' +
                '<div class="flex items-center gap-3">' +
                    '<div class="w-9 h-9 rounded-full font-bold flex items-center justify-center ' + colorClass + '">' + initLetter + '</div>' +
                    '<div>' +
                        '<div class="font-bold text-slate-800 text-sm">' + c.client_name + '</div>' +
                        '<div class="text-[10px] text-slate-500 uppercase">Client</div>' +
                    '</div>' +
                '</div>' +
            '</td>' +
            '<td class="border-b border-slate-100 py-3">' + statHtml + '</td>' +
            '<td class="border-b border-slate-100 py-3 text-sm text-slate-600 font-medium">' + dtStr + '</td>' +
            '<td class="border-b border-slate-100 py-3 text-sm font-bold text-slate-700">' + pCount + '</td>' +
            '<td class="text-center border-b border-slate-100 py-3">' +
                '<div class="flex items-center justify-center gap-3">' +
                    '<button class="text-slate-400 hover:text-blue-600 transition-colors btn-edit" data-id="' + c.id + '" data-name="' + c.client_name + '" title="Edit">✏️</button>' +
                    '<button class="text-slate-400 hover:text-red-500 transition-colors btn-del" data-id="' + c.id + '" title="Delete">🗑️</button>' +
                '</div>' +
            '</td>' +
        '</tr>';
    });

    tbody.innerHTML = html;
    document.getElementById('paginationInfo').textContent = 'Showing ' + data.length + ' clients';
    bindRowActions();
}

function updateKPIs(data) {
    const act = data.filter(c => (c.status || '').toUpperCase() === 'ACTIVE').length;
    const inAct = data.filter(c => (c.status || '').toUpperCase() === 'INACTIVE').length;
    
    document.getElementById('kpiTotal').textContent = data.length;
    document.getElementById('kpiActive').textContent = act;
    document.getElementById('kpiInactive').textContent = inAct;
}

let editClientId = null;

function setupModal() {
    const modal = document.getElementById('clientModal');
    const input = document.getElementById('clientNameInput');
    const saveBtn = document.getElementById('saveClientBtn');
    
    const closeModal = () => { modal.style.display = 'none'; };
    
    document.getElementById('openModalBtn')?.addEventListener('click', () => {
        editClientId = null; input.value = '';
        document.getElementById('modalTitle').textContent = 'Create New Client';
        saveBtn.textContent = 'Create Client';
        modal.style.display = 'flex';
    });

    document.getElementById('closeModalBtn')?.addEventListener('click', closeModal);
    document.getElementById('cancelBtn')?.addEventListener('click', closeModal);

    saveBtn?.addEventListener('click', async () => {
        const cName = input.value.trim();
        if (!cName) return alert('Sila masukkan nama client.');

        saveBtn.disabled = true; saveBtn.textContent = 'Saving...';
        let err = null;

        if (editClientId) {
            const { error } = await supabase.from('clients').update({ client_name: cName }).eq('id', editClientId);
            err = error;
        } else {
            const { error } = await supabase.from('clients').insert([{ client_name: cName, status: 'ACTIVE' }]);
            err = error;
        }

        saveBtn.disabled = false; 
        if (err) { alert('Ralat: ' + err.message); saveBtn.textContent = editClientId ? 'Update Client' : 'Create Client'; } 
        else { closeModal(); await fetchAllData(); }
    });
}

function bindRowActions() {
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            editClientId = e.currentTarget.getAttribute('data-id');
            const cName = e.currentTarget.getAttribute('data-name');
            document.getElementById('clientNameInput').value = cName;
            document.getElementById('modalTitle').textContent = 'Edit Client';
            document.getElementById('saveClientBtn').textContent = 'Update Client';
            document.getElementById('clientModal').style.display = 'flex';
        });
    });

    document.querySelectorAll('.btn-del').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (!confirm("Padam client ini selamanya?")) return;
            const id = e.currentTarget.getAttribute('data-id');
            await supabase.from('clients').delete().eq('id', id);
            await fetchAllData();
        });
    });
}
