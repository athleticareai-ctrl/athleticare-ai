// ================= AUTH GUARD =================
const currentUser = JSON.parse(localStorage.getItem("currentUser"));

if (!currentUser) {
    window.location.href = "login1.html";
}

// ================= STORAGE KEYS =================
const CHECKIN_KEY = `checkin_${currentUser.email}`;

// ================= DOM ELEMENTS =================
const checkInForm = document.getElementById("checkInForm");
const checkInSection = document.getElementById("checkInSection");
const completedState = document.getElementById("completedState");
const metricsCard = document.getElementById("metricsCard");
const scoreDisplay = document.getElementById("scoreDisplay");
const scoreNumber = document.getElementById("scoreNumber");
const scoreStatus = document.getElementById("scoreStatus");
const checkInTime = document.getElementById("checkInTime");
const recommendationsSection = document.getElementById("recommendationsSection");
const recommendationsList = document.getElementById("recommendationsList");
const toast = document.getElementById("toast");
const currentDateEl = document.getElementById("currentDate");

// Slider displays
const painDisplay = document.getElementById("painDisplay");
const sorenessDisplay = document.getElementById("sorenessDisplay");
const stressDisplay = document.getElementById("stressDisplay");
const loadDisplay = document.getElementById("loadDisplay");

// ================= INITIALIZATION =================
document.addEventListener("DOMContentLoaded", () => {
    displayCurrentDate();
    setupSliderListeners();
    loadTrends();

    // Logout logic
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.removeItem("token");
            localStorage.removeItem("currentUser");
            window.location.href = "login1.html";
        });
    }
});

function displayCurrentDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    if (currentDateEl) {
        currentDateEl.textContent = new Date().toLocaleDateString('en-US', options);
    }
}

// ================= SLIDER LISTENERS =================
function setupSliderListeners() {
    const sliders = ['pain', 'soreness', 'stress', 'load'];
    sliders.forEach(id => {
        const slider = document.getElementById(id);
        const display = document.getElementById(id + "Display");
        if (slider && display) {
            slider.addEventListener("input", (e) => {
                display.textContent = e.target.value;
            });
        }
    });
}

// ================= UI UPDATES =================
function showCompletedState(data) {
    if (checkInSection) checkInSection.classList.add("hidden");
    if (completedState) completedState.classList.remove("hidden");
    if (metricsCard) metricsCard.classList.remove("hidden");
    if (recommendationsSection) recommendationsSection.classList.remove("hidden");

    // Update stats cards
    if (document.getElementById("sleepValue")) document.getElementById("sleepValue").textContent = `${data.sleep}/5`;
    if (document.getElementById("sorenessValue")) document.getElementById("sorenessValue").textContent = `${data.soreness}/10`;
    if (document.getElementById("energyValue")) document.getElementById("energyValue").textContent = `${data.pain}/10`;
    if (document.getElementById("stressValue")) document.getElementById("stressValue").textContent = `${data.stress}/10`;

    // Show check-in time
    const time = new Date(data.timestamp).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
    });
    if (checkInTime) checkInTime.textContent = `Completed at ${time}`;

    updateScoreDisplay(data.score);
    showRecommendations(data.score, data);
}

// ================= FORM SUBMISSION =================
if (checkInForm) {
    checkInForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const formData = new FormData(checkInForm);
        const data = {
            pain: parseInt(formData.get("pain")),
            mobility: parseInt(formData.get("mobility")),
            sleep: parseInt(formData.get("sleep")),
            fatigue: parseInt(formData.get("fatigue")),
            soreness: parseInt(formData.get("soreness")),
            stress: parseInt(formData.get("stress")),
            load: parseInt(formData.get("load")),
            confidence: parseInt(formData.get("confidence")),
            notes: formData.get("notes") || "",
            date: new Date().toDateString(),
            timestamp: new Date().toISOString()
        };

        // Calculate score
        const score = calculateScore(data);
        data.score = score;

        // Save data to server
        saveCheckIn(data).then(() => {
            showCompletedState(data);
            loadTrends();
            showToast("Check-in submitted!", "success");
        }).catch(err => {
            showToast("Failed to save check-in.", "error");
        });
    });
}

// ================= SAVE CHECK-IN =================
async function saveCheckIn(data) {
    try {
        await api.post("/checkin", {
            score: data.score,
            data: data,
            date: data.date
        });
    } catch (err) {
        console.error("Save check-in failed:", err);
        throw err;
    }
}

// ================= SCORE CALCULATION =================
function calculateScore(data) {
    const painScore = ((10 - data.pain) / 10) * 20;
    const sorenessScore = ((10 - data.soreness) / 9) * 15;
    const fatigueScore = ((data.fatigue - 1) / 3) * 15;
    const sleepScore = (data.sleep / 5) * 15;
    const stressScore = ((10 - data.stress) / 9) * 10;
    const mobilityScore = ((data.mobility - 1) / 3) * 10;
    const confidenceScore = (data.confidence / 5) * 10;
    const loadScore = ((10 - data.load) / 10) * 5;

    const total = painScore + sorenessScore + fatigueScore + sleepScore + stressScore + mobilityScore + confidenceScore + loadScore;
    return Math.round(total);
}

// ================= UPDATE SCORE DISPLAY =================
function updateScoreDisplay(score) {
    if (scoreNumber) scoreNumber.textContent = score;
    if (scoreStatus) scoreStatus.innerHTML = `<span class="status-label">${score >= 80 ? 'Ready' : score >= 60 ? 'Monitor' : 'Recovery'}</span>`;
    
    let category = score >= 80 ? "good" : score >= 60 ? "moderate" : "poor";
    const circle = scoreDisplay.querySelector(".circle");
    if (circle) circle.style.strokeDasharray = `${score}, 100`;
    
    const scoreCircle = scoreDisplay.querySelector(".score-circle");
    if (scoreCircle) scoreCircle.className = `score-circle ${category}`;
}

// ================= RECOMMENDATIONS =================
function showRecommendations(score, data) {
    if (!recommendationsList) return;
    recommendationsList.innerHTML = "";

    const profile = currentUser.profile || {};
    const sport = profile.sport?.toLowerCase() || "";
    const goal = profile.recoveryGoal?.toLowerCase() || "";

    const tips = [];

    if (score >= 80) {
        tips.push({ title: "Green Light", text: "You are in an optimal state for training." });
    } else if (score >= 60) {
        tips.push({ title: "Caution", text: "Moderate intensity recommended." });
    } else {
        tips.push({ title: "Recovery Focus", text: "Prioritize rest and light mobility today." });
    }

    // Add sport/goal specific tips...
    if (sport.includes("football") && data.pain >= 6) {
        tips.push({ title: "Impact Alert", text: "Avoid high-contact drills today." });
    }

    tips.forEach(tip => {
        const div = document.createElement("div");
        div.className = "recommendation-item";
        div.innerHTML = `<h4>${tip.title}</h4><p>${tip.text}</p>`;
        recommendationsList.appendChild(div);
    });
}

// ================= LOAD TRENDS =================
async function loadTrends() {
    try {
        const checkins = await api.get("/checkins");
        if (checkins.length > 0) {
            const latest = checkins[0];
            const today = new Date().toDateString();
            if (latest.date === today) {
                showCompletedState(latest.data);
            }
        }
        renderTrendsChart(checkins);
    } catch (err) {
        console.error("Load trends failed:", err);
    }
}

function renderTrendsChart(checkins) {
    const chart = document.getElementById("trendsChart");
    if (!chart) return;
    chart.innerHTML = "";

    // Show last 7 days
    const recent = checkins.slice(0, 7).reverse();
    recent.forEach(c => {
        const date = new Date(c.timestamp);
        const day = date.toLocaleDateString('en-US', { weekday: 'short' });
        
        const bar = document.createElement("div");
        bar.className = "chart-bar";
        
        const scoreClass = c.score >= 80 ? "good" : c.score >= 60 ? "moderate" : "poor";
        
        bar.innerHTML = `
            <div class="bar-value">${c.score}</div>
            <div class="bar-fill ${scoreClass}" style="height: ${c.score}%"></div>
            <div class="bar-label">${day}</div>
        `;
        chart.appendChild(bar);
    });
}

// ================= TOAST =================
function showToast(message, type = "success") {
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove("show"), 3000);
}
