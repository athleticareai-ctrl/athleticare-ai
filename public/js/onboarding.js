document.addEventListener("DOMContentLoaded", () => {
    // Check if user is logged in
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) {
        window.location.href = "login1.html";
        return;
    }

    const form = document.getElementById("onboardingForm");
    const errorMsg = document.getElementById("error-message");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const profile = {
            sport: document.getElementById("sport").value,
            sport2: document.getElementById("sport2").value || "",
            sport3: document.getElementById("sport3").value || "",
            grade: document.getElementById("grade").value,
            age: document.getElementById("age").value,
            position: document.getElementById("position").value,
            trainingFreq: document.getElementById("trainingFreq").value,
            recoveryGoal: document.getElementById("recoveryGoal").value,
            heightWeight: document.getElementById("heightWeight").value,
            mobilityLimitation: document.getElementById("mobilityLimitation").value
        };

        if (!profile.sport || !profile.grade || !profile.age || !profile.trainingFreq || !profile.recoveryGoal) {
            errorMsg.textContent = "Please fill in all required fields.";
            return;
        }

        try {
            await api.post("/profile", { profile });

            // Update local user state
            currentUser.onboardingComplete = true;
            currentUser.profile = profile;
            localStorage.setItem("currentUser", JSON.stringify(currentUser));

            // Success feedback
            const btn = form.querySelector('.submit-btn');
            btn.textContent = "Profile Saved!";
            btn.style.background = "#fff";
            btn.style.color = "#000";

            setTimeout(() => {
                window.location.href = "index.html";
            }, 800);
        } catch (err) {
            errorMsg.textContent = "Failed to save profile. Please try again.";
        }
    });
});
