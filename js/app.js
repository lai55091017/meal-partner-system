//初始化、事件綁定、頁面切換
/**
 * 飯搭子系統 Prototype JS
 * ------------------------------------------------------
 * 功能總覽：
 * 1. 底部導覽列切換頁面：通知 / 聊天室 / home / 個人帳號
 * 2. 點「個人帳號」時，如果尚未登入，先顯示登入頁；登入成功後才進入個人帳號
 * 3. 首頁飯局卡片點擊後，進入更完整的「飯局詳情」
 * 4. 詳情頁會顯示飯局名稱、主辦人、店家、時間、人數與介紹
 * 5. 其他飯局按 join 後，會把目前登入使用者加入成員列表
 * 5. 成員頁按 評價 後，進入「評價頁」
 * 6. 首頁右下角 + 按鈕，進入「新增飯局」
 * 7. 新增飯局送出後，會寫入 PostgreSQL，並在首頁「我的飯局」新增一張卡片
 * 8. 首頁篩選按鈕可切換 早餐 / 午餐 / 晚餐 / 宵夜
 * 9. 聊天室頁會顯示已建立或已加入的飯局聊天室
 * 10. 每個飯局都有獨立聊天紀錄，訊息會寫入 PostgreSQL
 * 11. 已加入飯局後可以退出，退出後人數與成員列表會自動更新
 * 12. 評價頁星星可以點擊切換 1～5 顆星
 *
 * 目前已連接 Express API 與 PostgreSQL，localStorage 僅保留登入狀態與少量前端暫存。
 */
(function () {
    "use strict";

    /* ======================================================
     * 1. DOM 工具函式
     * ====================================================== */
    const $ = (selector, scope = document) => scope.querySelector(selector);
    const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

    /* ======================================================
     * 2. 頁面與登入設定
     * ====================================================== */
    const AUTH_KEY = "mealPartnerLoginUser";
    const PROFILE_KEY = "mealPartnerProfileData";
    const PARTIES_KEY = "mealPartnerMyParties";
    const JOINED_PARTIES_KEY = "mealPartnerJoinedParties";
    const CHAT_MESSAGES_KEY = "mealPartnerChatMessages";
    const CANCELED_PARTIES_KEY = "mealPartnerCanceledParties";
    const NOTIFICATIONS_KEY = "mealPartnerNotifications";
    const DELETED_PARTIES_KEY = "mealPartnerDeletedParties";
    const DELETED_CHAT_ROOMS_KEY = "mealPartnerDeletedChatRooms";
    const RATINGS_KEY = "mealPartnerRatings";

    const VIEW_IDS = {
        login: "view-login",
        home: "view-home",
        notifications: "view-notifications",
        chat: "view-chat",
        partyDetail: "view-party-detail",
        partyJoined: "view-party-joined",
        rating: "view-rating",
        create: "view-create",
        profile: "view-profile",
        admin: "view-admin",
    };

    const PAGE_TITLES = {
        login: "登入 · 飯搭子系統",
        home: "飯搭子系統",
        notifications: "通知 · 飯搭子系統",
        chat: "聊天室 · 飯搭子系統",
        partyDetail: "飯局詳情 · 飯搭子系統",
        partyJoined: "飯局成員 · 飯搭子系統",
        rating: "評價 · 飯搭子系統",
        create: "新增飯局 · 飯搭子系統",
        profile: "個人帳號 · 飯搭子系統",
        admin: "後台管理 · 飯搭子系統",
    };

    // 底部導覽列對應的主要頁面。
    const NAV_TO_VIEW = {
        home: "home",
        notifications: "notifications",
        chat: "chat",
        profile: "profile",
        admin: "admin",
    };

    // 這些頁面屬於首頁流程，所以底部導覽列維持 home 亮起。
    const OVERLAY_VIEWS = ["create", "partyDetail", "partyJoined", "rating"];

    /* ======================================================
     * 3. 主要 DOM 元素
     * ====================================================== */
    const app = $(".app");
    const views = Object.fromEntries(
        Object.entries(VIEW_IDS).map(([key, id]) => [key, document.getElementById(id)])
    );

    const navItems = $$(".nav-item");
    const fab = $("#fab");
    const filterBtn = $("#filter-btn");
    const filterMenu = $("#filter-menu");
    const filterLabel = $("#filter-label");
    const mealTypeFilter = $("#meal-type-filter");
    const advancedFilterPanel = $("#advanced-filter-panel");
    const searchInput = $("#search-input");
    const availableOnlyFilter = $("#available-only-filter");
    const restaurantCategoryFilter = $("#restaurant-category-filter");
    const restaurantPriceFilter = $("#restaurant-price-filter");
    const homeNoResult = $("#home-no-result");
    const myPartiesSection = $("#my-parties-section");
    const otherPartiesSection = $("#other-parties-section");
    const homePartyTabs = $$(".home-party-tab");
    const myPartyTabCount = $("#my-party-tab-count");
    const otherPartyTabCount = $("#other-party-tab-count");
    const createForm = $("#create-form");
    const signoutBtn = $("#profile-signout");

    const loginForm = $("#login-form");
    const loginAccount = $("#login-account");
    const loginPassword = $("#login-password");
    const loginMessage = $("#login-message");
    const registerForm = $("#register-form");
    const registerAccount = $("#register-account");
    const registerName = $("#register-name");
    const registerPassword = $("#register-password");
    const registerPasswordConfirm = $("#register-password-confirm");
    const registerMessage = $("#register-message");
    const loginTabBtn = $("#login-tab-btn");
    const registerTabBtn = $("#register-tab-btn");
    const authTitle = $("#auth-title");
    const authSubtitle = $("#auth-subtitle");

    const myPartyList = $("#my-party-list");
    const myPartyEmpty = $("#my-party-empty");
    const otherPartyEmpty = $("#other-party-empty");
    const notificationList = $("#notification-list");
    const notificationEmpty = $("#notification-empty");
    const otherPartyCard = $("#other-party-card");
    const partyJoinBtn = $("#party-join-btn");
    const partyDetailDeleteBtn = $("#party-detail-delete-btn");
    const partyRateBtn = $("#party-rate-btn");
    const joinedMemberList = $("#joined-member-list");
    const joinedMembersCount = $("#joined-members-count");
    const partyChatBtn = $("#party-chat-btn");
    const partyLeaveBtn = $("#party-leave-btn");
    const partyCancelBtn = $("#party-cancel-btn");
    const chatRoomList = $("#chat-room-list");
    const chatEmpty = $("#chat-empty");
    const chatRoomPanel = $("#chat-room-panel");
    const chatRoomTitle = $("#chat-room-title");
    const chatRoomMeta = $("#chat-room-meta");
    const chatMessageList = $("#chat-message-list");
    const chatForm = $("#chat-form");
    const chatInput = $("#chat-input");
    const chatBackBtn = $("#chat-back-btn");
    const profileForm = $("#profile-form");
    const profileEditBtn = $("#profile-edit-btn");
    const profileSaveBtn = $("#profile-save-btn");
    const profileAvatarFile = $("#profile-avatar-file");
    const profileAvatarPreview = $("#profile-avatar-preview");
    const profileAvatarIcon = $(".profile-avatar-icon");
    const createCoverFile = $("#create-cover-file");
    const detailPartyImage = $("#detail-party-image");
    const joinedPartyImage = $("#joined-party-image");
    const profileNameInput = $("#profile-name-input");
    const profileStudentId = $("#profile-student-id");
    const profileDepartment = $("#profile-department");
    const profileBio = $("#profile-bio");
    const hostPreviewName = $("#host-preview-name");
    const hostPreviewDiet = $("#host-preview-diet");
    const hostPreviewBio = $("#host-preview-bio");
    const ratingPartyTitle = $("#rating-party-title");
    const ratingList = $("#rating-list");
    const ratingMessage = $("#rating-message");
    const ratingSubmitBtn = $("#rating-submit-btn");
    const profileAverageRating = $("#profile-average-rating");
    const profileReviewList = $("#profile-review-list");
    const profileReviewEmpty = $("#profile-review-empty");
    const adminRefreshBtn = $("#admin-refresh-btn");
    const adminMessage = $("#admin-message");
    const adminTotalUsers = $("#admin-total-users");
    const adminTotalParties = $("#admin-total-parties");
    const adminTotalMessages = $("#admin-total-messages");
    const adminTotalRatings = $("#admin-total-ratings");
    const adminTotalRestaurants = $("#admin-total-restaurants");
    const adminUserList = $("#admin-user-list");
    const adminPartyList = $("#admin-party-list");
    const adminChatList = $("#admin-chat-list");
    const createRestaurantSelect = $("#create-restaurant");
    const createRestaurantInfo = $("#create-restaurant-info");
    const createRestaurantName = $("#create-restaurant-name");
    const createRestaurantCategory = $("#create-restaurant-category");
    const createRestaurantPrice = $("#create-restaurant-price");
    const createRestaurantHours = $("#create-restaurant-hours");
    const createRestaurantAddress = $("#create-restaurant-address");
    const createRestaurantFeature = $("#create-restaurant-feature");
    const createNewRestaurantToggle = $("#create-new-restaurant-toggle");
    const createCustomRestaurantForm = $("#create-custom-restaurant");
    const customRestaurantName = $("#custom-restaurant-name");
    const customRestaurantCategory = $("#custom-restaurant-category");
    const customRestaurantPrice = $("#custom-restaurant-price");
    const customRestaurantHours = $("#custom-restaurant-hours");
    const customRestaurantAddress = $("#custom-restaurant-address");
    const customRestaurantFeature = $("#custom-restaurant-feature");
    const adminRestaurantForm = $("#admin-restaurant-form");
    const adminRestaurantId = $("#admin-restaurant-id");
    const adminRestaurantName = $("#admin-restaurant-name");
    const adminRestaurantCategory = $("#admin-restaurant-category");
    const adminRestaurantPrice = $("#admin-restaurant-price");
    const adminRestaurantHours = $("#admin-restaurant-hours");
    const adminRestaurantAddress = $("#admin-restaurant-address");
    const adminRestaurantFeature = $("#admin-restaurant-feature");
    const adminRestaurantSaveBtn = $("#admin-restaurant-save-btn");
    const adminRestaurantCancelEdit = $("#admin-restaurant-cancel-edit");
    const adminRestaurantList = $("#admin-restaurant-list");
    const detailReportBtn = $("#detail-report-btn");
    const joinedReportBtn = $("#joined-report-btn");
    const reportModal = $("#report-modal");
    const reportForm = $("#report-form");
    const reportCloseBtn = $("#report-close-btn");
    const reportCancelBtn = $("#report-cancel-btn");
    const reportTargetText = $("#report-target-text");
    const reportTargetRow = $("#report-target-row");
    const reportTargetType = $("#report-target-type");
    const reportReason = $("#report-reason");
    const reportDescription = $("#report-description");
    const reportMessage = $("#report-message");
    const reportSubmitBtn = $("#report-submit-btn");
    const adminPendingReports = $("#admin-pending-reports");
    const adminReportList = $("#admin-report-list");

    /* ======================================================
     * 4. 頁面狀態資料
     * ====================================================== */
    let currentParty = null;
    let allowJoinFlow = false;
    let currentUser = null;
    let currentChatPartyId = null;
    let visibleMyPartyCount = 0;
    let visibleOtherPartyCount = 0;
    let activeHomePartyTab = "my";
    let backendParties = [];
    let currentChatMessages = [];
    let chatPreviewCache = {};
    let ratingReviewedCache = new Set();
    let receivedRatingsCache = [];
    let ratingSummaryCache = { average: null, count: 0 };
    let partyHostProfileCache = {};
    let currentReportContext = null;
    let restaurantOptions = [];
    const CUSTOM_RESTAURANT_VALUE = "__custom__";
    let pendingProfileAvatarFile = null;
    let pendingProfileAvatarPreview = "";
    let isSavingProfile = false;

    // 正式版不再顯示範例飯局 / 範例聊天室；只顯示資料庫或使用者實際建立、加入的資料。
    const DEMO_PARTY_IDS = new Set(["default-my-party", "other-demo-party"]);

    function isDemoPartyId(partyId) {
        return DEMO_PARTY_IDS.has(String(partyId));
    }

    const detailRestaurantFields = {
        panel: $("#detail-restaurant-info"),
        name: $("#detail-restaurant-name"),
        category: $("#detail-restaurant-category"),
        price: $("#detail-restaurant-price"),
        hours: $("#detail-restaurant-hours"),
        address: $("#detail-restaurant-address"),
        feature: $("#detail-restaurant-feature"),
    };

    const joinedRestaurantFields = {
        panel: $("#joined-restaurant-info"),
        name: $("#joined-restaurant-name"),
        category: $("#joined-restaurant-category"),
        price: $("#joined-restaurant-price"),
        hours: $("#joined-restaurant-hours"),
        address: $("#joined-restaurant-address"),
        feature: $("#joined-restaurant-feature"),
    };

    const detailFields = {
        partyName: $("#detail-party-name"),
        host: $("#detail-host"),
        store: $("#detail-store"),
        time: $("#detail-time"),
        mealType: $("#detail-meal-type"),
        people: $("#detail-people"),
        status: $("#detail-status"),
        description: $("#detail-description"),
        restaurantInfo: detailRestaurantFields,
    };

    const joinedFields = {
        partyName: $("#joined-party-name"),
        host: $("#joined-host"),
        store: $("#joined-store"),
        time: $("#joined-time"),
        mealType: $("#joined-meal-type"),
        people: $("#joined-people"),
        status: $("#joined-status"),
        description: $("#joined-description"),
        restaurantInfo: joinedRestaurantFields,
    };

    /* ======================================================
     * 5. 登入 / 登出功能
     * ====================================================== */
    function loadSavedUser() {
        try {
            const savedUser = localStorage.getItem(AUTH_KEY);
            currentUser = savedUser ? JSON.parse(savedUser) : null;
        } catch (error) {
            currentUser = null;
            localStorage.removeItem(AUTH_KEY);
        }
    }

    function removeDemoPartiesFromLocalStorage() {
        try {
            const myParties = loadMyParties().filter((party) => !isDemoPartyId(party.id));
            saveMyParties(myParties);

            const joinedParties = loadJoinedParties();
            DEMO_PARTY_IDS.forEach((id) => delete joinedParties[id]);
            saveJoinedParties(joinedParties);

            const chatMessages = loadChatMessages();
            DEMO_PARTY_IDS.forEach((id) => delete chatMessages[id]);
            saveChatMessages(chatMessages);

            saveDeletedPartyIds(loadDeletedPartyIds().filter((id) => !isDemoPartyId(id)));
            saveDeletedChatRoomIds(loadDeletedChatRoomIds().filter((id) => !isDemoPartyId(id)));
        } catch (error) {
            console.warn("清除範例資料失敗：", error);
        }
    }

    function isLoggedIn() {
        return currentUser !== null;
    }

    function isAdminUser(user = currentUser) {
        return Boolean(user && (user.role === "admin" || user.account === "admin"));
    }

    function isAdminOnlyAllowedView(viewKey) {
        return ["admin", "profile", "login"].includes(viewKey);
    }

    function updateAdminNavVisibility() {
        const isAdmin = isAdminUser();

        navItems.forEach((nav) => {
            const navKey = nav.dataset.nav;

            if (isAdmin) {
                // 管理員採純後台模式：只保留「後台」與「個人帳號」。
                nav.hidden = !(navKey === "admin" || navKey === "profile");
            } else {
                // 一般使用者不可看見後台入口。
                nav.hidden = navKey === "admin";
            }
        });

        if (fab) fab.hidden = isAdmin;
    }

    function getCurrentUserId() {
        return currentUser?.id != null ? String(currentUser.id) : currentUser?.account || "guest-user";
    }

    function getDefaultProfile() {
        return {
            name: currentUser?.name || "約飯人 先生/小姐",
            studentId: currentUser?.student_id || currentUser?.account || "",
            department: "",
            avatar: "",
            diet: [],
            cuisine: [],
            bio: "",
        };
    }

    function loadProfileData() {
        try {
            const savedProfile = localStorage.getItem(PROFILE_KEY);
            return savedProfile ? { ...getDefaultProfile(), ...JSON.parse(savedProfile) } : getDefaultProfile();
        } catch (error) {
            localStorage.removeItem(PROFILE_KEY);
            return getDefaultProfile();
        }
    }

    function saveProfileData(profile) {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    }

    function groupPreferences(preferences = []) {
        return preferences.reduce(
            (groups, preference) => {
                if (preference.type === "diet") groups.diet.push(preference.value);
                if (preference.type === "cuisine") groups.cuisine.push(preference.value);
                return groups;
            },
            { diet: [], cuisine: [] }
        );
    }

    function mapBackendProfileToFrontend(user, preferences = []) {
        const previousProfile = loadProfileData();
        const groupedPreferences = groupPreferences(preferences);

        return {
            name: user?.name || previousProfile.name || "約飯人 先生/小姐",
            studentId: user?.student_id || user?.account || previousProfile.studentId || "",
            department: user?.department || "",
            avatar: user?.avatar || previousProfile.avatar || "",
            diet: groupedPreferences.diet,
            cuisine: groupedPreferences.cuisine,
            bio: user?.bio || "",
        };
    }

    function updateCurrentUserStorage(user) {
        if (!user) return;

        currentUser = {
            ...(currentUser || {}),
            ...user,
        };

        localStorage.setItem(AUTH_KEY, JSON.stringify(currentUser));
        updateAdminNavVisibility();
    }

    async function loadProfileFromBackend(options = {}) {
        const { silent = false } = options;

        if (!isLoggedIn() || !currentUser?.id) {
            renderProfileForm();
            return loadProfileData();
        }

        try {
            const result = await api.getUserProfile(currentUser.id);
            const profile = mapBackendProfileToFrontend(result.user, result.preferences || []);

            updateCurrentUserStorage(result.user);
            saveProfileData(profile);
            renderProfileForm();

            return profile;
        } catch (error) {
            console.error("讀取個人資料失敗：", error);
            renderProfileForm();

            if (!silent) {
                alert(error.message || "讀取個人資料失敗，請確認後端是否啟動");
            }

            return loadProfileData();
        }
    }

    function buildProfilePayload(profile) {
        return {
            name: profile.name,
            studentId: profile.studentId,
            department: profile.department,
            avatar: profile.avatar,
            bio: profile.bio,
        };
    }

    async function saveProfileToBackend(event) {
        event?.preventDefault?.();
        event?.stopPropagation?.();

        if (isSavingProfile) return;

        const viewBeforeSave = app?.dataset?.view || "profile";
        const shouldStayOnProfile = viewBeforeSave === "profile";

        if (!isLoggedIn() || !currentUser?.id) {
            alert("請先登入後再儲存個人資料");
            switchView("login");
            return;
        }

        const profile = collectProfileData();
        const hasPendingAvatar = Boolean(pendingProfileAvatarFile);

        try {
            isSavingProfile = true;

            if (profileSaveBtn) {
                profileSaveBtn.disabled = true;
                profileSaveBtn.textContent = hasPendingAvatar ? "上傳中..." : "儲存中...";
            }

            // 選擇大頭貼時只先預覽；只有按下「儲存」才上傳圖片並寫入 users.avatar。
            if (hasPendingAvatar) {
                profile.avatar = await uploadImageFile(pendingProfileAvatarFile, "avatar");
                if (profileSaveBtn) profileSaveBtn.textContent = "儲存中...";
            }

            const profileResult = await api.updateUserProfile(currentUser.id, buildProfilePayload(profile));
            const preferencesResult = await api.updateUserPreferences(currentUser.id, {
                diet: profile.diet || [],
                cuisine: profile.cuisine || [],
            });

            updateCurrentUserStorage(profileResult.user);

            const updatedProfile = mapBackendProfileToFrontend(
                profileResult.user,
                [
                    ...(preferencesResult.preferences?.diet || []).map((value) => ({ type: "diet", value })),
                    ...(preferencesResult.preferences?.cuisine || []).map((value) => ({ type: "cuisine", value })),
                ]
            );

            pendingProfileAvatarFile = null;
            pendingProfileAvatarPreview = "";
            if (profileAvatarFile) profileAvatarFile.value = "";

            saveProfileData(updatedProfile);
            renderProfileForm();
            setProfileEditMode(false);
            updateHostPreview(updatedProfile);

            if (currentUser?.id) {
                delete partyHostProfileCache[String(currentUser.id)];
            }

            if (currentParty?.id && isBackendPartyId(currentParty.id)) {
                currentParty = await loadBackendPartyDetail(currentParty.id);
                renderJoinedMembers(currentParty);
                updateJoinedActionButtons(currentParty);
            }

            await loadBackendParties();
            renderChatRoomList();

            // loadBackendParties 會重繪首頁資料，但不應該改變目前頁面。
            // 尤其是編輯大頭貼後，使用者應停留在個人帳號頁。
            if (shouldStayOnProfile) {
                switchView("profile");
            }

            alert("個人資料已儲存到資料庫");

            if (shouldStayOnProfile) {
                switchView("profile");
                setTimeout(() => {
                    if (app?.dataset?.view !== "profile") switchView("profile");
                }, 0);
            }
        } catch (error) {
            console.error("儲存個人資料失敗：", error);
            alert(error.message || "儲存個人資料失敗，請確認後端是否啟動");

            if (shouldStayOnProfile) {
                switchView("profile");
            }
        } finally {
            isSavingProfile = false;

            if (profileSaveBtn) {
                profileSaveBtn.disabled = false;
                profileSaveBtn.textContent = "儲存";
            }
        }
    }


    /* ======================================================
     * 6. 通知功能
     *    已改為 PostgreSQL 資料庫儲存；未登入或 API 失敗時才暫用 localStorage fallback。
     * ====================================================== */
    function loadLocalNotifications() {
        try {
            const saved = localStorage.getItem(NOTIFICATIONS_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            localStorage.removeItem(NOTIFICATIONS_KEY);
            return [];
        }
    }

    function saveLocalNotifications(notifications) {
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications.slice(0, 50)));
    }

    function mapBackendNotification(notice) {
        return {
            id: String(notice.id),
            type: notice.type || "system",
            title: notice.title || "通知",
            message: notice.message || "",
            partyId: notice.party_id != null ? String(notice.party_id) : "",
            createdAt: notice.created_at || notice.createdAt || new Date().toISOString(),
            isRead: notice.is_read === true,
        };
    }

    async function loadNotifications() {
        if (!currentUser?.id) return loadLocalNotifications();

        try {
            const result = await api.getNotifications(currentUser.id);
            return (result.notifications || []).map(mapBackendNotification);
        } catch (error) {
            console.error("讀取通知失敗，改用本機暫存：", error);
            return loadLocalNotifications();
        }
    }

    async function deleteNotification(noticeId) {
        if (!noticeId) return;
        if (!confirm("確定要刪除這則通知嗎？")) return;

        try {
            if (currentUser?.id && /^\d+$/.test(String(noticeId))) {
                await api.deleteNotification(noticeId, currentUser.id);
            } else {
                const notifications = loadLocalNotifications().filter((notice) => notice.id !== noticeId);
                saveLocalNotifications(notifications);
            }

            await renderNotifications();
        } catch (error) {
            console.error("刪除通知失敗：", error);
            alert(error.message || "刪除通知失敗");
        }
    }

    async function addNotification(type, title, message, partyId = "") {
        const createdAt = new Date().toISOString();

        try {
            if (currentUser?.id) {
                await api.createNotification({
                    userId: currentUser.id,
                    type,
                    title,
                    message,
                    partyId: partyId || null,
                });
            } else {
                const notifications = loadLocalNotifications();
                notifications.unshift({
                    id: `notice-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                    type,
                    title,
                    message,
                    partyId,
                    createdAt,
                });
                saveLocalNotifications(notifications);
            }

            await renderNotifications();
        } catch (error) {
            console.error("新增通知失敗，改存本機暫存：", error);

            const notifications = loadLocalNotifications();
            notifications.unshift({
                id: `notice-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                type,
                title,
                message,
                partyId,
                createdAt,
            });
            saveLocalNotifications(notifications);
            await renderNotifications();
        }
    }


    /* ======================================================
     * 評價資料功能
     * ====================================================== */
    function loadRatings() {
        try {
            const saved = localStorage.getItem(RATINGS_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            localStorage.removeItem(RATINGS_KEY);
            return [];
        }
    }

    function saveRatings(ratings) {
        localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings));
    }

    function parsePartyEndTime(party) {
        const text = String(party?.time || "");
        const match = text.match(/今天\s*(\d{1,2}):(\d{2})/);
        if (!match) return null;

        const end = new Date();
        end.setHours(Number(match[1]), Number(match[2]), 0, 0);
        return end;
    }

    function isPartyEnded(party) {
        if (!party || party.isCanceled) return false;
        if (party.isEnded === true || party.status === "ended") return true;
        const endTime = parsePartyEndTime(party);
        if (!endTime) return false;
        return Date.now() >= endTime.getTime();
    }

    function getPartyEndHint(party) {
        const endTime = parsePartyEndTime(party);
        if (!endTime) return "此飯局時間格式無法判斷，請使用『今天 HH:mm』的時間選項。";
        return `飯局約在 ${formatMessageTime(endTime.toISOString())} 後才能評價。`;
    }

    function markPartyReviewed(partyId) {
        if (!partyId) return;
        ratingReviewedCache.add(String(partyId));
    }

    function unmarkPartyReviewed(partyId) {
        if (!partyId) return;
        ratingReviewedCache.delete(String(partyId));
    }

    function hasReviewedParty(partyId) {
        const partyKey = String(partyId);
        const reviewerId = getCurrentUserId();

        if (ratingReviewedCache.has(partyKey)) return true;

        // fallback：非後端示範飯局或 API 尚未載入時，保留舊 localStorage 判斷。
        return loadRatings().some((rating) => String(rating.partyId) === partyKey && String(rating.reviewerId) === String(reviewerId));
    }

    function getReceivedRatings(userId = getCurrentUserId()) {
        if (currentUser?.id && String(userId) === String(currentUser.id)) {
            return receivedRatingsCache;
        }

        return loadRatings().filter((rating) => String(rating.targetId) === String(userId));
    }

    function getAverageRating(userId = getCurrentUserId()) {
        if (currentUser?.id && String(userId) === String(currentUser.id)) {
            return ratingSummaryCache.average;
        }

        const received = getReceivedRatings(userId);
        if (!received.length) return null;
        const total = received.reduce((sum, rating) => sum + Number(rating.score || 0), 0);
        return total / received.length;
    }

    function mapBackendRating(rating) {
        return {
            id: String(rating.id),
            partyId: String(rating.party_id),
            partyName: rating.party_name || "飯局",
            reviewerId: String(rating.reviewer_id),
            reviewerName: rating.reviewer_name || rating.reviewer_account || "使用者",
            targetId: String(rating.target_id),
            targetName: rating.target_name || rating.target_account || "使用者",
            score: Number(rating.score || 0),
            comment: rating.comment || "",
            createdAt: rating.created_at || new Date().toISOString(),
        };
    }

    async function refreshRatingReviewedCache(partyId) {
        if (!partyId) return false;

        if (!currentUser?.id || !isBackendPartyId(partyId)) {
            return hasReviewedParty(partyId);
        }

        try {
            const result = await api.checkPartyReviewed(partyId, currentUser.id);
            if (result.reviewed) markPartyReviewed(partyId);
            else unmarkPartyReviewed(partyId);
            return Boolean(result.reviewed);
        } catch (error) {
            console.error("檢查評價狀態失敗：", error);
            return hasReviewedParty(partyId);
        }
    }

    async function loadReceivedRatingsFromBackend() {
        if (!currentUser?.id) {
            receivedRatingsCache = [];
            ratingSummaryCache = { average: null, count: 0 };
            return;
        }

        try {
            const [ratingsResult, summaryResult] = await Promise.all([
                api.getReceivedRatings(currentUser.id),
                api.getRatingSummary(currentUser.id),
            ]);

            receivedRatingsCache = (ratingsResult.ratings || []).map(mapBackendRating);
            ratingSummaryCache = {
                average: summaryResult.summary?.average === null || summaryResult.summary?.average === undefined
                    ? null
                    : Number(summaryResult.summary.average),
                count: Number(summaryResult.summary?.count || 0),
            };
        } catch (error) {
            console.error("讀取評價資料失敗，改用本機暫存：", error);
            receivedRatingsCache = getReceivedRatings(currentUser?.id || getCurrentUserId());
            const average = receivedRatingsCache.length
                ? receivedRatingsCache.reduce((sum, rating) => sum + Number(rating.score || 0), 0) / receivedRatingsCache.length
                : null;
            ratingSummaryCache = { average, count: receivedRatingsCache.length };
        }
    }

    async function renderProfileRatingSummary() {
        await loadReceivedRatingsFromBackend();

        const average = getAverageRating();
        const received = getReceivedRatings();

        if (profileAverageRating) {
            profileAverageRating.textContent = average === null
                ? "尚無評價"
                : `${average.toFixed(1)} / 5（${received.length} 則）`;
        }

        if (!profileReviewList || !profileReviewEmpty) return;

        profileReviewList.innerHTML = "";
        profileReviewEmpty.hidden = received.length > 0;

        received.slice(0, 8).forEach((rating) => {
            const item = document.createElement("li");
            item.className = "profile-review-item";

            const title = document.createElement("p");
            title.className = "profile-review-title";
            title.textContent = `${rating.score} 顆星｜${rating.partyName}`;

            const meta = document.createElement("p");
            meta.className = "profile-review-meta";
            meta.textContent = `${rating.reviewerName || "使用者"}・${formatMessageTime(rating.createdAt)}`;

            const comment = document.createElement("p");
            comment.className = "profile-review-comment";
            comment.textContent = rating.comment || "沒有留下文字評價。";

            item.append(title, meta, comment);
            profileReviewList.appendChild(item);
        });
    }

    function getNotificationTypeLabel(type) {
        const labels = {
            create: "飯局通知",
            join: "成員通知",
            leave: "成員通知",
            cancel: "飯局取消",
            chat: "聊天室",
            rating: "評價通知",
        };

        return labels[type] || "系統通知";
    }

    async function renderNotifications() {
        if (!notificationList) return;

        const notifications = await loadNotifications();
        notificationList.innerHTML = "";

        if (notificationEmpty) notificationEmpty.hidden = notifications.length > 0;

        notifications.forEach((notice) => {
            const item = document.createElement("li");
            item.className = `notice-card notice-card--${notice.type || "system"}`;

            const header = document.createElement("div");
            header.className = "notice-card-header";

            const type = document.createElement("span");
            type.className = "notice-type";
            type.textContent = getNotificationTypeLabel(notice.type);

            const actions = document.createElement("div");
            actions.className = "notice-actions";

            const time = document.createElement("time");
            time.className = "notice-time";
            time.dateTime = notice.createdAt || "";
            time.textContent = formatMessageTime(notice.createdAt);

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "notice-delete-btn";
            deleteBtn.textContent = "×";
            deleteBtn.setAttribute("aria-label", "刪除通知");
            deleteBtn.setAttribute("title", "刪除通知");
            deleteBtn.addEventListener("click", () => {
                deleteNotification(notice.id);
            });

            actions.append(time, deleteBtn);

            const title = document.createElement("h3");
            title.className = "notice-title";
            title.textContent = notice.title || "通知";

            const desc = document.createElement("p");
            desc.className = "notice-desc";
            desc.textContent = notice.message || "";

            header.append(type, actions);
            item.append(header, title, desc);
            notificationList.appendChild(item);
        });
    }

    function setCheckedValues(name, values) {
        $$(`input[name="${name}"]`, profileForm).forEach((input) => {
            input.checked = values.includes(input.value);
        });
    }

    function getCheckedValues(name) {
        return $$(`input[name="${name}"]:checked`, profileForm).map((input) => input.value);
    }

    function fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.addEventListener("load", () => resolve(String(reader.result || "")));
            reader.addEventListener("error", () => reject(new Error("圖片讀取失敗")));
            reader.readAsDataURL(file);
        });
    }

    function validateImageFile(file) {
        if (!file) return "";
        if (!file.type || !file.type.startsWith("image/")) return "請選擇圖片檔案";
        if (file.size > 4 * 1024 * 1024) return "圖片大小不能超過 4MB";
        return "";
    }

    async function uploadImageFile(file, usage) {
        if (!file) return "";
        const errorMessage = validateImageFile(file);
        if (errorMessage) throw new Error(errorMessage);
        const dataUrl = await fileToDataUrl(file);
        const result = await api.uploadImage(dataUrl, file.name || "image", usage);

        // 資料庫優先儲存相對路徑，避免之後換電腦或換網址時圖片失效。
        return result.path || result.url || "";
    }

    function getApiOrigin() {
        return String(API_BASE_URL || "").replace(/\/api\/?$/, "");
    }

    function getImageUrl(imageUrl) {
        const value = String(imageUrl || "").trim();
        if (!value) return "";
        if (/^(https?:|data:|blob:)/i.test(value)) return value;
        if (value.startsWith("/")) return `${getApiOrigin()}${value}`;
        return `${getApiOrigin()}/${value}`;
    }

    async function syncAvatarToBackend(avatarUrl) {
        if (!currentUser?.id) return null;

        const profile = collectProfileData();
        profile.avatar = avatarUrl || "";

        const result = await api.updateUserProfile(currentUser.id, buildProfilePayload(profile));
        updateCurrentUserStorage(result.user);

        const updatedProfile = {
            ...profile,
            name: result.user?.name || profile.name,
            studentId: result.user?.student_id || result.user?.account || profile.studentId,
            department: result.user?.department || profile.department,
            avatar: result.user?.avatar || avatarUrl || "",
            bio: result.user?.bio || profile.bio,
        };

        saveProfileData(updatedProfile);

        if (currentUser?.id) {
            delete partyHostProfileCache[String(currentUser.id)];
        }

        return updatedProfile;
    }

    function renderImageBox(box, imageUrl, fallbackText = "飯") {
        if (!box) return;
        box.innerHTML = "";
        box.classList.toggle("has-image", Boolean(imageUrl));

        if (imageUrl) {
            const img = document.createElement("img");
            img.src = getImageUrl(imageUrl);
            img.alt = "";
            box.appendChild(img);
            return;
        }

        const placeholder = document.createElement("span");
        placeholder.className = "image-placeholder-text";
        placeholder.textContent = fallbackText;
        box.appendChild(placeholder);
    }

    function renderProfileForm() {
        const profile = loadProfileData();

        if (profileNameInput) profileNameInput.value = profile.name;
        if (profileStudentId) profileStudentId.value = profile.studentId;
        if (profileDepartment) profileDepartment.value = profile.department;
        if (profileBio) profileBio.value = profile.bio;

        setCheckedValues("diet", profile.diet || []);
        setCheckedValues("cuisine", profile.cuisine || []);

        if (profileAvatarPreview && profileAvatarIcon) {
            const avatarPreviewUrl = pendingProfileAvatarPreview || getImageUrl(profile.avatar);
            if (avatarPreviewUrl) {
                profileAvatarPreview.src = avatarPreviewUrl;
                profileAvatarPreview.hidden = false;
                profileAvatarIcon.hidden = true;
            } else {
                profileAvatarPreview.removeAttribute("src");
                profileAvatarPreview.hidden = true;
                profileAvatarIcon.hidden = false;
            }
        }

        updateHostPreview(profile);
        renderProfileRatingSummary();
    }

    function collectProfileData() {
        const previousProfile = loadProfileData();

        return {
            name: profileNameInput?.value.trim() || "約飯人 先生/小姐",
            studentId: profileStudentId?.value.trim() || currentUser?.account || "",
            department: profileDepartment?.value.trim() || "",
            avatar: previousProfile.avatar || "",
            diet: getCheckedValues("diet"),
            cuisine: getCheckedValues("cuisine"),
            bio: profileBio?.value.trim() || "",
        };
    }

    function setProfileEditMode(isEditing) {
        profileForm?.classList.toggle("profile-form--editing", isEditing);

        [profileNameInput, profileStudentId, profileDepartment, profileBio].forEach((field) => {
            if (!field) return;
            field.readOnly = !isEditing;
        });

        $$('input[type="checkbox"]', profileForm).forEach((input) => {
            input.disabled = !isEditing;
        });

        if (profileAvatarFile) profileAvatarFile.disabled = !isEditing;
        if (profileEditBtn) profileEditBtn.hidden = isEditing;
        if (profileSaveBtn) profileSaveBtn.hidden = !isEditing;
    }

    function updateHostPreview(profile = loadProfileData()) {
        const preferences = [...(profile.diet || []), ...(profile.cuisine || [])];

        if (hostPreviewName) hostPreviewName.textContent = profile.name || "約飯人 先生/小姐";
        if (hostPreviewDiet) {
            hostPreviewDiet.textContent = preferences.length
                ? preferences.join("・")
                : "飲食偏好尚未填寫";
        }
        if (hostPreviewBio) {
            hostPreviewBio.textContent = profile.bio || "這位使用者尚未填寫個人介紹。";
        }
    }

    function applyPartyHostPreview(profile = {}) {
        const preferences = [...(profile.diet || []), ...(profile.cuisine || [])];

        if (hostPreviewName) hostPreviewName.textContent = profile.name || "約飯人 先生/小姐";
        if (hostPreviewDiet) {
            hostPreviewDiet.textContent = preferences.length
                ? preferences.join("・")
                : (profile.department ? `系所：${profile.department}` : "飲食偏好尚未填寫");
        }
        if (hostPreviewBio) {
            hostPreviewBio.textContent = profile.bio || "這位約飯人尚未填寫個人介紹。";
        }
    }

    async function renderPartyHostPreview(party) {
        if (!party) {
            applyPartyHostPreview({});
            return;
        }

        const normalizedParty = normalizeParty(party);
        const fallbackProfile = {
            name: normalizedParty.host,
            department: normalizedParty.hostDepartment,
            diet: normalizedParty.hostDiet,
            cuisine: normalizedParty.hostCuisine,
            bio: normalizedParty.hostBio,
        };

        applyPartyHostPreview(fallbackProfile);

        const hostId = normalizedParty.hostId;
        if (!hostId || !/^\d+$/.test(String(hostId))) return;

        try {
            if (!partyHostProfileCache[hostId]) {
                const result = await api.getUserProfile(hostId);
                const groupedPreferences = groupPreferences(result.preferences || []);
                partyHostProfileCache[hostId] = {
                    name: result.user?.name || fallbackProfile.name,
                    department: result.user?.department || fallbackProfile.department,
                    diet: groupedPreferences.diet,
                    cuisine: groupedPreferences.cuisine,
                    bio: result.user?.bio || fallbackProfile.bio,
                    avatar: result.user?.avatar || fallbackProfile.avatar || "",
                };
            }

            if (currentParty && String(currentParty.hostId) === String(hostId)) {
                applyPartyHostPreview(partyHostProfileCache[hostId]);
            }
        } catch (error) {
            console.warn("讀取飯局房主資料失敗：", error);
        }
    }

    async function updateProfileUser(options = {}) {
        const profile = loadProfileData();

        if (!profile.studentId && currentUser?.account) profile.studentId = currentUser.account;
        if ((!profile.name || profile.name === "約飯人 先生/小姐") && currentUser?.name) profile.name = currentUser.name;

        saveProfileData(profile);
        renderProfileForm();

        if (isLoggedIn() && currentUser?.id) {
            await loadProfileFromBackend(options);
        }
    }


    function showAuthMode(mode = "login") {
        const isRegister = mode === "register";

        if (loginForm) loginForm.hidden = isRegister;
        if (registerForm) registerForm.hidden = !isRegister;

        loginTabBtn?.classList.toggle("auth-tab--active", !isRegister);
        registerTabBtn?.classList.toggle("auth-tab--active", isRegister);

        if (loginTabBtn) loginTabBtn.setAttribute("aria-selected", String(!isRegister));
        if (registerTabBtn) registerTabBtn.setAttribute("aria-selected", String(isRegister));

        if (authTitle) authTitle.textContent = isRegister ? "註冊帳號" : "登入帳號";
        if (authSubtitle) {
            authSubtitle.textContent = isRegister
                ? "建立帳號後即可使用飯局、聊天室與評價功能"
                : "請輸入帳號與密碼進入系統";
        }

        if (loginMessage) loginMessage.textContent = "";
        if (registerMessage) registerMessage.textContent = "";

        if (isRegister) {
            registerAccount?.focus();
        } else {
            loginAccount?.focus();
        }
    }

    async function registerNewAccount(account, password, name) {
        try {
            if (registerMessage) registerMessage.textContent = "註冊中...";
            if (registerTabBtn) registerTabBtn.disabled = true;

            const result = await api.register(account, password, name);

            currentUser = result.user;
            localStorage.setItem(AUTH_KEY, JSON.stringify(currentUser));
            updateAdminNavVisibility();

            const profile = mapBackendProfileToFrontend(currentUser, []);
            saveProfileData(profile);

            if (registerForm) registerForm.reset();
            if (loginForm) loginForm.reset();
            if (registerMessage) registerMessage.textContent = "";
            if (loginMessage) loginMessage.textContent = "";

            await loadProfileFromBackend({ silent: true });
            setProfileEditMode(false);
            await loadBackendParties();
            renderChatRoomList();
            switchView(isAdminUser() ? "admin" : "profile");
            if (isAdminUser()) loadAdminDashboard();
        } catch (error) {
            console.error("註冊失敗：", error);

            if (registerMessage) {
                registerMessage.textContent = error.message || "註冊失敗，請確認資料是否正確";
            } else {
                alert(error.message || "註冊失敗，請確認資料是否正確");
            }
        } finally {
            if (registerTabBtn) registerTabBtn.disabled = false;
        }
    }

    async function login(account, password) {
        try {
            if (loginMessage) loginMessage.textContent = "登入中...";

            const result = await api.login(account, password);

            currentUser = result.user;

            localStorage.setItem(AUTH_KEY, JSON.stringify(currentUser));
            updateAdminNavVisibility();

            const profile = loadProfileData();
            profile.name = currentUser.name || account;
            profile.studentId = currentUser.student_id || currentUser.account || account;
            profile.department = currentUser.department || "";
            profile.avatar = currentUser.avatar || "";
            profile.bio = currentUser.bio || "";

            saveProfileData(profile);

            if (loginForm) loginForm.reset();
            if (loginMessage) loginMessage.textContent = "";

            renderProfileForm();
            setProfileEditMode(false);
            switchView(isAdminUser() ? "admin" : "profile");
            if (isAdminUser()) loadAdminDashboard();
        } catch (error) {
            console.error("登入失敗：", error);

            if (loginMessage) {
                loginMessage.textContent = error.message || "登入失敗，請確認帳號密碼";
            } else {
                alert(error.message || "登入失敗，請確認帳號密碼");
            }
        }
    }

    function logout() {
        localStorage.removeItem(AUTH_KEY);
        currentUser = null;
        updateAdminNavVisibility();
        renderProfileForm();
        renderProfileRatingSummary();
        setProfileEditMode(false);
        switchView("home");
    }

    /* ======================================================
     * 6. 共用頁面切換功能
     * ====================================================== */
    function setActiveNav(activeNavKey) {
        navItems.forEach((nav) => {
            const isActive = nav.dataset.nav === activeNavKey;
            nav.classList.toggle("nav-item--active", isActive);
            nav.toggleAttribute("aria-current", isActive);
        });
    }

    function closeFilterMenu() {
        if (!filterBtn || !filterMenu) return;
        filterMenu.hidden = true;
        filterBtn.setAttribute("aria-expanded", "false");
    }

    function switchView(viewKey) {
        if (!app) return;

        let safeViewKey = views[viewKey] ? viewKey : "home";

        // 管理員採純後台模式，不能進入一般使用者流程頁面。
        if (isAdminUser() && !isAdminOnlyAllowedView(safeViewKey)) {
            safeViewKey = "admin";
        }

        const targetView = views[safeViewKey];

        Object.values(views).forEach((view) => {
            if (!view) return;
            const shouldShow = view === targetView;
            view.hidden = !shouldShow;
            view.classList.toggle("view--active", shouldShow);
        });

        app.dataset.view = safeViewKey;
        document.title = PAGE_TITLES[safeViewKey] || PAGE_TITLES.home;

        // 登入頁是從個人帳號進來，所以讓「個人帳號」維持亮起。
        if (safeViewKey === "login") {
            setActiveNav("profile");
        } else {
            setActiveNav(OVERLAY_VIEWS.includes(safeViewKey) ? "home" : safeViewKey);
        }

        updateAdminNavVisibility();

        if (safeViewKey === "create") {
            loadRestaurants();
        }

        closeFilterMenu();
    }

    function openProfileOrLogin() {
        if (isLoggedIn()) {
            updateProfileUser();
            switchView("profile");
        } else {
            showAuthMode("login");
            switchView("login");
            loginAccount?.focus();
        }
    }

    /* ======================================================
     * 7. 飯局資料讀取與顯示
     * ====================================================== */
    function parseMembersFromCard(card) {
        try {
            return card.dataset.members ? JSON.parse(card.dataset.members) : [];
        } catch (error) {
            return [];
        }
    }

    function inferMealType(party) {
        const explicit = party.mealType || party.meal || party.category;
        const validTypes = ["早餐", "午餐", "晚餐", "宵夜"];
        if (validTypes.includes(explicit)) return explicit;

        const text = `${party.partyName || ""} ${party.time || ""} ${party.description || ""}`;
        if (/早餐|早上|上午|早午餐/.test(text)) return "早餐";
        if (/午餐|中午|午間/.test(text)) return "午餐";
        if (/晚餐|晚上|晚間|傍晚/.test(text)) return "晚餐";
        if (/宵夜|夜宵|凌晨/.test(text)) return "宵夜";
        return "午餐";
    }


    function mapRestaurant(restaurant = {}) {
        return {
            id: restaurant.id != null ? String(restaurant.id) : "",
            name: restaurant.name || restaurant.restaurant_name || "",
            category: restaurant.category || restaurant.restaurant_category || "",
            priceLevel: restaurant.price_level || restaurant.priceLevel || restaurant.restaurant_price_level || "",
            openingHours: restaurant.opening_hours || restaurant.openingHours || restaurant.restaurant_opening_hours || "",
            address: restaurant.address || restaurant.restaurant_address || "",
            feature: restaurant.feature || restaurant.restaurant_feature || "",
        };
    }

    function isCustomRestaurantMode() {
        return createRestaurantSelect?.value === CUSTOM_RESTAURANT_VALUE;
    }

    function getSelectedRestaurant() {
        const selectedId = createRestaurantSelect?.value || "";
        if (selectedId === CUSTOM_RESTAURANT_VALUE) return null;
        return restaurantOptions.find((restaurant) => String(restaurant.id) === String(selectedId)) || null;
    }

    function getCustomRestaurantData() {
        return {
            name: customRestaurantName?.value.trim() || "",
            category: customRestaurantCategory?.value.trim() || "",
            priceLevel: customRestaurantPrice?.value || "$",
            openingHours: customRestaurantHours?.value.trim() || "",
            address: customRestaurantAddress?.value.trim() || "",
            feature: customRestaurantFeature?.value.trim() || "",
        };
    }

    function resetCustomRestaurantForm() {
        [customRestaurantName, customRestaurantCategory, customRestaurantHours, customRestaurantAddress, customRestaurantFeature].forEach((field) => {
            if (field) field.value = "";
        });
        if (customRestaurantPrice) customRestaurantPrice.value = "$";
    }

    function setCustomRestaurantMode(enabled) {
        if (!createRestaurantSelect) return;
        createRestaurantSelect.value = enabled ? CUSTOM_RESTAURANT_VALUE : "";
        updateSelectedRestaurantInfo();
        if (enabled) customRestaurantName?.focus();
    }

    function renderRestaurantSelect() {
        if (!createRestaurantSelect) return;

        const currentValue = createRestaurantSelect.value;
        createRestaurantSelect.innerHTML = "";

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = restaurantOptions.length ? "請選擇餐廳" : "目前沒有餐廳資料";
        createRestaurantSelect.appendChild(placeholder);

        restaurantOptions.forEach((restaurant) => {
            const option = document.createElement("option");
            option.value = String(restaurant.id);
            option.textContent = `${restaurant.name}｜${restaurant.category}｜${restaurant.priceLevel}`;
            createRestaurantSelect.appendChild(option);
        });

        const customOption = document.createElement("option");
        customOption.value = CUSTOM_RESTAURANT_VALUE;
        customOption.textContent = "＋ 新增其他餐廳";
        createRestaurantSelect.appendChild(customOption);

        if (currentValue === CUSTOM_RESTAURANT_VALUE || (currentValue && restaurantOptions.some((restaurant) => String(restaurant.id) === String(currentValue)))) {
            createRestaurantSelect.value = currentValue;
        }

        updateSelectedRestaurantInfo();
        updateRestaurantFilterOptions();
    }

    function updateRestaurantFilterOptions() {
        if (!restaurantCategoryFilter) return;

        const currentValue = restaurantCategoryFilter.value || "全部";
        const categories = Array.from(new Set(
            restaurantOptions
                .map((restaurant) => String(restaurant.category || "").trim())
                .filter(Boolean)
        )).sort((a, b) => a.localeCompare(b, "zh-Hant"));

        restaurantCategoryFilter.innerHTML = "";

        const allOption = document.createElement("option");
        allOption.value = "全部";
        allOption.textContent = "全部類型";
        restaurantCategoryFilter.appendChild(allOption);

        categories.forEach((category) => {
            const option = document.createElement("option");
            option.value = category;
            option.textContent = category;
            restaurantCategoryFilter.appendChild(option);
        });

        restaurantCategoryFilter.value = categories.includes(currentValue) ? currentValue : "全部";
    }

    async function loadRestaurants() {
        try {
            const result = await api.getRestaurants();
            restaurantOptions = (result.restaurants || []).map(mapRestaurant);
            renderRestaurantSelect();
        } catch (error) {
            console.error("讀取餐廳清單失敗：", error);
            restaurantOptions = [];
            renderRestaurantSelect();
            if (createRestaurantSelect) {
                const option = createRestaurantSelect.querySelector("option");
                if (option) option.textContent = "餐廳清單讀取失敗";
            }
        }
    }

    function updateSelectedRestaurantInfo() {
        const restaurant = getSelectedRestaurant();
        const customMode = isCustomRestaurantMode();
        const storeInput = $("#create-store");

        if (storeInput) storeInput.value = restaurant?.name || "";
        if (createNewRestaurantToggle) {
            createNewRestaurantToggle.textContent = customMode ? "取消新增餐廳" : "＋ 新增其他餐廳";
        }
        if (createCustomRestaurantForm) createCustomRestaurantForm.hidden = !customMode;

        if (!createRestaurantInfo) return;

        createRestaurantInfo.hidden = !restaurant || customMode;
        if (!restaurant || customMode) return;

        if (createRestaurantName) createRestaurantName.textContent = restaurant.name || "餐廳名稱";
        if (createRestaurantCategory) createRestaurantCategory.textContent = restaurant.category || "未分類";
        if (createRestaurantPrice) createRestaurantPrice.textContent = restaurant.priceLevel || "$";
        if (createRestaurantHours) createRestaurantHours.textContent = restaurant.openingHours || "營業時間未填寫";
        if (createRestaurantAddress) createRestaurantAddress.textContent = `地址：${restaurant.address || "尚未填寫"}`;
        if (createRestaurantFeature) createRestaurantFeature.textContent = `特色：${restaurant.feature || "尚未填寫"}`;
    }

    function mapBackendPartyToFrontend(party) {
        const currentUserId = currentUser?.id ? Number(currentUser.id) : null;
        const hostId = party.host_id ? Number(party.host_id) : null;
        const isMine = currentUserId !== null && hostId === currentUserId;
        const isCurrentUserMember = party.is_current_user_member === true || party.is_current_user_member === "true";
        const previewMembers = isCurrentUserMember && !isMine && currentUser?.id
            ? [{
                id: String(currentUser.id),
                name: currentUser.name || currentUser.account || "目前使用者",
                role: "參加者",
                avatar: currentUser.avatar || loadProfileData().avatar || "",
            }]
            : [];

        return normalizeParty({
            id: String(party.id),
            partyName: party.title,
            host: party.host_name || "主辦人",
            hostId: party.host_id,
            hostAccount: party.host_account || "",
            hostDepartment: party.host_department || "",
            hostBio: party.host_bio || "",
            hostAvatar: party.host_avatar || "",
            store: party.restaurant_name || party.store,
            restaurantId: party.restaurant_id,
            restaurantCategory: party.restaurant_category || "",
            restaurantPriceLevel: party.restaurant_price_level || "",
            restaurantOpeningHours: party.restaurant_opening_hours || "",
            restaurantAddress: party.restaurant_address || "",
            restaurantFeature: party.restaurant_feature || "",
            time: party.party_time,
            mealType: party.meal_type,
            maxMembers: Number(party.max_people) || 4,
            currentPeople: Number(party.current_people ?? party.currentPeople ?? 0) || 0,
            description: party.description || "尚未填寫飯局介紹。",
            imageUrl: party.image_url || party.imageUrl || "",
            members: previewMembers,
            isMine,
            isEnded: party.status === "ended",
            isCanceled: party.status === "cancelled",
            isFull: party.is_full === true,
            canJoin: party.can_join !== false,
            status: party.status || "open",
            createdAt: party.created_at,
            source: "backend",
        });
    }

    //後端詳情轉前端格式函式
    function mapBackendPartyDetailToFrontend(party, members = []) {
        const frontendParty = mapBackendPartyToFrontend(party);

        frontendParty.members = members.map((member) => ({
            id: String(member.id),
            name: member.name || member.account || "使用者",
            role: Number(member.id) === Number(party.host_id) ? "主辦人" : "參加者",
            avatar: member.avatar || "",
            department: member.department || "",
        }));

        if (!frontendParty.members.length) {
            frontendParty.members = [
                {
                    id: String(party.host_id),
                    name: party.host_name || "主辦人",
                    role: "主辦人",
                    avatar: party.host_avatar || "",
                    department: party.host_department || "",
                },
            ];
        }

        return frontendParty;
    }

    //讀取飯局詳情函式
    async function loadBackendPartyDetail(partyId) {
        const result = await api.getParty(partyId);

        const party = result.party;
        const members = result.members || [];

        return mapBackendPartyDetailToFrontend(party, members);
    }


    function normalizeParty(party) {
        const rawParty = party || {};
        const maxMembers = Math.max(1, Number(rawParty.maxMembers) || 4);
        const members = Array.isArray(rawParty.members) ? rawParty.members.map((member) => ({
            ...member,
            id: member?.id != null ? String(member.id) : "",
        })) : [];
        const fallbackMembers = members.length
            ? members
            : [{
                id: rawParty.hostId != null ? String(rawParty.hostId) : `host-${rawParty.id || Date.now()}`,
                name: rawParty.host || "約飯人 先生/小姐",
                role: "主辦人",
                avatar: rawParty.hostAvatar || rawParty.host_avatar || "",
            }];

        const explicitCurrentPeople = Number(rawParty.currentPeople ?? rawParty.current_people);
        const currentPeople = Number.isFinite(explicitCurrentPeople) && explicitCurrentPeople > 0
            ? explicitCurrentPeople
            : fallbackMembers.length;

        return {
            id: rawParty.id ? String(rawParty.id) : `party-${Date.now()}`,
            partyName: rawParty.partyName || "飯局名稱",
            host: rawParty.host || "約飯人 先生/小姐",
            hostId: rawParty.hostId != null ? String(rawParty.hostId) : (rawParty.host_id != null ? String(rawParty.host_id) : ""),
            hostAccount: rawParty.hostAccount || rawParty.host_account || "",
            hostDepartment: rawParty.hostDepartment || rawParty.host_department || "",
            hostBio: rawParty.hostBio || rawParty.host_bio || "",
            hostAvatar: rawParty.hostAvatar || rawParty.host_avatar || "",
            hostDiet: Array.isArray(rawParty.hostDiet) ? rawParty.hostDiet : [],
            hostCuisine: Array.isArray(rawParty.hostCuisine) ? rawParty.hostCuisine : [],
            store: rawParty.store || rawParty.restaurantName || "店家名稱",
            restaurantId: rawParty.restaurantId != null ? String(rawParty.restaurantId) : (rawParty.restaurant_id != null ? String(rawParty.restaurant_id) : ""),
            restaurantCategory: rawParty.restaurantCategory || rawParty.restaurant_category || "",
            restaurantPriceLevel: rawParty.restaurantPriceLevel || rawParty.restaurant_price_level || "",
            restaurantOpeningHours: rawParty.restaurantOpeningHours || rawParty.restaurant_opening_hours || "",
            restaurantAddress: rawParty.restaurantAddress || rawParty.restaurant_address || "",
            restaurantFeature: rawParty.restaurantFeature || rawParty.restaurant_feature || "",
            time: rawParty.time || "時間",
            mealType: inferMealType(rawParty),
            maxMembers,
            currentPeople,
            description: rawParty.description || "尚未填寫飯局介紹。",
            imageUrl: rawParty.imageUrl || rawParty.image_url || "",
            members: fallbackMembers,
            isMine: rawParty.isMine === true,
            isEnded: rawParty.isEnded === true || rawParty.status === "ended",
            isCanceled: rawParty.isCanceled === true || rawParty.status === "cancelled" || isPartyCanceled(rawParty.id),
            isFull: rawParty.isFull === true || rawParty.is_full === true,
            canJoin: rawParty.canJoin !== false && rawParty.can_join !== false,
            status: rawParty.status || (rawParty.isEnded === true ? "ended" : rawParty.isCanceled === true ? "cancelled" : "open"),
            canceledAt: rawParty.canceledAt || "",
            createdAt: rawParty.createdAt || new Date().toISOString(),
        };
    }

    function getPartyDataFromCard(card) {
        return normalizeParty({
            id: card.dataset.partyId || card.dataset.id,
            partyName: card.dataset.partyName || "飯局名稱",
            host: card.dataset.host || "約飯人 先生/小姐",
            hostId: card.dataset.hostId || "",
            hostAccount: card.dataset.hostAccount || "",
            hostDepartment: card.dataset.hostDepartment || "",
            hostBio: card.dataset.hostBio || "",
            hostAvatar: card.dataset.hostAvatar || "",
            imageUrl: card.dataset.imageUrl || "",
            store: card.dataset.store || "店家名稱",
            restaurantId: card.dataset.restaurantId || "",
            restaurantCategory: card.dataset.restaurantCategory || "",
            restaurantPriceLevel: card.dataset.restaurantPriceLevel || "",
            restaurantOpeningHours: card.dataset.restaurantOpeningHours || "",
            restaurantAddress: card.dataset.restaurantAddress || "",
            restaurantFeature: card.dataset.restaurantFeature || "",
            time: card.dataset.time || "時間",
            mealType: card.dataset.mealType || "",
            maxMembers: card.dataset.maxMembers || 4,
            currentPeople: card.dataset.currentPeople || card.dataset.currentPeopleCount || "",
            description: card.dataset.description || "尚未填寫飯局介紹。",
            members: parseMembersFromCard(card),
            isMine: card.dataset.source === "mine",
            isEnded: card.dataset.ended === "true" || card.dataset.status === "ended",
            isCanceled: card.dataset.canceled === "true" || card.dataset.status === "cancelled",
            isFull: card.dataset.full === "true",
            canJoin: card.dataset.canJoin !== "false",
            status: card.dataset.status || "open",
            canceledAt: card.dataset.canceledAt || "",
        });
    }

    function getPartyDataFromForm() {
        const profile = loadProfileData();
        const hostName = profile.name || currentUser?.name || currentUser?.account || "約飯人 先生/小姐";

        const partyId = `party-${Date.now()}`;
        const hostMember = getCurrentMember("主辦人");
        hostMember.name = hostName;
        const selectedRestaurant = getSelectedRestaurant();
        const customRestaurant = isCustomRestaurantMode() ? getCustomRestaurantData() : null;

        return normalizeParty({
            id: partyId,
            partyName: $("#create-party-name")?.value.trim() || "飯局名稱",
            host: hostMember.name,
            store: selectedRestaurant?.name || customRestaurant?.name || $("#create-store")?.value.trim() || "店家名稱",
            restaurantId: selectedRestaurant?.id || "",
            restaurantCategory: selectedRestaurant?.category || customRestaurant?.category || "",
            restaurantPriceLevel: selectedRestaurant?.priceLevel || customRestaurant?.priceLevel || "",
            restaurantOpeningHours: selectedRestaurant?.openingHours || customRestaurant?.openingHours || "",
            restaurantAddress: selectedRestaurant?.address || customRestaurant?.address || "",
            restaurantFeature: selectedRestaurant?.feature || customRestaurant?.feature || "",
            time: $("#create-time")?.value.trim() || "時間",
            mealType: $("#create-meal-type")?.value || "午餐",
            maxMembers: $("#create-max-members")?.value.trim() || 4,
            description: $("#create-description")?.value.trim() || "尚未填寫飯局介紹。",
            imageUrl: "",
            members: [hostMember],
            isMine: true,
            createdAt: new Date().toISOString(),
        });
    }

    //建立飯局用函式
    function getBackendPartyDataFromForm() {
        const selectedRestaurant = getSelectedRestaurant();
        const customRestaurant = isCustomRestaurantMode() ? getCustomRestaurantData() : null;

        return {
            title: $("#create-party-name")?.value.trim() || "",
            hostId: currentUser?.id,
            restaurantId: selectedRestaurant?.id || "",
            customRestaurant,
            store: selectedRestaurant?.name || customRestaurant?.name || "",
            mealType: $("#create-meal-type")?.value || "午餐",
            partyTime: $("#create-time")?.value || "",
            maxPeople: Number($("#create-max-members")?.value || 0),
            description: $("#create-description")?.value.trim() || "",
            imageUrl: "",
        };
    }

    //表單驗證函式
    function validateBackendPartyData(partyData) {
        if (!partyData.title) return "請輸入飯局名稱";
        if (!partyData.hostId) return "請先登入後再建立飯局";
        if (!partyData.restaurantId && !partyData.customRestaurant) return "請選擇餐廳或新增其他餐廳";
        if (partyData.customRestaurant) {
            if (!partyData.customRestaurant.name) return "請輸入新增餐廳名稱";
            if (!partyData.customRestaurant.category) return "請輸入新增餐廳類型";
            if (!partyData.customRestaurant.openingHours) return "請輸入新增餐廳營業時間";
            if (!partyData.customRestaurant.address) return "請輸入新增餐廳地址";
        }
        if (!partyData.mealType) return "請選擇餐期";
        if (!partyData.partyTime) return "請選擇時間";
        if (!partyData.maxPeople || partyData.maxPeople < 2) return "人數上限至少需要 2 人";

        return "";
    }


    function loadMyParties() {
        try {
            const savedParties = localStorage.getItem(PARTIES_KEY);
            return savedParties ? JSON.parse(savedParties) : [];
        } catch (error) {
            localStorage.removeItem(PARTIES_KEY);
            return [];
        }
    }

    function saveMyParties(parties) {
        localStorage.setItem(PARTIES_KEY, JSON.stringify(parties));
    }


    function loadCanceledPartyIds() {
        try {
            const saved = localStorage.getItem(CANCELED_PARTIES_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            localStorage.removeItem(CANCELED_PARTIES_KEY);
            return [];
        }
    }

    function saveCanceledPartyIds(ids) {
        localStorage.setItem(CANCELED_PARTIES_KEY, JSON.stringify(Array.from(new Set(ids))));
    }

    function isPartyCanceled(partyId) {
        if (!partyId) return false;
        return loadCanceledPartyIds().includes(partyId);
    }

    function markPartyCanceled(partyId) {
        if (!partyId) return;
        const ids = loadCanceledPartyIds();
        if (!ids.includes(partyId)) ids.push(partyId);
        saveCanceledPartyIds(ids);
    }

    function loadDeletedPartyIds() {
        try {
            const saved = localStorage.getItem(DELETED_PARTIES_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            localStorage.removeItem(DELETED_PARTIES_KEY);
            return [];
        }
    }

    function saveDeletedPartyIds(ids) {
        localStorage.setItem(DELETED_PARTIES_KEY, JSON.stringify(Array.from(new Set(ids))));
    }

    function isPartyDeleted(partyId) {
        if (!partyId) return false;
        return loadDeletedPartyIds().includes(partyId);
    }

    function markPartyDeleted(partyId) {
        if (!partyId) return;
        const ids = loadDeletedPartyIds();
        if (!ids.includes(partyId)) ids.push(partyId);
        saveDeletedPartyIds(ids);
    }

    function removePartyFromStorage(partyId) {
        if (!partyId) return;

        saveMyParties(loadMyParties().filter((party) => party.id !== partyId));

        const joinedParties = loadJoinedParties();
        if (joinedParties[partyId]) {
            delete joinedParties[partyId];
            saveJoinedParties(joinedParties);
        }

        const canceledIds = loadCanceledPartyIds().filter((id) => id !== partyId);
        saveCanceledPartyIds(canceledIds);

        const messagesByParty = loadChatMessages();
        if (messagesByParty[partyId]) {
            delete messagesByParty[partyId];
            saveChatMessages(messagesByParty);
        }
    }

    async function deleteClosedPartyRecord(partyId) {
        if (!partyId) return;

        if (!isLoggedIn() || !currentUser?.id) {
            alert("請先登入後再刪除飯局紀錄");
            switchView("login");
            return;
        }

        if (!confirm("確定要刪除這筆已取消或已結束的飯局紀錄嗎？刪除後會同步從 PostgreSQL 資料庫移除，無法復原。")) return;

        try {
            if (isBackendPartyId(partyId)) {
                await api.deleteParty(partyId, currentUser.id);
            }

            markPartyDeleted(partyId);
            removePartyFromStorage(partyId);

            if (currentParty?.id === partyId) currentParty = null;
            if (currentChatPartyId === partyId) closeChatRoom();

            await loadBackendParties();
            renderHomeParties();
            renderChatRoomList();
            await renderNotifications();

            alert("飯局紀錄已從資料庫刪除");
        } catch (error) {
            console.error("刪除飯局紀錄失敗：", error);
            alert(error.message || "刪除飯局紀錄失敗，請確認後端是否啟動");
        }
    }

    function updateStoredParty(updatedParty) {
        const party = normalizeParty(updatedParty);

        const myParties = loadMyParties();
        const myIndex = myParties.findIndex((item) => item.id === party.id);
        if (myIndex >= 0) {
            myParties[myIndex] = party;
            saveMyParties(myParties);
        }

        const joinedParties = loadJoinedParties();
        if (joinedParties[party.id]) {
            joinedParties[party.id] = party;
            saveJoinedParties(joinedParties);
        }

        if (party.isCanceled) markPartyCanceled(party.id);
    }

    function addMyParty(party) {
        const parties = loadMyParties();
        parties.unshift(party);
        saveMyParties(parties);
    }
    function getCurrentMember(role = "參加者") {
        const profile = loadProfileData();
        return {
            id: getCurrentUserId(),
            name: profile.name || currentUser?.name || currentUser?.account || "目前使用者",
            role,
            avatar: profile.avatar || "",
        };
    }

    function loadJoinedParties() {
        try {
            const saved = localStorage.getItem(JOINED_PARTIES_KEY);
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            localStorage.removeItem(JOINED_PARTIES_KEY);
            return {};
        }
    }

    function saveJoinedParties(parties) {
        localStorage.setItem(JOINED_PARTIES_KEY, JSON.stringify(parties));
    }

    function getJoinedParty(partyId) {
        const joinedParties = loadJoinedParties();
        return joinedParties[partyId] ? normalizeParty(joinedParties[partyId]) : null;
    }

    function isCurrentUserMember(party) {
        const normalizedParty = normalizeParty(party);
        const userId = getCurrentUserId();
        return (normalizedParty.members || []).some((member) => String(member.id) === String(userId));
    }

    function getPartyPeopleText(party) {
        const normalizedParty = normalizeParty(party);
        const people = Number(normalizedParty.currentPeople || (normalizedParty.members || []).length || 0);
        return `${people} / ${normalizedParty.maxMembers || 4} 人`;
    }

    // 依照飯局人數與目前使用者身份，回傳卡片與詳情頁要顯示的狀態。
    // 狀態規則：
    // 1. 我建立的飯局：我是主辦人，不能再 join。
    // 2. 我已加入的飯局：已加入。
    // 3. 人數達上限：已額滿。
    // 4. 其他可加入飯局：招募中。
    function getPartyStatus(party) {
        const normalizedParty = normalizeParty(party);
        const userId = getCurrentUserId();
        const currentMember = (normalizedParty.members || []).find((member) => String(member.id) === String(userId));
        const currentPeople = Number(normalizedParty.currentPeople || (normalizedParty.members || []).length || 0);

        if (normalizedParty.isCanceled === true) {
            return { text: "已取消", key: "canceled" };
        }

        if (isPartyEnded(normalizedParty)) {
            return { text: "已結束", key: "ended" };
        }

        if (normalizedParty.isMine === true || currentMember?.role === "主辦人") {
            return { text: "我是主辦人", key: "owner" };
        }

        if (currentMember) {
            return { text: "已加入", key: "joined" };
        }

        if (normalizedParty.isFull === true || currentPeople >= normalizedParty.maxMembers) {
            return { text: "已額滿", key: "full" };
        }

        return { text: "招募中", key: "open" };
    }

    function isBackendPartyId(partyId) {
        return /^\d+$/.test(String(partyId));
    }

    function setStatusClass(element, status) {
        if (!element || !status) return;
        element.textContent = status.text;
        element.dataset.status = status.key;
        element.classList.remove(
            "party-status--open",
            "party-status--joined",
            "party-status--full",
            "party-status--owner",
            "party-status--ended",
            "party-status--canceled"
        );
        element.classList.add(`party-status--${status.key}`);
    }

    async function joinCurrentParty() {
        if (!currentParty) return null;

        if (isAdminUser()) {
            alert("管理員帳號為純後台模式，不能加入飯局。");
            switchView("admin");
            return normalizeParty(currentParty);
        }

        if (!isLoggedIn()) {
            alert("請先登入後再加入飯局");
            switchView("login");
            return null;
        }

        const party = normalizeParty(currentParty);

        if (party.isCanceled) {
            alert("此飯局已取消，無法加入。");
            return party;
        }

        if (isPartyEnded(party)) {
            alert("此飯局已結束，無法加入。");
            return party;
        }

        try {
            if (isBackendPartyId(party.id)) {
                await api.joinParty(party.id, currentUser.id);

                currentParty = await loadBackendPartyDetail(party.id);

                addNotification(
                    "join",
                    "加入飯局成功",
                    `你已加入「${currentParty.partyName}」。目前人數 ${getPartyPeopleText(currentParty)}。`,
                    currentParty.id
                );

                await loadBackendParties();
                renderHomeParties();
                renderChatRoomList();
                renderNotifications();

                return currentParty;
            }

            const alreadyJoined = isCurrentUserMember(party);
            const isFull = Number(party.currentPeople || party.members.length) >= party.maxMembers;

            if (!alreadyJoined && isFull) {
                alert("此飯局人數已滿");
                return party;
            }

            if (!alreadyJoined) {
                const member = getCurrentMember("參加者");
                party.members.push(member);

                addNotification(
                    "join",
                    "有人加入飯局",
                    `${member.name} 加入了「${party.partyName}」。目前人數 ${getPartyPeopleText(party)}。`,
                    party.id
                );
            }

            currentParty = party;

            const joinedParties = loadJoinedParties();
            joinedParties[party.id] = party;
            saveJoinedParties(joinedParties);

            return party;
        } catch (error) {
            console.error("加入飯局失敗：", error);
            alert(error.message || "加入飯局失敗");
            return party;
        }
    }
    // 判斷目前登入者是否可以退出這場飯局。
    // 主辦人不能用「退出」移除自己，避免飯局沒有主辦人。
    function canCurrentUserLeaveParty(party) {
        if (isAdminUser()) return false;
        if (!party || !isLoggedIn()) return false;

        const normalizedParty = normalizeParty(party);
        const userId = getCurrentUserId();
        const member = (normalizedParty.members || []).find((item) => String(item.id) === String(userId));

        return Boolean(
            member &&
            member.role !== "主辦人" &&
            normalizedParty.isMine !== true &&
            normalizedParty.isCanceled !== true &&
            !isPartyEnded(normalizedParty)
        );
    }

    async function leaveCurrentParty() {
        if (!currentParty) return null;

        if (!isLoggedIn()) {
            alert("請先登入後再退出飯局");
            switchView("login");
            return null;
        }

        const party = normalizeParty(currentParty);

        if (!canCurrentUserLeaveParty(party)) {
            alert("目前帳號不是此飯局的參加者，無法退出。");
            return party;
        }

        try {
            if (isBackendPartyId(party.id)) {
                await api.leaveParty(party.id, currentUser.id);

                addNotification(
                    "leave",
                    "退出飯局成功",
                    `你已退出「${party.partyName}」。`,
                    party.id
                );

                currentParty = await loadBackendPartyDetail(party.id);

                await loadBackendParties();

                if (currentChatPartyId === party.id) {
                    closeChatRoom();
                }

                prepareOtherPartyCard();
                renderHomeParties();
                renderChatRoomList();
                renderNotifications();

                return currentParty;
            }

            const userId = getCurrentUserId();
            const leavingMember = (party.members || []).find((member) => String(member.id) === String(userId));

            party.members = party.members.filter((member) => String(member.id) !== String(userId));
            party.currentPeople = party.members.length;
            currentParty = party;

            addNotification(
                "leave",
                "有人退出飯局",
                `${leavingMember?.name || "有成員"} 退出了「${party.partyName}」。目前人數 ${getPartyPeopleText(party)}。`,
                party.id
            );

            const joinedParties = loadJoinedParties();
            joinedParties[party.id] = party;
            saveJoinedParties(joinedParties);

            if (currentChatPartyId === party.id) {
                closeChatRoom();
            }

            prepareOtherPartyCard();
            renderHomeParties();
            renderChatRoomList();
            renderNotifications();

            return party;
        } catch (error) {
            console.error("退出飯局失敗：", error);
            alert(error.message || "退出飯局失敗");
            return party;
        }
    }
    function canCurrentUserCancelParty(party) {
        if (isAdminUser()) return false;
        if (!party || !isLoggedIn()) return false;
        const normalizedParty = normalizeParty(party);
        const userId = getCurrentUserId();
        const currentMember = (normalizedParty.members || []).find((member) => String(member.id) === String(userId));
        return (normalizedParty.isMine === true || currentMember?.role === "主辦人") && normalizedParty.isCanceled !== true && !isPartyEnded(normalizedParty);
    }

    function canCurrentUserDeleteClosedParty(party) {
        if (isAdminUser()) return false;
        if (!party || !isLoggedIn()) return false;
        const normalizedParty = normalizeParty(party);
        const status = getPartyStatus(normalizedParty);
        const userId = getCurrentUserId();
        const currentMember = (normalizedParty.members || []).find((member) => String(member.id) === String(userId));
        const isOwner = normalizedParty.isMine === true || currentMember?.role === "主辦人";
        return isOwner && (status.key === "canceled" || status.key === "ended");
    }

    async function cancelCurrentParty() {
        if (!currentParty) return null;

        if (!canCurrentUserCancelParty(currentParty)) {
            alert("只有主辦人可以取消飯局，或此飯局已經取消。");
            return currentParty;
        }

        const party = normalizeParty(currentParty);

        try {
            if (isBackendPartyId(party.id)) {
                await api.cancelParty(party.id, currentUser.id);

                currentParty = await loadBackendPartyDetail(party.id);

                addNotification(
                    "cancel",
                    "飯局已取消",
                    `主辦人已取消「${party.partyName}」，此飯局將無法再加入。`,
                    party.id
                );

                await loadBackendParties();

                prepareOtherPartyCard();
                renderHomeParties();
                renderChatRoomList();
                renderNotifications();

                return currentParty;
            }

            party.isCanceled = true;
            party.canceledAt = new Date().toISOString();
            currentParty = party;

            updateStoredParty(party);

            addNotification(
                "cancel",
                "飯局已取消",
                `主辦人已取消「${party.partyName}」，此飯局將無法再加入。`,
                party.id
            );

            prepareOtherPartyCard();
            renderHomeParties();
            renderChatRoomList();
            renderNotifications();

            return party;
        } catch (error) {
            console.error("取消飯局失敗：", error);
            alert(error.message || "取消飯局失敗");
            return party;
        }
    }

    function canCurrentUserRateParty(party) {
        if (isAdminUser()) return false;
        if (!party || !isLoggedIn()) return false;
        const normalizedParty = normalizeParty(party);
        return normalizedParty.isMine === true || isCurrentUserMember(normalizedParty);
    }

    function updateJoinedActionButtons(party) {
        const status = getPartyStatus(party);

        if (isAdminUser()) {
            if (partyLeaveBtn) partyLeaveBtn.hidden = true;
            if (partyCancelBtn) partyCancelBtn.hidden = true;
            if (partyChatBtn) partyChatBtn.hidden = true;
            if (partyRateBtn) partyRateBtn.hidden = true;
            return;
        }

        if (partyLeaveBtn) {
            partyLeaveBtn.hidden = status.key === "canceled" || status.key === "ended" || !canCurrentUserLeaveParty(party);
        }


        if (partyCancelBtn) {
            partyCancelBtn.hidden = !canCurrentUserCancelParty(party);
        }

        if (partyChatBtn) {
            partyChatBtn.disabled = status.key === "canceled";
        }

        if (partyRateBtn) {
            const ended = isPartyEnded(party);
            const reviewed = hasReviewedParty(party.id);
            const canRate = canCurrentUserRateParty(party);
            const hasTargets = getRatingTargets(party).length > 0;
            partyRateBtn.disabled = status.key === "canceled" || !ended || reviewed || !canRate || !hasTargets;
            partyRateBtn.textContent = reviewed ? "已評價" : ended ? "評價" : "尚未結束";
            partyRateBtn.title = !canRate ? "只有本場飯局成員可以評價" : reviewed ? "同一場飯局只能評價一次" : ended ? "可以評價本場飯局成員" : getPartyEndHint(party);
        }
    }

    function renderJoinedMembers(party) {
        if (!joinedMemberList) return;

        const members = party?.members || [];
        joinedMemberList.innerHTML = "";

        members.forEach((member) => {
            const item = document.createElement("li");
            item.className = "party-member";

            const avatar = document.createElement("div");
            avatar.className = "party-member-avatar";
            avatar.setAttribute("aria-hidden", "true");

            if (member.avatar) {
                const img = document.createElement("img");
                img.src = getImageUrl(member.avatar);
                img.alt = "";
                avatar.appendChild(img);
            } else {
                avatar.textContent = (member.name || "飯").slice(0, 1);
            }

            const name = document.createElement("span");
            name.className = "party-member-name";
            name.textContent = member.name || "加入人名稱";

            const role = document.createElement("span");
            role.className = "party-member-role";
            role.textContent = member.role || "參加者";

            item.append(avatar, name, role);
            joinedMemberList.appendChild(item);
        });

        if (joinedMembersCount) joinedMembersCount.textContent = `${members.length} 人`;
    }

    function getPartyCardIconSvg(icon) {
        const iconMap = {
            host: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.4"></circle><path d="M5.5 20c.8-4.2 3.1-6.2 6.5-6.2s5.7 2 6.5 6.2"></path></svg>',
            meal: '<svg viewBox="0 0 24 24"><path d="M7 3v8"></path><path d="M11 3v8"></path><path d="M7 7h4"></path><path d="M9 11v10"></path><path d="M17 3v18"></path><path d="M17 3c2.2 1.5 3 3.3 3 5.3 0 1.9-.8 3.4-3 4.5"></path></svg>',
            time: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5v5l3.2 2"></path></svg>',
            people: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"></circle><path d="M3.8 19c.7-3.6 2.5-5.3 5.2-5.3s4.5 1.7 5.2 5.3"></path><circle cx="16.5" cy="9" r="2.4"></circle><path d="M14.9 14.4c2.7.2 4.5 1.8 5.1 4.6"></path></svg>',
            restaurant: '<svg viewBox="0 0 24 24"><path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11z"></path><circle cx="12" cy="10" r="2.2"></circle></svg>',
        };

        const normalizedIcon = {
            "👤": "host",
            "🍽": "meal",
            "⏰": "time",
            "👥": "people",
            "📍": "restaurant",
        }[icon] || icon;

        return iconMap[normalizedIcon] || iconMap.restaurant;
    }

    function createPartyCardMeta(icon, text, className = "") {
        const item = document.createElement("span");
        item.className = `party-card-meta-item ${className}`.trim();

        const iconEl = document.createElement("span");
        iconEl.className = "party-card-meta-icon";
        iconEl.setAttribute("aria-hidden", "true");
        iconEl.innerHTML = getPartyCardIconSvg(icon);

        const textEl = document.createElement("span");
        textEl.className = "party-card-meta-text";
        textEl.textContent = text;

        item.append(iconEl, textEl);
        return item;
    }

    function createPartyCardAvatars(party) {
        const avatarWrap = document.createElement("div");
        avatarWrap.className = "party-card-avatars";
        avatarWrap.setAttribute("aria-label", "參與成員");

        const normalizedParty = normalizeParty(party);
        const members = Array.isArray(normalizedParty.members) ? normalizedParty.members : [];
        const displayMembers = members.length
            ? members.slice(0, 3)
            : [{ name: normalizedParty.host, avatar: normalizedParty.hostAvatar }];

        displayMembers.forEach((member) => {
            const avatar = document.createElement("span");
            avatar.className = "party-card-avatar";
            avatar.title = member.name || "成員";

            const avatarUrl = getImageUrl(member.avatar || "");
            if (avatarUrl) {
                const img = document.createElement("img");
                img.src = avatarUrl;
                img.alt = "";
                avatar.appendChild(img);
            } else {
                avatar.textContent = (member.name || normalizedParty.host || "飯").slice(0, 1);
            }

            avatarWrap.appendChild(avatar);
        });

        const currentPeople = Number(normalizedParty.currentPeople || members.length || displayMembers.length || 0);
        if (currentPeople > displayMembers.length) {
            const extra = document.createElement("span");
            extra.className = "party-card-avatar party-card-avatar--more";
            extra.textContent = `+${currentPeople - displayMembers.length}`;
            avatarWrap.appendChild(extra);
        }

        return avatarWrap;
    }

    function applyPartyCardDataset(card, party, source) {
        const normalizedParty = normalizeParty(party);
        card.dataset.partyId = normalizedParty.id;
        card.dataset.partyName = normalizedParty.partyName;
        card.dataset.host = normalizedParty.host;
        card.dataset.hostId = normalizedParty.hostId || "";
        card.dataset.hostAccount = normalizedParty.hostAccount || "";
        card.dataset.hostDepartment = normalizedParty.hostDepartment || "";
        card.dataset.hostBio = normalizedParty.hostBio || "";
        card.dataset.hostAvatar = normalizedParty.hostAvatar || "";
        card.dataset.imageUrl = normalizedParty.imageUrl || "";
        card.dataset.store = normalizedParty.store;
        card.dataset.restaurantId = normalizedParty.restaurantId || "";
        card.dataset.restaurantCategory = normalizedParty.restaurantCategory || "";
        card.dataset.restaurantPriceLevel = normalizedParty.restaurantPriceLevel || "";
        card.dataset.restaurantOpeningHours = normalizedParty.restaurantOpeningHours || "";
        card.dataset.restaurantAddress = normalizedParty.restaurantAddress || "";
        card.dataset.restaurantFeature = normalizedParty.restaurantFeature || "";
        card.dataset.time = normalizedParty.time;
        card.dataset.mealType = normalizedParty.mealType;
        card.dataset.maxMembers = String(normalizedParty.maxMembers);
        card.dataset.currentPeople = String(normalizedParty.currentPeople || normalizedParty.members.length);
        card.dataset.description = normalizedParty.description;
        card.dataset.ended = isPartyEnded(normalizedParty) ? "true" : "false";
        card.dataset.canceled = normalizedParty.isCanceled ? "true" : "false";
        card.dataset.full = normalizedParty.isFull ? "true" : "false";
        card.dataset.canJoin = normalizedParty.canJoin === false ? "false" : "true";
        card.dataset.status = normalizedParty.status || (isPartyEnded(normalizedParty) ? "ended" : normalizedParty.isCanceled ? "cancelled" : "open");
        card.dataset.canceledAt = normalizedParty.canceledAt || "";
        card.dataset.members = JSON.stringify(normalizedParty.members);
        card.dataset.source = source;
    }

    function createPartyCard(party, isDefault = false) {
        const normalizedParty = normalizeParty(party);
        const card = document.createElement("article");
        card.className = "party-card party-card--mine party-card--list";
        card.role = "button";
        card.tabIndex = 0;
        card.setAttribute("aria-label", `查看 ${normalizedParty.partyName || "飯局"} 詳情`);
        applyPartyCardDataset(card, normalizedParty, "mine");

        const thumb = document.createElement("div");
        thumb.className = "party-card-thumb";
        thumb.setAttribute("aria-hidden", "true");
        renderImageBox(thumb, normalizedParty.imageUrl, normalizedParty.mealType?.slice(0, 1) || "飯");

        const body = document.createElement("div");
        body.className = "party-card-body party-card-body--list";

        const topRow = document.createElement("div");
        topRow.className = "party-card-top-row";

        const titleBlock = document.createElement("div");
        titleBlock.className = "party-card-title-block";

        const title = document.createElement("h3");
        title.className = "party-card-title";
        title.textContent = normalizedParty.partyName;

        const host = document.createElement("p");
        host.className = "party-card-host";
        host.append(
            createPartyCardMeta("host", normalizedParty.host || "使用者", "party-card-meta-item--host")
        );

        titleBlock.append(title, host);

        const sideTools = document.createElement("div");
        sideTools.className = "party-card-side-tools";
        sideTools.appendChild(createPartyCardAvatars(normalizedParty));

        topRow.append(titleBlock, sideTools);

        const metaRow = document.createElement("div");
        metaRow.className = "party-card-meta-row";
        metaRow.append(
            createPartyCardMeta("meal", normalizedParty.mealType || "餐期", "party-card-meta-item--meal"),
            createPartyCardMeta("time", normalizedParty.time || "時間", "party-card-meta-item--time"),
            createPartyCardMeta("people", getPartyPeopleText(normalizedParty), "party-card-meta-item--people")
        );

        const bottomRow = document.createElement("div");
        bottomRow.className = "party-card-bottom-row";

        const restaurantInfo = document.createElement("div");
        restaurantInfo.className = "party-card-restaurant";

        const restaurantName = createPartyCardMeta("restaurant", normalizedParty.store || "餐廳", "party-card-restaurant-name");
        restaurantInfo.appendChild(restaurantName);

        const restaurantTags = document.createElement("div");
        restaurantTags.className = "party-card-restaurant-tags";

        if (normalizedParty.restaurantCategory) {
            const tag = document.createElement("span");
            tag.className = "party-card-tag party-card-tag--category";
            tag.textContent = normalizedParty.restaurantCategory;
            restaurantTags.appendChild(tag);
        }

        if (normalizedParty.restaurantPriceLevel) {
            const tag = document.createElement("span");
            tag.className = "party-card-tag party-card-tag--price";
            tag.textContent = normalizedParty.restaurantPriceLevel;
            restaurantTags.appendChild(tag);
        }

        if (restaurantTags.children.length) {
            restaurantInfo.appendChild(restaurantTags);
        }

        const status = getPartyStatus(normalizedParty);
        const statusBadge = document.createElement("span");
        statusBadge.className = "party-card-status";
        setStatusClass(statusBadge, status);

        bottomRow.append(restaurantInfo, statusBadge);
        body.append(topRow, metaRow, bottomRow);
        card.append(thumb, body);

        bindPartyCard(card, { allowJoin: true });
        return card;
    }

    function getHomeFilterState() {
        return {
            keyword: (searchInput?.value || "").trim().toLowerCase(),
            mealType: mealTypeFilter?.value || "全部",
            restaurantCategory: restaurantCategoryFilter?.value || "全部",
            restaurantPrice: restaurantPriceFilter?.value || "全部",
            availableOnly: availableOnlyFilter?.checked === true,
        };
    }

    function isPartyAvailable(party) {
        const normalizedParty = normalizeParty(party);
        const currentPeople = Number(normalizedParty.currentPeople || (normalizedParty.members || []).length || 0);
        return normalizedParty.isCanceled !== true && !isPartyEnded(normalizedParty) && normalizedParty.isFull !== true && currentPeople < normalizedParty.maxMembers;
    }

    function matchesPartyFilters(party) {
        const normalizedParty = normalizeParty(party);
        const filter = getHomeFilterState();

        if (filter.keyword) {
            const targetText = [
                normalizedParty.partyName,
                normalizedParty.host,
                normalizedParty.store,
                normalizedParty.restaurantCategory,
                normalizedParty.restaurantPriceLevel,
                normalizedParty.restaurantAddress,
                normalizedParty.restaurantFeature,
            ].join(" ").toLowerCase();
            if (!targetText.includes(filter.keyword)) return false;
        }

        if (filter.mealType && filter.mealType !== "全部" && normalizedParty.mealType !== filter.mealType) {
            return false;
        }

        if (filter.restaurantCategory && filter.restaurantCategory !== "全部" && normalizedParty.restaurantCategory !== filter.restaurantCategory) {
            return false;
        }

        if (filter.restaurantPrice && filter.restaurantPrice !== "全部" && normalizedParty.restaurantPriceLevel !== filter.restaurantPrice) {
            return false;
        }

        if (filter.availableOnly && !isPartyAvailable(normalizedParty)) {
            return false;
        }

        return true;
    }

    function updateHomeNoResult() {
        // 取消首頁上方大型「目前沒有符合條件的飯局」提示，避免搜尋時畫面太雜。
        // 各區塊仍會用自己的空狀態文字提醒使用者。
        if (homeNoResult) homeNoResult.hidden = true;
    }

    function updateHomePartyTabs() {
        if (myPartyTabCount) myPartyTabCount.textContent = String(visibleMyPartyCount);
        if (otherPartyTabCount) otherPartyTabCount.textContent = String(visibleOtherPartyCount);

        const showMy = activeHomePartyTab !== "other";

        if (myPartiesSection) {
            myPartiesSection.hidden = !showMy;
            myPartiesSection.classList.toggle("home-party-panel--active", showMy);
        }

        if (otherPartiesSection) {
            otherPartiesSection.hidden = showMy;
            otherPartiesSection.classList.toggle("home-party-panel--active", !showMy);
        }

        homePartyTabs.forEach((tab) => {
            const isActive = tab.dataset.homeTab === activeHomePartyTab;
            tab.classList.toggle("home-party-tab--active", isActive);
            tab.setAttribute("aria-selected", String(isActive));
            tab.tabIndex = isActive ? 0 : -1;
        });
    }

    function setHomePartyTab(tabKey) {
        activeHomePartyTab = tabKey === "other" ? "other" : "my";
        updateHomePartyTabs();
    }

    function isMyRelatedParty(party) {
        const normalizedParty = normalizeParty(party);
        return normalizedParty.isMine === true || isCurrentUserMember(normalizedParty);
    }

    function renderMyParties() {
        if (!myPartyList) return;

        myPartyList.innerHTML = "";

        // 我的飯局 = 我建立的飯局 + 我已加入的飯局。
        const allParties = backendParties
            .map(normalizeParty)
            .filter((party) =>
                isMyRelatedParty(party) &&
                !isDemoPartyId(party.id) &&
                !isPartyDeleted(party.id)
            );
        const filteredParties = allParties.filter(matchesPartyFilters);

        visibleMyPartyCount = filteredParties.length;

        filteredParties.forEach((party) => {
            myPartyList.appendChild(createPartyCard(party, false));
        });

        if (myPartyEmpty) {
            myPartyEmpty.hidden = filteredParties.length > 0;
            myPartyEmpty.textContent = allParties.length > 0
                ? "我的飯局沒有符合條件的飯局。"
                : "目前尚未建立或加入飯局。";
        }

        if (myPartiesSection) myPartiesSection.hidden = false;
        updateHomeNoResult();
    }

    async function loadBackendParties() {
        try {
            const result = await api.getParties(currentUser?.id || "");
            backendParties = (result.parties || [])
                .map(mapBackendPartyToFrontend)
                .filter((party) => !isDemoPartyId(party.id));
            renderHomeParties();
        } catch (error) {
            console.error("讀取後端飯局失敗：", error);
            alert("讀取飯局資料失敗，請確認後端是否啟動");
        }
    }

    function renderHomeParties() {
        renderMyParties();
        prepareOtherPartyCard();
        updateHomeNoResult();
        updateHomePartyTabs();
    }

    function renderPartyRestaurantInfo(fields, party) {
        if (!fields?.panel || !party) return;
        const normalizedParty = normalizeParty(party);
        const hasRestaurantInfo = Boolean(
            normalizedParty.store ||
            normalizedParty.restaurantCategory ||
            normalizedParty.restaurantPriceLevel ||
            normalizedParty.restaurantOpeningHours ||
            normalizedParty.restaurantAddress ||
            normalizedParty.restaurantFeature
        );

        fields.panel.hidden = !hasRestaurantInfo;
        if (!hasRestaurantInfo) return;

        if (fields.name) fields.name.textContent = normalizedParty.store || "餐廳名稱";
        if (fields.category) fields.category.textContent = normalizedParty.restaurantCategory || "未分類";
        if (fields.price) fields.price.textContent = normalizedParty.restaurantPriceLevel || "$";
        if (fields.hours) fields.hours.textContent = normalizedParty.restaurantOpeningHours || "營業時間未填寫";
        if (fields.address) fields.address.textContent = `地址：${normalizedParty.restaurantAddress || "尚未填寫"}`;
        if (fields.feature) fields.feature.textContent = `特色：${normalizedParty.restaurantFeature || "尚未填寫"}`;
    }

    function fillPartyFields(fields, data) {
        if (!fields || !data) return;
        const party = normalizeParty(data);
        if (fields.partyName) fields.partyName.textContent = party.partyName;
        if (fields.host) fields.host.textContent = party.host;
        if (fields.store) fields.store.textContent = party.store;
        if (fields.time) fields.time.textContent = party.time;
        if (fields.mealType) fields.mealType.textContent = party.mealType;
        if (fields.people) fields.people.textContent = getPartyPeopleText(party);
        if (fields.status) setStatusClass(fields.status, getPartyStatus(party));
        if (fields.description) fields.description.textContent = party.description || "尚未填寫飯局介紹。";
        renderPartyRestaurantInfo(fields.restaurantInfo, party);
    }

    async function openPartyDetail(card, options = {}) {
        if (!card) return;

        const partyFromCard = getPartyDataFromCard(card);
        currentParty = getJoinedParty(partyFromCard.id) || partyFromCard;
        allowJoinFlow = options.allowJoin === true;

        try {
            // 後端飯局 id 是數字字串，例如 "1", "2", "3"。
            // 預設示範飯局 id 不是數字，因此不呼叫後端。
            if (/^\d+$/.test(String(partyFromCard.id))) {
                currentParty = await loadBackendPartyDetail(partyFromCard.id);
            }
        } catch (error) {
            console.error("讀取飯局詳情失敗：", error);
            alert(error.message || "讀取飯局詳情失敗");
        }

        fillPartyFields(detailFields, currentParty);
        renderImageBox(detailPartyImage, normalizeParty(currentParty).imageUrl, "飯");
        renderPartyHostPreview(currentParty);

        const status = getPartyStatus(currentParty);

        if (partyJoinBtn) {
            partyJoinBtn.hidden = isAdminUser() || !allowJoinFlow;
            partyJoinBtn.disabled = false;

            if (!isAdminUser() && allowJoinFlow) {
                if (status.key === "owner") {
                    partyJoinBtn.textContent = "管理飯局";
                    partyJoinBtn.disabled = false;
                } else if (status.key === "joined") {
                    partyJoinBtn.textContent = "查看成員";
                } else if (status.key === "canceled") {
                    partyJoinBtn.textContent = "已取消";
                    partyJoinBtn.disabled = true;
                } else if (status.key === "ended") {
                    partyJoinBtn.textContent = "已結束";
                    partyJoinBtn.disabled = true;
                } else if (status.key === "full") {
                    partyJoinBtn.textContent = "已額滿";
                    partyJoinBtn.disabled = true;
                } else {
                    partyJoinBtn.textContent = "join";
                }
            }
        }

        if (partyDetailDeleteBtn) {
            partyDetailDeleteBtn.hidden = !canCurrentUserDeleteClosedParty(currentParty);
        }

        switchView("partyDetail");
    }

    function openJoinedParty() {
        if (!currentParty) return;

        currentParty = normalizeParty(currentParty);
        fillPartyFields(joinedFields, currentParty);
        renderImageBox(joinedPartyImage, currentParty.imageUrl, "飯");
        renderJoinedMembers(currentParty);
        updateJoinedActionButtons(currentParty);
        switchView("partyJoined");
    }

    function bindPartyCard(card, options = {}) {
        if (!card) return;

        card.addEventListener("click", () => {
            openPartyDetail(card, options);
        });

        // 讓鍵盤 Enter / Space 也能打開卡片。
        card.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            openPartyDetail(card, options);
        });
    }
    function getOtherPartyListContainer() {
        if (!otherPartyCard) return null;

        let list = document.getElementById("other-party-list");
        if (!list) {
            list = document.createElement("div");
            list.id = "other-party-list";
            list.className = "party-list";
            list.setAttribute("aria-live", "polite");
            otherPartyCard.insertAdjacentElement("beforebegin", list);
        }

        return list;
    }

    function createOtherPartyCard(party) {
        const card = createPartyCard(party, false);
        // 其他飯局沿用與「我的飯局」相同的列表版 class，只切換來源標記。
        // 這是純排版調整，不更動飯局狀態判斷或加入流程。
        card.className = "party-card party-card--other party-card--list";
        card.dataset.source = "other";
        card.setAttribute("aria-label", `查看 ${party.partyName || "飯局"} 詳情`);
        return card;
    }

    function prepareOtherPartyCard() {
        if (!otherPartyCard) return;

        // 舊版 HTML 只有一張固定的 other-party-card，會導致其他飯局永遠只顯示第一筆。
        // 保留它當作隱藏模板，實際列表改由 other-party-list 動態渲染全部飯局。
        otherPartyCard.hidden = true;

        const otherPartyList = getOtherPartyListContainer();
        if (!otherPartyList) return;
        otherPartyList.innerHTML = "";

        // 其他飯局 = 我還沒加入、也不是我建立的飯局。
        const allOtherParties = backendParties
            .map(normalizeParty)
            .filter((party) =>
                !isMyRelatedParty(party) &&
                !isDemoPartyId(party.id) &&
                !isPartyDeleted(party.id)
            );

        const filteredParties = allOtherParties.filter(matchesPartyFilters);
        visibleOtherPartyCount = filteredParties.length;

        filteredParties.forEach((party) => {
            otherPartyList.appendChild(createOtherPartyCard(party));
        });

        if (otherPartyEmpty) {
            otherPartyEmpty.hidden = filteredParties.length > 0;
            otherPartyEmpty.textContent = allOtherParties.length > 0
                ? "其他飯局沒有符合條件的飯局。"
                : "目前沒有其他飯局。";
        }

        if (otherPartiesSection) otherPartiesSection.hidden = false;
    }


    /* ======================================================
     * 8. 飯局聊天室功能
     * ====================================================== */
    function loadChatMessages() {
        try {
            const saved = localStorage.getItem(CHAT_MESSAGES_KEY);
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            localStorage.removeItem(CHAT_MESSAGES_KEY);
            return {};
        }
    }

    function saveChatMessages(messagesByParty) {
        localStorage.setItem(CHAT_MESSAGES_KEY, JSON.stringify(messagesByParty));
    }

    function loadDeletedChatRoomIds() {
        try {
            const saved = localStorage.getItem(DELETED_CHAT_ROOMS_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            localStorage.removeItem(DELETED_CHAT_ROOMS_KEY);
            return [];
        }
    }

    function saveDeletedChatRoomIds(ids) {
        localStorage.setItem(DELETED_CHAT_ROOMS_KEY, JSON.stringify(Array.from(new Set(ids))));
    }

    function isChatRoomDeleted(partyId) {
        if (!partyId) return false;
        return loadDeletedChatRoomIds().includes(partyId);
    }

    function markChatRoomDeleted(partyId) {
        if (!partyId) return;
        const ids = loadDeletedChatRoomIds();
        if (!ids.includes(partyId)) ids.push(partyId);
        saveDeletedChatRoomIds(ids);
    }

    function restoreChatRoom(partyId) {
        if (!partyId) return;
        saveDeletedChatRoomIds(loadDeletedChatRoomIds().filter((id) => id !== partyId));
    }

    function deleteChatRoom(partyId) {
        if (!partyId) return;
        const party = findAccessiblePartyById(partyId);
        const partyName = party?.partyName || "這個聊天室";
        if (!confirm(`確定要刪除「${partyName}」的聊天室嗎？聊天紀錄也會一起刪除。`)) return;

        markChatRoomDeleted(partyId);

        const messagesByParty = loadChatMessages();
        if (messagesByParty[partyId]) {
            delete messagesByParty[partyId];
            saveChatMessages(messagesByParty);
        }

        if (currentChatPartyId === partyId) closeChatRoom();
        renderChatRoomList();
    }

    function formatMessageTime(isoString) {
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) return "剛剛";

        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hour = String(date.getHours()).padStart(2, "0");
        const minute = String(date.getMinutes()).padStart(2, "0");
        return `${month}/${day} ${hour}:${minute}`;
    }

    function getAllAccessibleParties() {
        const joinedParties = Object.values(loadJoinedParties()).map(normalizeParty);
        const backendAccessibleParties = backendParties
            .map(normalizeParty)
            .filter((party) => party.isMine === true || isCurrentUserMember(party));

        const allParties = [...backendAccessibleParties, ...joinedParties];
        const uniqueParties = [];
        const usedIds = new Set();

        allParties.forEach((party) => {
            if (!party?.id || isDemoPartyId(party.id) || usedIds.has(party.id) || isPartyDeleted(party.id)) return;
            usedIds.add(party.id);
            uniqueParties.push(party);
        });

        return uniqueParties;
    }

    function findAccessiblePartyById(partyId) {
        return getAllAccessibleParties().find((party) => party.id === partyId) || null;
    }

    function canUsePartyChat(party) {
        if (!party) return false;
        return party.isMine === true || isCurrentUserMember(party);
    }

    function getLastChatPreview(partyId) {
        const cachedMessage = chatPreviewCache[partyId];
        if (cachedMessage) {
            return `${cachedMessage.senderName || "使用者"}：${cachedMessage.text || ""}`;
        }

        // 後端聊天室尚未載入前，保留舊 localStorage 訊息作為暫時預覽。
        const messagesByParty = loadChatMessages();
        const messages = messagesByParty[partyId] || [];
        const lastMessage = messages[messages.length - 1];

        if (!lastMessage) return "尚未有訊息，可以開始討論集合時間或地點。";
        return `${lastMessage.senderName || "使用者"}：${lastMessage.text || ""}`;
    }

    function renderChatRoomList() {
        if (!chatRoomList) return;

        chatRoomList.innerHTML = "";

        if (!isLoggedIn()) {
            if (chatEmpty) {
                chatEmpty.hidden = false;
                chatEmpty.textContent = "請先登入後，才能查看已建立或已加入的飯局聊天室。";
            }
            if (chatRoomPanel) chatRoomPanel.hidden = true;
            return;
        }

        const parties = getAllAccessibleParties().filter((party) => canUsePartyChat(party) && !isChatRoomDeleted(party.id));

        if (chatEmpty) {
            chatEmpty.hidden = parties.length > 0;
            chatEmpty.textContent = "目前沒有可使用的聊天室，請先建立或加入飯局。";
        }

        parties.forEach((party) => {
            const item = document.createElement("li");
            item.className = "chat-card";
            item.role = "listitem";

            const button = document.createElement("button");
            button.type = "button";
            button.className = "chat-room-button";
            button.dataset.partyId = party.id;

            const title = document.createElement("span");
            title.className = "chat-name";
            title.textContent = party.partyName;

            const meta = document.createElement("span");
            meta.className = "chat-meta";
            meta.textContent = `${party.store}・${party.time}・${getPartyPeopleText(party)}`;

            const preview = document.createElement("span");
            preview.className = "chat-preview";
            preview.textContent = getLastChatPreview(party.id);

            button.append(title, meta, preview);
            button.addEventListener("click", () => openChatRoom(party.id));

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "chat-room-delete";
            deleteBtn.textContent = "×";
            deleteBtn.setAttribute("aria-label", "刪除聊天室");
            deleteBtn.setAttribute("title", "刪除聊天室");
            deleteBtn.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                deleteChatRoom(party.id);
            });

            item.append(button, deleteBtn);
            chatRoomList.appendChild(item);
        });
    }

    async function openChatRoom(partyId) {
        if (!isLoggedIn()) {
            alert("請先登入後才能使用聊天室");
            switchView("login");
            return;
        }

        const party = findAccessiblePartyById(partyId);
        if (!party || !canUsePartyChat(party)) {
            alert("請先加入該飯局後才能進入聊天室");
            renderChatRoomList();
            return;
        }

        restoreChatRoom(party.id);
        currentChatPartyId = party.id;
        currentChatMessages = [];

        if (chatRoomTitle) chatRoomTitle.textContent = party.partyName;
        if (chatRoomMeta) chatRoomMeta.textContent = `${party.host}｜${party.store}｜${party.time}`;
        if (chatRoomPanel) chatRoomPanel.hidden = false;

        renderChatMessages();

        try {
            if (isBackendPartyId(party.id)) {
                const result = await api.getChatMessages(party.id, currentUser.id);
                currentChatMessages = (result.messages || []).map(mapBackendChatMessage);
                const lastMessage = currentChatMessages[currentChatMessages.length - 1];
                if (lastMessage) chatPreviewCache[party.id] = lastMessage;
            } else {
                const messagesByParty = loadChatMessages();
                currentChatMessages = messagesByParty[party.id] || [];
            }

            renderChatMessages();
            renderChatRoomList();
            chatInput?.focus();
        } catch (error) {
            console.error("讀取聊天室訊息失敗：", error);
            alert(error.message || "讀取聊天室訊息失敗");
            currentChatMessages = [];
            renderChatMessages();
        }
    }

    function closeChatRoom() {
        currentChatPartyId = null;
        currentChatMessages = [];
        if (chatRoomPanel) chatRoomPanel.hidden = true;
        renderChatRoomList();
    }

    function mapBackendChatMessage(message) {
        return {
            id: String(message.id),
            partyId: String(message.party_id),
            senderId: String(message.user_id),
            senderName: message.sender_name || message.sender_account || "使用者",
            text: message.message || "",
            createdAt: message.created_at || new Date().toISOString(),
        };
    }

    function renderChatMessages() {
        if (!chatMessageList || !currentChatPartyId) return;

        const messages = currentChatMessages || [];
        const currentUserId = getCurrentUserId();

        chatMessageList.innerHTML = "";

        if (!messages.length) {
            const empty = document.createElement("li");
            empty.className = "chat-message-empty";
            empty.textContent = "目前還沒有訊息，傳送第一則訊息開始討論吧。";
            chatMessageList.appendChild(empty);
            return;
        }

        messages.forEach((message) => {
            const item = document.createElement("li");
            item.className = "chat-message";
            item.classList.toggle("chat-message--mine", String(message.senderId) === String(currentUserId));

            const sender = document.createElement("p");
            sender.className = "chat-message-sender";
            sender.textContent = message.senderName || "使用者";

            const bubble = document.createElement("p");
            bubble.className = "chat-message-bubble";
            bubble.textContent = message.text || "";

            const time = document.createElement("p");
            time.className = "chat-message-time";
            time.textContent = formatMessageTime(message.createdAt);

            if (String(message.senderId) !== String(currentUserId) && !isAdminUser() && isBackendPartyId(message.id)) {
                const reportBtn = document.createElement("button");
                reportBtn.type = "button";
                reportBtn.className = "chat-report-btn";
                reportBtn.textContent = "檢舉";
                reportBtn.setAttribute("aria-label", "檢舉這則聊天訊息");
                reportBtn.addEventListener("click", (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openReportModal({
                        targetType: "chat",
                        targetId: message.id,
                        partyId: currentChatPartyId,
                        preview: String(message.text || "").slice(0, 40),
                    });
                });
                time.appendChild(reportBtn);
            }

            item.append(sender, bubble, time);
            chatMessageList.appendChild(item);
        });

        chatMessageList.scrollTop = chatMessageList.scrollHeight;
    }

    async function sendChatMessage(text) {
        if (!currentChatPartyId) return false;
        if (!text.trim()) return false;

        const party = findAccessiblePartyById(currentChatPartyId);
        if (!party || !canUsePartyChat(party)) {
            alert("請先加入該飯局後才能傳送訊息");
            closeChatRoom();
            return false;
        }

        const profile = loadProfileData();

        try {
            let newMessage;

            if (isBackendPartyId(currentChatPartyId)) {
                const result = await api.sendChatMessage(currentChatPartyId, currentUser.id, text.trim());
                newMessage = mapBackendChatMessage(result.message);
            } else {
                newMessage = {
                    id: `msg-${Date.now()}`,
                    partyId: currentChatPartyId,
                    senderId: getCurrentUserId(),
                    senderName: profile.name || currentUser?.name || currentUser?.account || "目前使用者",
                    text: text.trim(),
                    createdAt: new Date().toISOString(),
                };

                const messagesByParty = loadChatMessages();
                const partyMessages = messagesByParty[currentChatPartyId] || [];
                partyMessages.push(newMessage);
                messagesByParty[currentChatPartyId] = partyMessages;
                saveChatMessages(messagesByParty);
            }

            currentChatMessages.push(newMessage);
            chatPreviewCache[currentChatPartyId] = newMessage;

            addNotification(
                "chat",
                "聊天室新訊息",
                `${newMessage.senderName || profile.name || currentUser?.name || currentUser?.account || "使用者"} 在「${party.partyName}」傳送新訊息：${text.trim()}`,
                party.id
            );

            renderChatMessages();
            renderChatRoomList();
            return true;
        } catch (error) {
            console.error("傳送聊天室訊息失敗：", error);
            alert(error.message || "傳送聊天室訊息失敗");
            return false;
        }
    }



    /* ======================================================
     * 檢舉功能
     * ====================================================== */
    function getReportTargetLabel(type) {
        const labels = {
            party: "飯局",
            user: "飯局成員",
            chat: "聊天室訊息",
        };
        return labels[type] || "檢舉對象";
    }

    function getCurrentUserPartyRole(party) {
        if (!isLoggedIn()) return "guest";

        const normalizedParty = normalizeParty(party || currentParty || {});
        const currentUserId = String(getCurrentUserId());

        if (normalizedParty.hostId && String(normalizedParty.hostId) === currentUserId) {
            return "host";
        }

        const currentMember = (normalizedParty.members || []).find((member) => String(member?.id) === currentUserId);
        if (!currentMember) return "outsider";

        return currentMember.role === "主辦人" ? "host" : "member";
    }

    function canReportPartyItself(party) {
        const role = getCurrentUserPartyRole(party);
        // 外部使用者可以檢舉飯局；一般成員也可以檢舉飯局。
        // 主辦人不需要檢舉自己建立的飯局，應改由後台管理處理。
        return role === "outsider" || role === "member";
    }

    function getReportablePartyMembers(party) {
        const normalizedParty = normalizeParty(party || currentParty || {});
        const roleInParty = getCurrentUserPartyRole(normalizedParty);

        // 外部使用者不屬於飯局內部，因此只能檢舉飯局本身，不能檢舉成員。
        if (roleInParty === "outsider" || roleInParty === "guest") return [];

        const members = Array.isArray(normalizedParty.members) ? normalizedParty.members : [];
        const seen = new Set();
        const currentUserId = String(getCurrentUserId());
        const reportableMembers = [];

        members.forEach((member) => {
            const memberId = member?.id != null ? String(member.id) : "";
            if (!memberId || seen.has(memberId) || memberId === currentUserId) return;
            seen.add(memberId);
            reportableMembers.push({
                id: memberId,
                name: member.name || member.account || "使用者",
                role: member.role || (String(memberId) === String(normalizedParty.hostId) ? "主辦人" : "參加者"),
            });
        });

        // 若成員清單因資料未載入而缺少主辦人，非主辦人成員仍可檢舉主辦人。
        if (
            roleInParty === "member" &&
            normalizedParty.hostId &&
            !seen.has(String(normalizedParty.hostId)) &&
            String(normalizedParty.hostId) !== currentUserId
        ) {
            reportableMembers.unshift({
                id: String(normalizedParty.hostId),
                name: normalizedParty.host || "主辦人",
                role: "主辦人",
            });
        }

        return reportableMembers;
    }

    function getReportMemberLabel(member) {
        const roleText = member.role ? `（${member.role}）` : "";
        return `${member.name || "使用者"}${roleText}`;
    }

    function setupReportTargetOptions(context = {}) {
        if (!reportTargetType) return;

        const isChatReport = context.targetType === "chat";
        reportTargetType.innerHTML = "";
        reportTargetType.disabled = isChatReport;

        if (isChatReport) {
            const option = document.createElement("option");
            option.value = "chat";
            option.textContent = "檢舉聊天室訊息";
            reportTargetType.appendChild(option);
            return;
        }

        const party = context.party || currentParty;

        if (canReportPartyItself(party)) {
            const partyOption = document.createElement("option");
            partyOption.value = "party";
            partyOption.textContent = "檢舉飯局";
            reportTargetType.appendChild(partyOption);
        }

        getReportablePartyMembers(party).forEach((member) => {
            const option = document.createElement("option");
            option.value = `user:${member.id}`;
            option.textContent = `檢舉 ${getReportMemberLabel(member)}`;
            reportTargetType.appendChild(option);
        });

        if (context.defaultTargetId) {
            const targetValue = `user:${context.defaultTargetId}`;
            if ([...reportTargetType.options].some((option) => option.value === targetValue)) {
                reportTargetType.value = targetValue;
                return;
            }
        }

        if (!reportTargetType.options.length) {
            const option = document.createElement("option");
            option.value = "";
            option.textContent = "目前沒有可檢舉對象";
            reportTargetType.appendChild(option);
            reportTargetType.disabled = true;
            return;
        }

        reportTargetType.value = context.defaultTargetType === "user" && reportTargetType.options[1]
            ? reportTargetType.options[1].value
            : reportTargetType.options[0].value;
    }

    function openReportModal(context = {}) {
        if (!isLoggedIn()) {
            alert("請先登入後再檢舉");
            switchView("login");
            return;
        }

        if (isAdminUser()) {
            alert("管理員帳號使用後台審核功能，不使用一般檢舉流程。");
            return;
        }

        currentReportContext = context;

        if (reportForm) reportForm.reset();
        if (reportMessage) reportMessage.textContent = "";
        if (reportSubmitBtn) reportSubmitBtn.disabled = false;

        const isChatReport = context.targetType === "chat";
        if (reportTargetRow) reportTargetRow.hidden = isChatReport;
        setupReportTargetOptions(context);

        const hasSelectableReportTarget = isChatReport || Boolean(reportTargetType?.value);
        if (reportSubmitBtn) reportSubmitBtn.disabled = !hasSelectableReportTarget;

        if (reportTargetText) {
            if (isChatReport) {
                reportTargetText.textContent = `檢舉聊天室訊息：${context.preview || "訊息內容"}`;
            } else {
                const party = context.party || currentParty;
                const partyName = context.party?.partyName || "目前飯局";
                const roleInParty = getCurrentUserPartyRole(party);
                const members = getReportablePartyMembers(party);
                const canReportParty = canReportPartyItself(party);

                if (roleInParty === "outsider") {
                    reportTargetText.textContent = `你不是這場飯局的成員，因此只能檢舉飯局「${partyName}」。每個對象只能檢舉一次。`;
                } else if (roleInParty === "host") {
                    reportTargetText.textContent = members.length
                        ? `你是這場飯局的主辦人，可以檢舉其他參與成員；不能檢舉自己建立的飯局。每個對象只能檢舉一次。`
                        : `你是這場飯局的主辦人，目前沒有其他可檢舉的參與成員。`;
                } else if (canReportParty && members.length) {
                    reportTargetText.textContent = `你可以檢舉飯局「${partyName}」，也可以檢舉這場飯局中的其他成員。每個對象只能檢舉一次。`;
                } else {
                    reportTargetText.textContent = `你可以檢舉飯局「${partyName}」。每個對象只能檢舉一次。`;
                }
            }
        }

        if (reportModal) reportModal.hidden = false;
        reportReason?.focus();
    }

    function closeReportModal() {
        if (reportModal) reportModal.hidden = true;
        currentReportContext = null;
        if (reportForm) reportForm.reset();
        if (reportMessage) reportMessage.textContent = "";
        if (reportSubmitBtn) reportSubmitBtn.disabled = false;
        if (reportTargetType) reportTargetType.disabled = false;
    }

    function buildReportPayload() {
        const context = currentReportContext || {};
        const reason = reportReason?.value || "";
        const description = reportDescription?.value.trim() || "";

        if (context.targetType === "chat") {
            return {
                userId: currentUser?.id,
                targetType: "chat",
                targetId: context.targetId,
                partyId: context.partyId || currentChatPartyId || null,
                reason,
                description,
            };
        }

        const party = normalizeParty(context.party || currentParty);
        const selectedTarget = reportTargetType?.value || "";

        if (!selectedTarget) {
            return {
                userId: currentUser?.id,
                targetType: "",
                targetId: "",
                partyId: party.id,
                reason,
                description,
            };
        }

        if (selectedTarget.startsWith("user:")) {
            return {
                userId: currentUser?.id,
                targetType: "user",
                targetId: selectedTarget.replace("user:", ""),
                partyId: party.id,
                reason,
                description,
            };
        }

        // 相容舊版選項：若仍是 user，就檢舉主辦人。
        if (selectedTarget === "user") {
            return {
                userId: currentUser?.id,
                targetType: "user",
                targetId: party.hostId,
                partyId: party.id,
                reason,
                description,
            };
        }

        return {
            userId: currentUser?.id,
            targetType: "party",
            targetId: party.id,
            partyId: party.id,
            reason,
            description,
        };
    }

    async function submitReportForm() {
        if (!currentReportContext) return;

        const payload = buildReportPayload();

        if (!payload.reason) {
            if (reportMessage) reportMessage.textContent = "請選擇檢舉原因";
            return;
        }

        if (!payload.targetId) {
            if (reportMessage) reportMessage.textContent = "找不到檢舉對象，請重新整理後再試。";
            return;
        }

        try {
            if (reportSubmitBtn) {
                reportSubmitBtn.disabled = true;
                reportSubmitBtn.textContent = "送出中...";
            }

            await api.submitReport(payload);
            closeReportModal();
            alert("檢舉已送出，管理員會進行審核。 ");
        } catch (error) {
            console.error("送出檢舉失敗：", error);
            if (reportMessage) reportMessage.textContent = error.message || "送出檢舉失敗";
        } finally {
            if (reportSubmitBtn) {
                reportSubmitBtn.disabled = false;
                reportSubmitBtn.textContent = "送出檢舉";
            }
        }
    }

    /* ======================================================
     * 9. 後台管理功能
     * ====================================================== */
    function setAdminMessage(message = "", isError = false) {
        if (!adminMessage) return;
        adminMessage.textContent = message;
        adminMessage.classList.toggle("admin-message--error", isError);
    }

    function formatAdminDate(value) {
        if (!value) return "-";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleString("zh-TW", {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function renderAdminSummary(summary = {}) {
        if (adminTotalUsers) adminTotalUsers.textContent = String(summary.users || 0);
        if (adminTotalParties) adminTotalParties.textContent = String(summary.parties || 0);
        if (adminTotalMessages) adminTotalMessages.textContent = String(summary.messages || 0);
        if (adminTotalRatings) adminTotalRatings.textContent = String(summary.ratings || 0);
        if (adminTotalRestaurants) adminTotalRestaurants.textContent = String(summary.restaurants || 0);
        if (adminPendingReports) adminPendingReports.textContent = String(summary.pendingReports || 0);
    }


    function getRestaurantFormData() {
        return {
            name: adminRestaurantName?.value.trim() || "",
            category: adminRestaurantCategory?.value.trim() || "",
            priceLevel: adminRestaurantPrice?.value || "$",
            openingHours: adminRestaurantHours?.value.trim() || "",
            address: adminRestaurantAddress?.value.trim() || "",
            feature: adminRestaurantFeature?.value.trim() || "",
        };
    }

    function resetRestaurantForm() {
        if (adminRestaurantForm) adminRestaurantForm.reset();
        if (adminRestaurantId) adminRestaurantId.value = "";
        if (adminRestaurantSaveBtn) adminRestaurantSaveBtn.textContent = "新增餐廳";
        if (adminRestaurantCancelEdit) adminRestaurantCancelEdit.hidden = true;
    }

    function fillRestaurantForm(restaurant) {
        if (!restaurant) return;
        if (adminRestaurantId) adminRestaurantId.value = restaurant.id || "";
        if (adminRestaurantName) adminRestaurantName.value = restaurant.name || "";
        if (adminRestaurantCategory) adminRestaurantCategory.value = restaurant.category || "";
        if (adminRestaurantPrice) adminRestaurantPrice.value = restaurant.price_level || restaurant.priceLevel || "$";
        if (adminRestaurantHours) adminRestaurantHours.value = restaurant.opening_hours || restaurant.openingHours || "";
        if (adminRestaurantAddress) adminRestaurantAddress.value = restaurant.address || "";
        if (adminRestaurantFeature) adminRestaurantFeature.value = restaurant.feature || "";
        if (adminRestaurantSaveBtn) adminRestaurantSaveBtn.textContent = "儲存修改";
        if (adminRestaurantCancelEdit) adminRestaurantCancelEdit.hidden = false;
        adminRestaurantName?.focus();
    }

    function renderAdminRestaurants(restaurants = []) {
        if (!adminRestaurantList) return;
        adminRestaurantList.innerHTML = "";

        if (!restaurants.length) {
            const row = document.createElement("tr");
            row.innerHTML = `<td colspan="6" class="admin-empty-cell">目前沒有餐廳資料。</td>`;
            adminRestaurantList.appendChild(row);
            return;
        }

        restaurants.forEach((restaurant) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${restaurant.id}</td>
                <td>
                    <strong>${restaurant.name || "未命名"}</strong><br />
                    <span class="admin-muted">${restaurant.address || ""}</span>
                </td>
                <td>${restaurant.category || "-"}<br /><span class="admin-muted">${restaurant.price_level || "$"}</span></td>
                <td>${restaurant.opening_hours || "-"}</td>
                <td class="admin-feature-cell">${restaurant.feature || "-"}</td>
                <td></td>
            `;

            const actionCell = row.querySelector("td:last-child");
            const editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.className = "admin-secondary-btn";
            editBtn.textContent = "編輯";
            editBtn.addEventListener("click", () => fillRestaurantForm(restaurant));

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "admin-danger-btn";
            deleteBtn.textContent = "刪除";
            deleteBtn.disabled = Number(restaurant.party_count || 0) > 0;
            deleteBtn.title = deleteBtn.disabled ? "已有飯局使用此餐廳，不能刪除" : "刪除餐廳";
            deleteBtn.addEventListener("click", async () => {
                if (!confirm(`確定要刪除餐廳「${restaurant.name}」嗎？`)) return;
                await api.adminDeleteRestaurant(restaurant.id, currentUser.id);
                await loadAdminDashboard();
                await loadRestaurants();
            });

            actionCell.append(editBtn, deleteBtn);
            adminRestaurantList.appendChild(row);
        });
    }

    function renderAdminUsers(users = []) {
        if (!adminUserList) return;
        adminUserList.innerHTML = "";

        if (!users.length) {
            const row = document.createElement("tr");
            row.innerHTML = `<td colspan="6" class="admin-empty-cell">目前沒有使用者資料。</td>`;
            adminUserList.appendChild(row);
            return;
        }

        users.forEach((user) => {
            const row = document.createElement("tr");
            const ratingText = user.average_rating == null ? "尚無" : `${Number(user.average_rating).toFixed(1)} / 5`;
            const isSelf = String(user.id) === String(currentUser?.id);

            row.innerHTML = `
                <td>${user.id}</td>
                <td>
                    <strong>${user.name || "未命名"}</strong><br />
                    <span class="admin-muted">${user.account || ""}</span>
                </td>
                <td>${user.role === "admin" ? "管理員" : "一般"}</td>
                <td>${user.hosted_count || 0}</td>
                <td>${ratingText}</td>
                <td></td>
            `;

            const actionCell = row.querySelector("td:last-child");
            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "admin-danger-btn";
            deleteBtn.textContent = isSelf ? "自己" : "刪除";
            deleteBtn.disabled = isSelf;
            deleteBtn.addEventListener("click", async () => {
                if (!confirm(`確定要刪除使用者「${user.name || user.account}」嗎？相關飯局、聊天與評價也會一起刪除。`)) return;
                await api.adminDeleteUser(user.id, currentUser.id);
                await loadAdminDashboard();
            });
            actionCell.appendChild(deleteBtn);
            adminUserList.appendChild(row);
        });
    }

    function getAdminPartyStatusText(status) {
        const labels = {
            open: "招募中",
            ended: "已結束",
            cancelled: "已取消",
        };
        return labels[status] || status || "未知";
    }

    function renderAdminParties(parties = []) {
        if (!adminPartyList) return;
        adminPartyList.innerHTML = "";

        if (!parties.length) {
            const row = document.createElement("tr");
            row.innerHTML = `<td colspan="6" class="admin-empty-cell">目前沒有飯局資料。</td>`;
            adminPartyList.appendChild(row);
            return;
        }

        parties.forEach((party) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${party.id}</td>
                <td>
                    <strong>${party.title || "飯局"}</strong><br />
                    <span class="admin-muted">${party.store || ""}・${party.meal_type || ""}</span><br />
                    <span class="admin-muted">${party.restaurant_category || ""} ${party.restaurant_price_level || ""}</span>
                </td>
                <td>${party.host_name || party.host_account || "-"}</td>
                <td>${party.party_time || "-"}<br /><span class="admin-muted">${party.current_people || 0} / ${party.max_people || 0} 人</span></td>
                <td>${getAdminPartyStatusText(party.status)}</td>
                <td></td>
            `;

            const actionCell = row.querySelector("td:last-child");
            const cancelBtn = document.createElement("button");
            cancelBtn.type = "button";
            cancelBtn.className = "admin-secondary-btn";
            cancelBtn.textContent = "取消";
            cancelBtn.disabled = party.status === "cancelled";
            cancelBtn.addEventListener("click", async () => {
                if (!confirm(`確定要取消飯局「${party.title}」嗎？`)) return;
                await api.adminCancelParty(party.id, currentUser.id);
                await loadAdminDashboard();
                await loadBackendParties();
            });

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "admin-danger-btn";
            deleteBtn.textContent = "刪除";
            deleteBtn.addEventListener("click", async () => {
                if (!confirm(`確定要刪除飯局「${party.title}」嗎？此動作無法復原。`)) return;
                await api.adminDeleteParty(party.id, currentUser.id);
                await loadAdminDashboard();
                await loadBackendParties();
                renderChatRoomList();
            });

            actionCell.append(cancelBtn, deleteBtn);
            adminPartyList.appendChild(row);
        });
    }

    function renderAdminChats(messages = []) {
        if (!adminChatList) return;
        adminChatList.innerHTML = "";

        if (!messages.length) {
            const row = document.createElement("tr");
            row.innerHTML = `<td colspan="6" class="admin-empty-cell">目前沒有聊天室訊息。</td>`;
            adminChatList.appendChild(row);
            return;
        }

        messages.forEach((message) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${message.id}</td>
                <td>${message.party_title || "-"}</td>
                <td>${message.sender_name || message.sender_account || "-"}</td>
                <td class="admin-message-cell">${message.message || ""}</td>
                <td>${formatAdminDate(message.created_at)}</td>
                <td></td>
            `;

            const actionCell = row.querySelector("td:last-child");
            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "admin-danger-btn";
            deleteBtn.textContent = "刪除";
            deleteBtn.addEventListener("click", async () => {
                if (!confirm("確定要刪除這則聊天室訊息嗎？")) return;
                await api.adminDeleteChatMessage(message.id, currentUser.id);
                await loadAdminDashboard();
                if (currentChatPartyId) {
                    await openChatRoom(currentChatPartyId);
                }
            });
            actionCell.appendChild(deleteBtn);
            adminChatList.appendChild(row);
        });
    }


    function getAdminReportTypeText(type) {
        const labels = {
            party: "飯局",
            user: "使用者",
            chat: "聊天訊息",
        };
        return labels[type] || type || "檢舉";
    }

    function getAdminReportStatusText(status) {
        const labels = {
            pending: "待處理",
            resolved: "已處理",
            rejected: "已駁回",
        };
        return labels[status] || status || "待處理";
    }

    function getAdminReportTargetText(report) {
        if (report.target_type === "party") return report.target_party_title || `飯局 #${report.target_id}`;
        if (report.target_type === "user") return report.target_user_name || report.target_user_account || `使用者 #${report.target_id}`;
        if (report.target_type === "chat") return report.chat_party_title || `訊息 #${report.target_id}`;
        return `#${report.target_id}`;
    }

    function getAdminReportDetailText(report) {
        if (report.target_type === "chat") {
            return report.target_chat_message ? `訊息：${report.target_chat_message}` : "聊天室訊息已不存在或已刪除";
        }
        return report.description || "沒有補充說明。";
    }

    async function updateReportStatus(reportId, status) {
        const note = status === "rejected" ? "檢舉內容不足，已駁回" : "管理員已完成審核";
        await api.adminUpdateReportStatus(reportId, currentUser.id, status, note);
        await loadAdminDashboard();
    }

    function renderAdminReports(reports = []) {
        if (!adminReportList) return;
        adminReportList.innerHTML = "";

        if (!reports.length) {
            const row = document.createElement("tr");
            row.innerHTML = `<td colspan="6" class="admin-empty-cell">目前沒有檢舉資料。</td>`;
            adminReportList.appendChild(row);
            return;
        }

        reports.forEach((report) => {
            const row = document.createElement("tr");
            const statusClass = `admin-report-status--${report.status || "pending"}`;
            const detail = getAdminReportDetailText(report);
            row.innerHTML = `
                <td>${report.id}</td>
                <td>
                    <strong>${getAdminReportTypeText(report.target_type)}</strong><br />
                    <span class="admin-muted">${getAdminReportTargetText(report)}</span>
                </td>
                <td>${report.reporter_name || report.reporter_account || "-"}</td>
                <td>
                    ${report.reason || "-"}
                    <span class="admin-report-detail">${detail}</span>
                </td>
                <td><span class="${statusClass}">${getAdminReportStatusText(report.status)}</span><br /><span class="admin-muted">${formatAdminDate(report.created_at)}</span></td>
                <td></td>
            `;

            const actionCell = row.querySelector("td:last-child");
            if (report.status === "pending") {
                const resolveBtn = document.createElement("button");
                resolveBtn.type = "button";
                resolveBtn.className = "admin-secondary-btn";
                resolveBtn.textContent = "處理";
                resolveBtn.addEventListener("click", async () => {
                    if (!confirm("確認將此檢舉標記為已處理嗎？")) return;
                    await updateReportStatus(report.id, "resolved");
                });

                const rejectBtn = document.createElement("button");
                rejectBtn.type = "button";
                rejectBtn.className = "admin-danger-btn";
                rejectBtn.textContent = "駁回";
                rejectBtn.addEventListener("click", async () => {
                    if (!confirm("確認駁回此檢舉嗎？")) return;
                    await updateReportStatus(report.id, "rejected");
                });

                actionCell.append(resolveBtn, rejectBtn);
            } else {
                const reopenBtn = document.createElement("button");
                reopenBtn.type = "button";
                reopenBtn.className = "admin-secondary-btn";
                reopenBtn.textContent = "重開";
                reopenBtn.addEventListener("click", async () => {
                    await updateReportStatus(report.id, "pending");
                });
                actionCell.appendChild(reopenBtn);
            }

            adminReportList.appendChild(row);
        });
    }

    async function loadAdminDashboard() {
        if (!isLoggedIn()) {
            switchView("login");
            return;
        }

        if (!isAdminUser()) {
            alert("只有管理員可以進入後台管理。需要先將 users.role 設為 admin。");
            switchView("home");
            return;
        }

        try {
            if (adminRefreshBtn) {
                adminRefreshBtn.disabled = true;
                adminRefreshBtn.textContent = "讀取中...";
            }
            setAdminMessage("讀取後台資料中...");

            const [summaryResult, usersResult, partiesResult, chatsResult, restaurantsResult, reportsResult] = await Promise.all([
                api.getAdminSummary(currentUser.id),
                api.getAdminUsers(currentUser.id),
                api.getAdminParties(currentUser.id),
                api.getAdminChats(currentUser.id),
                api.getAdminRestaurants(currentUser.id),
                api.getAdminReports(currentUser.id),
            ]);

            renderAdminSummary(summaryResult.summary || {});
            renderAdminUsers(usersResult.users || []);
            renderAdminParties(partiesResult.parties || []);
            renderAdminChats(chatsResult.messages || []);
            renderAdminRestaurants(restaurantsResult.restaurants || []);
            renderAdminReports(reportsResult.reports || []);
            setAdminMessage("後台資料已更新。 ");
        } catch (error) {
            console.error("讀取後台資料失敗：", error);
            setAdminMessage(error.message || "讀取後台資料失敗", true);
        } finally {
            if (adminRefreshBtn) {
                adminRefreshBtn.disabled = false;
                adminRefreshBtn.textContent = "重新整理";
            }
        }
    }

    /* ======================================================
     * 10. 篩選選單功能
     * ====================================================== */
    function initFilterMenu() {
        if (!filterBtn) return;

        if (advancedFilterPanel) {
            const setAdvancedPanelOpen = (isOpen) => {
                advancedFilterPanel.hidden = !isOpen;
                filterBtn.setAttribute("aria-expanded", String(isOpen));
            };

            setAdvancedPanelOpen(true);

            filterBtn.addEventListener("click", (event) => {
                event.stopPropagation();
                const isOpen = filterBtn.getAttribute("aria-expanded") === "true";
                setAdvancedPanelOpen(!isOpen);
            });

            return;
        }

        if (!filterMenu || !filterLabel) return;

        function openFilterMenu() {
            filterMenu.hidden = false;
            filterBtn.setAttribute("aria-expanded", "true");
        }

        filterBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            filterMenu.hidden ? openFilterMenu() : closeFilterMenu();
        });

        $$("li", filterMenu).forEach((option, index) => {
            option.tabIndex = 0;
            option.setAttribute("aria-selected", index === 0 ? "true" : "false");

            option.addEventListener("click", () => {
                const value = option.dataset.value || option.textContent.trim();
                filterLabel.textContent = value;

                $$("li", filterMenu).forEach((li) => {
                    li.setAttribute("aria-selected", li === option ? "true" : "false");
                });

                closeFilterMenu();
                renderHomeParties();
            });

            option.addEventListener("keydown", (event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                option.click();
            });
        });

        document.addEventListener("click", (event) => {
            if (!filterMenu.hidden && !filterMenu.contains(event.target) && event.target !== filterBtn) {
                closeFilterMenu();
            }
        });
    }

    /* ======================================================
     * 10. 星星評價功能
     * ====================================================== */
    function setStarRating(group, value) {
        const rating = Math.max(1, Math.min(5, Number(value) || 3));

        $$(".star", group).forEach((star, index) => {
            const isActive = index < rating;
            star.classList.toggle("star--active", isActive);
            star.setAttribute("aria-pressed", isActive ? "true" : "false");
        });

        group.dataset.rating = String(rating);
        group.setAttribute("aria-label", `評分 ${rating} 顆星`);
    }

    function bindStarRatingGroup(group) {
        if (!group) return;
        setStarRating(group, group.dataset.rating || 3);

        $$(".star", group).forEach((star) => {
            star.addEventListener("click", () => {
                setStarRating(group, star.dataset.value);
            });
        });
    }

    function initStarRatings() {
        $$(".star-rating").forEach(bindStarRatingGroup);
    }

    function createStarRatingGroup(initial = 3) {
        const group = document.createElement("div");
        group.className = "star-rating";
        group.role = "group";
        group.dataset.rating = String(initial);

        for (let value = 1; value <= 5; value += 1) {
            const star = document.createElement("button");
            star.type = "button";
            star.className = "star";
            star.dataset.value = String(value);
            star.setAttribute("aria-label", `${value} 顆星`);
            star.textContent = "★";
            group.appendChild(star);
        }

        bindStarRatingGroup(group);
        return group;
    }

    function getRatingTargets(party) {
        const userId = getCurrentUserId();
        const normalizedParty = normalizeParty(party);
        return (normalizedParty.members || []).filter((member) => String(member.id) !== String(userId));
    }

    function renderRatingPage() {
        if (!ratingList || !ratingSubmitBtn || !ratingMessage) return;

        ratingList.innerHTML = "";
        ratingMessage.textContent = "";

        if (!currentParty) {
            ratingMessage.textContent = "目前沒有可評價的飯局。";
            ratingSubmitBtn.disabled = true;
            return;
        }

        const party = normalizeParty(currentParty);
        const targets = getRatingTargets(party);
        const reviewed = hasReviewedParty(party.id);
        const canRate = canCurrentUserRateParty(party);

        if (ratingPartyTitle) ratingPartyTitle.textContent = `評價「${party.partyName}」`;

        if (!isPartyEnded(party)) {
            ratingMessage.textContent = getPartyEndHint(party);
            ratingSubmitBtn.disabled = true;
        } else if (!canRate) {
            ratingMessage.textContent = "只有本場飯局成員可以評價。";
            ratingSubmitBtn.disabled = true;
        } else if (reviewed) {
            ratingMessage.textContent = "你已經評價過這場飯局，同一場飯局只能評價一次。";
            ratingSubmitBtn.disabled = true;
        } else if (!targets.length) {
            ratingMessage.textContent = "目前沒有其他成員可以評價。";
            ratingSubmitBtn.disabled = true;
        } else {
            ratingMessage.textContent = "請對本場飯局成員給予星等與留言。";
            ratingSubmitBtn.disabled = false;
        }

        targets.forEach((member) => {
            const item = document.createElement("li");
            item.className = "rating-item";
            item.dataset.memberId = member.id;
            item.dataset.memberName = member.name || "加入人名稱";

            const user = document.createElement("div");
            user.className = "rating-user";

            const avatar = document.createElement("div");
            avatar.className = "rating-avatar";
            avatar.setAttribute("aria-hidden", "true");

            if (member.avatar) {
                const img = document.createElement("img");
                img.src = getImageUrl(member.avatar);
                img.alt = "";
                avatar.appendChild(img);
            } else {
                avatar.textContent = (member.name || "飯").slice(0, 1);
            }

            const name = document.createElement("span");
            name.className = "rating-name";
            name.textContent = member.name || "加入人名稱";
            user.append(avatar, name);

            const controls = document.createElement("div");
            controls.className = "rating-controls";
            controls.appendChild(createStarRatingGroup(3));

            const comment = document.createElement("textarea");
            comment.className = "rating-comment";
            comment.rows = 2;
            comment.placeholder = "留下簡短評價，例如：準時、好溝通。";
            comment.setAttribute("aria-label", `給 ${member.name || "成員"} 的評價文字`);
            controls.appendChild(comment);

            item.append(user, controls);
            ratingList.appendChild(item);
        });
    }

    async function submitRatings() {
        if (!currentParty) return;

        if (!isLoggedIn() || !currentUser?.id) {
            alert("請先登入後再送出評價。");
            switchView("login");
            return;
        }

        const party = normalizeParty(currentParty);
        if (!canCurrentUserRateParty(party)) {
            alert("只有本場飯局成員可以送出評價。");
            return;
        }

        if (!isPartyEnded(party)) {
            alert("飯局結束後才能評價。" + getPartyEndHint(party));
            return;
        }

        const reviewed = await refreshRatingReviewedCache(party.id);
        if (reviewed) {
            alert("你已經評價過這場飯局，同一場飯局只能評價一次。 ");
            await renderRatingPage();
            return;
        }

        const reviewerProfile = loadProfileData();
        const reviewerId = currentUser.id;
        const reviewerName = reviewerProfile.name || currentUser?.name || currentUser?.account || "目前使用者";
        const items = $$(".rating-item", ratingList);

        if (!items.length) {
            alert("目前沒有其他成員可以評價。 ");
            return;
        }

        const ratingItems = items.map((item) => {
            const group = $(".star-rating", item);
            const comment = $(".rating-comment", item);
            return {
                targetId: Number(item.dataset.memberId),
                targetName: item.dataset.memberName,
                score: Number(group?.dataset.rating || 3),
                comment: comment?.value.trim() || "",
            };
        });

        try {
            if (ratingSubmitBtn) {
                ratingSubmitBtn.disabled = true;
                ratingSubmitBtn.textContent = "送出中...";
            }

            if (isBackendPartyId(party.id)) {
                await api.submitRatings({
                    partyId: Number(party.id),
                    reviewerId,
                    ratings: ratingItems,
                });
            } else {
                const newRatings = ratingItems.map((rating) => ({
                    id: `rating-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                    partyId: party.id,
                    partyName: party.partyName,
                    reviewerId: String(reviewerId),
                    reviewerName,
                    targetId: String(rating.targetId),
                    targetName: rating.targetName,
                    score: rating.score,
                    comment: rating.comment,
                    createdAt: new Date().toISOString(),
                }));
                saveRatings([...loadRatings(), ...newRatings]);
            }

            markPartyReviewed(party.id);

            await addNotification(
                "rating",
                "評價已送出",
                `你已完成「${party.partyName}」的成員評價。`,
                party.id
            );

            await renderProfileRatingSummary();
            updateJoinedActionButtons(party);
            await renderRatingPage();
            alert("評價已送出並儲存到資料庫。 ");
            switchView("profile");
        } catch (error) {
            console.error("送出評價失敗：", error);
            alert(error.message || "送出評價失敗");
        } finally {
            if (ratingSubmitBtn) {
                ratingSubmitBtn.textContent = "送出評價";
            }
        }
    }

    async function openRatingPage() {
        if (isAdminUser()) {
            alert("管理員帳號為純後台模式，不能使用評價功能。");
            switchView("admin");
            return;
        }
        if (!currentParty) return;
        if (isBackendPartyId(currentParty.id)) {
            try {
                currentParty = await loadBackendPartyDetail(currentParty.id);
            } catch (error) {
                console.error("重新讀取飯局成員失敗：", error);
                alert(error.message || "讀取飯局成員失敗");
                return;
            }
        }

        const party = normalizeParty(currentParty);

        if (!isLoggedIn() || !currentUser?.id) {
            alert("請先登入後再評價。");
            switchView("login");
            return;
        }

        if (!canCurrentUserRateParty(party)) {
            alert("只有本場飯局成員可以評價。");
            return;
        }

        if (!isPartyEnded(party)) {
            alert("飯局結束後才能評價。" + getPartyEndHint(party));
            return;
        }

        const reviewed = await refreshRatingReviewedCache(party.id);
        if (reviewed) {
            alert("你已經評價過這場飯局，同一場飯局只能評價一次。 ");
            return;
        }

        await renderRatingPage();
        switchView("rating");
    }

    /* ======================================================
     * 11. 事件綁定
     * ====================================================== */
    function bindEvents() {
        navItems.forEach((item) => {
            item.addEventListener("click", (event) => {
                event.preventDefault();
                const navKey = item.dataset.nav;

                if (isAdminUser() && !(navKey === "admin" || navKey === "profile")) {
                    switchView("admin");
                    loadAdminDashboard();
                    return;
                }

                if (navKey === "profile") {
                    openProfileOrLogin();
                    return;
                }

                if (navKey === "chat") {
                    renderChatRoomList();
                    switchView("chat");
                    return;
                }

                if (navKey === "notifications") {
                    renderNotifications();
                    switchView("notifications");
                    return;
                }

                if (navKey === "admin") {
                    switchView("admin");
                    loadAdminDashboard();
                    return;
                }

                switchView(NAV_TO_VIEW[navKey] || "home");
            });
        });


        detailReportBtn?.addEventListener("click", () => {
            if (!currentParty) return;
            openReportModal({ party: currentParty, defaultTargetType: "party" });
        });

        joinedReportBtn?.addEventListener("click", () => {
            if (!currentParty) return;
            openReportModal({ party: currentParty, defaultTargetType: "party" });
        });

        reportCloseBtn?.addEventListener("click", closeReportModal);
        reportCancelBtn?.addEventListener("click", closeReportModal);
        reportModal?.addEventListener("click", (event) => {
            if (event.target?.hasAttribute("data-report-close")) closeReportModal();
        });

        reportForm?.addEventListener("submit", async (event) => {
            event.preventDefault();
            await submitReportForm();
        });

        adminRefreshBtn?.addEventListener("click", loadAdminDashboard);
        createRestaurantSelect?.addEventListener("change", updateSelectedRestaurantInfo);
        createNewRestaurantToggle?.addEventListener("click", () => {
            setCustomRestaurantMode(!isCustomRestaurantMode());
        });

        adminRestaurantCancelEdit?.addEventListener("click", resetRestaurantForm);

        adminRestaurantForm?.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (!isAdminUser() || !currentUser?.id) {
                alert("只有管理員可以管理餐廳。 ");
                return;
            }

            const restaurantData = getRestaurantFormData();
            if (!restaurantData.name || !restaurantData.category || !restaurantData.priceLevel || !restaurantData.openingHours || !restaurantData.address) {
                alert("請完整填寫餐廳名稱、類型、價格、營業時間與地址");
                return;
            }

            try {
                const editingId = adminRestaurantId?.value || "";
                if (adminRestaurantSaveBtn) {
                    adminRestaurantSaveBtn.disabled = true;
                    adminRestaurantSaveBtn.textContent = editingId ? "儲存中..." : "新增中...";
                }

                if (editingId) {
                    await api.adminUpdateRestaurant(editingId, currentUser.id, restaurantData);
                } else {
                    await api.adminCreateRestaurant(currentUser.id, restaurantData);
                }

                resetRestaurantForm();
                await loadAdminDashboard();
                await loadRestaurants();
            } catch (error) {
                console.error("儲存餐廳失敗：", error);
                alert(error.message || "儲存餐廳失敗");
            } finally {
                if (adminRestaurantSaveBtn) {
                    adminRestaurantSaveBtn.disabled = false;
                    adminRestaurantSaveBtn.textContent = adminRestaurantId?.value ? "儲存修改" : "新增餐廳";
                }
            }
        });

        homePartyTabs.forEach((tab) => {
            tab.addEventListener("click", () => {
                setHomePartyTab(tab.dataset.homeTab || "my");
            });
        });

        searchInput?.addEventListener("input", renderHomeParties);
        mealTypeFilter?.addEventListener("change", renderHomeParties);
        restaurantCategoryFilter?.addEventListener("change", renderHomeParties);
        restaurantPriceFilter?.addEventListener("change", renderHomeParties);
        availableOnlyFilter?.addEventListener("change", renderHomeParties);

        loginForm?.addEventListener("submit", (event) => {
            event.preventDefault();

            const account = loginAccount?.value.trim();
            const password = loginPassword?.value.trim();

            if (!account || !password) {
                if (loginMessage) loginMessage.textContent = "請輸入帳號與密碼";
                return;
            }

            login(account, password);
        });

        loginTabBtn?.addEventListener("click", () => {
            showAuthMode("login");
        });

        registerTabBtn?.addEventListener("click", () => {
            showAuthMode("register");
        });

        registerForm?.addEventListener("submit", (event) => {
            event.preventDefault();

            const account = registerAccount?.value.trim();
            const name = registerName?.value.trim();
            const password = registerPassword?.value.trim();
            const passwordConfirm = registerPasswordConfirm?.value.trim();

            if (!account || !name || !password || !passwordConfirm) {
                if (registerMessage) registerMessage.textContent = "請完整填寫帳號、姓名與密碼";
                return;
            }

            if (password.length < 4) {
                if (registerMessage) registerMessage.textContent = "密碼至少需要 4 個字元";
                return;
            }

            if (password !== passwordConfirm) {
                if (registerMessage) registerMessage.textContent = "兩次輸入的密碼不一致";
                return;
            }

            registerNewAccount(account, password, name);
        });

        bindPartyCard(otherPartyCard, { allowJoin: true });

        partyJoinBtn?.addEventListener("click", async () => {
            if (!allowJoinFlow || !currentParty) return;

            const status = getPartyStatus(currentParty);
            if (status.key === "owner" || status.key === "joined") {
                openJoinedParty();
                return;
            }

            if (status.key === "canceled" || status.key === "ended" || status.key === "full") return;

            const joinedParty = await joinCurrentParty();
            if (!joinedParty) return;
            prepareOtherPartyCard();
            renderChatRoomList();
            openJoinedParty();
        });

        partyDetailDeleteBtn?.addEventListener("click", async () => {
            if (!currentParty) return;
            if (!canCurrentUserDeleteClosedParty(currentParty)) return;
            const partyId = currentParty.id;
            await deleteClosedPartyRecord(partyId);
            if (!currentParty) switchView("home");
        });

        partyChatBtn?.addEventListener("click", () => {
            if (!currentParty) return;
            openChatRoom(currentParty.id);
            switchView("chat");
        });

        partyLeaveBtn?.addEventListener("click", async () => {
            if (!currentParty) return;
            if (!confirm("確定要退出這個飯局嗎？")) return;

            const updatedParty = await leaveCurrentParty();
            if (!updatedParty) return;

            fillPartyFields(detailFields, updatedParty);
            renderImageBox(detailPartyImage, normalizeParty(updatedParty).imageUrl, "飯");
            renderPartyHostPreview(updatedParty);

            if (partyJoinBtn) {
                const status = getPartyStatus(updatedParty);
                partyJoinBtn.hidden = false;
                partyJoinBtn.disabled = status.key === "full" || status.key === "canceled" || status.key === "ended";
                partyJoinBtn.textContent = status.key === "full" ? "已額滿" : status.key === "canceled" ? "已取消" : status.key === "ended" ? "已結束" : "join";
            }

            alert("已退出飯局，成員列表與人數已更新。你可以再次按 join 加入。");
            switchView("partyDetail");
        });

        partyCancelBtn?.addEventListener("click", async () => {
            if (!currentParty) return;
            if (!confirm("確定要取消這個飯局嗎？取消後將無法再讓其他人加入。")) return;

            const updatedParty = await cancelCurrentParty();
            if (!updatedParty) return;

            fillPartyFields(detailFields, updatedParty);
            fillPartyFields(joinedFields, updatedParty);
            renderJoinedMembers(updatedParty);
            updateJoinedActionButtons(updatedParty);

            if (partyJoinBtn) {
                partyJoinBtn.hidden = false;
                partyJoinBtn.disabled = true;
                partyJoinBtn.textContent = "已取消";
            }
            if (partyDetailDeleteBtn) {
                partyDetailDeleteBtn.hidden = false;
            }

            alert("飯局已取消，狀態已更新為已取消。 ");
            switchView("partyDetail");
        });

        partyRateBtn?.addEventListener("click", openRatingPage);
        ratingSubmitBtn?.addEventListener("click", submitRatings);
        fab?.addEventListener("click", () => {
            if (isAdminUser()) {
                alert("管理員帳號為純後台模式，不能建立飯局。");
                switchView("admin");
                return;
            }
            switchView("create");
        });

        createForm?.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (!isLoggedIn()) {
                alert("請先登入後再建立飯局");
                switchView("login");
                return;
            }

            if (isAdminUser()) {
                alert("管理員帳號為純後台模式，不能建立飯局。");
                switchView("admin");
                return;
            }

            const partyData = getBackendPartyDataFromForm();
            const errorMessage = validateBackendPartyData(partyData);

            if (errorMessage) {
                alert(errorMessage);
                return;
            }

            try {
                if (partyData.customRestaurant) {
                    const restaurantResult = await api.createRestaurant(currentUser.id, partyData.customRestaurant);
                    const createdRestaurant = mapRestaurant(restaurantResult.restaurant || {});
                    partyData.restaurantId = createdRestaurant.id;
                    partyData.store = createdRestaurant.name;
                    delete partyData.customRestaurant;

                    if (createdRestaurant.id && !restaurantOptions.some((restaurant) => String(restaurant.id) === String(createdRestaurant.id))) {
                        restaurantOptions.push(createdRestaurant);
                    }
                    renderRestaurantSelect();
                    if (createRestaurantSelect) createRestaurantSelect.value = createdRestaurant.id;
                    updateSelectedRestaurantInfo();
                }

                const coverFile = createCoverFile?.files?.[0];
                if (coverFile) {
                    partyData.imageUrl = await uploadImageFile(coverFile, "party");
                }

                const result = await api.createParty(partyData);

                addNotification(
                    "create",
                    "飯局建立成功",
                    `你已成功建立「${partyData.title}」。`,
                    String(result.party?.id || "")
                );

                createForm.reset();
                resetCustomRestaurantForm();
                updateSelectedRestaurantInfo();

                await loadBackendParties();

                renderChatRoomList();
                switchView("home");
            } catch (error) {
                console.error("建立飯局失敗：", error);
                alert(error.message || "建立飯局失敗，請確認後端是否啟動");
            }
        });

        profileEditBtn?.addEventListener("click", () => {
            setProfileEditMode(true);
            profileNameInput?.focus();
        });

        profileSaveBtn?.addEventListener("click", saveProfileToBackend);

        profileForm?.addEventListener("submit", saveProfileToBackend);

        profileAvatarFile?.addEventListener("change", async (event) => {
            event?.preventDefault?.();
            event?.stopPropagation?.();

            const file = profileAvatarFile.files?.[0];
            if (!file) return;

            if (!isLoggedIn() || !currentUser?.id) {
                alert("請先登入後再更換頭像");
                profileAvatarFile.value = "";
                switchView("login");
                return;
            }

            try {
                const errorMessage = validateImageFile(file);
                if (errorMessage) throw new Error(errorMessage);

                pendingProfileAvatarFile = file;
                pendingProfileAvatarPreview = await fileToDataUrl(file);

                if (profileAvatarPreview && profileAvatarIcon) {
                    profileAvatarPreview.src = pendingProfileAvatarPreview;
                    profileAvatarPreview.hidden = false;
                    profileAvatarIcon.hidden = true;
                }

                if (profileSaveBtn) {
                    profileSaveBtn.hidden = false;
                    profileSaveBtn.disabled = false;
                    profileSaveBtn.textContent = "儲存";
                }

                setProfileEditMode(true);
            } catch (error) {
                pendingProfileAvatarFile = null;
                pendingProfileAvatarPreview = "";
                profileAvatarFile.value = "";
                console.error("頭像預覽失敗：", error);
                alert(error.message || "頭像預覽失敗");
            }
        });

        chatForm?.addEventListener("submit", async (event) => {
            event.preventDefault();
            const message = chatInput?.value || "";
            const sent = await sendChatMessage(message);
            if (sent && chatInput) chatInput.value = "";
        });

        chatBackBtn?.addEventListener("click", closeChatRoom);

        signoutBtn?.addEventListener("click", () => {
            if (confirm("確定要登出嗎？")) {
                logout();
            }
        });
    }

    /* ======================================================
     * 12. 初始化
     * ====================================================== */
    function init() {
        loadSavedUser();
        updateAdminNavVisibility();
        removeDemoPartiesFromLocalStorage();
        bindEvents();
        initFilterMenu();
        initStarRatings();
        updateProfileUser();
        setProfileEditMode(false);
        prepareOtherPartyCard();
        renderHomeParties();
        loadBackendParties();
        renderChatRoomList();
        renderNotifications();
        loadRestaurants();

        if (isAdminUser()) {
            switchView("admin");
            loadAdminDashboard();
        } else {
            switchView("home");
        }
    }

    init();
})();
