// ================= TRAINER AUTH GUARD =================
const currentUser = JSON.parse(localStorage.getItem("currentUser"));
if (!currentUser || currentUser.role !== "trainer") {
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
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
const teamSportFilter = document.getElementById("teamSportFilter");

// Modal Elements
const modal = document.getElementById("athleteProfileModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const trainerNotesArea = document.getElementById("trainerNotes");
const saveNotesBtn = document.getElementById("saveNotesBtn");

let activeAthleteEmail = null;
let teamData = [];
let filteredData = [];

// ================= INITIALIZATION =================
document.addEventListener("DOMContentLoaded", () => {
    displayCurrentDate();
    loadTeamData();

    if (teamSportFilter) {
        teamSportFilter.addEventListener("change", (e) => {
            const selectedSport = e.target.value;
            filterDataBySport(selectedSport);
        });
    }
});

function filterDataBySport(sport) {
    if (sport === "all") {
        filteredData = [...teamData];
    } else {
        filteredData = teamData.filter(athlete => {
            const athleteSport = (athlete.user.profile?.sport || "").toLowerCase();
            return athleteSport === sport.toLowerCase();
        });
    }

    // Update UI with filtered data
    updateStats(filteredData);
    renderTable(filteredData);
    updateAlert(filteredData);
}

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
        filteredData = [...teamData];
        const selectedSport = teamSportFilter ? teamSportFilter.value : "all";
        filterDataBySport(selectedSport);

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
    let total = data.length || 1;

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

    // Calculate Executive Summary Stats
    const availability = Math.round(((ready + monitor) / total) * 100);
    const compliance = Math.round(((total - noCheckIn) / total) * 100);
    const highRisk = recovery + (data.filter(a => a.today && a.yesterday && a.today.score < a.yesterday.score - 15).length);

    // Update Executive UI
    const availEl = document.getElementById("availabilityPct");
    const flagsEl = document.getElementById("highRiskFlags");
    const complianceEl = document.getElementById("complianceRate");

    if (availEl) availEl.textContent = `${availability}%`;
    if (flagsEl) flagsEl.textContent = highRisk;
    if (complianceEl) complianceEl.textContent = `${compliance}%`;
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
        const sport = user.profile?.sport || "General";

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
                <td><span class="sport-badge">${escapeHtml(sport)}</span></td>
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
    if (!today) return '<span class="text-secondary">—</span>';
    const concerns = [];
    if (today.pain >= 6) concerns.push("Pain");
    if (today.sleep <= 2) concerns.push("Sleep");
    if (today.fatigue <= 1) concerns.push("Fatigue");
    
    if (concerns.length > 0) {
        return `<span class="concern-circle">${concerns[0]}</span>`;
    }
    return '<span class="text-secondary">None</span>';
}

function formatLastCheckIn(lastCheckIn) {
    if (!lastCheckIn) return "Never";
    const date = new Date(lastCheckIn.timestamp);
    const now = new Date();
    // Use Math.max(0, ...) to avoid negative days due to clock drift
    const daysAgo = Math.max(0, Math.floor((now - date) / (1000 * 60 * 60 * 24)));
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
    document.getElementById("infoTraining").textContent = user.profile?.trainingFreq ? `${user.profile.trainingFreq} days` : "--";

    // Re-use existing UI logic
    const latestCheckin = allCheckins.length > 0 ? allCheckins[0] : null;
    calculateAthleteStats(allCheckins.map(c => ({ ...c.data, score: c.score, timestamp: c.timestamp })));
    renderAthleteChart(allCheckins.map(c => ({ ...c.data, score: c.score, date: c.date })));
    renderRisks(allCheckins.map(c => ({ ...c.data, score: c.score })));
    renderRecommendations(latestCheckin ? latestCheckin.score : 0, latestCheckin ? latestCheckin.data : {}, user.profile || {});
    renderPainHeatmap(allCheckins);

    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

// Re-implement helper functions (calculateAthleteStats, renderAthleteChart, renderRisks, etc.)
// ... similar to previous version but using athlete object structure ...

function calculateAthleteStats(checkins) {
    if (checkins.length === 0) {
        ["avgScore", "recoveryConsistency", "lowScoreFreq", "acwrValue", "primaryConcern"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = "--";
        });
        return;
    }

    // 1. Average Score
    const avg = Math.round(checkins.reduce((s, c) => s + c.score, 0) / checkins.length);
    document.getElementById("avgScore").textContent = avg;

    // 2. Low Score Frequency
    document.getElementById("lowScoreFreq").textContent = `${Math.round((checkins.filter(c => c.score < 60).length / checkins.length) * 100)}%`;

    // 3. ACWR (Acute:Chronic Workload Ratio)
    const now = new Date();
    const oneDay = 1000 * 60 * 60 * 24;

    const acuteWindow = 7;
    const chronicWindow = 28;

    const acuteLoads = checkins.filter(c => (now - new Date(c.timestamp)) / oneDay <= acuteWindow);
    const chronicLoads = checkins.filter(c => (now - new Date(c.timestamp)) / oneDay <= chronicWindow);

    // Sum of loads / window size
    const acuteSum = acuteLoads.reduce((s, c) => s + (c.load || 0), 0);
    const chronicSum = chronicLoads.reduce((s, c) => s + (c.load || 0), 0);

    const acuteAvg = acuteSum / acuteWindow;
    const chronicAvg = chronicSum / chronicWindow;

    const acwr = chronicAvg > 0 ? (acuteAvg / chronicAvg).toFixed(2) : "0.00";

    const acwrEl = document.getElementById("acwrValue");
    if (acwrEl) {
        acwrEl.textContent = acwr;
        // Color coding for ACWR
        if (acwr >= 1.5) {
            acwrEl.style.color = "var(--score-poor)";
            acwrEl.title = "High Risk: Danger Zone";
        } else if (acwr >= 1.3) {
            acwrEl.style.color = "var(--score-moderate)";
            acwrEl.title = "Elevated Risk: Caution";
        } else if (acwr >= 0.8) {
            acwrEl.style.color = "var(--score-good)";
            acwrEl.title = "Sweet Spot: Optimal Loading";
        } else {
            acwrEl.style.color = "var(--text-secondary)";
            acwrEl.title = "Low Loading: Undertraining";
        }
    }

    // 5. Primary Concern
    const concernCounts = { Pain: 0, Sleep: 0, Fatigue: 0, Stress: 0 };
    checkins.forEach(c => {
        if (c.pain >= 6) concernCounts.Pain++;
        if (c.sleep <= 2) concernCounts.Sleep++;
        if (c.fatigue <= 1) concernCounts.Fatigue++;
        if (c.stress >= 8) concernCounts.Stress++;
    });

    let topConcern = "None";
    let maxCount = 0;
    Object.entries(concernCounts).forEach(([name, count]) => {
        if (count > maxCount) {
            maxCount = count;
            topConcern = name;
        }
    });

    const concernEl = document.getElementById("primaryConcern");
    if (concernEl) {
        concernEl.textContent = topConcern;
        if (topConcern !== "None") {
            concernEl.className = "value concern-circle";
            concernEl.style.marginTop = "8px";
            concernEl.style.display = "inline-flex";
        } else {
            concernEl.className = "value";
            concernEl.style.marginTop = "0";
        }
    }
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
        col.innerHTML = `<div class="chart-bar-wrapper"><div class="chart-bar ${scoreClass}" style="height: ${score}%"></div></div><span class="chart-label">${d.toLocaleDateString('en', { weekday: 'short' })}</span>`;
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

    // Check for Recurring Pain (same spot in 3 of last 5 check-ins)
    const recentCheckins = checkins.slice(0, 5);
    const painCounts = {};
    recentCheckins.forEach(c => {
        if (c.painLocations && Array.isArray(c.painLocations)) {
            c.painLocations.forEach(loc => {
                painCounts[loc] = (painCounts[loc] || 0) + 1;
            });
        }
    });

    Object.entries(painCounts).forEach(([loc, count]) => {
        if (count >= 3) {
            const badge = document.createElement("div");
            badge.className = "risk-badge medium";
            badge.textContent = `Persistent ${loc} Pain (${count} days)`;
            container.appendChild(badge);
        }
    });
}

function renderPainHeatmap(checkins) {
    const container = document.getElementById("painHeatmap");
    if (!container) return;

    container.innerHTML = "";

    if (checkins.length === 0 || !checkins[0].data?.painLocations?.length) {
        container.innerHTML = '<p class="empty-msg">No pain reported</p>';
        return;
    }

    const latestPain = checkins[0].data.painLocations;
    const listWrapper = document.createElement("div");
    listWrapper.className = "pain-badge-list";
    listWrapper.style.display = "flex";
    listWrapper.style.flexWrap = "wrap";
    listWrapper.style.gap = "10px";
    listWrapper.style.marginTop = "10px";

    latestPain.forEach(locEntry => {
        const [loc, level] = locEntry.split(":");
        const badge = document.createElement("div");
        badge.className = "pain-badge";

        // Color based on level if present
        let badgeColor = "var(--green)";
        if (level === "tight") badgeColor = "#f59e0b";
        if (level === "sore") badgeColor = "#ef4444";
        if (level === "severe") badgeColor = "#b91c1c";

        badge.style.background = `${badgeColor}20`;
        badge.style.color = badgeColor;
        badge.style.border = `1px solid ${badgeColor}40`;
        badge.style.padding = "6px 14px";
        badge.style.borderRadius = "20px";
        badge.style.fontSize = "0.85rem";
        badge.style.fontWeight = "600";
        badge.textContent = loc + (level ? ` (${level})` : "");

        listWrapper.appendChild(badge);
    });

    container.appendChild(listWrapper);
}

// ================= RECOMMENDATIONS =================
function getSpecificRecommendations(data) {
    const recommendations = [];
    if (!data) return recommendations;

    // Pain Level (0-10)
    if (data.pain >= 9) recommendations.push({ title: "Critical Pain Alert", text: "High injury risk. Stop training immediately. Professional evaluation required.", type: "danger" });
    else if (data.pain >= 6) recommendations.push({ title: "Significant Pain", text: "Limit intensity. Consult trainer for assessment before starting.", type: "warning" });
    else if (data.pain >= 3) recommendations.push({ title: "Mild Pain", text: "Consider active recovery. Focus on low-impact movements.", type: "info" });

    // Mobility (1-4)
    if (data.mobility === 1) recommendations.push({ title: "Mobility Focus", text: "Prioritize 15-20 min of dynamic stretching and foam rolling.", type: "info" });
    else if (data.mobility === 4) recommendations.push({ title: "Stability Note", text: "Optimal mobility. Focus on stability exercises during warm-up.", type: "success" });

    // Sleep (1-5)
    if (data.sleep <= 2) recommendations.push({ title: "Sleep Deficit", text: "Extreme fatigue risk. Focus on technique over intensity. Prioritize an early night.", type: "danger" });
    else if (data.sleep === 3) recommendations.push({ title: "Rest Monitor", text: "Moderate rest. Monitor energy levels during peak sets.", type: "info" });

    // Fatigue (1-4)
    if (data.fatigue === 1) recommendations.push({ title: "CNS Fatigue", text: "High central nervous system fatigue. Consider a deload or complete rest day.", type: "danger" });
    else if (data.fatigue === 2) recommendations.push({ title: "Energy Management", text: "Limit volume but maintain intensity if needed.", type: "warning" });
    else if (data.fatigue === 4) recommendations.push({ title: "Peak Energy", text: "Opportunity for high performance/PR attempts today.", type: "success" });

    // Soreness (1-10)
    if (data.soreness >= 7) recommendations.push({ title: "High Soreness (DOMS)", text: "Focus on different muscle groups or low-intensity recovery.", type: "warning" });
    else if (data.soreness >= 4) recommendations.push({ title: "Mild Soreness", text: "Light cardio to increase blood flow recommended.", type: "info" });

    // Stress (1-10)
    if (data.stress >= 7) recommendations.push({ title: "High Mental Load", text: "Shorten session duration. Focus on 'fun' or low-pressure drills.", type: "warning" });
    else if (data.stress >= 4) recommendations.push({ title: "Moderate Stress", text: "Practice mindfulness or deep breathing before session.", type: "info" });

    // Load (0-10)
    if (data.load >= 8) recommendations.push({ title: "Heavy Load Recovery", text: "Heavy load yesterday. High risk of overtraining. Consider recovery focus.", type: "warning" });

    // Confidence (1-5)
    if (data.confidence <= 2) recommendations.push({ title: "Mental Readiness", text: "Low readiness mindset. Focus on small wins and technique.", type: "info" });

    return recommendations;
}

function renderRecommendations(score, data, profile) {
    const container = document.getElementById("modalRecommendations");
    if (!container) return;
    container.innerHTML = "";

    if (!data || Object.keys(data).length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem;">No check-in data for today</p>';
        return;
    }

    const sport = profile.sport?.toLowerCase() || "";
    const generalTips = [];
    if (score >= 80) {
        generalTips.push({ title: "Green Light", text: "Athlete is in an optimal state for training.", type: "success" });
    } else if (score >= 60) {
        generalTips.push({ title: "Caution", text: "Moderate intensity recommended. Monitor for fatigue.", type: "warning" });
    } else {
        generalTips.push({ title: "Recovery Focus", text: "Prioritize rest and light mobility today.", type: "danger" });
    }

    const specificTips = getSpecificRecommendations(data);
    const allTips = [...generalTips, ...specificTips];

    // Sport specific addition
    if (sport.includes("football") && data.pain >= 6) {
        allTips.push({ title: "Contact Alert", text: "Avoid high-contact drills today due to pain levels.", type: "danger" });
    }

    allTips.forEach(tip => {
        const div = document.createElement("div");
        div.className = `recommendation-item ${tip.type || ''}`;
        div.innerHTML = `<h4>${tip.title}</h4><p>${tip.text}</p>`;
        container.appendChild(div);
    });
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
function showToast(m, t = "success") { toast.textContent = m; toast.className = `toast ${t} show`; setTimeout(() => toast.classList.remove("show"), 3000); }
refreshBtn.addEventListener("click", loadTeamData);
window.openAthleteProfile = openAthleteProfile;

// ================= AUTO LOGOUT ON INACTIVITY =================
let idleTime = 0;
const MAX_IDLE_MINUTES = 10;

function resetIdleTimer() {
    idleTime = 0;
}

const idleInterval = setInterval(() => {
    idleTime++;
    if (idleTime >= MAX_IDLE_MINUTES) {
        clearInterval(idleInterval);
        localStorage.removeItem("token");
        localStorage.removeItem("currentUser");
        alert("Session expired due to inactivity. Please log in again to protect athlete records.");
        window.location.href = "trainer-login.html";
    }
}, 60000);

["mousemove", "keypress", "click", "scroll", "touchstart"].forEach(event => {
    document.addEventListener(event, resetIdleTimer, true);
});
