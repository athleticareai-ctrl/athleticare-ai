console.log("Login.js loaded");

document.addEventListener("DOMContentLoaded", () => {

    // ================================
    // SIGNUP FORM HANDLING
    // ================================
    const signupForm = document.getElementById("form");
    if (signupForm) {
        const firstnameInput = document.getElementById("firstname-input");
        const emailInput = document.getElementById("email-input");
        const passwordInput = document.getElementById("password-input");
        const confirmPasswordInput = document.getElementById("confirm-password-input");
        const errorMessage = document.getElementById("error-message");

        signupForm.addEventListener("submit", (e) => {
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

            // Load users from localStorage
            let users = JSON.parse(localStorage.getItem("users")) || [];

            // Check if email already exists
            if (users.find(u => u.email.toLowerCase() === emailInput.value.trim().toLowerCase())) {
                errorMessage.textContent = "Account already exists.";
                errorMessage.style.color = "red";
                return;
            }

            // Create new user
            const newUser = {
                firstname: firstnameInput.value.trim(),
                email: emailInput.value.trim().toLowerCase(),
                password: passwordInput.value
            };
            users.push(newUser);
            localStorage.setItem("users", JSON.stringify(users));
            localStorage.setItem("currentUser", JSON.stringify(newUser));
            fetch("/send-confirmation", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: newUser.email,
                    firstname: newUser.firstname,
                }),
            });

            // Show success
            errorMessage.textContent = "Account created successfully!";
            errorMessage.style.color = "limegreen";

            signupForm.reset();

            // Optional: redirect after 1 second
            setTimeout(() => {
                window.location.href = "index.html";
            }, 1000);
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

        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();

            const email = loginEmail.value.trim().toLowerCase();
            const password = loginPassword.value;

            let users = JSON.parse(localStorage.getItem("users")) || [];
            const user = users.find(u => u.email === email && u.password === password);

            if (!user) {
                loginMessage.textContent = "Invalid email or password.";
                loginMessage.style.color = "red";
                return;
            }

            // Save current user
            localStorage.setItem("currentUser", JSON.stringify(user));

            loginMessage.textContent = `Welcome, ${user.firstname}! Redirecting...`;
            loginMessage.style.color = "limegreen";

            setTimeout(() => {
                window.location.href = "index.html";
            }, 1000);
        });
    }

    // ================================
    // HELPER FUNCTION
    // ================================
    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
});




