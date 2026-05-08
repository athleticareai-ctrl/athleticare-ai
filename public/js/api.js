// ================= API UTILITY =================
const API_BASE = (window.location.origin + "/api").replace(/\/+$/, "");

const api = {
    async request(endpoint, method = "GET", body = null) {
        const token = localStorage.getItem("token");
        const headers = {
            "Content-Type": "application/json"
        };
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const config = {
            method,
            headers
        };
        if (body) {
            config.body = JSON.stringify(body);
        }

        const url = `${API_BASE}/${endpoint.replace(/^\/+/, "")}`;
        const response = await fetch(url, config);
        
        if (response.status === 401) {
            // Token expired or invalid
            localStorage.removeItem("token");
            localStorage.removeItem("currentUser");
            
            // Smart redirect: if on trainer pages, go to trainer-login
            if (window.location.pathname.includes("trainer") || window.location.pathname.includes("team")) {
                window.location.href = "trainer-login.html";
            } else {
                window.location.href = "login1.html";
            }
            return;
        }

        const contentType = response.headers.get("content-type");
        let data;
        
        if (contentType && contentType.includes("application/json")) {
            data = await response.json();
        } else {
            const text = await response.text();
            console.error("Non-JSON response received:", text);
            throw new Error(`Server returned non-JSON response (${response.status})`);
        }

        if (!response.ok) {
            throw new Error(data.error || "Request failed");
        }
        return data;
    },

    get(endpoint) {
        return this.request(endpoint, "GET");
    },

    post(endpoint, body) {
        return this.request(endpoint, "POST", body);
    }
};

window.api = api;
