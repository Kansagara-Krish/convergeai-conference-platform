/* ============================================
   ADMIN PANEL FUNCTIONALITY
   ============================================ */

const AdminAuth = {
  isAdminSession() {
    if (typeof AppAuth !== "undefined" && AppAuth?.isAdminSession) {
      return AppAuth.isAdminSession();
    }

    const token = Storage?.getToken ? Storage.getToken() : null;
    const user = Storage?.getUser ? Storage.getUser() : null;
    return Boolean(token && user && user.role === "admin");
  },

  redirectToLogin() {
    if (typeof AppAuth !== "undefined" && AppAuth?.redirectToLogin) {
      AppAuth.redirectToLogin();
      return;
    }

    window.location.href = "../index.html";
  },
};

const AdminPageSkeletonLoader = {
  isBooting: true,
  pendingRequests: 0,
  patched: false,

  init() {
    const adminContent = document.querySelector(".admin-content");
    if (!adminContent) {
      this.isBooting = false;
      return;
    }

    adminContent.classList.add("page-skeleton-loading");
    this.patchApiRequests();

    setTimeout(() => {
      this.finishIfReady(true);
    }, 1800);
  },

  patchApiRequests() {
    if (this.patched || typeof API === "undefined") return;

    ["get", "post", "put", "delete"].forEach((methodName) => {
      const original = API[methodName];
      if (typeof original !== "function") return;

      API[methodName] = async (...args) => {
        this.onRequestStart();
        try {
          return await original.apply(API, args);
        } finally {
          this.onRequestEnd();
        }
      };
    });

    this.patched = true;
  },

  onRequestStart() {
    if (!this.isBooting) return;
    this.pendingRequests += 1;
  },

  onRequestEnd() {
    if (!this.isBooting) return;
    this.pendingRequests = Math.max(0, this.pendingRequests - 1);
    this.finishIfReady(false);
  },

  finishIfReady(force) {
    if (!this.isBooting) return;
    if (!force && this.pendingRequests > 0) return;

    const adminContent = document.querySelector(".admin-content");
    if (adminContent) {
      adminContent.classList.remove("page-skeleton-loading");
    }

    this.isBooting = false;
  },
};

class AdminPanel {
  constructor() {
    this.currentChatbotId = null;
    this.sidebarRefreshInterval = null;
    this.dashboardRefreshInterval = null;
    this.notificationRefreshInterval = null;
    this.dashboardNotifications = [];
    this.dashboardUnreadCount = 0;
    this.isBellPanelOpen = false;
    this.sidebarScrollTopKey = "admin_sidebar_scroll_top";
    this.pageScrollTopKey = "admin_page_scroll_top";
    this.recentChatbotsPerPage = 3;
    this.recentChatbotsPage = 1;
    this.recentChatbotsTotalPages = 1;
    this.dashboardPaginationBound = false;
    this.init();
  }

  init() {
    if (!AdminAuth.isAdminSession()) {
      NotificationManager.warning("Please login as admin to continue");
      AdminAuth.redirectToLogin();
      return;
    }

    this.setupSidebar();
    this.setupHeader();
    this.setupEventListeners();
    this.startSidebarBadgeRefresh();
    this.loadDashboardData();
    this.setupDashboardBell();
    this.startDashboardRefresh();
  }

  setupDashboardBell() {
    const bellBtn = DomUtils.$("#dashboard-bell-btn");
    const bellWrap = DomUtils.$("#dashboard-bell-wrap");
    const bellPanel = DomUtils.$("#dashboard-bell-panel");
    if (!bellBtn || !bellWrap || !bellPanel) return;

    setTimeout(() => {
      bellBtn.classList.remove("bell-ringing");
    }, 2300);

    bellBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      this.isBellPanelOpen = !this.isBellPanelOpen;
      bellPanel.classList.toggle("active", this.isBellPanelOpen);
      bellPanel.setAttribute("aria-hidden", String(!this.isBellPanelOpen));

      if (this.isBellPanelOpen) {
        await this.loadDashboardNotifications();
        if (this.dashboardUnreadCount > 0) {
          await this.markDashboardNotificationsRead();
        }
      }
    });

    document.addEventListener("click", (event) => {
      if (!bellWrap.contains(event.target)) {
        this.isBellPanelOpen = false;
        bellPanel.classList.remove("active");
        bellPanel.setAttribute("aria-hidden", "true");
      }
    });

    this.loadDashboardNotifications();
    this.startDashboardNotificationRefresh();
  }

  setupSidebar() {
    const sidebar = DomUtils.$(".admin-sidebar");
    if (!sidebar) return;

    // Active menu item based on current page
    const currentPage =
      window.location.pathname.split("/").pop() || "dashboard.html";
    const menuItems = DomUtils.$$(".menu-item");
    menuItems.forEach((item) => {
      const href = item.getAttribute("href");
      if (href && href.includes(currentPage)) {
        DomUtils.addClass(item, "active");
      }
    });

    // Sidebar toggle for mobile (keep existing logic for mobile overlay if needed,
    // but the new toggle works for desktop too)
    const hamburger = DomUtils.$(".hamburger-menu");
    if (hamburger) {
      hamburger.addEventListener("click", () => {
        DomUtils.toggleClass(sidebar, "active");
      });
    }

    // Close sidebar when menu item is clicked (only on mobile)
    menuItems.forEach((item) => {
      item.addEventListener("click", () => {
        this.saveScrollPositions(sidebar);
        if (window.innerWidth < 1024) {
          DomUtils.removeClass(sidebar, "active");
        }
      });
    });

    this.restoreScrollPositions(sidebar);
    this.bindScrollPersistence(sidebar);
    this.resetSidebarBadges();
  }

  bindScrollPersistence(sidebar) {
    const persistScroll = () => this.saveScrollPositions(sidebar);

    sidebar.addEventListener("scroll", persistScroll, { passive: true });
    window.addEventListener("scroll", persistScroll, { passive: true });
    window.addEventListener("beforeunload", persistScroll);
  }

  saveScrollPositions(sidebar) {
    if (sidebar) {
      sessionStorage.setItem(
        this.sidebarScrollTopKey,
        String(sidebar.scrollTop),
      );
    }

    const pageTop =
      window.scrollY ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;
    sessionStorage.setItem(this.pageScrollTopKey, String(pageTop));
  }

  restoreScrollPositions(sidebar) {
    const savedSidebarTop = Number.parseInt(
      sessionStorage.getItem(this.sidebarScrollTopKey) || "0",
      10,
    );

    if (sidebar && Number.isFinite(savedSidebarTop)) {
      sidebar.scrollTop = Math.max(savedSidebarTop, 0);
    }

    const savedPageTop = Number.parseInt(
      sessionStorage.getItem(this.pageScrollTopKey) || "0",
      10,
    );

    if (Number.isFinite(savedPageTop) && savedPageTop > 0) {
      requestAnimationFrame(() => {
        window.scrollTo(0, savedPageTop);
      });
    }
  }

  resetSidebarBadges() {
    const chatbotBadge = document.querySelector(
      '.sidebar-menu a[href="chatbot-list.html"] .menu-badge',
    );
    const usersBadge = document.querySelector(
      '.sidebar-menu a[href="user-management.html"] .menu-badge',
    );

    [chatbotBadge, usersBadge].forEach((badge) => {
      if (!badge) return;
      badge.textContent = "";
      badge.style.display = "none";
    });
  }

  setSidebarBadge(selector, value) {
    const badge = document.querySelector(selector);
    if (!badge) return;

    const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
    badge.textContent = safeValue;
    badge.style.display = safeValue > 0 ? "inline-block" : "none";
  }

  updateSidebarBadges(stats) {
    if (!stats) return;
  }

  updateDashboardBell(unreadCount) {
    const dot = DomUtils.$("#dashboard-bell-dot");
    if (!dot) return;
    const safeUnreadCount = Number.isFinite(Number(unreadCount))
      ? Number(unreadCount)
      : 0;
    if (safeUnreadCount > 0) {
      dot.classList.remove("hidden");
      return;
    }
    dot.classList.add("hidden");
  }

  startDashboardNotificationRefresh() {
    if (this.notificationRefreshInterval) {
      clearInterval(this.notificationRefreshInterval);
    }

    this.notificationRefreshInterval = setInterval(() => {
      this.loadDashboardNotifications();
    }, 30000);

    window.addEventListener("beforeunload", () => {
      if (this.notificationRefreshInterval) {
        clearInterval(this.notificationRefreshInterval);
      }
    });
  }

  async loadDashboardNotifications() {
    const bellList = DomUtils.$("#dashboard-bell-list");
    if (!bellList) return;

    try {
      const response = await API.get("/api/admin/notifications?limit=50");
      this.dashboardNotifications = Array.isArray(response?.data)
        ? response.data
        : [];
      this.dashboardUnreadCount = Number.isFinite(
        Number(response?.unread_count),
      )
        ? Number(response.unread_count)
        : 0;

      this.updateDashboardBell(this.dashboardUnreadCount);
      this.renderDashboardNotifications();
    } catch (error) {
      console.error("Error loading notifications:", error);
      bellList.innerHTML =
        '<div class="dashboard-bell-empty">Failed to load notifications.</div>';
    }
  }

  renderDashboardNotifications() {
    const bellList = DomUtils.$("#dashboard-bell-list");
    if (!bellList) return;

    if (
      !Array.isArray(this.dashboardNotifications) ||
      this.dashboardNotifications.length === 0
    ) {
      bellList.innerHTML =
        '<div class="dashboard-bell-empty">No notifications in the last 7 days.</div>';
      return;
    }

    bellList.innerHTML = this.dashboardNotifications
      .map((item) => {
        const unreadClass = item.is_read ? "" : " unread";
        const title = this.escapeHtml(item.title || "Notification");
        const message = this.escapeHtml(item.message || "");
        const createdAt = this.formatNotificationTime(item.created_at);
        return `
          <div class="dashboard-bell-item${unreadClass}">
            <div class="dashboard-bell-item-title">${title}</div>
            <div class="dashboard-bell-item-message">${message}</div>
            <div class="dashboard-bell-item-time">${createdAt}</div>
          </div>
        `;
      })
      .join("");
  }

  async markDashboardNotificationsRead() {
    try {
      await API.put("/api/admin/notifications/read", {});
      this.dashboardUnreadCount = 0;
      this.dashboardNotifications = this.dashboardNotifications.map((item) => ({
        ...item,
        is_read: true,
      }));
      this.updateDashboardBell(0);
      this.renderDashboardNotifications();
    } catch (error) {
      console.error("Error marking notifications read:", error);
    }
  }

  formatNotificationTime(timestamp) {
    if (!timestamp) return "Just now";
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "Just now";
    return date.toLocaleString();
  }

  escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  async loadSidebarCounts() {
    try {
      const response = await API.get("/api/admin/dashboard/stats");
      this.updateSidebarBadges(response.data);
    } catch (error) {
      console.error("Error loading sidebar counts:", error);
    }
  }

  startDashboardRefresh() {
    // Refresh dashboard stats every 5 seconds
    setInterval(() => {
      const page = window.location.pathname;
      if (page.includes("dashboard.html") || page.endsWith("admin/")) {
        this.loadDashboardStats();
        this.loadRecentChatbots();
      }
    }, 5000);
  }

  startSidebarBadgeRefresh() {
    this.loadSidebarCounts();

    if (this.sidebarRefreshInterval) {
      clearInterval(this.sidebarRefreshInterval);
    }

    this.sidebarRefreshInterval = setInterval(() => {
      this.loadSidebarCounts();
    }, 30000);

    window.addEventListener("beforeunload", () => {
      if (this.sidebarRefreshInterval) {
        clearInterval(this.sidebarRefreshInterval);
      }
    });
  }

  startDashboardRefresh() {
    // Refresh dashboard stats every 5 seconds
    this.dashboardRefreshInterval = setInterval(() => {
      const page = window.location.pathname;
      if (page.includes("dashboard.html") || page.endsWith("admin/")) {
        this.loadDashboardStats();
        this.loadRecentChatbots();
      }
    }, 5000);

    window.addEventListener("beforeunload", () => {
      if (this.dashboardRefreshInterval) {
        clearInterval(this.dashboardRefreshInterval);
      }
    });
  }

  setupHeader() {
    // User dropdown menu
    const userBtn = DomUtils.$(".header-user-btn");
    const dropdown = DomUtils.$(".dropdown-menu");

    if (userBtn && dropdown) {
      userBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        DomUtils.toggleClass(dropdown, "active");
      });

      document.addEventListener("click", () => {
        DomUtils.removeClass(dropdown, "active");
      });
    }

    // Logout handler
    const logoutBtns = DomUtils.$$('[data-action="logout"]');
    if (logoutBtns) {
      logoutBtns.forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          this.logout();
        });
      });
    }
  }

  setupEventListeners() {
    // Delete confirmation
    const deleteButtons = DomUtils.$$('[data-action="delete"]');
    deleteButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const chatbotName = btn.dataset.name || "item";
        ModalManager.confirm(
          `Are you sure you want to delete "${chatbotName}"? This action cannot be undone.`,
          () => this.deleteChatbot(btn.dataset.id),
        );
      });
    });
  }

  async loadDashboardData() {
    const page = window.location.pathname;
    if (page.includes("dashboard.html") || page.endsWith("admin/")) {
      this.setDashboardSectionsLoading(true);
      try {
        await Promise.all([
          this.loadDashboardStats(),
          this.loadRecentChatbots(),
        ]);
      } finally {
        this.setDashboardSectionsLoading(false);
      }
    }
  }

  setDashboardSectionsLoading(isLoading) {
    const targets = ["#quick-actions-card", "#recent-chatbots-card"];
    targets.forEach((selector) => {
      const node = DomUtils.$(selector);
      if (!node) return;
      node.classList.toggle("dashboard-section-loading", Boolean(isLoading));
    });
  }

  async loadDashboardStats() {
    this.setDashboardLoading(true);
    try {
      const response = await API.get("/api/admin/dashboard/stats");
      const stats = response.data;
      this.updateSidebarBadges(stats);

      // Update stat cards
      this.updateStatCard("total-chatbots", stats.total_chatbots);
      this.updateStatCard("total-users", stats.total_users);
      this.updateStatCard("active-events", stats.active_chatbots);
      this.updateStatCard("upcoming-events", stats.upcoming_events);

      // Update other stats if elements exist
      this.updateStatCard("active-chatbots", stats.active_chatbots);
      this.updateStatCard("total-guests", stats.total_guests);
    } catch (error) {
      console.error("Error loading dashboard:", error);
      NotificationManager.error("Failed to load dashboard stats");
    } finally {
      this.setDashboardLoading(false);
    }
  }

  setDashboardLoading(isLoading) {
    const statsGrid = DomUtils.$(".stats-grid");
    if (!statsGrid) return;
    statsGrid.classList.toggle("dashboard-loading", Boolean(isLoading));
  }

  updateStatCard(id, value) {
    const target = DomUtils.$(`#${id}`);
    if (!target) return;

    const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;

    if (target.classList.contains("stat-value")) {
      target.textContent = safeValue;
      target.classList.add("animate-fade-in");
      return;
    }

    const valueEl = target.querySelector(".stat-value");
    if (valueEl) {
      valueEl.textContent = safeValue;
      valueEl.classList.add("animate-fade-in");
    }
  }

  async loadRecentChatbots(page = 1) {
    const tbody = DomUtils.$("#dashboard-recent-chatbots");
    if (!tbody) return;

    const safePage = Number.isFinite(Number(page))
      ? Math.max(Number(page), 1)
      : 1;
    this.recentChatbotsPage = safePage;

    try {
      const response = await API.get(
        `/api/admin/chatbots?page=${safePage}&per_page=${this.recentChatbotsPerPage}`,
      );
      const chatbots = Array.isArray(response?.data) ? response.data : [];
      const totalPages = Number.isFinite(Number(response?.pages))
        ? Number(response.pages)
        : 1;
      this.recentChatbotsTotalPages = Math.max(totalPages, 1);

      if (chatbots.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="6" class="text-center">No chatbots found.</td></tr>';
        this.renderRecentChatbotsPagination();
        return;
      }

      tbody.innerHTML = chatbots
        .map(
          (bot) => `
            <tr>
              <td>${bot.name || "-"}</td>
              <td>${bot.event_name || "-"}</td>
              <td>${DateUtils.formatDateRange(bot.start_date, bot.end_date)}</td>
              <td><span class="status-indicator status-${bot.status}"><span class="status-dot"></span> ${bot.status}</span></td>
              <td>${bot.participants_count || 0}</td>
              <td>
                <div class="table-actions">
                  <a href="create-chatbot.html?id=${bot.id}" class="btn btn-sm btn-icon btn-secondary"><i class="fas fa-edit"></i></a>
                  <button class="btn btn-sm btn-icon btn-danger" data-action="delete" data-id="${bot.id}" data-name="${bot.name}"><i class="fas fa-trash"></i></button>
                </div>
              </td>
            </tr>
          `,
        )
        .join("");

      this.setupEventListeners();
      this.renderRecentChatbotsPagination();
    } catch (error) {
      console.error("Error loading recent chatbots:", error);
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center">Failed to load recent chatbots.</td></tr>';
      this.renderRecentChatbotsPagination(true);
    }
  }

  renderRecentChatbotsPagination(isError = false) {
    const container = DomUtils.$("#dashboard-chatbots-pagination");
    if (!container) return;

    if (isError || this.recentChatbotsTotalPages <= 1) {
      container.innerHTML = "";
      return;
    }

    const prevDisabled = this.recentChatbotsPage <= 1;
    const nextDisabled =
      this.recentChatbotsPage >= this.recentChatbotsTotalPages;

    const pageButtons = Array.from(
      { length: this.recentChatbotsTotalPages },
      (_, index) => {
        const pageNumber = index + 1;
        const isActive = pageNumber === this.recentChatbotsPage;
        return `
          <button class="page-btn${isActive ? " active" : ""}" data-page="${pageNumber}" aria-current="${isActive ? "page" : "false"}">
            ${pageNumber}
          </button>
        `;
      },
    ).join("");

    container.innerHTML = `
      <button class="page-btn" data-page="${this.recentChatbotsPage - 1}" ${
        prevDisabled ? "disabled" : ""
      } aria-label="Previous page">
        Prev
      </button>
      <div class="pagination-track" role="list">
        ${pageButtons}
      </div>
      <button class="page-btn" data-page="${this.recentChatbotsPage + 1}" ${
        nextDisabled ? "disabled" : ""
      } aria-label="Next page">
        Next
      </button>
    `;

    this.bindRecentChatbotsPagination();
  }

  bindRecentChatbotsPagination() {
    const container = DomUtils.$("#dashboard-chatbots-pagination");
    if (!container || this.dashboardPaginationBound) return;

    container.addEventListener("click", (event) => {
      const target = event.target.closest("button[data-page]");
      if (!target || target.disabled) return;

      const page = Number.parseInt(target.dataset.page || "1", 10);
      if (!Number.isFinite(page) || page === this.recentChatbotsPage) return;

      this.loadRecentChatbots(page);
    });

    this.dashboardPaginationBound = true;
  }

  async deleteChatbot(id) {
    try {
      // API call to delete
      await API.delete(`/api/admin/chatbots/${id}`);
      NotificationManager.success("Chatbot deleted successfully");
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error("Delete error:", error);
      NotificationManager.error("Failed to delete chatbot");
    }
  }

  logout() {
    Storage.clear();
    NotificationManager.success("Logging out...");
    setTimeout(() => {
      AdminAuth.redirectToLogin();
    }, 500);
  }
}

// ============================================
// CHATBOT FORM HANDLER
// ============================================

class ChatbotFormHandler {
  constructor() {
    this.form = DomUtils.$('form[data-form="chatbot"]');
    this.deletedGuestIds = [];
    this.defaultSinglePersonPrompt =
      "Generate a high-quality professional portrait image of the guest.\n\nDetails:\n- Focus on one person only.\n- Center the person in the frame.\n- Use a given background image\n- Maintain realistic facial features.\n- Proper lighting and sharp focus.\n- Business or formal attire.\n- No extra people in the frame.\n- No distortion or overlapping elements.\n- Professional conference vibe.";
    this.defaultMultiplePersonPrompt =
      "Generate a professional group image of multiple guests.\n\nRequirements:\n- Include all selected guests in one frame.\n- Arrange them naturally in a group.\n- Maintain correct proportions for each person.\n- Ensure no unnatural gaps between group members.\n- If people are close together, blend them naturally without visual separation.\n- Avoid cutting faces or overlapping distortions.\n- Use a conference or stage background.\n- Maintain uniform lighting and perspective.\n- Make the group appear cohesive and professionally composed.";
    if (this.form) {
      this.init();
    }
  }

  init() {
    this.form.addEventListener("submit", (e) => this.handleSubmit(e));
    this.setupFileUpload();
    this.setupRichEditor();
    this.setupRichEditor();
    this.setupDatePicker();
    this.setupToggleSwitch();
    this.setupDefaultPrompts();
    this.setupGuestBuilder();

    // Check for edit mode
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get("id");
    if (id) {
      this.loadChatbotData(id);
    }
  }

  async loadChatbotData(id) {
    try {
      const response = await API.get(`/api/chatbots/${id}`);
      const bot = response.data;

      // Switch to edit mode
      this.form.dataset.action = "edit";
      DomUtils.$(".header-title h1").textContent = "Edit Chatbot";
      const breadcrumbLast = DomUtils.$(".header-breadcrumb span:last-child");
      if (breadcrumbLast) {
        breadcrumbLast.textContent = "Edit Chatbot";
      }
      DomUtils.$('button[type="submit"]').textContent = "Save Changes";

      const backgroundInput = this.form.querySelector(
        '[name="background_image"]',
      );
      const guestListInput = this.form.querySelector('[name="guest_list"]');
      [backgroundInput, guestListInput].forEach((input) => {
        if (!input) return;
        input.removeAttribute("required");
        input.removeAttribute("data-rules");
      });

      // Add hidden ID field
      const idInput = document.createElement("input");
      idInput.type = "hidden";
      idInput.name = "id";
      idInput.value = bot.id;
      this.form.appendChild(idInput);

      // Populate fields
      const fields = {
        name: bot.name,
        event_name: bot.event_name,
        start_date: bot.start_date,
        end_date: bot.end_date,
        description: bot.description,
        single_person_prompt:
          bot.single_person_prompt || this.defaultSinglePersonPrompt,
        multiple_person_prompt:
          bot.multiple_person_prompt || this.defaultMultiplePersonPrompt,
      };

      for (const [name, value] of Object.entries(fields)) {
        const input = this.form.querySelector(`[name="${name}"]`);
        if (input) input.value = value;
      }

      this.populateGuests(Array.isArray(bot.guests) ? bot.guests : []);

      if (bot.active !== undefined) {
        const activeCheckbox = DomUtils.$("#chatbot-active");
        if (activeCheckbox) {
          activeCheckbox.checked = bot.active;
          this.updateToggleText(activeCheckbox);
        }
      }

      // Display current background image if exists
      if (bot.background_image) {
        this.displayCurrentImage(bot.background_image);
      }

      NotificationManager.info("Loaded chatbot details for editing");
    } catch (error) {
      console.error("Error loading chatbot:", error);
      NotificationManager.error("Failed to load chatbot details");
    }
  }

  updateToggleText(checkbox) {
    const label = checkbox.nextElementSibling;
    if (label && label.querySelector(".toggle-text")) {
      const textSpan = label.querySelector(".toggle-text");
      textSpan.textContent = checkbox.checked
        ? textSpan.dataset.active
        : textSpan.dataset.inactive;
    }
  }

  displayCurrentImage(imagePath) {
    const uploadArea = this.form.querySelector(
      '[name="background_image"]',
    ).parentElement;
    const fileUploadIcon = uploadArea.querySelector(".file-upload-icon");
    uploadArea.classList.add("current-image-state");

    // Clear existing content
    fileUploadIcon.innerHTML = "";

    // Create image preview
    const img = document.createElement("img");
    img.src = `${API_BASE_URL}/${imagePath}`; // Use API_BASE_URL to serve from backend
    img.alt = "Current background image";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    fileUploadIcon.appendChild(img);

    // Update text
    const fileUploadText = uploadArea.querySelector(".file-upload-text");
    if (fileUploadText) {
      fileUploadText.textContent = "Current image · click to replace";
      fileUploadText.style.color = "";
    }

    // Update hint with clear button
    const fileUploadHint = uploadArea.querySelector(".file-upload-hint");
    if (fileUploadHint) {
      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "upload-clear-btn";
      clearBtn.textContent = "Clear current image";
      clearBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.clearCurrentImage();
      });

      const hintRow = document.createElement("div");
      hintRow.className = "upload-hint-row";

      const helper = document.createElement("span");
      helper.textContent = "Recommended: 1920×1080 PNG or JPG";

      hintRow.appendChild(helper);
      hintRow.appendChild(clearBtn);
      fileUploadHint.innerHTML = "";
      fileUploadHint.appendChild(hintRow);
    }
  }

  clearCurrentImage() {
    const fileInput = this.form.querySelector('[name="background_image"]');
    const uploadArea = fileInput.parentElement;
    const fileUploadIcon = uploadArea.querySelector(".file-upload-icon");
    uploadArea.classList.remove("current-image-state");

    // Reset to default icon
    fileUploadIcon.innerHTML =
      '<span class="material-symbols-outlined">image</span>';
    fileUploadIcon.style.opacity = "1";

    // Reset text
    const fileUploadText = uploadArea.querySelector(".file-upload-text");
    if (fileUploadText) {
      fileUploadText.textContent = "Click or drag image here";
      fileUploadText.style.color = "";
    }

    // Reset hint
    const fileUploadHint = uploadArea.querySelector(".file-upload-hint");
    if (fileUploadHint) {
      fileUploadHint.innerHTML = "Recommended: 1920x1080px, PNG or JPG";
    }

    // Clear file input
    fileInput.value = "";

    NotificationManager.success("Image cleared. Select a new one to replace.");
  }

  setupFileUpload() {
    const uploadAreas = DomUtils.$$(".file-upload");
    uploadAreas.forEach((area) => {
      const input = area.querySelector('input[type="file"]');

      // Click to open file dialog
      area.addEventListener("click", () => {
        if (input) input.click();
      });

      // Drag and drop events
      area.addEventListener("dragover", (e) => {
        e.preventDefault();
        DomUtils.addClass(area, "dragover");
      });

      area.addEventListener("dragleave", () => {
        DomUtils.removeClass(area, "dragover");
      });

      area.addEventListener("drop", (e) => {
        e.preventDefault();
        DomUtils.removeClass(area, "dragover");
        const files = e.dataTransfer.files;
        this.handleFiles(files, area);
      });

      // File input change event (when user selects file via dialog)
      if (input) {
        input.addEventListener("change", () => {
          if (input.files.length > 0) {
            this.handleFiles(input.files, area);
          }
        });
      }
    });
  }

  handleFiles(files, area) {
    if (files.length === 0) return;
    const input = area.querySelector('input[type="file"]');
    if (!input) return;

    const allowMultiple = Boolean(input.multiple);
    const selectedFiles = allowMultiple ? Array.from(files) : [files[0]];
    const file = selectedFiles[0];

    // Update the input's files
    const dataTransfer = new DataTransfer();
    selectedFiles.forEach((selectedFile) =>
      dataTransfer.items.add(selectedFile),
    );
    input.files = dataTransfer.files;

    // Show file info
    const feedbackText = allowMultiple
      ? `${selectedFiles.length} files selected`
      : `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;

    // Update UI with file preview
    const fileUploadText = area.querySelector(".file-upload-text");
    if (fileUploadText) {
      fileUploadText.textContent = feedbackText;
      fileUploadText.style.color = "var(--accent-green, #4fc3f7)";
    }

    // For image uploads, show image preview
    if (
      input.name === "background_image" &&
      file &&
      file.type.startsWith("image/")
    ) {
      this.showImagePreview(file, area);
    }

    NotificationManager.success("File selection updated");
  }

  setupGuestBuilder() {
    const addGuestBtn = this.form.querySelector("#add-guest-btn");
    if (addGuestBtn) {
      addGuestBtn.addEventListener("click", () => {
        const row = this.addGuestRow();
        const nameInput = row?.querySelector(".manual-guest-name");
        if (row) {
          row.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        if (nameInput) {
          setTimeout(() => nameInput.focus(), 120);
        }
      });
    }

    const container = this.form.querySelector("#manual-guests-container");
    if (container && !container.children.length) {
      this.addGuestRow();
    }
  }

  addGuestRow(guest = {}) {
    const container = this.form.querySelector("#manual-guests-container");
    if (!container) return null;

    const row = document.createElement("div");
    row.className = "manual-guest-row";

    if (guest.id) {
      row.dataset.guestId = String(guest.id);
    }

    const fileInputId = `manual-guest-image-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    row.innerHTML = `
      <input type="text" class="manual-guest-name" placeholder="Guest name" value="${(guest.name || "").replace(/"/g, "&quot;")}" />
      <div class="manual-guest-file-wrap">
        <input type="file" id="${fileInputId}" class="manual-guest-image" accept="image/*" />
        <img class="manual-guest-thumb" alt="Guest image preview" />
        <button type="button" class="btn btn-secondary btn-sm manual-guest-file-btn">Choose Image</button>
        <span class="manual-guest-file-name">No image selected</span>
      </div>
      <button type="button" class="btn btn-ghost manual-guest-remove" title="Remove guest"><i class="fas fa-trash"></i></button>
    `;

    const imageInput = row.querySelector(".manual-guest-image");
    const imageBtn = row.querySelector(".manual-guest-file-btn");
    const fileName = row.querySelector(".manual-guest-file-name");
    const thumb = row.querySelector(".manual-guest-thumb");

    const setThumb = (src) => {
      if (!thumb) return;
      if (!src) {
        thumb.removeAttribute("src");
        thumb.style.display = "none";
        return;
      }
      thumb.src = src;
      thumb.style.display = "block";
    };

    const resolveUploadUrl = (path) => {
      const raw = String(path || "").trim();
      if (!raw) return "";
      if (/^https?:\/\//i.test(raw)) return raw;
      const normalized = raw.replace(/^\/+/, "");
      if (normalized.startsWith("uploads/")) {
        return `${API_BASE_URL}/${normalized}`;
      }
      return `${API_BASE_URL}/uploads/${normalized}`;
    };

    if (imageBtn && imageInput) {
      imageBtn.addEventListener("click", () => imageInput.click());
      imageInput.addEventListener("change", () => {
        const selected = imageInput.files?.[0];
        fileName.textContent = selected ? selected.name : "No image selected";
        if (selected) {
          setThumb(URL.createObjectURL(selected));
        } else if (guest.photo) {
          setThumb(resolveUploadUrl(guest.photo));
        } else {
          setThumb("");
        }
      });
    }

    const removeBtn = row.querySelector(".manual-guest-remove");
    removeBtn.addEventListener("click", () => {
      if (row.dataset.guestId) {
        this.deletedGuestIds.push(row.dataset.guestId);
      }
      row.remove();
    });

    if (guest.photo) {
      setThumb(resolveUploadUrl(guest.photo));
      const photoName = guest.photo.split("/").pop();
      if (photoName && fileName) {
        fileName.textContent = "Current image selected";
        fileName.title = photoName;
      }
      const info = document.createElement("small");
      info.className = "manual-guest-photo-info";
      info.textContent = "Current image available. Choose file to replace.";
      row.appendChild(info);
    } else {
      setThumb("");
    }

    container.appendChild(row);
    return row;
  }

  populateGuests(guests) {
    const container = this.form.querySelector("#manual-guests-container");
    if (!container) return;

    container.innerHTML = "";
    this.deletedGuestIds = [];

    if (!Array.isArray(guests) || guests.length === 0) {
      this.addGuestRow();
      return;
    }

    guests.forEach((guest) => this.addGuestRow(guest));
  }

  collectManualGuests(formData) {
    const rows = this.form.querySelectorAll(".manual-guest-row");
    const guests = [];

    rows.forEach((row, index) => {
      const nameInput = row.querySelector(".manual-guest-name");
      const imageInput = row.querySelector(".manual-guest-image");
      const name = String(nameInput?.value || "").trim();

      if (!name) return;

      const item = { name };
      if (row.dataset.guestId) {
        item.id = Number(row.dataset.guestId);
      }

      const file = imageInput?.files?.[0];
      if (file) {
        const fieldName = `manual_guest_photo_${index}`;
        formData.append(fieldName, file);
        item.photo_file_field = fieldName;
      }

      guests.push(item);
    });

    return guests;
  }

  showImagePreview(file, area) {
    area.classList.add("current-image-state");
    const reader = new FileReader();
    reader.onload = (e) => {
      const previewArea = area.querySelector(".file-upload-icon");
      if (previewArea) {
        // Create a small thumbnail preview
        const img = document.createElement("img");
        img.src = e.target.result;
        img.alt = "Selected background image";
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "cover";
        previewArea.innerHTML = "";
        previewArea.appendChild(img);
      }
    };
    reader.readAsDataURL(file);
  }

  setupToggleSwitch() {
    const activeCheckbox = DomUtils.$("#chatbot-active");
    if (activeCheckbox) {
      activeCheckbox.addEventListener("change", (e) => {
        this.updateToggleText(activeCheckbox);
      });
      // Set initial text
      this.updateToggleText(activeCheckbox);
    }
  }

  setupRichEditor() {
    const editor = DomUtils.$(".rich-editor");
    if (editor) {
      // Basic keyboard shortcuts
      editor.addEventListener("keydown", (e) => {
        if (e.ctrlKey || e.metaKey) {
          if (e.key === "b") {
            e.preventDefault();
            this.insertMarkdown(editor, "**", "**");
          }
          if (e.key === "i") {
            e.preventDefault();
            this.insertMarkdown(editor, "*", "*");
          }
        }
      });
    }
  }

  setupDefaultPrompts() {
    const singlePrompt = this.form.querySelector(
      '[name="single_person_prompt"]',
    );
    const multiplePrompt = this.form.querySelector(
      '[name="multiple_person_prompt"]',
    );

    if (singlePrompt && !singlePrompt.value.trim()) {
      singlePrompt.value = this.defaultSinglePersonPrompt;
    }

    if (multiplePrompt && !multiplePrompt.value.trim()) {
      multiplePrompt.value = this.defaultMultiplePersonPrompt;
    }
  }

  insertMarkdown(editor, before, after) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const text = editor.value;
    const selectedText = text.substring(start, end);
    editor.value =
      text.substring(0, start) +
      before +
      selectedText +
      after +
      text.substring(end);
    editor.focus();
  }

  setupDatePicker() {
    const dateInputs = DomUtils.$$('input[type="date"]');
    dateInputs.forEach((input) => {
      input.addEventListener("change", () => {
        const date = new Date(input.value);
        const daysUntil = DateUtils.daysUntil(date);
        const hint = document.createElement("small");
        hint.className = "text-muted mt-xs";
        hint.textContent =
          daysUntil > 0 ? `${daysUntil} days away` : "Event date has passed";
        const existing = input.parentElement.querySelector("small");
        if (existing) existing.remove();
        input.parentElement.appendChild(hint);
      });
    });
  }

  async handleSubmit(e) {
    e.preventDefault();

    const isEdit = this.form.dataset.action === "edit";

    if (!FormValidator.validate(this.form)) {
      NotificationManager.error("Please fill in all required fields");
      return;
    }

    if (!isEdit) {
      const backgroundInput = this.form.querySelector(
        '[name="background_image"]',
      );

      if (!backgroundInput?.files?.length) {
        NotificationManager.error("Background image is required");
        return;
      }
    }

    const formData = new FormData(this.form);

    const singlePersonPrompt = String(
      formData.get("single_person_prompt") || "",
    ).trim();
    const multiplePersonPrompt = String(
      formData.get("multiple_person_prompt") || "",
    ).trim();

    if (!singlePersonPrompt || !multiplePersonPrompt) {
      NotificationManager.error(
        "Single Person Prompt and Multiple Person Prompt cannot be empty",
      );
      return;
    }

    formData.set("single_person_prompt", singlePersonPrompt);
    formData.set("multiple_person_prompt", multiplePersonPrompt);

    const guestListInput = this.form.querySelector('[name="guest_list"]');
    const hasExcelGuestList = Boolean(guestListInput?.files?.length);

    const guestRows = this.form.querySelectorAll(".manual-guest-row");
    let hasValidManualGuest = false;

    for (const row of guestRows) {
      const nameInput = row.querySelector(".manual-guest-name");
      const imageInput = row.querySelector(".manual-guest-image");
      const name = String(nameInput?.value || "").trim();
      const hasImageFile = Boolean(imageInput?.files?.length);
      const hasExistingImage = Boolean(
        row.querySelector(".manual-guest-photo-info"),
      );
      const hasAnyInput = Boolean(name || hasImageFile);

      if (!hasAnyInput) continue;

      if (!name) {
        NotificationManager.error(
          "Guest name is required for manual guest entry",
        );
        return;
      }

      if (!hasImageFile && !hasExistingImage) {
        NotificationManager.error(
          "Guest image is required for manual guest entry",
        );
        return;
      }

      hasValidManualGuest = true;
    }

    if (!isEdit && !hasExcelGuestList && !hasValidManualGuest) {
      NotificationManager.error(
        "Add at least one guest with name and image, or upload a guest Excel file",
      );
      return;
    }

    const manualGuests = this.collectManualGuests(formData);
    formData.set("manual_guests", JSON.stringify(manualGuests));
    formData.set("deleted_guest_ids", JSON.stringify(this.deletedGuestIds));

    // Handle active status (checkbox value must be explicitly sent)
    const activeCheckbox = this.form.querySelector('[name="active"]');
    if (activeCheckbox) {
      formData.set("active", activeCheckbox.checked ? "1" : "0");
    }

    // Handle image clearing during edit mode
    if (isEdit) {
      const backgroundInput = this.form.querySelector(
        '[name="background_image"]',
      );
      // Check if image was cleared (selected for deletion)
      const uploadArea = backgroundInput.parentElement;
      const fileUploadIcon = uploadArea.querySelector(".file-upload-icon");
      const hasDefaultImageIcon = Boolean(
        fileUploadIcon?.querySelector(".material-symbols-outlined"),
      );

      // If icon shows emoji (cleared) and no files selected, mark for deletion
      if (hasDefaultImageIcon && !backgroundInput.files.length) {
        formData.append("clear_background_image", "1");
      }
    }

    // Disable submit button and show loader
    const submitBtn = this.form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i>' +
      (isEdit ? "Saving..." : "Creating...");
    submitBtn.style.opacity = "0.6";

    try {
      const chatbotId = formData.get("id");
      const endpoint = isEdit ? `/api/chatbots/${chatbotId}` : "/api/chatbots";

      const response = isEdit
        ? await API.put(endpoint, formData)
        : await API.post(endpoint, formData);

      NotificationManager.success(
        `Chatbot ${isEdit ? "updated" : "created"} successfully`,
      );
      setTimeout(
        () =>
          (window.location.href = `chatbot-list.html?msg=${isEdit ? "updated" : "created"}`),
        500,
      );
    } catch (error) {
      console.error("Form submission error:", error);
      NotificationManager.error(error.message || "Failed to save chatbot");

      // Re-enable button on error
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
      submitBtn.style.opacity = "1";
    }
  }
}

// ============================================
// IMPORT EXCEL HANDLER
// ============================================

class ImportExcelHandler {
  constructor() {
    this.form = DomUtils.$('form[data-form="import-excel"]');
    this.eventSelect = DomUtils.$("#event-select");
    this.roleSelect = DomUtils.$("#role-select");
    this.recentImportsBody = DomUtils.$("#recent-imports-body");
    this.recentImportsKey = "admin_recent_imports";
    this.maxRecentImports = 10;
    if (this.form) {
      this.init();
    }
  }

  init() {
    this.form.addEventListener("submit", (e) => this.handleSubmit(e));
    this.setupFileInput();
    this.loadEventOptions();
    this.loadRecentImports();
  }

  async loadEventOptions() {
    if (!this.eventSelect) return;

    try {
      const response = await API.get("/api/admin/chatbots?page=1&per_page=200");
      const chatbots = Array.isArray(response?.data) ? response.data : [];

      this.eventSelect.innerHTML =
        '<option value="">Select an event...</option>' +
        chatbots
          .map(
            (bot) =>
              `<option value="${bot.id}">${bot.event_name || bot.name || `Chatbot ${bot.id}`}</option>`,
          )
          .join("");
    } catch (error) {
      console.error("Failed to load event options:", error);
      this.eventSelect.innerHTML =
        '<option value="">Unable to load events</option>';
    }
  }

  setupFileInput() {
    const input = this.form.querySelector('input[type="file"]');
    if (!input) return;

    const uploadArea = input.closest(".file-upload");

    if (uploadArea) {
      uploadArea.addEventListener("click", () => input.click());

      uploadArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadArea.classList.add("dragover");
      });

      uploadArea.addEventListener("dragleave", () => {
        uploadArea.classList.remove("dragover");
      });

      uploadArea.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadArea.classList.remove("dragover");

        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;

        const transfer = new DataTransfer();
        transfer.items.add(files[0]);
        input.files = transfer.files;

        this.previewFile(input.files[0]);
      });
    }

    input.addEventListener("change", () => {
      this.previewFile(input.files[0]);
    });
  }

  async previewFile(file) {
    if (!file || !file.name.endsWith(".xlsx")) {
      NotificationManager.error("Please upload an Excel file (.xlsx)");
      return;
    }

    const countBox = DomUtils.$("#uploaded-user-count");
    const fileInput = this.form.querySelector('input[type="file"]');
    const uploadArea = fileInput?.closest(".file-upload");
    const uploadText = uploadArea?.querySelector(".file-upload-text");
    const uploadHint = uploadArea?.querySelector(".file-upload-hint");
    const uploadIcon = uploadArea?.querySelector(".file-upload-icon");

    if (uploadIcon) {
      uploadIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
      uploadIcon.style.color = "var(--accent-green)";
    }

    if (uploadText) {
      uploadText.textContent = file.name;
      uploadText.style.color = "var(--text-primary)";
      uploadText.style.fontWeight = "600";
    }

    if (uploadHint) {
      uploadHint.textContent = `Uploaded • Size: ${(file.size / 1024).toFixed(2)} KB • Click to change file`;
    }

    if (uploadArea) {
      uploadArea.classList.remove("dragover");
      uploadArea.style.borderColor = "var(--accent-green)";
      uploadArea.style.background = "rgba(34, 197, 94, 0.08)";
    }

    if (countBox) {
      countBox.style.display = "block";
      countBox.innerHTML =
        '<p><strong>Users:</strong> <span style="color: var(--accent-blue);">...</span></p>';
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await API.post("/api/admin/import/excel/preview", formData);
      const info = data?.preview || {};

      if (uploadHint) {
        uploadHint.textContent = `Uploaded • Size: ${(file.size / 1024).toFixed(2)} KB • Click to change file`;
      }

      if (countBox) {
        countBox.innerHTML = `<p><strong>Users:</strong> <span style="color: var(--accent-green);">${info.total_rows ?? 0}</span></p>`;
      }
    } catch (error) {
      if (uploadHint) {
        uploadHint.textContent =
          "File uploaded • Preview unavailable • You can still import";
      }

      if (countBox) {
        countBox.style.display = "block";
        countBox.innerHTML =
          '<p><strong>Users:</strong> <span style="color: var(--accent-orange);">Unavailable</span></p>';
      }
    }
  }

  async handleSubmit(e) {
    e.preventDefault();

    const file = this.form.querySelector('input[type="file"]').files[0];
    if (!file) {
      NotificationManager.error("Please select a file");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const selectedRole = this.roleSelect?.value || "user";
    const selectedEvent = this.eventSelect?.value || "";
    if (selectedRole) formData.append("default_role", selectedRole);
    if (selectedEvent) formData.append("event_id", selectedEvent);

    try {
      const data = await API.post("/api/admin/import/excel", formData);
      const skipped = Number.isFinite(Number(data.skipped))
        ? Number(data.skipped)
        : 0;

      NotificationManager.success(`Imported ${data.count} users successfully`);
      NotificationManager.info(
        `Credentials emails are being sent to ${data.count} users in background`,
      );
      this.showCredentials(data.credentials, skipped);
      this.appendRecentImportRow({
        fileName: file.name,
        count: data.count,
        eventName:
          this.eventSelect?.options?.[this.eventSelect.selectedIndex]?.text ||
          "-",
      });
    } catch (error) {
      console.error("Import error:", error);
      NotificationManager.error(error.message || "Failed to import file");
    }
  }

  appendRecentImportRow({ fileName, count, eventName }) {
    if (!this.recentImportsBody) return;

    this.storeRecentImport({
      fileName,
      count,
      eventName,
      createdAt: new Date().toISOString(),
    });

    const placeholder = this.recentImportsBody.querySelector("td[colspan='5']");
    if (placeholder) {
      this.recentImportsBody.innerHTML = "";
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${DateUtils.formatDate(new Date())}</td>
      <td>${eventName || "-"}</td>
      <td>${count}</td>
      <td>${fileName}</td>
      <td><span class="badge badge-success">Completed</span></td>
    `;

    this.recentImportsBody.prepend(row);
  }

  loadRecentImports() {
    if (!this.recentImportsBody) return;

    const stored = this.readRecentImports();
    if (!stored.length) return;

    this.recentImportsBody.innerHTML = "";
    stored.forEach((item) => this.renderRecentImportRow(item));
  }

  renderRecentImportRow(item) {
    if (!this.recentImportsBody) return;

    const row = document.createElement("tr");
    const createdAt = item.createdAt ? new Date(item.createdAt) : new Date();
    row.innerHTML = `
      <td>${DateUtils.formatDate(createdAt)}</td>
      <td>${item.eventName || "-"}</td>
      <td>${item.count || 0}</td>
      <td>${item.fileName || "-"}</td>
      <td><span class="badge badge-success">Completed</span></td>
    `;
    this.recentImportsBody.appendChild(row);
  }

  storeRecentImport(entry) {
    const stored = this.readRecentImports();
    stored.unshift(entry);
    const trimmed = stored.slice(0, this.maxRecentImports);
    localStorage.setItem(this.recentImportsKey, JSON.stringify(trimmed));
  }

  readRecentImports() {
    try {
      const raw = localStorage.getItem(this.recentImportsKey);
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  showCredentials(credentials, skipped = 0) {
    const html = `
      <h3>Import Successful!</h3>
      <p>${credentials.length} users created with credentials:</p>
      ${skipped > 0 ? `<p style="color: var(--accent-orange);">${skipped} rows were skipped (duplicates or invalid data).</p>` : ""}
      <div class="table-container" style="max-height: 400px; overflow-y: auto;">
        <table class="table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Password</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            ${credentials
              .map(
                (cred) => `
              <tr>
                <td>${cred.username}</td>
                <td style="font-family: var(--font-mono); font-size: 0.85rem;">${cred.password}</td>
                <td>${cred.email}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    ModalManager.create(
      "Import Results",
      html,
      [
        {
          id: "close",
          label: "Close",
          class: "btn-secondary",
        },
      ],
      { width: "800px" },
    );
  }
}

// ============================================
// USER MANAGEMENT
// ============================================

class UserManagementHandler {
  constructor() {
    this.table = DomUtils.$('table[data-table="users"]');
    this.roleFilter = DomUtils.$("#user-role-filter");
    this.statusFilter = DomUtils.$("#user-status-filter");
    this.searchInput = DomUtils.$("#user-search");
    this.addSingleUserBtn = DomUtils.$("#add-single-user-btn");
    this.paginationContainer = DomUtils.$("#users-pagination-container");
    this.paginationSummary = DomUtils.$("#users-pagination-summary");
    this.paginationButtons = DomUtils.$("#users-pagination-buttons");
    this.searchDebounceTimer = null;
    this.currentPage = 1;
    this.perPage = 7;
    if (this.table) {
      this.init();
    }
  }

  init() {
    this.setupActions();
    this.setupFilters();
    this.setupPaginationActions();
    this.loadUserStats();
    this.loadUsers();
  }

  async loadUserStats() {
    try {
      const response = await API.get("/api/admin/dashboard/stats");
      const stats = response.data || {};

      const totalUsers = Number.isFinite(Number(stats.total_users))
        ? Number(stats.total_users)
        : 0;
      const activeUsers = Number.isFinite(Number(stats.active_users))
        ? Number(stats.active_users)
        : 0;
      const inactiveUsers = Math.max(totalUsers - activeUsers, 0);

      this.updateStatValue("users-total", totalUsers);
      this.updateStatValue("users-active", activeUsers);
      this.updateStatValue("users-inactive", inactiveUsers);

      if (Number.isFinite(Number(stats.new_users_this_month))) {
        this.updateStatValue(
          "users-new-month",
          Number(stats.new_users_this_month),
        );
      }
    } catch (error) {
      console.error("Error loading user stats:", error);
    }
  }

  updateStatValue(id, value) {
    const el = DomUtils.$(`#${id}`);
    if (!el) return;
    el.textContent = Number.isFinite(Number(value)) ? Number(value) : 0;
  }

  setupActions() {
    if (this.addSingleUserBtn) {
      this.addSingleUserBtn.addEventListener("click", () =>
        this.openAddSingleUserModal(),
      );
    }

    this.table.addEventListener("click", (event) => {
      const resetBtn = event.target.closest('[data-action="reset-password"]');
      if (resetBtn) {
        this.resetPassword(resetBtn.dataset.userId);
        return;
      }

      const toggleBtn = event.target.closest('[data-action="toggle-user"]');
      if (toggleBtn) {
        const isActive = toggleBtn.dataset.userActive === "true";
        this.toggleUser(toggleBtn.dataset.userId, isActive);
        return;
      }

      const deleteBtn = event.target.closest('[data-action="delete-user"]');
      if (deleteBtn) {
        this.deleteUser(deleteBtn.dataset.userId, deleteBtn.dataset.userName);
      }
    });
  }

  async openAddSingleUserModal() {
    const content = `
      <form id="single-user-form" class="single-user-form">
        <!-- Account Information Section -->
        <div style="padding-bottom: 16px; border-bottom: 2px solid var(--border-color); margin-bottom: 16px;">
          <h4 style="margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px; color: var(--accent-blue);">
            <i class="fas fa-user-circle"></i> Account Information
          </h4>
          <div class="form-group">
            <label for="single-user-name">Full Name <span style="color: var(--accent-red);">*</span></label>
            <input type="text" id="single-user-name" name="name" placeholder="e.g., John Doe" required />
          </div>
          <div class="form-group">
            <label for="single-user-email">Email <span style="color: var(--accent-red);">*</span></label>
            <input type="email" id="single-user-email" name="email" placeholder="user@example.com" required />
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label for="single-user-username">Username <span style="color: var(--accent-red);">*</span></label>
              <input type="text" id="single-user-username" name="username" placeholder="username" required />
            </div>
            <div class="form-group">
              <label for="single-user-password">Password <span style="color: var(--accent-red);">*</span></label>
              <input type="text" id="single-user-password" name="password" placeholder="temporary password" required />
            </div>
          </div>
        </div>

        <!-- Role & Status Section -->
        <div style="padding-bottom: 16px; border-bottom: 2px solid var(--border-color); margin-bottom: 16px;">
          <h4 style="margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px; color: var(--accent-blue);">
            <i class="fas fa-shield-alt"></i> Role & Status
          </h4>
          <div class="single-user-role-row" style="display: grid; grid-template-columns: minmax(280px, 1fr) auto; gap: 16px; align-items: end;">
            <div class="form-group">
              <label for="single-user-role">User Role</label>
              <select id="single-user-role" name="role" class="single-user-role-select" style="width: 100%;">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div class="form-group single-user-active-wrap" style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
              <div class="toggle-switch">
                <input type="checkbox" id="single-user-active" name="active" checked style="display: none;" />
                <label for="single-user-active" class="toggle-label" style="margin: 0;">
                  <span class="toggle-slider"></span>
                  <span class="toggle-text" data-active="Active" data-inactive="Inactive">Active</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Event Assignment Section -->
        <div style="padding-bottom: 16px;">
          <h4 style="margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px; color: var(--accent-blue);">
            <i class="fas fa-calendar-check"></i> Assign to Active Events
          </h4>
          <select id="single-user-chatbots" name="chatbots" multiple class="single-user-events-select" style="width: 100%; height: 160px; padding: 10px; border-radius: 8px; border: 2px solid var(--border-color); background-color: var(--bg-secondary); color: var(--text-primary); font-size: 14px; cursor: pointer; font-family: inherit;">
            <option value="" disabled>Loading active events...</option>
          </select>
          <small style="color: var(--text-secondary); display: block; margin-top: 8px; font-style: italic;">
            <i class="fas fa-info-circle"></i> Select one or more events • Hold Ctrl/Cmd to multi-select
          </small>
        </div>

        <!-- Buttons -->
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; padding-top: 16px; border-top: 2px solid var(--border-color);">
          <button type="button" class="btn btn-secondary" id="single-user-cancel" style="padding: 10px 20px;">
            <i class="fas fa-times"></i> Cancel
          </button>
          <button type="submit" class="btn btn-primary" id="single-user-submit" style="padding: 10px 24px; background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));">
            <i class="fas fa-user-plus"></i> Create User
          </button>
        </div>
      </form>
    `;

    const modal = ModalManager.create("Add Single User", content, [], {
      width: "980px",
    });
    const form = modal.querySelector("#single-user-form");
    const cancelBtn = modal.querySelector("#single-user-cancel");
    const chatbotsSelect = modal.querySelector("#single-user-chatbots");
    const activeToggle = modal.querySelector("#single-user-active");
    const activeToggleText = modal.querySelector(".toggle-text");

    if (activeToggle && activeToggleText) {
      const updateSingleUserActiveText = () => {
        activeToggleText.textContent = activeToggle.checked
          ? activeToggleText.dataset.active
          : activeToggleText.dataset.inactive;
      };

      updateSingleUserActiveText();
      activeToggle.addEventListener("change", updateSingleUserActiveText);
    }

    // Load available chatbots
    try {
      const response = await API.get("/api/admin/chatbots");
      const allChatbots = response?.data || [];

      // Filter only active chatbots
      const activeChatbots = allChatbots.filter((c) => c.active);

      if (activeChatbots.length === 0) {
        chatbotsSelect.innerHTML =
          '<option value="" disabled>No active events available</option>';
      } else {
        // Sort by name
        activeChatbots.sort((a, b) =>
          (a.name || "").localeCompare(b.name || ""),
        );

        chatbotsSelect.innerHTML = activeChatbots
          .map(
            (chatbot) =>
              `<option value="${chatbot.id}">${chatbot.name} - ${chatbot.event_name}</option>`,
          )
          .join("");
      }
    } catch (error) {
      chatbotsSelect.innerHTML =
        '<option value="" disabled>Error loading events</option>';
      console.error("Failed to load chatbots:", error);
    }

    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => ModalManager.close(modal));
    }

    if (form) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        await this.submitSingleUser(form, modal);
      });
    }
  }

  async submitSingleUser(form, modal) {
    const elements = form.elements;

    // Get selected chatbot IDs from multi-select
    const chatbotsSelect = form.querySelector('[name="chatbots"]');
    const selectedChatbots = Array.from(chatbotsSelect.selectedOptions).map(
      (opt) => parseInt(opt.value),
    );

    const payload = {
      name: elements["name"].value.trim(),
      email: elements["email"].value.trim(),
      username: elements["username"].value.trim(),
      password: elements["password"].value,
      role: elements["role"].value,
      active: elements["active"].checked,
      chatbot_ids: selectedChatbots,
    };

    if (
      !payload.name ||
      !payload.email ||
      !payload.username ||
      !payload.password
    ) {
      NotificationManager.error("Please fill all required fields");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailPattern.test(payload.email)) {
      NotificationManager.error("Please enter a valid email address");
      return;
    }

    const submitBtn = form.querySelector("#single-user-submit");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Creating...";
    }

    try {
      const response = await API.post("/api/admin/users", payload);
      if (response?.email_sent === false) {
        NotificationManager.warning(
          response?.message ||
            "User created, but email was not sent. Check mail settings.",
        );
      } else {
        NotificationManager.success(
          response?.message || "User created successfully",
        );
      }
      ModalManager.close(modal);
      await this.loadUserStats();
      await this.loadUsers(1);
      // Refresh chatbot list to update participant counts
      if (window.chatbotList) {
        window.chatbotList.loadChatbots();
      }
    } catch (error) {
      NotificationManager.error(error.message || "Failed to create user");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Create User";
      }
    }
  }

  setupFilters() {
    if (this.roleFilter) {
      this.roleFilter.addEventListener("change", () => {
        this.currentPage = 1;
        this.loadUsers(1);
      });
    }

    if (this.statusFilter) {
      this.statusFilter.addEventListener("change", () => {
        this.currentPage = 1;
        this.loadUsers(1);
      });
    }

    if (this.searchInput) {
      this.searchInput.addEventListener("input", () => {
        if (this.searchDebounceTimer) {
          clearTimeout(this.searchDebounceTimer);
        }

        this.searchDebounceTimer = setTimeout(() => {
          this.currentPage = 1;
          this.loadUsers(1);
        }, 300);
      });
    }
  }

  setupPaginationActions() {
    if (!this.paginationButtons) return;

    this.paginationButtons.addEventListener("click", (event) => {
      const pageButton = event.target.closest("[data-page]");
      if (!pageButton) return;

      const nextPage = Number(pageButton.dataset.page);
      if (
        !Number.isFinite(nextPage) ||
        nextPage < 1 ||
        nextPage === this.currentPage
      ) {
        return;
      }

      this.loadUsers(nextPage);
    });
  }

  async resetPassword(userId) {
    ModalManager.confirm(
      "Reset password for this user? A new temporary password will be sent to their email.",
      async () => {
        try {
          await API.post(`/api/auth/users/${userId}/reset-password`, {});
          NotificationManager.success("Password reset sent to user email");
        } catch (error) {
          NotificationManager.error("Failed to reset password");
        }
      },
    );
  }

  async toggleUser(userId, isCurrentlyActive) {
    try {
      await API.put(`/api/admin/users/${userId}`, {
        active: !isCurrentlyActive,
      });
      NotificationManager.success(
        `User ${isCurrentlyActive ? "deactivated" : "activated"}`,
      );
      await this.loadUserStats();
      await this.loadUsers(this.currentPage);
    } catch (error) {
      NotificationManager.error("Failed to update user");
    }
  }

  async deleteUser(userId, userName) {
    ModalManager.confirm(
      `Are you sure you want to permanently delete "${userName || "this user"}"? This action cannot be undone.`,
      async () => {
        try {
          await API.delete(`/api/admin/users/${userId}`);
          NotificationManager.success("User deleted successfully");
          await this.loadUserStats();
          await this.loadUsers(this.currentPage);
          // Refresh dashboard stats
          if (
            window.adminPanel &&
            typeof window.adminPanel.loadDashboardStats === "function"
          ) {
            window.adminPanel.loadDashboardStats();
          }
        } catch (error) {
          NotificationManager.error(error.message || "Failed to delete user");
        }
      },
    );
  }

  async loadUsers(page = 1) {
    try {
      const role = this.roleFilter?.value || "";
      const roleQuery = role ? `&role=${encodeURIComponent(role)}` : "";
      const active = this.statusFilter?.value || "";
      const activeQuery = active ? `&active=${encodeURIComponent(active)}` : "";
      const search = (this.searchInput?.value || "").trim();
      const searchQuery = search ? `&search=${encodeURIComponent(search)}` : "";
      const response = await API.get(
        `/api/admin/users?page=${page}&per_page=${this.perPage}${roleQuery}${activeQuery}${searchQuery}`,
      );

      const users = Array.isArray(response?.data) ? response.data : [];
      const total = Number.isFinite(Number(response?.total))
        ? Number(response.total)
        : users.length;
      const pages = Number.isFinite(Number(response?.pages))
        ? Number(response.pages)
        : 1;
      const currentPage = Number.isFinite(Number(response?.current_page))
        ? Number(response.current_page)
        : page;

      this.currentPage = currentPage;

      this.renderUsers(users);
      this.renderPagination(total, currentPage, pages);
    } catch (error) {
      console.error("Error loading users:", error);
      NotificationManager.error("Failed to load users");
      this.renderUsers([]);
      this.renderPagination(0, 1, 1);
    }
  }

  renderUsers(users) {
    const tbody = this.table.querySelector("tbody");
    if (!tbody) return;

    if (!users.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center">No users found.</td></tr>';
      return;
    }

    tbody.innerHTML = users
      .map((user) => {
        const initials = this.getUserInitials(
          user.name || user.username || "U",
        );
        const joinedOn = user.created_at
          ? DateUtils.formatDate(user.created_at)
          : "-";
        const statusClass = user.active ? "status-active" : "status-inactive";
        const statusText = user.active ? "Active" : "Inactive";

        // Display chatbot assignments
        const chatbots = user.chatbots || [];
        const chatbotsDisplay =
          chatbots.length > 0
            ? `<div style="font-size: 0.85em; color: var(--text-secondary); margin-top: 4px;">
               <i class="fas fa-calendar-alt" style="margin-right: 4px;"></i>
               ${chatbots.map((c) => c.name).join(", ")}
             </div>`
            : `<div style="font-size: 0.85em; color: var(--text-tertiary); margin-top: 4px; font-style: italic;">
               No events assigned
             </div>`;

        return `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: var(--spacing-md);">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700;">${initials}</div>
                <div>
                  <div>${user.name || user.username || "-"}</div>
                  ${chatbotsDisplay}
                </div>
              </div>
            </td>
            <td>${user.email || "-"}</td>
            <td>${user.role || "-"}</td>
            <td>${joinedOn}</td>
            <td><span class="status-indicator ${statusClass}"><span class="status-dot"></span> ${statusText}</span></td>
            <td>
              <div class="table-actions">
                <button class="btn btn-sm btn-secondary" data-action="reset-password" data-user-id="${user.id}"><i class="fas fa-key"></i> Reset</button>
                <button class="btn btn-sm ${user.active ? "btn-danger" : "btn-success"}" data-action="toggle-user" data-user-id="${user.id}" data-user-active="${user.active}">${user.active ? "Deactivate" : "Activate"}</button>
                <button class="btn btn-sm btn-danger" data-action="delete-user" data-user-id="${user.id}" data-user-name="${user.name || user.username || "User"}" title="Delete user"><i class="fas fa-trash"></i></button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  renderPagination(totalUsers, currentPage, totalPages) {
    const start = totalUsers === 0 ? 0 : (currentPage - 1) * this.perPage + 1;
    const end = Math.min(currentPage * this.perPage, totalUsers);

    if (this.paginationSummary) {
      this.paginationSummary.textContent = `Showing ${start}-${end} of ${totalUsers} users`;
    }

    if (!this.paginationContainer || !this.paginationButtons) return;

    const shouldShowPagination = totalUsers > this.perPage && totalPages > 1;
    this.paginationContainer.style.display = shouldShowPagination
      ? "flex"
      : "none";

    if (!shouldShowPagination) {
      this.paginationButtons.innerHTML = "";
      return;
    }

    const pageButtons = [];

    pageButtons.push(`
      <button class="btn btn-ghost btn-sm" data-page="${Math.max(currentPage - 1, 1)}" ${currentPage <= 1 ? "disabled" : ""}>← Previous</button>
    `);

    for (let page = 1; page <= totalPages; page += 1) {
      pageButtons.push(`
        <button class="btn ${page === currentPage ? "btn-primary" : "btn-ghost"} btn-sm" data-page="${page}">${page}</button>
      `);
    }

    pageButtons.push(`
      <button class="btn btn-ghost btn-sm" data-page="${Math.min(currentPage + 1, totalPages)}" ${currentPage >= totalPages ? "disabled" : ""}>Next →</button>
    `);

    this.paginationButtons.innerHTML = pageButtons.join("");
  }

  getUserInitials(name) {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "U";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
}

class AdminProfileHandler {
  constructor() {
    this.form = DomUtils.$('form[data-form="admin-profile"]');
    if (!this.form) return;

    this.nameInput = this.form.querySelector('[name="name"]');
    this.usernameInput = this.form.querySelector('[name="username"]');
    this.emailInput = this.form.querySelector('[name="email"]');
    this.organizationInput = this.form.querySelector('[name="organization"]');
    this.bioInput = this.form.querySelector('[name="bio"]');

    this.init();
  }

  init() {
    this.form.addEventListener("submit", (event) => this.handleSubmit(event));
    this.loadProfile();
  }

  async loadProfile() {
    try {
      const response = await API.get("/api/user/profile");
      const profile = response?.data || {};

      if (this.nameInput) this.nameInput.value = profile.name || "";
      if (this.usernameInput) this.usernameInput.value = profile.username || "";
      if (this.emailInput) this.emailInput.value = profile.email || "";
      if (this.organizationInput) {
        this.organizationInput.value = profile.organization || "";
      }
      if (this.bioInput) this.bioInput.value = profile.bio || "";

      const roleEl = DomUtils.$("#profile-role");
      if (roleEl) roleEl.textContent = profile.role || "Admin";

      const messagesEl = DomUtils.$("#profile-messages");
      if (messagesEl) {
        messagesEl.textContent = Number.isFinite(Number(profile.messages_sent))
          ? Number(profile.messages_sent)
          : 0;
      }

      const joinedEl = DomUtils.$("#profile-joined-chatbots");
      if (joinedEl) {
        joinedEl.textContent = Number.isFinite(Number(profile.joined_chatbots))
          ? Number(profile.joined_chatbots)
          : 0;
      }
    } catch (error) {
      console.error("Error loading admin profile:", error);
      NotificationManager.error("Failed to load profile");
    }
  }

  async handleSubmit(event) {
    event.preventDefault();

    const payload = {
      name: this.nameInput?.value?.trim() || "",
      organization: this.organizationInput?.value?.trim() || "",
      bio: this.bioInput?.value?.trim() || "",
    };

    if (!payload.name) {
      NotificationManager.error("Name is required");
      return;
    }

    try {
      const response = await API.put("/api/user/profile", payload);
      const updatedUser = response?.data || {};

      const currentUser = Storage.getUser() || {};
      Storage.setUser({
        ...currentUser,
        name: updatedUser.name || payload.name,
        organization: updatedUser.organization || payload.organization,
        bio: updatedUser.bio || payload.bio,
      });

      NotificationManager.success("Profile updated successfully");
    } catch (error) {
      console.error("Error updating admin profile:", error);
      NotificationManager.error(error.message || "Failed to update profile");
    }
  }
}

class AdminSettingsHandler {
  constructor() {
    this.form = DomUtils.$('form[data-form="admin-password"]');
    if (!this.form) return;

    this.currentPasswordInput = this.form.querySelector(
      '[name="current_password"]',
    );
    this.newPasswordInput = this.form.querySelector('[name="new_password"]');
    this.confirmPasswordInput = this.form.querySelector(
      '[name="confirm_password"]',
    );

    this.init();
  }

  init() {
    this.setupPasswordVisibilityToggles();
    this.form.addEventListener("submit", (event) => this.handleSubmit(event));
  }

  setupPasswordVisibilityToggles() {
    const toggles = DomUtils.$$(".password-visibility-toggle");
    if (!toggles || toggles.length === 0) return;

    toggles.forEach((toggleBtn) => {
      toggleBtn.addEventListener("click", () => {
        const targetId = toggleBtn.dataset.target;
        if (!targetId) return;

        const input = document.getElementById(targetId);
        if (!input) return;

        const icon = toggleBtn.querySelector("i");
        const isHidden = input.type === "password";
        input.type = isHidden ? "text" : "password";

        if (icon) {
          icon.classList.toggle("fa-eye", !isHidden);
          icon.classList.toggle("fa-eye-slash", isHidden);
        }

        toggleBtn.setAttribute(
          "aria-label",
          isHidden ? "Hide password" : "Show password",
        );
      });
    });
  }

  async handleSubmit(event) {
    event.preventDefault();

    const currentPassword = this.currentPasswordInput?.value || "";
    const newPassword = this.newPasswordInput?.value || "";
    const confirmPassword = this.confirmPasswordInput?.value || "";

    if (!currentPassword || !newPassword || !confirmPassword) {
      NotificationManager.error("Please fill all password fields");
      return;
    }

    if (newPassword.length < 6) {
      NotificationManager.error("New password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      NotificationManager.error("New password and confirmation do not match");
      return;
    }

    try {
      await API.put("/api/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });

      NotificationManager.success(
        "Password updated successfully. Please login again.",
      );
      this.form.reset();
      setTimeout(() => {
        Storage.clear();
        AdminAuth.redirectToLogin();
      }, 700);
    } catch (error) {
      console.error("Error changing password:", error);
      NotificationManager.error(error.message || "Failed to update password");
    }
  }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  AdminPageSkeletonLoader.init();

  // Initialize admin panel
  if (document.querySelector(".admin-container")) {
    window.adminPanel = new AdminPanel();
  }

  // Initialize form handlers
  window.chatbotForm = new ChatbotFormHandler();
  window.chatbotList = new ChatbotListHandler();
  window.importExcel = new ImportExcelHandler();
  window.userManagement = new UserManagementHandler();
  window.guestManagement = new GuestManagementHandler();
  window.adminProfile = new AdminProfileHandler();
  window.adminSettings = new AdminSettingsHandler();
});

// ============================================
// CHATBOT LIST HANDLER
// ============================================

class ChatbotListHandler {
  constructor() {
    // Check if we are on the chatbot list page
    if (
      document.getElementById("chatbot-grid") ||
      document.querySelector('table[data-table="chatbots"]')
    ) {
      this.grid = document.getElementById("chatbot-grid");
      this.table = document.querySelector('table[data-table="chatbots"]');
      this.chatbotsPerPage = 100;
      this.chatbotsPage = 1;
      this.chatbotsTotalPages = 1;
      this.chatbotPaginationBound = false;
      this.paginationContainer = document.getElementById(
        "chatbot-list-pagination",
      );
      this.init();
    }
  }

  init() {
    this.allChatbots = [];
    this.filteredChatbots = [];
    this.searchInput = document.getElementById("chatbot-search");
    this.statusFilter = document.getElementById("chatbot-status-filter");

    this.loadChatbots();
    this.setupEventListeners();
    this.checkSuccessMessage();
  }

  checkSuccessMessage() {
    const params = new URLSearchParams(window.location.search);
    const msg = params.get("msg");
    if (msg === "created") {
      NotificationManager.success("Chatbot created successfully!");
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (msg === "updated") {
      NotificationManager.success("Chatbot updated successfully!");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  setupEventListeners() {
    // Delegate delete events
    const handleDelete = (e) => {
      const btn = e.target.closest('[data-action="delete"]');
      if (btn) {
        e.preventDefault();
        const id = btn.dataset.id;
        const name = btn.dataset.name;
        this.confirmDelete(id, name);
      }
    };

    if (this.table) {
      this.table.addEventListener("click", handleDelete);
    }

    if (this.grid) {
      this.grid.addEventListener("click", handleDelete);
    }

    if (this.searchInput) {
      this.searchInput.addEventListener("input", () => this.applyFilters(true));
    }

    if (this.statusFilter) {
      this.statusFilter.addEventListener("change", () =>
        this.applyFilters(true),
      );
    }
  }

  confirmDelete(id, name) {
    ModalManager.confirm(`Are you sure you want to delete "${name}"?`, () =>
      this.deleteChatbot(id),
    );
  }

  async deleteChatbot(id) {
    try {
      await API.delete(`/api/admin/chatbots/${id}`);
      NotificationManager.success("Chatbot deleted successfully");
      this.loadChatbots(); // Reload list
      // Refresh dashboard stats
      if (
        window.adminPanel &&
        typeof window.adminPanel.loadDashboardStats === "function"
      ) {
        window.adminPanel.loadDashboardStats();
      }
    } catch (error) {
      console.error("Delete error:", error);
      NotificationManager.error("Failed to delete chatbot");
    }
  }

  async loadChatbots() {
    try {
      const response = await API.get("/api/admin/chatbots");
      const chatbots = this.normalizeChatbots(response);
      this.allChatbots = chatbots;
      this.applyFilters(true);

      // Update sidebar badge if it exists
      const badge = document.querySelector(".menu-item.active .menu-badge");
      if (badge) {
        badge.textContent = chatbots.length;
        badge.style.display = chatbots.length > 0 ? "inline-block" : "none";
      }
    } catch (error) {
      console.error("Error loading chatbots:", error);
      NotificationManager.error("Failed to load chatbots");
      this.renderLoadError(error?.message || "Unable to load chatbots");
    }
  }

  normalizeChatbots(response) {
    if (Array.isArray(response?.data)) {
      return response.data;
    }

    if (Array.isArray(response?.data?.items)) {
      return response.data.items;
    }

    if (Array.isArray(response?.items)) {
      return response.items;
    }

    return [];
  }

  applyFilters(resetPage = false) {
    const searchTerm = (this.searchInput?.value || "").trim().toLowerCase();
    const selectedStatus = (this.statusFilter?.value || "")
      .trim()
      .toLowerCase();

    const filtered = this.allChatbots.filter((bot) => {
      const matchesSearch =
        !searchTerm ||
        (bot.name || "").toLowerCase().includes(searchTerm) ||
        (bot.event_name || "").toLowerCase().includes(searchTerm) ||
        (bot.description || "").toLowerCase().includes(searchTerm);

      const adminStatus = bot.active ? "active" : "inactive";
      const matchesStatus = !selectedStatus || adminStatus === selectedStatus;

      return matchesSearch && matchesStatus;
    });

    this.filteredChatbots = filtered;
    if (resetPage) {
      this.chatbotsPage = 1;
    }
    this.chatbotsTotalPages = Math.max(
      Math.ceil(filtered.length / this.chatbotsPerPage),
      1,
    );

    if (this.chatbotsPage > this.chatbotsTotalPages) {
      this.chatbotsPage = this.chatbotsTotalPages;
    }

    this.renderPage();
  }

  renderPage() {
    const start = (this.chatbotsPage - 1) * this.chatbotsPerPage;
    const pageItems = this.filteredChatbots.slice(
      start,
      start + this.chatbotsPerPage,
    );
    this.render(pageItems);
    this.renderChatbotPagination();
  }

  renderChatbotPagination() {
    const container = this.paginationContainer;
    if (!container) return;

    if (this.chatbotsTotalPages <= 1) {
      container.innerHTML = "";
      return;
    }

    const prevDisabled = this.chatbotsPage <= 1;
    const nextDisabled = this.chatbotsPage >= this.chatbotsTotalPages;

    const pageButtons = Array.from(
      { length: this.chatbotsTotalPages },
      (_, index) => {
        const pageNumber = index + 1;
        const isActive = pageNumber === this.chatbotsPage;
        return `
          <button class="page-btn${isActive ? " active" : ""}" data-page="${pageNumber}" aria-current="${isActive ? "page" : "false"}">
            ${pageNumber}
          </button>
        `;
      },
    ).join("");

    container.innerHTML = `
      <button class="page-btn" data-page="${this.chatbotsPage - 1}" ${
        prevDisabled ? "disabled" : ""
      } aria-label="Previous page">
        Prev
      </button>
      <div class="pagination-track" role="list">
        ${pageButtons}
      </div>
      <button class="page-btn" data-page="${this.chatbotsPage + 1}" ${
        nextDisabled ? "disabled" : ""
      } aria-label="Next page">
        Next
      </button>
    `;

    this.bindChatbotPagination();
  }

  bindChatbotPagination() {
    const container = this.paginationContainer;
    if (!container || this.chatbotPaginationBound) return;

    container.addEventListener("click", (event) => {
      const target = event.target.closest("button[data-page]");
      if (!target || target.disabled) return;

      const page = Number.parseInt(target.dataset.page || "1", 10);
      if (!Number.isFinite(page) || page === this.chatbotsPage) return;

      this.chatbotsPage = page;
      this.renderPage();
    });

    this.chatbotPaginationBound = true;
  }

  renderLoadError(message) {
    if (this.grid) {
      this.grid.innerHTML =
        '<div class="col-span-3 text-center py-xl text-muted">Failed to load chatbots. Please refresh and try again.</div>';
    }

    if (this.table) {
      const tbody = this.table.querySelector("tbody");
      if (tbody) {
        tbody.innerHTML =
          '<tr><td colspan="8" class="text-center py-xl text-muted">Failed to load chatbots. Please refresh and try again.</td></tr>';
      }
    }

    if (message) {
      console.error("Chatbot list load error detail:", message);
    }
  }

  render(chatbots) {
    // Render Table
    if (this.table) {
      const tbody = this.table.querySelector("tbody");
      if (tbody) {
        if (chatbots.length === 0) {
          tbody.innerHTML =
            '<tr><td colspan="8" class="text-center">No chatbots found.</td></tr>';
        } else {
          tbody.innerHTML = chatbots
            .map(
              (bot) => `
                    <tr>
                        <td>
                            <div class="chatbot-info">
                                <div class="chatbot-name">${bot.name}</div>
                            </div>
                        </td>
                  <td>${bot.event_name || "-"}</td>
                        <td>${DateUtils.formatDateRange(bot.start_date, bot.end_date)}</td>
                        <td><span class="status-indicator status-${bot.status}"><span class="status-dot"></span> ${bot.status}</span></td>
                        <td>
                            <span class="admin-status ${bot.active ? "status-active" : "status-inactive"}">
                              ${bot.active ? "Active" : "Inactive"}
                            </span>
                        </td>
                        <td>${bot.participants_count || 0}</td>
              <td>${bot.guests_count || 0}</td>
                        <td>
                            <div class="table-actions">
                                <a href="create-chatbot.html?id=${bot.id}" class="btn btn-sm btn-icon btn-secondary"><i class="fas fa-edit"></i></a>
                                <button class="btn btn-sm btn-icon btn-danger" data-action="delete" data-id="${bot.id}" data-name="${bot.name}"><i class="fas fa-trash"></i></button>
                            </div>
                        </td>
                    </tr>
                `,
            )
            .join("");
        }
      }
    }

    // Render Grid
    if (this.grid) {
      if (chatbots.length === 0) {
        this.grid.innerHTML =
          '<div class="col-span-3 text-center py-xl text-muted">No chatbots found. Create one to get started!</div>';
      } else {
        this.grid.innerHTML = chatbots
          .map(
            (bot) => `
                <div class="chatbot-card">
                    <div class="chatbot-card-header">
                        <div>
                            <h3 class="chatbot-card-title">${bot.name}</h3>
                            <div class="chatbot-card-status">${bot.event_name}</div>
                        </div>
                        <span class="admin-status ${bot.active ? "status-active" : "status-inactive"}">
                          ${bot.active ? "Active" : "Inactive"}
                        </span>
                    </div>
                    <div class="chatbot-card-body">
                        <div class="chatbot-card-item">
                            <span class="chatbot-card-item-icon"><i class="fas fa-calendar-alt"></i></span>
                            <span>${DateUtils.formatDateRange(bot.start_date, bot.end_date)}</span>
                        </div>
                        <div class="chatbot-card-item">
                            <span class="chatbot-card-item-icon"><i class="fas fa-users"></i></span>
                            <span>${bot.participants_count || 0} participants</span>
                        </div>
                        <div class="chatbot-card-item">
                            <span class="chatbot-card-item-icon"><i class="fas fa-user-tie"></i></span>
                            <span>${bot.guests_count || 0} guests</span>
                        </div>
                    </div>
                    <div class="chatbot-card-footer">
                        <a href="create-chatbot.html?id=${bot.id}" class="btn btn-sm btn-secondary"><i class="fas fa-edit"></i> Edit</a>
                        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${bot.id}"
                            data-name="${bot.name}"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                </div>
            `,
          )
          .join("");
      }
    }
  }

  getStatusBadgeClass(status) {
    switch (status) {
      case "active":
        return "success";
      case "pending":
        return "info";
      case "expired":
        return "warning";
      default:
        return "secondary";
    }
  }
}

// ============================================
// GUEST MANAGEMENT HANDLER
// ============================================

class GuestManagementHandler {
  constructor() {
    this.table = document.querySelector('table[data-table="guests"]');
    if (this.table) {
      this.init();
    }
  }

  init() {
    this.loadGuests();
    this.setupEventListeners();
    this.setupAddGuestButton();
  }

  setupEventListeners() {
    this.table.addEventListener("click", (e) => {
      const deleteBtn = e.target.closest('[data-action="delete"]');
      if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        this.confirmDelete(id);
        return;
      }

      const editBtn = e.target.closest('[data-action="edit"]');
      if (editBtn) {
        const id = editBtn.dataset.id;
        this.openEditModal(id);
        return;
      }
    });
  }

  setupAddGuestButton() {
    const addBtn = document.querySelector(".card-header .btn-primary");
    if (addBtn) {
      addBtn.addEventListener("click", () => this.openAddGuestModal());
    }
  }

  confirmDelete(id) {
    ModalManager.confirm("Are you sure you want to delete this guest?", () =>
      this.deleteGuest(id),
    );
  }

  async deleteGuest(id) {
    try {
      await API.delete(`/api/admin/guests/${id}`);
      NotificationManager.success("Guest deleted successfully");
      this.loadGuests();
    } catch (error) {
      NotificationManager.error("Failed to delete guest");
    }
  }

  async loadGuests() {
    try {
      const response = await API.get("/api/admin/guests");
      const guests = response.data;
      this.render(guests);

      // Update stats
      this.updateStats(guests);
    } catch (error) {
      console.error("Error loading guests:", error);
      NotificationManager.error("Failed to load guests");
    }
  }

  updateStats(guests) {
    const total = guests.length;

    this.setText("total-guests-count", total);
    this.setText("active-guests-count", total);
    this.setText("pending-guests-count", 0);
    this.setText("vip-guests-count", 0);
  }

  setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  render(guests) {
    const tbody = this.table.querySelector("tbody");
    if (!tbody) return;

    if (guests.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="3" class="text-center">No guests found.</td></tr>';
      return;
    }

    tbody.innerHTML = guests
      .map(
        (guest) => `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: var(--spacing-md);">
                        <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700;">
                            ${guest.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>${guest.name}</div>
                    </div>
                </td>
                <td>${guest.chatbot_id ? "Linked Event" : "General"}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-sm btn-secondary" data-action="edit" data-id="${guest.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${guest.id}"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `,
      )
      .join("");
  }

  async openEditModal(id) {
    try {
      console.log(`[GuestEdit] Fetching guest ${id}...`);
      const response = await API.get(`/api/admin/guests/${id}`);
      console.log(`[GuestEdit] Response received:`, response);

      let guest;
      if (response.data) {
        guest = response.data;
      } else if (response.success && typeof response === "object") {
        // Fallback if data is at root level
        guest = response;
      } else {
        throw new Error("Invalid response structure");
      }

      console.log(`[GuestEdit] Guest data:`, guest);

      const formHTML = `
        <div class="form-group">
          <label for="guest-name-edit">Name <span class="text-danger">*</span></label>
          <input type="text" id="guest-name-edit" class="form-control" value="${guest.name || ""}" required>
        </div>
        <div class="form-group">
          <label for="guest-title-edit">Title/Role</label>
          <input type="text" id="guest-title-edit" class="form-control" value="${guest.title || ""}">
        </div>
        <div class="form-group">
          <label for="guest-description-edit">Description</label>
          <textarea id="guest-description-edit" class="form-control" rows="3">${guest.description || ""}</textarea>
        </div>
      `;

      const self = this;
      const modal = ModalManager.create(`Edit Guest: ${guest.name}`, formHTML, [
        {
          id: "cancel",
          label: "Cancel",
          class: "btn-secondary",
          callback: () => {},
        },
        {
          id: "save",
          label: "Save Changes",
          class: "btn-primary",
          callback: async () => {
            const updatedData = {
              name: document.getElementById("guest-name-edit").value.trim(),
              title: document.getElementById("guest-title-edit").value.trim(),
              description: document
                .getElementById("guest-description-edit")
                .value.trim(),
            };

            if (!updatedData.name) {
              NotificationManager.error("Please enter a guest name");
              return;
            }

            try {
              await self.saveGuestChanges(id, updatedData);
              NotificationManager.success("Guest updated successfully");
              self.loadGuests();
            } catch (error) {
              console.error("[GuestEdit] Save error:", error);
              NotificationManager.error(
                "Failed to update guest: " + (error.message || "Unknown error"),
              );
            }
          },
        },
      ]);
    } catch (error) {
      console.error("[GuestEdit] Error loading guest:", error);
      console.error("[GuestEdit] Error message:", error.message);
      console.error("[GuestEdit] Error stack:", error.stack);
      NotificationManager.error(
        "Failed to load guest details: " + (error.message || "Unknown error"),
      );
    }
  }

  async saveGuestChanges(id, data) {
    return API.put(`/api/admin/guests/${id}`, data);
  }

  async openAddGuestModal() {
    const formHTML = `
      <div class="form-group">
        <label for="guest-name-add">Name <span class="text-danger">*</span></label>
        <input type="text" id="guest-name-add" class="form-control" placeholder="Guest name" required>
      </div>
      <div class="form-group">
        <label for="guest-title-add">Title/Role</label>
        <input type="text" id="guest-title-add" class="form-control" placeholder="e.g., Speaker, Moderator">
      </div>
      <div class="form-group">
        <label for="guest-description-add">Description</label>
        <textarea id="guest-description-add" class="form-control" rows="3" placeholder="Brief bio or description"></textarea>
      </div>
    `;

    const self = this;
    const modal = ModalManager.create("Add New Guest", formHTML, [
      {
        id: "cancel",
        label: "Cancel",
        class: "btn-secondary",
        callback: () => {},
      },
      {
        id: "add",
        label: "Add Guest",
        class: "btn-primary",
        callback: async () => {
          const guestData = {
            name: document.getElementById("guest-name-add").value.trim(),
            title: document.getElementById("guest-title-add").value.trim(),
            description: document
              .getElementById("guest-description-add")
              .value.trim(),
          };

          if (!guestData.name) {
            NotificationManager.error("Please enter a guest name");
            return;
          }

          try {
            console.log("[AddGuest] Creating guest:", guestData);
            const response = await API.post("/api/admin/guests", guestData);
            console.log("[AddGuest] Response:", response);
            NotificationManager.success("Guest added successfully");
            self.loadGuests();
          } catch (error) {
            console.error("[AddGuest] Error:", error);
            NotificationManager.error(
              "Failed to add guest: " + (error.message || "Unknown error"),
            );
          }
        },
      },
    ]);
  }
}
