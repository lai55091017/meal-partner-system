//統一寫 fetch()，負責跟後端溝通
async function requestApi(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
        ...options,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(data?.message || "API 請求失敗");
    }

    return data;
}

const api = {
    login(account, password) {
        return requestApi("/login", {
            method: "POST",
            body: JSON.stringify({ account, password }),
        });
    },

    register(account, password, name) {
        return requestApi("/register", {
            method: "POST",
            body: JSON.stringify({ account, password, name }),
        });
    },

    getParties() {
        return requestApi("/parties");
    },

    getParty(id) {
        return requestApi(`/parties/${id}`);
    },

    createParty(partyData) {
        return requestApi("/parties", {
            method: "POST",
            body: JSON.stringify(partyData),
        });
    },

    joinParty(partyId, userId) {
        return requestApi(`/parties/${partyId}/join`, {
            method: "POST",
            body: JSON.stringify({ userId }),
        });
    },

    leaveParty(partyId, userId) {
        return requestApi(`/parties/${partyId}/leave`, {
            method: "POST",
            body: JSON.stringify({ userId }),
        });
    },

    cancelParty(partyId, userId) {
        return requestApi(`/parties/${partyId}/cancel`, {
            method: "POST",
            body: JSON.stringify({ userId }),
        });
    },

    getUserProfile(userId) {
        return requestApi(`/users/${userId}/profile`);
    },

    updateUserProfile(userId, profileData) {
        return requestApi(`/users/${userId}/profile`, {
            method: "PUT",
            body: JSON.stringify(profileData),
        });
    },

    updateUserPreferences(userId, preferences) {
        return requestApi(`/users/${userId}/preferences`, {
            method: "PUT",
            body: JSON.stringify(preferences),
        });
    },

    deleteParty(partyId, userId) {
        return requestApi(`/parties/${partyId}`, {
            method: "DELETE",
            body: JSON.stringify({ userId }),
        });
    },

    getChatMessages(partyId, userId) {
        return requestApi(`/chats/${partyId}/messages?userId=${encodeURIComponent(userId)}`);
    },

    sendChatMessage(partyId, userId, message) {
        return requestApi(`/chats/${partyId}/messages`, {
            method: "POST",
            body: JSON.stringify({ userId, message }),
        });
    },
};