import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) return window.location.href = '../pages/login.html';

        // Kenal pasti elemen-elemen di bahagian kiri (Sidebar)
        const avatarInitials = document.getElementById('avatarInitials');
        const leftNameTitle = document.getElementById('leftNameTitle');
        const leftRoleBadge = document.getElementById('leftRoleBadge');
        const leftEmail = document.getElementById('leftEmail');
        const leftName = document.getElementById('leftName');
        const leftRole = document.getElementById('leftRole');

        // Kenal pasti elemen-elemen di bahagian kanan (Account Details)
        const inputEmail = document.getElementById('inputEmail');
        const inputName = document.getElementById('inputName');
        const inputRole = document.getElementById('inputRole');

        const userEmail = session.user.email;

        // Tarik data profil dari Supabase
        const { data: profiles } = await supabase
            .from('employees')
            .select('name, email, system_role')
            .ilike('email', userEmail.trim())
            .limit(1);

        const profile = profiles && profiles.length > 0 ? profiles[0] : null;

        if (profile) {
            const name = profile.name || 'NOT SET';
            const role = profile.system_role || 'User';
            const isAdmin = role.toLowerCase() === 'admin';
            const displayRole = isAdmin ? 'Administrator' : role;
            
            // Kemas kini bahagian Kiri (Sidebar)
            if (leftNameTitle) leftNameTitle.textContent = name.toUpperCase();
            if (leftName) leftName.textContent = name.toUpperCase();
            if (leftEmail) leftEmail.textContent = profile.email || userEmail;
            if (leftRole) leftRole.textContent = displayRole;
            
            // Kemas kini huruf besar pada Avatar Bulat
            if (avatarInitials && name !== 'NOT SET') {
                avatarInitials.textContent = name.charAt(0).toUpperCase();
            }

            // Kemas kini warna Lencana (Badge) mengikut peranan
            if (leftRoleBadge) {
                if (isAdmin) {
                    leftRoleBadge.innerHTML = `<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M5.2 4.6a1 1 0 011.5-.2l3.3 2.6 3.3-2.6a1 1 0 011.6 1v8.8a1 1 0 01-1 1H6.1a1 1 0 01-1-1V5.4a1 1 0 01.1-.8z"/></svg> ADMINISTRATOR`;
                    leftRoleBadge.className = 'mt-2.5 px-4 py-1 bg-amber-50 text-amber-500 border border-amber-100 rounded-full text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 shadow-sm';
                } else {
                    leftRoleBadge.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg> ${displayRole.toUpperCase()}`;
                    leftRoleBadge.className = 'mt-2.5 px-4 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-full text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 shadow-sm';
                }
            }

            // Kemas kini Input di bahagian Kanan (Account Details)
            if (inputEmail) inputEmail.value = profile.email || userEmail;
            if (inputName) inputName.value = name.toUpperCase();
            if (inputRole) inputRole.value = displayRole;
        }

    } catch (err) {
        console.error("Profile Init Error:", err);
    }
});

// Sistem kemas kini kata laluan
const pwdForm = document.getElementById('changePwdForm');
if (pwdForm) {
    pwdForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnUpdatePwd');
        const pwd1 = document.getElementById('newPwd').value;
        const pwd2 = document.getElementById('confirmPwd').value;

        if (pwd1 !== pwd2) return alert("Passwords do not match!");

        if (btn) {
            btn.innerHTML = `<svg class="animate-spin w-4 h-4 mr-2 text-white" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Updating...`;
            btn.disabled = true;
        }

        const { error } = await supabase.auth.updateUser({ password: pwd1 });

        if (btn) {
            btn.innerHTML = `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"></path></svg> Update Password`;
            btn.disabled = false;
        }

        if (error) {
            alert("Failed: " + error.message);
        } else {
            alert("Success! Password updated.");
            pwdForm.reset();
        }
    });
}



// 1. Klik butang kamera akan buka tetingkap pilih fail
document.getElementById('cameraButton').addEventListener('click', () => {
    document.getElementById('avatarInput').click();
});

// 2. Apabila user pilih gambar
document.getElementById('avatarInput').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Dapatkan ID user semasa (pastikan session ada)
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session.user.id;

    // Bina nama fail unik
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Math.random()}.${fileExt}`;

    try {
        // Tunjuk status loading jika perlu
        alert("Sedang memuat naik...");

        // A) Upload fail ke Supabase Storage (Bucket: 'avatars')
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, file, { upsert: true });

        if (uploadError) throw uploadError;

        // B) Dapatkan Public URL gambar yang baru diupload
        const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
            
        const avatarUrl = publicUrlData.publicUrl;

        // C) Simpan URL gambar ini ke dalam table database bos (contoh table: 'employees' atau 'users')
        const { error: updateError } = await supabase
            .from('employees') // Ganti dengan nama jadual sebenar bos
            .update({ avatar_url: avatarUrl }) // Pastikan ada lajur avatar_url dalam database
            .eq('id', userId);

        if (updateError) throw updateError;

        // D) Tukar gambar secara live di paparan skrin
        document.getElementById('profileImage').src = avatarUrl;
        alert("Avatar berjaya dikemaskini!");

    } catch (error) {
        console.error("Ralat muat naik:", error);
        alert("Gagal memuat naik gambar.");
    }
});
