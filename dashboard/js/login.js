document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMsg = document.getElementById('error-message');
    const submitBtn = document.getElementById('login-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnSpinner = submitBtn.querySelector('.btn-spinner');
    
    // Password visibility toggle helper
    const togglePasswordBtn = document.getElementById('toggle-password-btn');
    const togglePasswordIcon = document.getElementById('toggle-password-icon');
    
    if (togglePasswordBtn && togglePasswordIcon) {
        togglePasswordBtn.addEventListener('click', () => {
            const isPassword = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            togglePasswordBtn.title = isPassword ? 'Hide password' : 'Show password';
            togglePasswordBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
            
            if (isPassword) {
                togglePasswordIcon.innerHTML = `
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                `;
            } else {
                togglePasswordIcon.innerHTML = `
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                `;
            }
        });
    }
    
    // Check if already logged in and token is valid
    const token = localStorage.getItem('cloudpulse_jwt');
    const tokenExpiry = localStorage.getItem('cloudpulse_jwt_expiry');
    
    if (token && tokenExpiry) {
        if (Date.now() < parseInt(tokenExpiry)) {
            window.location.href = 'index.html';
            return;
        } else {
            // Token expired
            localStorage.removeItem('cloudpulse_jwt');
            localStorage.removeItem('cloudpulse_jwt_expiry');
            localStorage.removeItem('cloudpulse_username');
        }
    }
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        
        if (!username || !password) return;
        
        // UI loading state
        submitBtn.disabled = true;
        btnText.classList.add('hidden');
        btnSpinner.classList.remove('hidden');
        errorMsg.classList.add('hidden');
        
        try {
            const response = await ApiClient.login(username, password);
            
            // Calculate exact expiry timestamp (subtract 5 seconds for safety margin)
            const expiryTimestamp = Date.now() + (response.expires_in * 1000) - 5000;
            
            localStorage.setItem('cloudpulse_jwt', response.token);
            localStorage.setItem('cloudpulse_jwt_expiry', expiryTimestamp.toString());
            localStorage.setItem('cloudpulse_username', response.username);
            
            // Redirect to dashboard
            window.location.href = 'index.html';
        } catch (error) {
            errorMsg.textContent = error.message || 'Invalid credentials or server error';
            errorMsg.classList.remove('hidden');
            
            // Shake animation for error
            loginForm.classList.add('shake');
            setTimeout(() => loginForm.classList.remove('shake'), 500);
            
            // Reset UI
            submitBtn.disabled = false;
            btnText.classList.remove('hidden');
            btnSpinner.classList.add('hidden');
        }
    });
});
