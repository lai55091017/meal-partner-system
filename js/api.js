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

    getParties(userId) {
        const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
        return requestApi(`/parties${query}`);
    },

    getParty(id) {
        return requestApi(`/parties/${id}`);
    },

    uploadImage(dataUrl, fileName = "image", usage = "common") {
        return requestApi("/uploads/image", {
            method: "POST",
            body: JSON.stringify({ dataUrl, fileName, usage }),
        });
    },

    getRestaurants() {
        return requestApi("/restaurants");
    },

    createRestaurant(userId, restaurantData) {
        return requestApi("/restaurants", {
            method: "POST",
            body: JSON.stringify({ userId, ...restaurantData }),
        });
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

    getNotifications(userId) {
        return requestApi(`/notifications/${userId}`);
    },

    createNotification(notificationData) {
        return requestApi("/notifications", {
            method: "POST",
            body: JSON.stringify(notificationData),
        });
    },

    deleteNotification(notificationId, userId) {
        return requestApi(`/notifications/${notificationId}`, {
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

    editChatMessage(partyId, messageId, userId, message) {
        return requestApi(`/chats/${partyId}/messages/${messageId}`, {
            method: "PATCH",
            body: JSON.stringify({ userId, message }),
        });
    },

    recallChatMessage(partyId, messageId, userId) {
        return requestApi(`/chats/${partyId}/messages/${messageId}/recall`, {
            method: "PATCH",
            body: JSON.stringify({ userId }),
        });
    },

    submitRatings(ratingData) {
        return requestApi("/ratings", {
            method: "POST",
            body: JSON.stringify(ratingData),
        });
    },

    getReceivedRatings(userId) {
        return requestApi(`/ratings/received/${userId}`);
    },

    getRatingSummary(userId) {
        return requestApi(`/ratings/summary/${userId}`);
    },


    getAdminSummary(userId) {
        return requestApi(`/admin/summary?userId=${encodeURIComponent(userId)}`);
    },

    getAdminUsers(userId) {
        return requestApi(`/admin/users?userId=${encodeURIComponent(userId)}`);
    },

    getAdminParties(userId) {
        return requestApi(`/admin/parties?userId=${encodeURIComponent(userId)}`);
    },

    getAdminChats(userId) {
        return requestApi(`/admin/chats?userId=${encodeURIComponent(userId)}`);
    },

    getAdminReports(userId) {
        return requestApi(`/admin/reports?userId=${encodeURIComponent(userId)}`);
    },

    getAdminRestaurants(userId) {
        return requestApi(`/admin/restaurants?userId=${encodeURIComponent(userId)}`);
    },

    adminCreateRestaurant(userId, restaurantData) {
        return requestApi("/admin/restaurants", {
            method: "POST",
            body: JSON.stringify({ userId, ...restaurantData }),
        });
    },

    adminUpdateRestaurant(restaurantId, userId, restaurantData) {
        return requestApi(`/admin/restaurants/${restaurantId}`, {
            method: "PUT",
            body: JSON.stringify({ userId, ...restaurantData }),
        });
    },

    adminDeleteRestaurant(restaurantId, userId) {
        return requestApi(`/admin/restaurants/${restaurantId}`, {
            method: "DELETE",
            body: JSON.stringify({ userId }),
        });
    },

    adminCancelParty(partyId, userId) {
        return requestApi(`/admin/parties/${partyId}/cancel`, {
            method: "POST",
            body: JSON.stringify({ userId }),
        });
    },

    adminDeleteParty(partyId, userId) {
        return requestApi(`/admin/parties/${partyId}`, {
            method: "DELETE",
            body: JSON.stringify({ userId }),
        });
    },

    adminDeleteUser(targetUserId, userId) {
        return requestApi(`/admin/users/${targetUserId}`, {
            method: "DELETE",
            body: JSON.stringify({ userId }),
        });
    },

    adminDeleteChatMessage(messageId, userId) {
        return requestApi(`/admin/chats/${messageId}`, {
            method: "DELETE",
            body: JSON.stringify({ userId }),
        });
    },

    submitReport(reportData) {
        return requestApi("/reports", {
            method: "POST",
            body: JSON.stringify(reportData),
        });
    },

    adminUpdateReportStatus(reportId, userId, status, adminNote = "") {
        return requestApi(`/admin/reports/${reportId}/status`, {
            method: "PUT",
            body: JSON.stringify({ userId, status, adminNote }),
        });
    },

    checkPartyReviewed(partyId, userId) {
        return requestApi(`/ratings/check?partyId=${encodeURIComponent(partyId)}&userId=${encodeURIComponent(userId)}`);
    },
};