import { supabase } from './supabase.js';

let membersData = [];
let groupsData = [];
window.currentUserRole = 'Employee'; 
let activeMemberId = null;
let activeGroupId = null;
let currentPage = 1;
const rowsPerPage = 10; 

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return window.location.href = '../pages/login.html';

        // Pengekstrakan Nama & Initial Profil
        const avatarInitial = document.getElementById('avatarInitial');
        const profileName = document.getElementById('profileName');
        const userEmail = session.user.email;
        if (avatarInitial) avatarInitial.textContent = userEmail.charAt(0).toUpperCase();
        if (profileName) profileName.textContent = userEmail.split('@')[0].toUpperCase();

        const { data: profile } = await supabase.from('employees').select('system_role').eq('id', session.user.id).single();
        if (profile) {
            window.currentUserRole = profile.system_role;
            const profileRole = document.getElementById('profileRole');
            if(profileRole) profileRole.textContent = profile.system_role === 'Admin' ? 'Administrator' : profile.system_role;
        }

        if (window.currentUserRole !== 'Admin') {
            const btnAddMem = document.getElementById('btnAddMember');
            const btnAddGrp = document.getElementById('btnAddGroup');
            if (btnAddMem) btnAddMem.style.display = 'none';
            if (btnAddGrp) btnAddGrp.style.display = 'none';
        }

        setupTabs();
        setupFilters();
        setupExcelImport();
        
        if (window.currentUserRole === 'Admin') {
            setupMemberModal();
            setupGroupModal();
        }

        await fetchMembers(); 
        await fetchGroups();

    } catch (error) {
        console.error("Team Module Init Error:", error);
    }
});

// ==================== TABS & NAV ====================
function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            const tabId = e.target.getAttribute('data-tab');
            document.getElementById('membersView').style.display = tabId === 'membersView' ? 'block' : 'none';
            document.getElementById('groupsView').style.display = tabId === 'groupsView' ? 'block' : 'none';
        });
    });
}

// ==================== DATABASE LOAD & KPIs ====================
async function fetchMembers() {
    const { data, error } = await supabase
        .from('employees')
        .select(`id, name, email, employee_no, phone, department, position, system_role, group_id, billable_rate, status, groups!group_id(group_name)`)
        .order('name');

    if (!error) {
        membersData = data || [];
        updateKPIs();
        populateDepartmentFilter();
        populateManagerDropdown();
        filterMembers(); 
    }
}

function updateKPIs() {
    const tMembers = membersData.length;
    const tActive = membersData.filter(m => (m.status || '').toUpperCase() === 'ACTIVE').length;
    const tInactive = membersData.filter(m => (m.status || '').toUpperCase() === 'INACTIVE').length;

    document.getElementById('kpiTotal').textContent = tMembers;
    document.getElementById('kpiActive').textContent = tActive;
    document.getElementById('kpiInactive').textContent = tInactive;
}

function populateDepartmentFilter() {
    const deptSelect = document.getElementById('filterDept');
    if (!deptSelect) return;
    
    deptSelect.innerHTML = '<option value="all">All Departments</option>';
    const depts = [...new Set(membersData.map(m => m.department).filter(Boolean))].sort();
    
    depts.forEach(d => {
        deptSelect.innerHTML += '<option value="' + d + '">' + d + '</option>';
    });
}

// ==================== FILTERS & PAGINATION ====================
function setupFilters() {
    const sInp = document.getElementById('searchMember');
    const rSel = document.getElementById('filterRole');
    const dSel = document.getElementById('filterDept');
    const stSel = document.getElementById('filterStatus');

    const trigger = () => { currentPage = 1; filterMembers(); };
    if(sInp) sInp.addEventListener('keyup', trigger);
    if(rSel) rSel.addEventListener('change', trigger);
    if(dSel) dSel.addEventListener('change', trigger);
    if(stSel) stSel.addEventListener('change', trigger);

    document.getElementById('btnPrevPage')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; filterMembers(); } });
    document.getElementById('btnNextPage')?.addEventListener('click', () => { currentPage++; filterMembers(); });
}

function filterMembers() {
    const term = document.getElementById('searchMember')?.value.toLowerCase() || '';
    const role = document.getElementById('filterRole')?.value || 'all';
    const dept = document.getElementById('filterDept')?.value || 'all';
    const stat = document.getElementById('filterStatus')?.value || 'all';

    const filtered = membersData.filter(m => {
        const matchName = (m.name || '').toLowerCase().includes(term) || (m.email || '').toLowerCase().includes(term);
        const matchRole = role === 'all' || m.system_role === role;
        const matchDept = dept === 'all' || m.department === dept;
        const matchStat = stat === 'all' || (m.status||'').toUpperCase() === stat.toUpperCase();
        return matchName && matchRole && matchDept && matchStat;
    });

    renderMembersTable(filtered);
}

// ==================== RENDER JADUAL MEMBERS ====================
function renderMembersTable(data) {
    const tbody = document.getElementById('membersTableBody');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-10 text-gray-400">No matching records found.</td></tr>';
        updatePagination(0, 0);
        return;
    }

    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * rowsPerPage;
    const paginated = data.slice(startIdx, startIdx + rowsPerPage);

    let html = '';
    const colors = ['bg-indigo-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-purple-500'];

    paginated.forEach((m, idx) => {
        const globalIdx = startIdx + idx + 1;
        const name = m.name || 'Unknown';
        const init = name.substring(0, 2).toUpperCase();
        const empId = m.employee_no ? ' | ID: ' + m.employee_no : '';
        const color = colors[idx % colors.length];
        
        const isAct = (m.status || '').toUpperCase() === 'ACTIVE';
        const stHtml = isAct 
            ? '<span class="status-active"><div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>ACTIVE</span>'
            : '<span class="status-inactive"><div class="w-1.5 h-1.5 rounded-full bg-red-500"></div>INACTIVE</span>';
            
        html += '<tr class="hover:bg-slate-50 transition-colors">' +
            '<td class="text-center"><input type="checkbox" class="rounded border-gray-300"></td>' +
            '<td class="text-slate-500 font-medium">' + globalIdx + '</td>' +
            '<td>' +
                '<div class="flex items-center gap-3">' +
                    '<div class="w-9 h-9 rounded-full text-white flex items-center justify-center font-bold text-xs ' + color + '">' + init + '</div>' +
                    '<div>' +
                        '<div class="font-bold text-slate-800 text-xs uppercase">' + name + '</div>' +
                        '<div class="text-[10px] text-slate-500">' + m.email + empId + '</div>' +
                    '</div>' +
                '</div>' +
            '</td>' +
            '<td>' +
                '<div class="font-semibold text-slate-700 text-xs">' + (m.system_role || 'Employee') + '</div>' +
                '<div class="text-[10px] text-gray-500 uppercase mt-0.5">' + (m.position || '-') + '</div>' +
            '</td>' +
            '<td class="font-medium text-slate-600 text-xs uppercase">' + (m.department || '-') + '</td>' +
            '<td class="font-medium text-slate-600 text-xs">' + (m.billable_rate ? parseFloat(m.billable_rate).toFixed(2) : '0.00') + '</td>' +
            '<td>' + stHtml + '</td>' +
            '<td class="text-center">' +
                '<div class="flex justify-center gap-3">' +
                    '<button class="text-slate-400 hover:text-blue-600 bind-edit" data-id="' + m.id + '">✏️</button>' +
                    '<button class="text-slate-400 hover:text-red-500 bind-del text-lg" data-id="' + m.id + '">🗑️</button>' +
                '</div>' +
            '</td>' +
        '</tr>';
    });

    tbody.innerHTML = html;
    updatePagination(totalItems, totalPages, startIdx, startIdx + paginated.length);
    bindActionButtons();
}

function updatePagination(total, pages, start, end) {
    const info = document.getElementById('paginationInfo');
    const pNum = document.getElementById('pageNumbers');
    const bPrev = document.getElementById('btnPrevPage');
    const bNext = document.getElementById('btnNextPage');

    if (info) info.textContent = total > 0 ? `Showing \({start + 1}-\){end} of ${total} members` : 'Showing 0 members';
    if (pNum) pNum.textContent = `Page \({currentPage} of\){pages}`;
    
    if (bPrev) { bPrev.disabled = currentPage === 1; bPrev.style.opacity = currentPage === 1 ? '0.5' : '1'; }
    if (bNext) { bNext.disabled = currentPage >= pages; bNext.style.opacity = currentPage >= pages ? '0.5' : '1'; }
}

function bindActionButtons() {
    document.querySelectorAll('.bind-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const member = membersData.find(m => m.id === id);
            if (!member) return;

            activeMemberId = id; 
            document.getElementById('modalTitle').textContent = "Edit Member Profile";
            
            const setVal = (fid, val) => { const el = document.getElementById(fid); if(el) el.value = val || ''; };
            
            setVal('formEmail', member.email);
            document.getElementById('formEmail').disabled = true; 
            
            setVal('formName', member.name); setVal('formEmpNo', member.employee_no); setVal('formPhone', member.phone);
            setVal('formDept', member.department); setVal('formPosition', member.position);
            setVal('formRole', member.system_role || 'Employee'); setVal('formGroup', member.group_id);
            setVal('formRate', member.billable_rate || '0.00'); 
            setVal('formStatus', (member.status || 'Active').charAt(0).toUpperCase() + (member.status || 'Active').slice(1).toLowerCase());

            document.getElementById('memberModal').style.display = 'flex';
        });
    });

    document.querySelectorAll('.bind-del').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (!confirm('Adakah anda pasti mahu memadam pekerja ini?')) return;
            const id = e.currentTarget.getAttribute('data-id');
            try {
                await supabase.from('employees').delete().eq('id', id);
                fetchMembers();
            } catch (err) { alert('Gagal memadam: ' + err.message); }
        });
    });
}

// ==================== MODALS (MEMBER & GROUP) ====================
function setupMemberModal() {
    const modal = document.getElementById('memberModal');
    const form = document.getElementById('memberForm');

    document.getElementById('btnCloseModal')?.addEventListener('click', () => modal.style.display = 'none');
    document.getElementById('btnAddMember')?.addEventListener('click', () => {
        activeMemberId = null; 
        document.getElementById('modalTitle').textContent = "Add New Member";
        document.getElementById('formEmail').disabled = false;
        form.reset(); 
        modal.style.display = 'flex';
    });

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSave = document.getElementById('btnSaveMember');
            btnSave.disabled = true;

            const getVal = (id) => document.getElementById(id)?.value || null;
            const emailInp = getVal('formEmail');

            const payload = {
                name: getVal('formName') || 'Unknown', employee_no: getVal('formEmpNo'), phone: getVal('formPhone'),
                department: getVal('formDept'), position: getVal('formPosition'), system_role: getVal('formRole') || 'Employee',
                group_id: getVal('formGroup'), billable_rate: parseFloat(getVal('formRate') || 0), status: (getVal('formStatus') || 'ACTIVE').toUpperCase()
            };

            try {
                if (activeMemberId) {
                    await supabase.from('employees').update(payload).eq('id', activeMemberId);
                } else {
                    btnSave.textContent = "Sending Invite...";
                    const tempPwd = "Pwd" + Math.floor(Math.random() * 100000) + "A!";
                    const { data: auth, error: authErr } = await supabase.auth.signUp({ email: emailInp, password: tempPwd, options: { data: { full_name: payload.name } } });
                    if (authErr) throw authErr;
                    if (auth.user) {
                        payload.id = auth.user.id; payload.email = emailInp;
                        await supabase.from('employees').upsert([payload]);
                    }
                }
                modal.style.display = 'none';
                fetchMembers(); 
            } catch (err) { alert('Gagal: ' + err.message); }
            finally { btnSave.textContent = "Save Member"; btnSave.disabled = false; }
        });
    }
}

// ==================== EXCEL IMPORT ====================
function setupExcelImport() {
    const btnImp = document.getElementById('btnImportExcel');
    const fInp = document.getElementById('excelFileInput');

    if (btnImp && fInp) {
        btnImp.addEventListener('click', () => fInp.click());
        fInp.addEventListener('change', (e) => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const workbook = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
                    const excelData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                    
                    if (excelData.length === 0) return alert("Fail kosong!");
                    alert(`Berjaya membaca ${excelData.length} rekod. Mula mendaftar...`);

                    for (const r of excelData) {
                        const gV = (...k) => { const m = Object.keys(r).find(x => k.includes(x.trim().toLowerCase())); return m ? r[m] : null; };
                        const email = gV('email', 'e-mail', 'emel');
                        if (!email) continue;

                        const { data: auth, error: authErr } = await supabase.auth.signUp({
                            email: email, password: gV('password', 'kata laluan') || 'Cranetrack2026', options: { data: { full_name: gV('name', 'nama') || 'User' } }
                        });

                        if (!authErr && auth.user) {
                            await supabase.from('employees').insert({
                                id: auth.user.id, email: email, name: gV('name', 'nama') || 'User',
                                department: gV('department', 'jabatan'), position: gV('position', 'jawatan'),
                                system_role: gV('role', 'peranan') || 'Employee', status: 'ACTIVE'
                            });
                        }
                    }
                    alert("Selesai import!"); fetchMembers();
                } catch (err) { alert("Ralat: " + err.message); }
            };
            reader.readAsArrayBuffer(file);
            e.target.value = ''; 
        });
    }
}

// ==================== GROUPS LOGIC ====================
async function fetchGroups() {
    const { data } = await supabase.from('groups').select(`id, group_name, description, manager_id, status`).order('group_name');
    groupsData = data || [];
    populateGroupDropdowns();
    renderGroupsTable();
}

function renderGroupsTable() {
    const tbody = document.getElementById('groupsTableBody');
    if(!tbody) return;
    
    document.getElementById('searchGroup')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        Array.from(tbody.querySelectorAll('tr')).forEach(tr => tr.style.display = tr.innerText.toLowerCase().includes(term) ? '' : 'none');
    });

    let html = '';
    groupsData.forEach(g => {
        const count = membersData.filter(m => m.group_id === g.id).length;
        const mgr = membersData.find(m => m.id === g.manager_id);
        const mName = mgr ? mgr.name : '<span class="text-gray-400">- No Manager -</span>';
        const stHtml = g.status === 'Active' ? '<span class="status-active"><div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>ACTIVE</span>' : '<span class="status-inactive"><div class="w-1.5 h-1.5 rounded-full bg-red-500"></div>INACTIVE</span>';

        html += '<tr class="hover:bg-slate-50 transition-colors">' +
            '<td class="font-bold text-slate-700 py-3">' + g.group_name + '</td>' +
            '<td class="text-sm font-medium text-slate-600">' + mName + '</td>' +
            '<td><span class="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-bold">' + count + ' members</span></td>' +
            '<td>' + stHtml + '</td>' +
            '<td class="text-center">' +
                (window.currentUserRole === 'Admin' ? '<button class="text-slate-400 hover:text-blue-600 bind-edit-grp" data-id="' + g.id + '">✏️</button>' : '🔒') +
            '</td>' +
        '</tr>';
    });
    tbody.innerHTML = html || '<tr><td colspan="5" class="text-center py-6 text-gray-400">No groups found.</td></tr>';

    document.querySelectorAll('.bind-edit-grp').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const group = groupsData.find(g => g.id === id);
            if (!group) return;
            activeGroupId = id;
            document.getElementById('groupModalTitle').textContent = "Edit Group";
            document.getElementById('formGroupName').value = group.group_name;
            document.getElementById('formGroupDesc').value = group.description;
            document.getElementById('formGroupManager').value = group.manager_id || '';
            document.getElementById('formGroupStatus').value = group.status;
            document.getElementById('groupModal').style.display = 'flex';
        });
    });
}

function setupGroupModal() {
    const modal = document.getElementById('groupModal');
    const form = document.getElementById('groupForm');
    document.getElementById('btnCloseGroupModal')?.addEventListener('click', () => modal.style.display = 'none');
    document.getElementById('btnAddGroup')?.addEventListener('click', () => {
        activeGroupId = null; document.getElementById('groupModalTitle').textContent = "Create New Group";
        form.reset(); modal.style.display = 'flex';
    });
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                group_name: document.getElementById('formGroupName').value, description: document.getElementById('formGroupDesc').value,
                manager_id: document.getElementById('formGroupManager').value || null, status: document.getElementById('formGroupStatus').value
            };
            try {
                if (activeGroupId) await supabase.from('groups').update(payload).eq('id', activeGroupId);
                else await supabase.from('groups').insert([payload]);
                modal.style.display = 'none'; fetchGroups(); 
            } catch (err) { alert("Ralat: " + err.message); }
        });
    }
}

function populateGroupDropdowns() {
    const sel = document.getElementById('formGroup');
    if(sel) { sel.innerHTML = '<option value="">- No Group -</option>'; groupsData.forEach(g => sel.innerHTML += '<option value="'+g.id+'">'+g.group_name+'</option>'); }
}
function populateManagerDropdown() {
    const sel = document.getElementById('formGroupManager');
    if(sel) { sel.innerHTML = '<option value="">- Select Manager -</option>'; membersData.filter(m => ['Admin', 'Manager', 'Supervisor'].includes(m.system_role)).forEach(m => sel.innerHTML += '<option value="'+m.id+'">'+m.name+'</option>'); }
}
