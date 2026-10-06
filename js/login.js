import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. Fetch Company Settings (Logo & Background)
    const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('logo_url, bg_url')
        .limit(1)
        .single();

    if (settingsData) {
        if (settingsData.logo_url) {
            document.getElementById('companyLogo').src = settingsData.logo_url;
        }
        if (settingsData.bg_url) {
            document.getElementById('loginBg').style.backgroundImage = `url('${settingsData.bg_url}')`;
        }
    }

    // 2. Check Active Session
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        window.location.href = 'timesheet.html';
    }
    
    // 3. Variables & Elements
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const errorMessage = document.getElementById('errorMessage');
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');

    // --- 4. FUNGSI FORGOT PASSWORD ---
    forgotPasswordBtn.addEventListener('click', async (e) => {
        e.preventDefault(); 
        const emailVal = emailInput.value.trim();
        
        if (!emailVal) {
            errorMessage.textContent = 'Sila masukkan alamat e-mel anda di ruangan atas untuk reset katalaluan.';
            errorMessage.style.display = 'block';
            errorMessage.style.color = '#ef4444'; 
            return;
        }

        errorMessage.style.display = 'none';
        forgotPasswordBtn.textContent = 'Sending...';

        const { data, error } = await supabase.auth.resetPasswordForEmail(emailVal, {
            // NOTA: Gantikan 'reset-password.html' kepada nama fail/rute form tukar password bos yang sebenar
            redirectTo: window.location.origin + '/reset-password.html' 
        });

        if (error) {
            errorMessage.textContent = 'Ralat: ' + error.message;
            errorMessage.style.display = 'block';
            errorMessage.style.color = '#ef4444';
        } else {
            errorMessage.textContent = 'Pautan reset katalaluan telah dihantar ke e-mel anda!';
            errorMessage.style.display = 'block';
            errorMessage.style.color = '#10b981'; // Mesej bertukar hijau tanda berjaya
        }
        
        forgotPasswordBtn.textContent = 'Forgot Password?';
    });
    
    // --- 5. FUNGSI LOGIN ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        
        loginBtn.textContent = 'Signing in...';
        loginBtn.disabled = true;
        errorMessage.style.display = 'none';
        errorMessage.style.color = '#ef4444'; // Set warna kembali ke merah untuk sebarang error login

        const { data, error } = await supabase.auth.signInWithPassword({
            email: emailInput.value.trim(),
            password: passwordInput.value
        });

        if (error) {
            errorMessage.textContent = 'Invalid email or password. Please try again.';
            errorMessage.style.display = 'block';
            loginBtn.textContent = 'Sign In';
            loginBtn.disabled = false;
        } else {
            const userId = data.user.id;
            const { data: empData } = await supabase
                .from('employees')
                .select('status')
                .eq('id', userId)
                .single();

            if (empData && empData.status === 'PENDING') {
                await supabase.auth.signOut();
                errorMessage.textContent = 'Access Denied: Your account is still PENDING Admin/HR approval.';
                errorMessage.style.display = 'block';
                loginBtn.textContent = 'Sign In';
                loginBtn.disabled = false;
                return;
            }

            // --- UPDATE LAST SEEN WITH ERROR DETECTION ---
            try {
                const { data: updateData, error: updateErr } = await supabase
                    .from('employees')
                    .update({ last_seen: new Date().toISOString() })
                    .eq('email', emailInput.value.trim());

                if (updateErr) {
                    console.error("Failed to update last_seen from Supabase:", updateErr);
                } else {
                    console.log("Successfully updated last_seen for:", emailInput.value.trim());
                }
            } catch (err) {
                console.error("Unexpected error while updating last_seen:", err);
            }
            // ----------------------------------------------

            window.location.href = 'timesheet.html';
        }
    });
});
