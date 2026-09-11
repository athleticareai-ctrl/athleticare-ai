// ================= AUTH GUARD =================
const currentUser = JSON.parse(localStorage.getItem("currentUser"));
if (!currentUser) {
    window.location.href = "login1.html";
}

// ================= NAVBAR =================
const navActions = document.getElementById("nav-actions");
if (navActions) {
    navActions.innerHTML = `
      <ul>
        <li><a href="dashboard.html">Dashboard</a></li>
        <li><a href="schedule.html">Scheduling</a></li>
        <li><span class="nav-user">Hi, ${currentUser.firstname}</span></li>
        <li><a href="#" id="logoutBtn">Logout</a></li>
      </ul>
    `;
    document.getElementById("logoutBtn").addEventListener("click", () => {
        localStorage.removeItem("token");
        localStorage.removeItem("currentUser");
        window.location.href = "login1.html";
    });
}

// ================= STATE =================
let chats = [];
let activeChatId = null;

const chatList = document.getElementById("chatList");
const chatMessages = document.getElementById("chatMessages");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");

// ================= INITIALIZATION =================
document.addEventListener("DOMContentLoaded", async () => {
    await loadChats();
    if (chats.length) {
        activeChatId = chats[0].id;
        openChat(activeChatId);
    }
    renderChats();
});

async function loadChats() {
    try {
        chats = await api.get("/chats");
        if (!Array.isArray(chats)) chats = [];
    } catch (err) {
        console.warn("Load chats from server skipped or failed, using local storage:", err);
        chats = JSON.parse(localStorage.getItem("demo_chats") || "[]");
    }
    if (!chats.length) {
        chats = [{
            id: Date.now(),
            title: "Ankle Injury Guidance",
            messages: [
                { role: "user", text: "I twisted my right ankle during practice today." },
                { role: "bot", text: "Hello! I'm AthletiCare AI. For an acute ankle sprain, please follow RICE: Rest, Ice (15-20 min), Compression, and Elevation. Avoid putting weight on it if pain is severe. Would you like me to flag this for your athletic trainer?" }
            ]
        }];
    }
}

async function saveChats() {
    localStorage.setItem("demo_chats", JSON.stringify(chats));
    try {
        await api.post("/chats", { chats });
    } catch (err) {
        console.warn("Save chats to server skipped or failed:", err);
    }
}

function summarizeTitle(text) {
    return text.replace(/[^a-zA-Z0-9 ]/g, "").split(" ").slice(0, 4).join(" ");
}

function renderChats() {
    chatList.innerHTML = "";
    chats.forEach(chat => {
        const li = document.createElement("li");
        li.className = `chat-item ${chat.id === activeChatId ? "active" : ""}`;
        li.textContent = chat.title;
        li.addEventListener("click", () => openChat(chat.id));
        chatList.appendChild(li);
    });
}

function openChat(id) {
    activeChatId = id;
    chatMessages.innerHTML = "";
    const chat = chats.find(c => c.id === id);
    if (!chat) return;
    chat.messages.forEach(m => addMessage(m.role, m.text));
    renderChats();
}

function addMessage(role, text) {
    const div = document.createElement("div");
    div.className = `message ${role}`;
    if (role === "bot" && typeof marked !== "undefined") {
        div.innerHTML = marked.parse(text);
    } else {
        div.textContent = text;
    }
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function createNewChat() {
    const newChat = { id: Date.now(), title: "New Injury Chat", messages: [] };
    chats.unshift(newChat);
    activeChatId = newChat.id;
    saveChats();
    chatMessages.innerHTML = "";
    renderChats();
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;
    if (!activeChatId) createNewChat();
    
    const chat = chats.find(c => c.id === activeChatId);
    if (!chat) return;

    if (chat.messages.length === 0) chat.title = summarizeTitle(text);
    chat.messages.push({ role: "user", text });
    addMessage("user", text);
    userInput.value = "";
    renderChats();

    try {
        const response = await fetch("/chat", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify({
                messages: chat.messages.map(m => ({
                    role: m.role === "bot" ? "assistant" : "user",
                    content: m.text
                }))
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.reply) {
                chat.messages.push({ role: "bot", text: data.reply });
                addMessage("bot", data.reply);
                saveChats();
                return;
            }
        }
    } catch (err) {
        console.log("Server API request unavailable, using demo AI response fallback");
    }

    // Demo AI Fallback Response
    const demoResponses = [
        "Based on your description, initial management recommends RICE (Rest, Ice for 15-20 mins, Compression, and Elevation). Keep weight off the affected area if pain is present.",
        "I've logged these injury details into your profile. Make sure to stay hydrated and monitor for swelling or sharp pain. Would you like assistance scheduling a check-in with your athletic trainer?",
        "Please rest the joint and avoid strenuous exercise. If pain exceeds a 5/10 level or swelling increases, please consult a certified athletic trainer or healthcare provider immediately."
    ];
    const reply = demoResponses[Math.floor(Math.random() * demoResponses.length)];
    chat.messages.push({ role: "bot", text: reply });
    addMessage("bot", reply);
    saveChats();
}

sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", e => { if (e.key === "Enter") sendMessage(); });
newChatBtn.addEventListener("click", createNewChat);



