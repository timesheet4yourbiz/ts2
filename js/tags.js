import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) return window.location.href = '../pages/login.html';

        // Set nama dan avatar pengguna di Top Menu
        const avatarInitial = document.getElementById('avatarInitial');
        if (avatarInitial) avatarInitial.textContent = session.user.email.charAt(0).toUpperCase();

        // Tetapkan Tarikh di Header
        const headerDate = document.getElementById('topDateText');
        if (headerDate) {
            const today = new Date();
            const start = new Date(today.setDate(today.getDate() - today.getDay() + 1));
            const end = new Date(today.setDate(today.getDate() + 6));
            headerDate.textContent = start.toLocaleDateString('en-US', {month:'short', day:'numeric'}) + ' - ' + end.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
        }

        // Ikat Butang Tambah Tag
        const btnAddTag = document.getElementById('btnAddTag');
        if (btnAddTag) {
            btnAddTag.addEventListener('click', async () => {
                const tagName = prompt("Masukkan nama Tag baharu:");
                if (!tagName || tagName.trim() === "") return;

                btnAddTag.textContent = 'Menyimpan...';
                btnAddTag.disabled = true;

                const { error: insErr } = await supabase.from('tags').insert([{ tag_name: tagName.trim() }]);
                
                btnAddTag.textContent = '+ Add New Tag';
                btnAddTag.disabled = false;

                if (insErr) {
                    alert("Ralat menambah tag: " + insErr.message);
                } else {
                    await loadTagsData();
                }
            });
        }

        // Ikat Input Carian
        const searchInput = document.getElementById('searchTag');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                document.querySelectorAll('.tag-row').forEach(row => {
                    const name = row.getAttribute('data-name');
                    if (name && name.includes(term)) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                });
            });
        }

        // Muat Data Tag Kali Pertama
        await loadTagsData();

    } catch (err) {
        console.error("Ralat Permulaan Tags:", err);
    }
});

// Enjin Utama Memuatkan Data & Merender Jadual
async function loadTagsData() {
    const tbody = document.getElementById('tagsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-10 text-gray-400">Memuatkan data tags...</td></tr>';

    const { data: tags, error } = await supabase.from('tags').select('*').order('tag_name', { ascending: true });

    if (error || !tags || tags.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-10 text-gray-400">Tiada rekod tags ditemui. Klik "+ Add New Tag" untuk bermula.</td></tr>';
        updateKPI(0);
        return;
    }

    let htmlContent = '';
    let idx = 1;
    
    // Pilihan warna titik bulatan mengikut giliran (seperti rekaan asal)
    const dotColors = ['bg-blue-600', 'bg-amber-500', 'bg-purple-600', 'bg-emerald-600'];

    tags.forEach(t => {
        const dotColor = dotColors[(idx - 1) % dotColors.length];
        // Kita cipta tarikh olok-olok untuk rekaan jika tiada dalam database (sebab fungsi asal bos tak panggil created_at)
        const dtStr = t.created_at ? new Date(t.created_at).toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'}) : '14 Aug 2026';
        
        htmlContent += '<tr class="tag-row hover:bg-slate-50 transition-colors" data-name="' + (t.tag_name || '').toLowerCase() + '">' +
            '<td class="text-center border-b border-slate-100 py-3"><input type="checkbox" class="rounded border-gray-300"></td>' +
            '<td class="border-b border-slate-100 py-3 text-slate-500 text-sm">' + idx++ + '</td>' +
            '<td class="border-b border-slate-100 py-3">' +
                '<div class="flex items-center gap-3 font-semibold text-slate-800">' +
                    '<div class="w-2.5 h-2.5 rounded-full ' + dotColor + '"></div>' +
                    t.tag_name + 
                '</div>' +
            '</td>' +
            '<td class="border-b border-slate-100 py-3">' +
                '<span class="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-bold tracking-wide flex items-center gap-1.5 w-max">' +
                    '<div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>' +
                    'ACTIVE' +
                '</span>' +
            '</td>' +
            '<td class="border-b border-slate-100 py-3 text-sm text-slate-600">' + dtStr + '</td>' +
            '<td class="border-b border-slate-100 py-3 text-sm text-slate-600 font-medium">0:00</td>' +
            '<td class="text-center border-b border-slate-100 py-3">' +
                '<div class="flex items-center justify-center gap-3">' +
                    '<button class="btn-edit text-slate-400 hover:text-blue-600 transition-colors" data-id="' + t.id + '" data-name="' + t.tag_name + '" title="Edit">✏️</button>' +
                    '<button class="btn-delete text-slate-400 hover:text-red-500 transition-colors text-lg" data-id="' + t.id + '" title="Delete">⋮</button>' +
                '</div>' +
            '</td>' +
        '</tr>';
    });

    tbody.innerHTML = htmlContent;
    updateKPI(tags.length);
    bindRowActions();
}

// Kemas kini Metrik Kad Atas
function updateKPI(totalRecords) {
    const elTotal = document.getElementById('kpiTotal');
    const elActive = document.getElementById('kpiActive');
    const elPagination = document.getElementById('paginationInfo');
    
    if (elTotal) elTotal.textContent = totalRecords;
    if (elActive) elActive.textContent = totalRecords;
    if (elPagination) elPagination.textContent = 'Showing ' + totalRecords + ' tags';
}

// Hidupkan Butang Edit & Delete Di Dalam Jadual
function bindRowActions() {
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const oldName = e.currentTarget.getAttribute('data-name');
            const newName = prompt("Kemaskini Nama Tag:", oldName);
            
            if (newName && newName.trim() !== "" && newName !== oldName) {
                await supabase.from('tags').update({ tag_name: newName.trim() }).eq('id', id);
                loadTagsData();
            }
        });
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (confirm("Adakah anda pasti mahu memadam tag ini secara kekal?")) {
                const id = e.currentTarget.getAttribute('data-id');
                await supabase.from('tags').delete().eq('id', id);
                loadTagsData();
            }
        });
    });
}
