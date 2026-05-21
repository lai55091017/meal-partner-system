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
 * 7. 新增飯局送出後，會存到 localStorage，並在首頁「我的飯局」新增一張卡片
 * 8. 首頁篩選按鈕可切換 早餐 / 午餐 / 晚餐 / 宵夜
 * 9. 聊天室頁會顯示已建立或已加入的飯局聊天室
 * 10. 每個飯局都有獨立聊天紀錄，訊息會暫存在 localStorage
 * 11. 已加入飯局後可以退出，退出後人數與成員列表會自動更新
 * 12. 評價頁星星可以點擊切換 1～5 顆星
 *
 * 目前是前端展示用，資料沒有連接後端資料庫。
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
    };

    const PAGE_TITLES = {
        login: "登入 · 飯局系統",
        home: "飯局系統",
        notifications: "通知 · 飯局系統",
        chat: "聊天室 · 飯局系統",
        partyDetail: "飯局詳情 · 飯局系統",
        partyJoined: "飯局成員 · 飯局系統",
        rating: "評價 · 飯局系統",
        create: "新增飯局 · 飯局系統",
        profile: "個人帳號 · 飯局系統",
    };

    // 底部導覽列對應的主要頁面。
    const NAV_TO_VIEW = {
        home: "home",
        notifications: "notifications",
        chat: "chat",
        profile: "profile",
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
    const searchInput = $("#search-input");
    const availableOnlyFilter = $("#available-only-filter");
    const homeNoResult = $("#home-no-result");
    const myPartiesSection = $("#my-parties-section");
    const otherPartiesSection = $("#other-parties-section");
    const createForm = $("#create-form");
    const signoutBtn = $("#profile-signout");

    const loginForm = $("#login-form");
    const loginAccount = $("#login-account");
    const loginPassword = $("#login-password");
    const loginMessage = $("#login-message");

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

    /* ======================================================
     * 4. 頁面狀態資料
     * ====================================================== */
    let currentParty = null;
    let allowJoinFlow = false;
    let currentUser = null;
    let currentChatPartyId = null;
    let visibleMyPartyCount = 0;
    let visibleOtherPartyCount = 0;
    let backendParties = [];

    // 首頁預設示範飯局：讓系統一開始就有一張卡片可操作。
    const DEFAULT_MY_PARTY = {
        id: "default-my-party",
        partyName: "範例飯局",
        host: "約飯人 先生/小姐",
        store: "店家名稱",
        time: "時間",
        mealType: "午餐",
        maxMembers: 4,
        description: "這是預設示範飯局，可用來測試詳情頁與成員頁。",
        members: [{ id: "default-host", name: "約飯人 先生/小姐", role: "主辦人" }],
        isMine: true,
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

    function isLoggedIn() {
        return currentUser !== null;
    }

    function getDefaultProfile() {
        return {
            name: currentUser?.name || "約飯人 先生/小姐",
            studentId: currentUser?.account || "",
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


    /* ======================================================
     * 6. 通知功能
     *    目前使用 localStorage 暫存通知紀錄。
     * ====================================================== */
    function loadNotifications() {
        try {
            const saved = localStorage.getItem(NOTIFICATIONS_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            localStorage.removeItem(NOTIFICATIONS_KEY);
            return [];
        }
    }

    function saveNotifications(notifications) {
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications.slice(0, 50)));
    }

    function deleteNotification(noticeId) {
        if (!noticeId) return;
        if (!confirm("確定要刪除這則通知嗎？")) return;

        const notifications = loadNotifications().filter((notice) => notice.id !== noticeId);
        saveNotifications(notifications);
        renderNotifications();
    }

    function addNotification(type, title, message, partyId = "") {
        const notifications = loadNotifications();

        notifications.unshift({
            id: `notice-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            type,
            title,
            message,
            partyId,
            createdAt: new Date().toISOString(),
        });

        saveNotifications(notifications);
        renderNotifications();
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
        end.setMinutes(end.getMinutes() + 60);
        return end;
    }

    function isPartyEnded(party) {
        if (!party || party.isCanceled) return false;
        const endTime = parsePartyEndTime(party);
        if (!endTime) return false;
        return Date.now() >= endTime.getTime();
    }

    function getPartyEndHint(party) {
        const endTime = parsePartyEndTime(party);
        if (!endTime) return "此飯局時間格式無法判斷，請使用『今天 HH:mm』的時間選項。";
        return `飯局約在 ${formatMessageTime(endTime.toISOString())} 後才能評價。`;
    }

    function hasReviewedParty(partyId) {
        const reviewerId = currentUser?.account || "guest-user";
        return loadRatings().some((rating) => rating.partyId === partyId && rating.reviewerId === reviewerId);
    }

    function getReceivedRatings(userId = currentUser?.account || "guest-user") {
        return loadRatings().filter((rating) => rating.targetId === userId);
    }

    function getAverageRating(userId = currentUser?.account || "guest-user") {
        const received = getReceivedRatings(userId);
        if (!received.length) return null;
        const total = received.reduce((sum, rating) => sum + Number(rating.score || 0), 0);
        return total / received.length;
    }

    function renderProfileRatingSummary() {
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

    function renderNotifications() {
        if (!notificationList) return;

        const notifications = loadNotifications();
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
            deleteBtn.addEventListener("click", () => deleteNotification(notice.id));

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

    function renderProfileForm() {
        const profile = loadProfileData();

        if (profileNameInput) profileNameInput.value = profile.name;
        if (profileStudentId) profileStudentId.value = profile.studentId;
        if (profileDepartment) profileDepartment.value = profile.department;
        if (profileBio) profileBio.value = profile.bio;

        setCheckedValues("diet", profile.diet || []);
        setCheckedValues("cuisine", profile.cuisine || []);

        if (profileAvatarPreview && profileAvatarIcon) {
            if (profile.avatar) {
                profileAvatarPreview.src = profile.avatar;
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

    function updateProfileUser() {
        const profile = loadProfileData();

        if (!profile.studentId && currentUser?.account) profile.studentId = currentUser.account;
        if ((!profile.name || profile.name === "約飯人 先生/小姐") && currentUser?.name) profile.name = currentUser.name;

        saveProfileData(profile);
        renderProfileForm();
    }


    async function login(account, password) {
        try {
            if (loginMessage) loginMessage.textContent = "登入中...";

            const result = await api.login(account, password);

            currentUser = result.user;

            localStorage.setItem(AUTH_KEY, JSON.stringify(currentUser));

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
            switchView("profile");
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

        const safeViewKey = views[viewKey] ? viewKey : "home";
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

        closeFilterMenu();
    }

    function openProfileOrLogin() {
        if (isLoggedIn()) {
            updateProfileUser();
            switchView("profile");
        } else {
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

    function mapBackendPartyToFrontend(party) {
        const currentUserId = currentUser?.id ? Number(currentUser.id) : null;
        const hostId = party.host_id ? Number(party.host_id) : null;

        return normalizeParty({
            id: String(party.id),
            partyName: party.title,
            host: party.host_name || "主辦人",
            store: party.store,
            time: party.party_time,
            mealType: party.meal_type,
            maxMembers: Number(party.max_people) || 4,
            description: party.description || "尚未填寫飯局介紹。",
            members: [],
            isMine: currentUserId !== null && hostId === currentUserId,
            isCanceled: party.status === "cancelled",
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
            avatar: "",
            department: member.department || "",
        }));

        if (!frontendParty.members.length) {
            frontendParty.members = [
                {
                    id: String(party.host_id),
                    name: party.host_name || "主辦人",
                    role: "主辦人",
                    avatar: "",
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
        const maxMembers = Math.max(1, Number(party.maxMembers) || 4);
        const members = Array.isArray(party.members) ? party.members : [];

        return {
            id: party.id || `party-${Date.now()}`,
            partyName: party.partyName || "飯局名稱",
            host: party.host || "約飯人 先生/小姐",
            store: party.store || "店家名稱",
            time: party.time || "時間",
            mealType: inferMealType(party),
            maxMembers,
            description: party.description || "尚未填寫飯局介紹。",
            members: members.length ? members : [{ id: `host-${party.id || Date.now()}`, name: party.host || "約飯人 先生/小姐", role: "主辦人" }],
            isMine: party.isMine === true,
            isCanceled: party.isCanceled === true || isPartyCanceled(party.id),
            canceledAt: party.canceledAt || "",
            createdAt: party.createdAt || new Date().toISOString(),
        };
    }

    function getPartyDataFromCard(card) {
        return normalizeParty({
            id: card.dataset.partyId || card.dataset.id,
            partyName: card.dataset.partyName || "飯局名稱",
            host: card.dataset.host || "約飯人 先生/小姐",
            store: card.dataset.store || "店家名稱",
            time: card.dataset.time || "時間",
            mealType: card.dataset.mealType || "",
            maxMembers: card.dataset.maxMembers || 4,
            description: card.dataset.description || "尚未填寫飯局介紹。",
            members: parseMembersFromCard(card),
            isMine: card.dataset.source === "mine",
            isCanceled: card.dataset.canceled === "true",
            canceledAt: card.dataset.canceledAt || "",
        });
    }

    function getPartyDataFromForm() {
        const profile = loadProfileData();
        const hostName = profile.name || currentUser?.name || currentUser?.account || "約飯人 先生/小姐";

        const partyId = `party-${Date.now()}`;
        const hostMember = getCurrentMember("主辦人");
        hostMember.name = $("#create-host")?.value.trim() || hostName;

        return normalizeParty({
            id: partyId,
            partyName: $("#create-party-name")?.value.trim() || "飯局名稱",
            host: hostMember.name,
            store: $("#create-store")?.value.trim() || "店家名稱",
            time: $("#create-time")?.value.trim() || "時間",
            mealType: $("#create-meal-type")?.value || "午餐",
            maxMembers: $("#create-max-members")?.value.trim() || 4,
            description: $("#create-description")?.value.trim() || "尚未填寫飯局介紹。",
            members: [hostMember],
            isMine: true,
            createdAt: new Date().toISOString(),
        });
    }

    //建立飯局用函式
    function getBackendPartyDataFromForm() {
        return {
            title: $("#create-party-name")?.value.trim() || "",
            hostId: currentUser?.id,
            store: $("#create-store")?.value.trim() || "",
            mealType: $("#create-meal-type")?.value || "午餐",
            partyTime: $("#create-time")?.value || "",
            maxPeople: Number($("#create-max-members")?.value || 0),
            description: $("#create-description")?.value.trim() || "",
        };
    }

    //表單驗證函式
    function validateBackendPartyData(partyData) {
        if (!partyData.title) return "請輸入飯局名稱";
        if (!partyData.hostId) return "請先登入後再建立飯局";
        if (!partyData.store) return "請輸入店家名稱";
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

    function deleteCanceledPartyRecord(partyId) {
        if (!partyId) return;
        if (!confirm("確定要刪除這筆已取消飯局紀錄嗎？刪除後首頁與聊天室列表將不再顯示。")) return;

        markPartyDeleted(partyId);
        removePartyFromStorage(partyId);

        if (currentParty?.id === partyId) currentParty = null;
        if (currentChatPartyId === partyId) closeChatRoom();

        renderHomeParties();
        renderChatRoomList();
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
            id: currentUser?.account || "guest-user",
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
        const userId = currentUser?.account || "guest-user";
        return (party.members || []).some((member) => member.id === userId);
    }

    function getPartyPeopleText(party) {
        return `${(party.members || []).length} / ${party.maxMembers || 4} 人`;
    }

    // 依照飯局人數與目前使用者身份，回傳卡片與詳情頁要顯示的狀態。
    // 狀態規則：
    // 1. 我建立的飯局：我是主辦人，不能再 join。
    // 2. 我已加入的飯局：已加入。
    // 3. 人數達上限：已額滿。
    // 4. 其他可加入飯局：招募中。
    function getPartyStatus(party) {
        const normalizedParty = normalizeParty(party);
        const userId = currentUser?.account || "guest-user";
        const currentMember = (normalizedParty.members || []).find((member) => member.id === userId);

        if (normalizedParty.isCanceled === true) {
            return { text: "已取消", key: "canceled" };
        }

        if (normalizedParty.isMine === true || currentMember?.role === "主辦人") {
            return { text: "我是主辦人", key: "owner" };
        }

        if (currentMember) {
            return { text: "已加入", key: "joined" };
        }

        if ((normalizedParty.members || []).length >= normalizedParty.maxMembers) {
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
            "party-status--canceled"
        );
        element.classList.add(`party-status--${status.key}`);
    }

    async function joinCurrentParty() {
        if (!currentParty) return null;

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
            const isFull = party.members.length >= party.maxMembers;

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
        if (!party || !isLoggedIn()) return false;

        const userId = currentUser?.account || "guest-user";
        const member = (party.members || []).find((item) => item.id === userId);

        return Boolean(member && member.role !== "主辦人" && party.isMine !== true);
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

            const userId = currentUser?.account || "guest-user";
            const leavingMember = (party.members || []).find((member) => member.id === userId);

            party.members = party.members.filter((member) => member.id !== userId);
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
        if (!party || !isLoggedIn()) return false;
        const normalizedParty = normalizeParty(party);
        const userId = currentUser?.account || "guest-user";
        const currentMember = (normalizedParty.members || []).find((member) => member.id === userId);
        return (normalizedParty.isMine === true || currentMember?.role === "主辦人") && normalizedParty.isCanceled !== true;
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

    function updateJoinedActionButtons(party) {
        const status = getPartyStatus(party);

        if (partyLeaveBtn) {
            partyLeaveBtn.hidden = status.key === "canceled" || !canCurrentUserLeaveParty(party);
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
            partyRateBtn.disabled = status.key === "canceled" || !ended || reviewed;
            partyRateBtn.textContent = reviewed ? "已評價" : ended ? "評價" : "尚未結束";
            partyRateBtn.title = reviewed ? "同一場飯局只能評價一次" : ended ? "可以評價本場飯局成員" : getPartyEndHint(party);
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
                img.src = member.avatar;
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

    function createPartyCard(party, isDefault = false) {
        const card = document.createElement("article");
        card.className = "party-card party-card--mine";
        card.role = "button";
        card.tabIndex = 0;
        card.setAttribute("aria-label", `查看 ${party.partyName || "飯局"} 詳情`);
        const normalizedParty = normalizeParty(party);
        card.dataset.partyId = normalizedParty.id;
        card.dataset.partyName = normalizedParty.partyName;
        card.dataset.host = normalizedParty.host;
        card.dataset.store = normalizedParty.store;
        card.dataset.time = normalizedParty.time;
        card.dataset.mealType = normalizedParty.mealType;
        card.dataset.maxMembers = String(normalizedParty.maxMembers);
        card.dataset.description = normalizedParty.description;
        card.dataset.canceled = normalizedParty.isCanceled ? "true" : "false";
        card.dataset.canceledAt = normalizedParty.canceledAt || "";
        card.dataset.members = JSON.stringify(normalizedParty.members);
        card.dataset.source = "mine";

        const thumb = document.createElement("div");
        thumb.className = "party-card-thumb";
        thumb.setAttribute("aria-hidden", "true");

        const body = document.createElement("div");
        body.className = "party-card-body";

        const grid = document.createElement("div");
        grid.className = "party-card-grid";

        const fields = [
            { text: normalizedParty.partyName, className: "party-label" },
            { text: normalizedParty.host, className: "party-label party-label--right" },
            { text: normalizedParty.store, className: "party-label" },
            { text: normalizedParty.time, className: "party-label party-label--right" },
            { text: normalizedParty.mealType, className: "party-label party-label--meal" },
            { text: getPartyPeopleText(normalizedParty), className: "party-label party-label--people" },
        ];

        fields.forEach((field) => {
            const span = document.createElement("span");
            span.className = field.className;
            span.textContent = field.text;
            grid.appendChild(span);
        });


        const status = getPartyStatus(normalizedParty);
        const statusBadge = document.createElement("span");
        statusBadge.className = "party-card-status";
        setStatusClass(statusBadge, status);
        grid.appendChild(statusBadge);


        body.appendChild(grid);
        card.append(thumb, body);

        bindPartyCard(card, { allowJoin: true });
        return card;
    }

    function getHomeFilterState() {
        return {
            keyword: (searchInput?.value || "").trim().toLowerCase(),
            mealType: filterLabel?.textContent.trim() || "全部",
            availableOnly: availableOnlyFilter?.checked === true,
        };
    }

    function isPartyAvailable(party) {
        const normalizedParty = normalizeParty(party);
        return normalizedParty.isCanceled !== true && normalizedParty.members.length < normalizedParty.maxMembers;
    }

    function matchesPartyFilters(party) {
        const normalizedParty = normalizeParty(party);
        const filter = getHomeFilterState();

        if (filter.keyword) {
            const targetText = `${normalizedParty.partyName} ${normalizedParty.host} ${normalizedParty.store}`.toLowerCase();
            if (!targetText.includes(filter.keyword)) return false;
        }

        if (filter.mealType && filter.mealType !== "全部" && normalizedParty.mealType !== filter.mealType) {
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

    function renderMyParties() {
        if (!myPartyList) return;

        myPartyList.innerHTML = "";

        const savedParties = loadMyParties();
        const backendMyParties = backendParties.filter((party) => party.isMine);

        const sourceParties = backendParties.length > 0
            ? backendMyParties
            : savedParties.map(normalizeParty);

        const allParties = sourceParties.filter((party) => !isPartyDeleted(party.id));
        const filteredParties = allParties.filter(matchesPartyFilters);

        visibleMyPartyCount = filteredParties.length;

        filteredParties.forEach((party) => {
            myPartyList.appendChild(createPartyCard(party, party.id === DEFAULT_MY_PARTY.id));
        });

        if (myPartyEmpty) {
            myPartyEmpty.hidden = filteredParties.length > 0;
            myPartyEmpty.textContent = allParties.length > 0
                ? "我的飯局沒有符合條件的飯局。"
                : "目前尚未建立飯局。";
        }

        if (myPartiesSection) myPartiesSection.hidden = false;
        updateHomeNoResult();
    }

    async function loadBackendParties() {
        try {
            const result = await api.getParties();
            backendParties = (result.parties || []).map(mapBackendPartyToFrontend);
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
        updateHostPreview();

        const status = getPartyStatus(currentParty);

        if (partyJoinBtn) {
            partyJoinBtn.hidden = !allowJoinFlow;
            partyJoinBtn.disabled = false;

            if (allowJoinFlow) {
                if (status.key === "owner") {
                    partyJoinBtn.textContent = "管理飯局";
                    partyJoinBtn.disabled = false;
                } else if (status.key === "joined") {
                    partyJoinBtn.textContent = "查看成員";
                } else if (status.key === "canceled") {
                    partyJoinBtn.textContent = "已取消";
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
            partyDetailDeleteBtn.hidden = status.key !== "canceled";
        }

        switchView("partyDetail");
    }

    function openJoinedParty() {
        if (!currentParty) return;

        currentParty = normalizeParty(currentParty);
        fillPartyFields(joinedFields, currentParty);
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
    function prepareOtherPartyCard() {
        if (!otherPartyCard) return;

        const backendOtherParties = backendParties.filter((party) => !party.isMine);
        const backendOtherParty = backendOtherParties[0] || null;

        const party =
            (backendOtherParty ? getJoinedParty(backendOtherParty.id) || backendOtherParty : null) ||
            getJoinedParty(otherPartyCard.dataset.partyId || "other-demo-party") ||
            getPartyDataFromCard(otherPartyCard);

        if (isPartyDeleted(party.id)) {
            otherPartyCard.hidden = true;
            visibleOtherPartyCount = 0;
            if (otherPartyEmpty) {
                otherPartyEmpty.hidden = false;
                otherPartyEmpty.textContent = "其他飯局沒有符合條件的飯局。";
            }
            return;
        }

        otherPartyCard.dataset.partyId = party.id;
        otherPartyCard.dataset.partyName = party.partyName;
        otherPartyCard.dataset.host = party.host;
        otherPartyCard.dataset.store = party.store;
        otherPartyCard.dataset.time = party.time;
        otherPartyCard.dataset.mealType = party.mealType;
        otherPartyCard.dataset.maxMembers = String(party.maxMembers);
        otherPartyCard.dataset.description = party.description;
        otherPartyCard.dataset.canceled = party.isCanceled ? "true" : "false";
        otherPartyCard.dataset.canceledAt = party.canceledAt || "";
        otherPartyCard.dataset.members = JSON.stringify(party.members);
        otherPartyCard.dataset.source = "other";

        const shouldShow = matchesPartyFilters(party);
        otherPartyCard.hidden = !shouldShow;
        visibleOtherPartyCount = shouldShow ? 1 : 0;

        // 其他飯局搜尋或篩選後沒有結果時，顯示區塊內的小提示。
        if (otherPartyEmpty) {
            otherPartyEmpty.hidden = shouldShow;
            otherPartyEmpty.textContent = "其他飯局沒有符合條件的飯局。";
        }

        if (otherPartiesSection) otherPartiesSection.hidden = false;

        const grid = otherPartyCard.querySelector(".party-card-grid");
        let labels = $$(".party-label", otherPartyCard);

        // 其他飯局原本是固定 HTML 卡片，這裡補上「餐期」與「目前人數 / 人數上限」。
        // 如果舊版 HTML 沒有欄位，會自動新增 span，避免畫面少顯示資訊。
        let mealLabel = otherPartyCard.querySelector(".party-label--meal");
        if (!mealLabel && grid) {
            mealLabel = document.createElement("span");
            mealLabel.className = "party-label party-label--meal";
            grid.appendChild(mealLabel);
        }

        let peopleLabel = otherPartyCard.querySelector(".party-label--people");
        if (!peopleLabel && grid) {
            peopleLabel = document.createElement("span");
            peopleLabel.className = "party-label party-label--people";
            grid.appendChild(peopleLabel);
        }

        let statusBadge = otherPartyCard.querySelector(".party-card-status");
        if (!statusBadge && grid) {
            statusBadge = document.createElement("span");
            statusBadge.className = "party-card-status";
            grid.appendChild(statusBadge);
        }

        labels = $$(".party-label", otherPartyCard);
        const values = [party.partyName, party.host, party.store, party.time];
        labels.slice(0, 4).forEach((label, index) => {
            if (values[index]) label.textContent = values[index];
        });

        if (mealLabel) mealLabel.textContent = party.mealType;
        if (peopleLabel) peopleLabel.textContent = getPartyPeopleText(party);
        if (statusBadge) setStatusClass(statusBadge, getPartyStatus(party));

        const existingDeleteBtn = otherPartyCard.querySelector(".party-card-delete");
        if (existingDeleteBtn) existingDeleteBtn.remove();
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
        const savedMyParties = loadMyParties().map(normalizeParty);
        const joinedParties = Object.values(loadJoinedParties()).map(normalizeParty);
        const allParties = [normalizeParty(DEFAULT_MY_PARTY), ...savedMyParties, ...joinedParties];
        const uniqueParties = [];
        const usedIds = new Set();

        allParties.forEach((party) => {
            if (!party?.id || usedIds.has(party.id) || isPartyDeleted(party.id)) return;
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

    function openChatRoom(partyId) {
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

        if (chatRoomTitle) chatRoomTitle.textContent = party.partyName;
        if (chatRoomMeta) chatRoomMeta.textContent = `${party.host}｜${party.store}｜${party.time}`;
        if (chatRoomPanel) chatRoomPanel.hidden = false;

        renderChatMessages();
        chatInput?.focus();
    }

    function closeChatRoom() {
        currentChatPartyId = null;
        if (chatRoomPanel) chatRoomPanel.hidden = true;
        renderChatRoomList();
    }

    function renderChatMessages() {
        if (!chatMessageList || !currentChatPartyId) return;

        const messagesByParty = loadChatMessages();
        const messages = messagesByParty[currentChatPartyId] || [];
        const currentUserId = currentUser?.account || "guest-user";

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
            item.classList.toggle("chat-message--mine", message.senderId === currentUserId);

            const sender = document.createElement("p");
            sender.className = "chat-message-sender";
            sender.textContent = message.senderName || "使用者";

            const bubble = document.createElement("p");
            bubble.className = "chat-message-bubble";
            bubble.textContent = message.text || "";

            const time = document.createElement("p");
            time.className = "chat-message-time";
            time.textContent = formatMessageTime(message.createdAt);

            item.append(sender, bubble, time);
            chatMessageList.appendChild(item);
        });

        chatMessageList.scrollTop = chatMessageList.scrollHeight;
    }

    function sendChatMessage(text) {
        if (!currentChatPartyId) return;
        if (!text.trim()) return;

        const party = findAccessiblePartyById(currentChatPartyId);
        if (!party || !canUsePartyChat(party)) {
            alert("請先加入該飯局後才能傳送訊息");
            closeChatRoom();
            return;
        }

        const profile = loadProfileData();
        const messagesByParty = loadChatMessages();
        const partyMessages = messagesByParty[currentChatPartyId] || [];

        partyMessages.push({
            id: `msg-${Date.now()}`,
            partyId: currentChatPartyId,
            senderId: currentUser?.account || "guest-user",
            senderName: profile.name || currentUser?.name || currentUser?.account || "目前使用者",
            text: text.trim(),
            createdAt: new Date().toISOString(),
        });

        messagesByParty[currentChatPartyId] = partyMessages;
        saveChatMessages(messagesByParty);
        addNotification(
            "chat",
            "聊天室新訊息",
            `${profile.name || currentUser?.name || currentUser?.account || "使用者"} 在「${party.partyName}」傳送新訊息：${text.trim()}`,
            party.id
        );
        renderChatMessages();
        renderChatRoomList();
    }

    /* ======================================================
     * 9. 篩選選單功能
     * ====================================================== */
    function initFilterMenu() {
        if (!filterBtn || !filterMenu || !filterLabel) return;

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

        document.addEventListener("click", closeFilterMenu);
        filterMenu.addEventListener("click", (event) => event.stopPropagation());
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
        const userId = currentUser?.account || "guest-user";
        return (party?.members || []).filter((member) => member.id !== userId);
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

        if (ratingPartyTitle) ratingPartyTitle.textContent = `評價「${party.partyName}」`;

        if (!isPartyEnded(party)) {
            ratingMessage.textContent = getPartyEndHint(party);
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
                img.src = member.avatar;
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

    function submitRatings() {
        if (!currentParty) return;

        const party = normalizeParty(currentParty);
        if (!isPartyEnded(party)) {
            alert("飯局結束後才能評價。" + getPartyEndHint(party));
            return;
        }

        if (hasReviewedParty(party.id)) {
            alert("你已經評價過這場飯局，同一場飯局只能評價一次。 ");
            renderRatingPage();
            return;
        }

        const reviewerProfile = loadProfileData();
        const reviewerId = currentUser?.account || "guest-user";
        const reviewerName = reviewerProfile.name || currentUser?.name || currentUser?.account || "目前使用者";
        const items = $$(".rating-item", ratingList);

        if (!items.length) {
            alert("目前沒有其他成員可以評價。 ");
            return;
        }

        const newRatings = items.map((item) => {
            const group = $(".star-rating", item);
            const comment = $(".rating-comment", item);
            return {
                id: `rating-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                partyId: party.id,
                partyName: party.partyName,
                reviewerId,
                reviewerName,
                targetId: item.dataset.memberId,
                targetName: item.dataset.memberName,
                score: Number(group?.dataset.rating || 3),
                comment: comment?.value.trim() || "",
                createdAt: new Date().toISOString(),
            };
        });

        saveRatings([...loadRatings(), ...newRatings]);
        addNotification(
            "rating",
            "評價已送出",
            `你已完成「${party.partyName}」的成員評價。`,
            party.id
        );
        renderProfileRatingSummary();
        updateJoinedActionButtons(party);
        renderRatingPage();
        alert("評價已送出並儲存。 ");
        switchView("profile");
    }

    function openRatingPage() {
        if (!currentParty) return;
        const party = normalizeParty(currentParty);

        if (!isPartyEnded(party)) {
            alert("飯局結束後才能評價。" + getPartyEndHint(party));
            return;
        }

        if (hasReviewedParty(party.id)) {
            alert("你已經評價過這場飯局，同一場飯局只能評價一次。 ");
            return;
        }

        renderRatingPage();
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

                switchView(NAV_TO_VIEW[navKey] || "home");
            });
        });

        searchInput?.addEventListener("input", renderHomeParties);
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

        bindPartyCard(otherPartyCard, { allowJoin: true });

        partyJoinBtn?.addEventListener("click", async () => {
            if (!allowJoinFlow || !currentParty) return;

            const status = getPartyStatus(currentParty);
            if (status.key === "owner" || status.key === "joined") {
                openJoinedParty();
                return;
            }

            if (status.key === "canceled" || status.key === "full") return;

            const joinedParty = await joinCurrentParty();
            if (!joinedParty) return;
            prepareOtherPartyCard();
            renderChatRoomList();
            openJoinedParty();
        });

        partyDetailDeleteBtn?.addEventListener("click", () => {
            if (!currentParty || !currentParty.isCanceled) return;
            const partyId = currentParty.id;
            deleteCanceledPartyRecord(partyId);
            currentParty = null;
            switchView("home");
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
            updateHostPreview();

            if (partyJoinBtn) {
                const status = getPartyStatus(updatedParty);
                partyJoinBtn.hidden = false;
                partyJoinBtn.disabled = status.key === "full" || status.key === "canceled";
                partyJoinBtn.textContent = status.key === "full" ? "已額滿" : status.key === "canceled" ? "已取消" : "join";
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
        fab?.addEventListener("click", () => switchView("create"));

        createForm?.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (!isLoggedIn()) {
                alert("請先登入後再建立飯局");
                switchView("login");
                return;
            }

            const partyData = getBackendPartyDataFromForm();
            const errorMessage = validateBackendPartyData(partyData);

            if (errorMessage) {
                alert(errorMessage);
                return;
            }

            try {
                const result = await api.createParty(partyData);

                addNotification(
                    "create",
                    "飯局建立成功",
                    `你已成功建立「${partyData.title}」。`,
                    String(result.party?.id || "")
                );

                createForm.reset();

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

        profileSaveBtn?.addEventListener("click", () => {
            const profile = collectProfileData();
            saveProfileData(profile);
            renderProfileForm();
            setProfileEditMode(false);
            alert("個人資料已儲存");
        });

        profileAvatarFile?.addEventListener("change", () => {
            const file = profileAvatarFile.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.addEventListener("load", () => {
                const profile = collectProfileData();
                profile.avatar = String(reader.result || "");
                saveProfileData(profile);
                renderProfileForm();
            });
            reader.readAsDataURL(file);
        });

        chatForm?.addEventListener("submit", (event) => {
            event.preventDefault();
            const message = chatInput?.value || "";
            sendChatMessage(message);
            if (chatInput) chatInput.value = "";
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
        switchView("home");
    }

    init();
})();
