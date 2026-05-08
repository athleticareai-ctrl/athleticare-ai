console.log("Login.js loaded");

document.addEventListener("DOMContentLoaded", () => {
    // Check for existing session and redirect
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("currentUser"));
    if (token && user) {
        if (!user.onboardingComplete) {
            window.location.href = "onboarding.html";
        } else {
            window.location.href = "index.html";
        }
        return;
    }

    // ================================
    // SIGNUP FORM HANDLING
    // ================================
    const signupForm = document.getElementById("form");
    if (signupForm) {
        const firstnameInput = document.getElementById("firstname-input");
        const emailInput = document.getElementById("email-input");
        const passwordInput = document.getElementById("password-input");
        const confirmPasswordInput = document.getElementById("confirm-password-input");
        const accessCodeInput = document.getElementById("access-code-input");
        const errorMessage = document.getElementById("error-message");

        signupForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            let errors = [];

            // Validation
            if (!firstnameInput.value.trim()) errors.push("First name is required");
            if (!isValidEmail(emailInput.value.trim())) errors.push("Invalid email address");
            if (passwordInput.value.length < 8) errors.push("Password must be at least 8 characters");
            if (passwordInput.value !== confirmPasswordInput.value) errors.push("Passwords do not match");

            if (errors.length > 0) {
                errorMessage.textContent = errors.join(" | ");
                errorMessage.style.color = "red";
                return;
            }

            try {
                const response = await api.post("/auth/signup", {
                    firstname: firstnameInput.value.trim(),
                    email: emailInput.value.trim().toLowerCase(),
                    password: passwordInput.value,
                    accessCode: accessCodeInput && accessCodeInput.value ? accessCodeInput.value.trim().toUpperCase() : ""
                });

                // Save token and user for auto-login
                localStorage.setItem("token", response.token);
                localStorage.setItem("currentUser", JSON.stringify(response.user));

                // Show success
                errorMessage.textContent = "Account created! Redirecting to setup...";
                errorMessage.style.color = "limegreen";

                signupForm.reset();

                // Redirect to onboarding
                setTimeout(() => {
                    window.location.href = "onboarding.html";
                }, 1000);
            } catch (err) {
                errorMessage.textContent = err.message;
                errorMessage.style.color = "red";
            }
        });
    }

    // ================================
    // LOGIN FORM HANDLING
    // ================================
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        const loginEmail = document.getElementById("loginEmail");
        const loginPassword = document.getElementById("loginPassword");
        const loginMessage = document.getElementById("loginMessage");

        // Load remembered email
        const rememberedEmail = localStorage.getItem("rememberedEmail");
        if (rememberedEmail) {
            loginEmail.value = rememberedEmail;
        }

        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const email = loginEmail.value.trim().toLowerCase();
            const password = loginPassword.value;

            try {
                const response = await api.post("/auth/login", { email, password });
                
                // Save token and user
                localStorage.setItem("token", response.token);
                localStorage.setItem("currentUser", JSON.stringify(response.user));

                // Handle Remember Me (assuming there's a checkbox, otherwise we just remember the last successful email)
                localStorage.setItem("rememberedEmail", email);

                loginMessage.textContent = `Welcome, ${response.user.firstname}! Redirecting...`;
                loginMessage.style.color = "limegreen";

                setTimeout(() => {
                    if (!response.user.onboardingComplete) {
                        window.location.href = "onboarding.html";
                    } else {
                        window.location.href = "index.html";
                    }
                }, 1000);
            } catch (err) {
                loginMessage.textContent = "Invalid email or password.";
                loginMessage.style.color = "red";
            }
        });
    }

    // ================================
    // HELPER FUNCTION
    // ================================
    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
});
