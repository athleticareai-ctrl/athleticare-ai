// ================= TRAINER AUTH GUARD =================
// Simple trainer check for demo purposes
// In production, this would be a real session check
const currentUser = JSON.parse(localStorage.getItem("currentUser"));
if (!currentUser) {
    window.location.href = "trainer-login.html";
}

// ================= NAVBAR =================
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("token");
        localStorage.removeItem("currentUser");
        window.location.href = "trainer-login.html";
    });
}

// ================= DOM ELEMENTS =================
const currentDateEl = document.getElementById("currentDate");
const readyCountEl = document.getElementById("readyCount");
const monitorCountEl = document.getElementById("monitorCount");
const recoveryCountEl = document.getElementById("recoveryCount");
const noCheckInCountEl = document.getElementById("noCheckInCount");
const attentionAlert = document.getElementById("attentionAlert");
const attentionList = document.getElementById("attentionList");
const athleteTableBody = document.getElementById("athleteTableBody");
const emptyState = document.getElementById("emptyState");
const toast = document.getElementById("toast");
const refreshBtn = document.getElementById("refreshBtn");

// Modal Elements
const modal = document.getElementById("athleteProfileModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const trainerNotesArea = document.getElementById("trainerNotes");
const saveNotesBtn = document.getElementById("saveNotesBtn");

let activeAthleteEmail = null;
let teamData = [];

// ================= INITIALIZATION =================
document.addEventListener("DOMContentLoaded", () => {
    displayCurrentDate();
    loadTeamData();
});

// ================= DISPLAY DATE =================
function displayCurrentDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    currentDateEl.textContent = new Date().toLocaleDateString('en-US', options);
}

// ================= LOAD TEAM DATA =================
async function loadTeamData() {
    try {
        const athletes = await api.get("/trainer/team");
        
        // Transform data for rendering
        teamData = athletes.map(athlete => {
            const checkins = athlete.checkins || [];
            const today = new Date().toDateString();
            const todayCheckIn = checkins.find(c => c.date === today);

            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toDateString();
            const yesterdayCheckIn = checkins.find(c => c.date === yesterdayStr);

            const lastCheckIn = checkins.length > 0 ? checkins[0] : null;

            return {
                user: athlete.user,
                today: todayCheckIn ? { ...todayCheckIn.data, score: todayCheckIn.score } : null,
                yesterday: yesterdayCheckIn ? { ...yesterdayCheckIn.data, score: yesterdayCheckIn.score } : null,
                lastCheckIn: lastCheckIn ? { ...lastCheckIn, timestamp: lastCheckIn.timestamp } : null,
                allCheckins: checkins
            };
        });

        // Update UI
        updateStats(teamData);
        renderTable(teamData);
        updateAlert(teamData);

    } catch (err) {
        console.error("Load team data failed:", err);
        showToast("Failed to load team data", "error");
    }
}

// ================= UPDATE STATS =================
function updateStats(data) {
    let ready = 0;
    let monitor = 0;
    let recovery = 0;
    let noCheckIn = 0;

    data.forEach(athlete => {
        if (!athlete.today) {
            noCheckIn++;
            return;
        }

        const score = athlete.today.score;
        if (score >= 80) ready++;
        else if (score >= 60) monitor++;
        else recovery++;
    });

    readyCountEl.textContent = ready;
    monitorCountEl.textContent = monitor;
    recoveryCountEl.textContent = recovery;
    noCheckInCountEl.textContent = noCheckIn;
}

// ================= UPDATE ALERT =================
function updateAlert(data) {
    const needsAttention = [];

    data.forEach(athlete => {
        if (!athlete.today) {
            if (athlete.lastCheckIn) {
                const daysSince = Math.floor((new Date() - new Date(athlete.lastCheckIn.timestamp)) / (1000 * 60 * 60 * 24));
                if (daysSince >= 2) {
                    needsAttention.push({ name: athlete.user.firstname, reason: `No check-in for ${daysSince} days` });
                }
            }
            return;
        }

        if (athlete.today.score < 60) {
            needsAttention.push({ name: athlete.user.firstname, reason: `Low readiness score (${athlete.today.score})` });
        } else if (athlete.yesterday && athlete.today.score < athlete.yesterday.score - 10) {
            needsAttention.push({ name: athlete.user.firstname, reason: `Declining trend` });
        }
    });

    if (needsAttention.length > 0) {
        attentionAlert.classList.remove("hidden");
        attentionList.textContent = needsAttention.map(a => `${a.name}: ${a.reason}`).join(" • ");
    } else {
        attentionAlert.classList.add("hidden");
    }
}

// ================= RENDER TABLE =================
function renderTable(data) {
    if (data.length === 0) {
        emptyState.classList.remove("hidden");
        athleteTableBody.innerHTML = "";
        return;
    }

    emptyState.classList.add("hidden");

    athleteTableBody.innerHTML = data.map(athlete => {
        const { user, today, yesterday, lastCheckIn } = athlete;
        
        let scoreDisplay = "--", statusClass = "none", statusText = "No Check-In", scoreClass = "none";
        if (today) {
            scoreDisplay = today.score;
            scoreClass = today.score >= 80 ? "good" : today.score >= 60 ? "moderate" : "poor";
            statusText = today.score >= 80 ? "Ready" : today.score >= 60 ? "Monitor" : "Recovery";
            statusClass = scoreClass;
        }

        const initial = user.firstname.charAt(0).toUpperCase();

        return `
            <tr onclick="openAthleteProfile('${user.email}')">
                <td>
                    <div class="athlete-name">
                        <div class="athlete-avatar">${initial}</div>
                        <div class="athlete-info">
                            <span class="name">${escapeHtml(user.firstname)}</span>
                            <span class="email">${escapeHtml(user.email)}</span>
                        </div>
                    </div>
                </td>
                <td><span class="score-cell ${scoreClass}">${scoreDisplay}</span></td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td><span class="trend-cell">${calculateTrend(today, yesterday)}</span></td>
                <td>${getKeyConcern(today)}</td>
                <td><span class="last-checkin">${formatLastCheckIn(lastCheckIn)}</span></td>
            </tr>
        `;
    }).join("");
}

function calculateTrend(today, yesterday) {
    if (!today || !yesterday) return '<span class="trend-stable">—</span>';
    const diff = today.score - yesterday.score;
    if (diff > 5) return `<span class="trend-up">↑ +${diff}</span>`;
    if (diff < -5) return `<span class="trend-down">↓ ${diff}</span>`;
    return `<span class="trend-stable">→ ${diff >= 0 ? '+' : ''}${diff}</span>`;
}

function getKeyConcern(today) {
    if (!today) return '<span class="text-secondary">None</span>';
    const concerns = [];
    if (today.pain >= 6) concerns.push("Pain");
    if (today.sleep <= 2) concerns.push("Sleep");
    if (today.fatigue <= 1) concerns.push("Fatigue");
    if (concerns.length > 0) return `<span style="color: #ef4444; font-weight: 500;">${concerns.join(", ")}</span>`;
    return '<span class="text-secondary">None</span>';
}

function formatLastCheckIn(lastCheckIn) {
    if (!lastCheckIn) return "Never";
    const date = new Date(lastCheckIn.timestamp);
    const now = new Date();
    const daysAgo = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (daysAgo === 0) return "Today";
    if (daysAgo === 1) return "Yesterday";
    return `${daysAgo} days ago`;
}

// ================= ATHLETE PROFILE MODAL =================
async function openAthleteProfile(email) {
    activeAthleteEmail = email;
    const athlete = teamData.find(a => a.user.email === email);
    if (!athlete) return;

    const { user, allCheckins } = athlete;

    // Load Notes from API
    try {
        const notes = await api.get(`/trainer/notes/${email}`);
        trainerNotesArea.value = notes.length > 0 ? notes[0].notes : "";
    } catch (err) {
        trainerNotesArea.value = "";
    }

    // Set UI
    document.getElementById("modalAthleteName").textContent = user.firstname;
    document.getElementById("modalAthleteSport").textContent = `${user.profile?.sport || "Sport"}`;
    document.getElementById("modalAvatar").textContent = user.firstname.charAt(0).toUpperCase();
    
    document.getElementById("infoGrade").textContent = user.profile?.grade || "--";
    document.getElementById("infoAge").textContent = user.profile?.age || "--";
    document.getElementById("infoTraining").textContent = user.profile?.trainingFreq || "--";

    // Re-use existing UI logic
    calculateAthleteStats(allCheckins.map(c => ({ ...c.data, score: c.score, timestamp: c.timestamp })));
    renderAthleteChart(allCheckins.map(c => ({ ...c.data, score: c.score, date: c.date })));
    renderRisks(allCheckins.map(c => ({ ...c.data, score: c.score })));

    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

// Re-implement helper functions (calculateAthleteStats, renderAthleteChart, renderRisks, etc.)
// ... similar to previous version but using athlete object structure ...

function calculateAthleteStats(checkins) {
    if (checkins.length === 0) {
        ["avgScore", "recoveryConsistency", "lowScoreFreq", "primaryConcern"].forEach(id => {
            document.getElementById(id).textContent = "--";
        });
        return;
    }
    const avg = Math.round(checkins.reduce((s, c) => s + c.score, 0) / checkins.length);
    document.getElementById("avgScore").textContent = avg;
    document.getElementById("lowScoreFreq").textContent = `${Math.round((checkins.filter(c => c.score < 60).length / checkins.length) * 100)}%`;
}

function renderAthleteChart(checkins) {
    const container = document.getElementById("readinessChart");
    container.innerHTML = "";
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const c = checkins.find(check => check.date === d.toDateString());
        const score = c ? c.score : 0;
        const scoreClass = score >= 80 ? "good" : score >= 60 ? "moderate" : score > 0 ? "poor" : "";
        
        const col = document.createElement("div");
        col.className = "chart-column";
        col.innerHTML = `<div class="chart-bar-wrapper"><div class="chart-bar ${scoreClass}" style="height: ${score}%"></div></div><span class="chart-label">${d.toLocaleDateString('en', {weekday:'short'})}</span>`;
        container.appendChild(col);
    }
}

function renderRisks(checkins) {
    const container = document.getElementById("riskIndicators");
    container.innerHTML = "";
    if (checkins.length === 0) return;
    const last = checkins[0];
    if (last.score < 60) {
        const badge = document.createElement("div");
        badge.className = "risk-badge high";
        badge.textContent = "Low Readiness Alert";
        container.appendChild(badge);
    }
}

// Event Listeners
closeModalBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
    document.body.style.overflow = "auto";
});

saveNotesBtn.addEventListener("click", async () => {
    if (!activeAthleteEmail) return;
    try {
        await api.post("/trainer/notes", { athleteEmail: activeAthleteEmail, notes: trainerNotesArea.value });
        showToast("Notes saved");
    } catch (err) {
        showToast("Failed to save notes", "error");
    }
});

function escapeHtml(t) { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
function showToast(m, t="success") { toast.textContent = m; toast.className = `toast ${t} show`; setTimeout(() => toast.classList.remove("show"), 3000); }
refreshBtn.addEventListener("click", loadTeamData);
window.openAthleteProfile = openAthleteProfile;
