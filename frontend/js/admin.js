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

class AdminPanel {
  constructor() {
    this.currentChatbotId = null;
    this.sidebarRefreshInterval = null;
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
        if (window.innerWidth < 1024) {
          DomUtils.removeClass(sidebar, "active");
        }
      });
    });

    this.resetSidebarBadges();
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

    this.setSidebarBadge(
      '.sidebar-menu a[href="chatbot-list.html"] .menu-badge',
      stats.total_chatbots,
    );
    this.setSidebarBadge(
      '.sidebar-menu a[href="user-management.html"] .menu-badge',
      stats.total_users,
    );
  }

  async loadSidebarCounts() {
    try {
      const response = await API.get("/api/admin/dashboard/stats");
      this.updateSidebarBadges(response.data);
    } catch (error) {
      console.error("Error loading sidebar counts:", error);
    }
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
      this.loadDashboardStats();
    }
  }

  async loadDashboardStats() {
    try {
      const response = await API.get("/api/admin/dashboard/stats");
      const stats = response.data;
      this.updateSidebarBadges(stats);

      // Update stat cards
      this.updateStatCard("total-chatbots", stats.total_chatbots);
      this.updateStatCard("total-users", stats.total_users);
      // If there's a card for total guests, update it too.
      // Note: Dashboard currently has total-users.
      // If we want to show guests, we might need to change the HTML or ID.
      // For now, let's assume total-users is what's displayed.

      this.updateStatCard("upcoming-events", stats.upcoming_events);

      // Update other stats if elements exist
      this.updateStatCard("active-chatbots", stats.active_chatbots);
      this.updateStatCard("total-guests", stats.total_guests);
    } catch (error) {
      console.error("Error loading dashboard:", error);
      NotificationManager.error("Failed to load dashboard stats");
    }
  }

  updateStatCard(id, value) {
    const card = DomUtils.$(`#${id}`);
    if (card) {
      const valueEl = card.querySelector(".stat-value");
      if (valueEl) {
        valueEl.textContent = value;
        valueEl.classList.add("animate-fade-in");
      }
    }
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
      DomUtils.$(".header-breadcrumb span:last-child").textContent =
        "Edit Chatbot";
      DomUtils.$('button[type="submit"]').textContent = "💾 Save Changes";

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
        system_prompt: bot.system_prompt,
      };

      for (const [name, value] of Object.entries(fields)) {
        const input = this.form.querySelector(`[name="${name}"]`);
        if (input) input.value = value;
      }

      // checkboxes
      if (bot.single_mode) DomUtils.$("#single-mode").checked = true;
      if (bot.multiple_mode) DomUtils.$("#multiple-mode").checked = true;

      NotificationManager.info("Loaded chatbot details for editing");
    } catch (error) {
      console.error("Error loading chatbot:", error);
      NotificationManager.error("Failed to load chatbot details");
    }
  }

  setupFileUpload() {
    const uploadAreas = DomUtils.$$(".file-upload");
    uploadAreas.forEach((area) => {
      area.addEventListener("click", () => {
        const input = area.querySelector('input[type="file"]');
        if (input) input.click();
      });

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
    });
  }

  handleFiles(files, area) {
    if (files.length === 0) return;
    const file = files[0];
    const input = area.querySelector('input[type="file"]');
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    input.files = dataTransfer.files;

    const name = input.dataset.name || file.name;
    NotificationManager.success(`File selected: ${name}`);
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

    if (!FormValidator.validate(this.form)) {
      NotificationManager.error("Please fill in all required fields");
      return;
    }

    const formData = new FormData(this.form);
    const data = Object.fromEntries(formData);

    try {
      const isEdit = this.form.dataset.action === "edit";
      const endpoint = isEdit ? `/api/chatbots/${data.id}` : "/api/chatbots";
      const method = isEdit ? "put" : "post";

      const response = isEdit
        ? await API.put(endpoint, data)
        : await API.post(endpoint, data);

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
    }
  }
}

// ============================================
// IMPORT EXCEL HANDLER
// ============================================

class ImportExcelHandler {
  constructor() {
    this.form = DomUtils.$('form[data-form="import-excel"]');
    if (this.form) {
      this.init();
    }
  }

  init() {
    this.form.addEventListener("submit", (e) => this.handleSubmit(e));
    this.setupFileInput();
  }

  setupFileInput() {
    const input = this.form.querySelector('input[type="file"]');
    if (input) {
      input.addEventListener("change", () => {
        this.previewFile(input.files[0]);
      });
    }
  }

  previewFile(file) {
    if (!file || !file.name.endsWith(".xlsx")) {
      NotificationManager.error("Please upload an Excel file (.xlsx)");
      return;
    }

    // Simulate file preview - in real app, use xlsx library
    const preview = DomUtils.$(".import-preview");
    if (preview) {
      preview.innerHTML = `
        <p>File selected: ${file.name}</p>
        <p>Size: ${(file.size / 1024).toFixed(2)} KB</p>
        <p style="color: var(--accent-blue);">Ready to import</p>
      `;
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

    try {
      const response = await fetch("/api/import/excel", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        NotificationManager.success(
          `Imported ${data.count} users successfully`,
        );
        this.showCredentials(data.credentials);
      } else {
        NotificationManager.error(data.message || "Import failed");
      }
    } catch (error) {
      console.error("Import error:", error);
      NotificationManager.error("Failed to import file");
    }
  }

  showCredentials(credentials) {
    const html = `
      <h3>Import Successful!</h3>
      <p>${credentials.length} users created with credentials:</p>
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
      <button class="btn btn-primary mt-lg" onclick="downloadCredentials()">
        <i class="fas fa-download"></i> Download Credentials
      </button>
    `;

    ModalManager.create("Import Results", html, [
      {
        id: "close",
        label: "Close",
        class: "btn-secondary",
      },
    ]);
  }
}

// ============================================
// USER MANAGEMENT
// ============================================

class UserManagementHandler {
  constructor() {
    this.table = DomUtils.$('table[data-table="users"]');
    if (this.table) {
      this.init();
    }
  }

  init() {
    this.setupActions();
    this.loadUsers();
  }

  setupActions() {
    const resetBtns = DomUtils.$$('[data-action="reset-password"]');
    resetBtns.forEach((btn) => {
      btn.addEventListener("click", () =>
        this.resetPassword(btn.dataset.userId),
      );
    });

    const toggleBtns = DomUtils.$$('[data-action="toggle-user"]');
    toggleBtns.forEach((btn) => {
      btn.addEventListener("click", () =>
        this.toggleUser(btn.dataset.userId, btn),
      );
    });
  }

  async resetPassword(userId) {
    ModalManager.confirm(
      "Reset password for this user? A new temporary password will be sent to their email.",
      async () => {
        try {
          await API.post(`/api/users/${userId}/reset-password`, {});
          NotificationManager.success("Password reset sent to user email");
        } catch (error) {
          NotificationManager.error("Failed to reset password");
        }
      },
    );
  }

  async toggleUser(userId, btn) {
    try {
      const isActive = btn.classList.contains("active");
      await API.put(`/api/users/${userId}`, { active: !isActive });
      DomUtils.toggleClass(btn, "active");
      NotificationManager.success(
        `User ${isActive ? "deactivated" : "activated"}`,
      );
    } catch (error) {
      NotificationManager.error("Failed to update user");
    }
  }

  async loadUsers() {
    try {
      // Simulated data
      const users = [
        { id: 1, name: "John Doe", email: "john@example.com", active: true },
        { id: 2, name: "Jane Smith", email: "jane@example.com", active: true },
      ];

      // Render users
      const tbody = this.table.querySelector("tbody");
      if (tbody) {
        tbody.innerHTML = users
          .map(
            (user) => `
          <tr>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.active ? '<span class="badge badge-success"><i class="fas fa-check"></i></span>' : '<span class="badge badge-danger"><i class="fas fa-times"></i></span>'}</td>
            <td>
              <div class="table-actions">
                <button class="btn btn-sm btn-secondary" data-action="reset-password" data-user-id="${user.id}">
                  <i class="fas fa-key"></i> Reset
                </button>
                <button class="btn btn-sm ${user.active ? "btn-danger" : "btn-success"}" data-action="toggle-user" data-user-id="${user.id}">
                  ${user.active ? "Deactivate" : "Activate"}
                </button>
              </div>
            </td>
          </tr>
        `,
          )
          .join("");

        this.setupActions();
      }
    } catch (error) {
      console.error("Error loading users:", error);
    }
  }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener("DOMContentLoaded", () => {
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
      this.init();
    }
  }

  init() {
    this.loadChatbots();
    this.setupEventListeners();
    this.checkSuccessMessage();
  }

  checkSuccessMessage() {
    const params = new URLSearchParams(window.location.search);
    const msg = params.get("msg");
    if (msg === "created") {
      NotificationManager.success("✨ Chatbot created successfully!");
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (msg === "updated") {
      NotificationManager.success("✅ Chatbot updated successfully!");
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
    } catch (error) {
      console.error("Delete error:", error);
      NotificationManager.error("Failed to delete chatbot");
    }
  }

  async loadChatbots() {
    try {
      const response = await API.get("/api/admin/chatbots");
      const chatbots = this.normalizeChatbots(response);
      this.render(chatbots);

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

  renderLoadError(message) {
    if (this.grid) {
      this.grid.innerHTML =
        '<div class="col-span-3 text-center py-xl text-muted">Failed to load chatbots. Please refresh and try again.</div>';
    }

    if (this.table) {
      const tbody = this.table.querySelector("tbody");
      if (tbody) {
        tbody.innerHTML =
          '<tr><td colspan="7" class="text-center py-xl text-muted">Failed to load chatbots. Please refresh and try again.</td></tr>';
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
            '<tr><td colspan="7" class="text-center">No chatbots found.</td></tr>';
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
                        <td>${bot.guests_count || 0}</td>
                        <td>${bot.messages_count || 0}</td>
                        <td>
                            <div class="table-actions">
                                <a href="create-chatbot.html?id=${bot.id}" class="btn btn-sm btn-icon btn-secondary"><i class="fas fa-edit"></i></a>
                                <button class="btn btn-sm btn-icon btn-danger" data-action="delete" data-id="${bot.id}" data-name="${bot.name}"><i class="fas fa-trash"></i></button>
                                <a href="create-chatbot.html?id=${bot.id}" class="btn btn-sm btn-icon btn-secondary"><i class="fas fa-cog"></i></a>
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
                        <span class="badge badge-${this.getStatusBadgeClass(bot.status)}">${bot.status}</span>
                    </div>
                    <div class="chatbot-card-body">
                        <div class="chatbot-card-item">
                            <span class="chatbot-card-item-icon"><i class="fas fa-calendar-alt"></i></span>
                            <span>${DateUtils.formatDateRange(bot.start_date, bot.end_date)}</span>
                        </div>
                        <div class="chatbot-card-item">
                            <span class="chatbot-card-item-icon"><i class="fas fa-users"></i></span>
                            <span>${bot.guests_count || 0} participants</span>
                        </div>
                        <div class="chatbot-card-item">
                            <span class="chatbot-card-item-icon"><i class="fas fa-comments"></i></span>
                            <span>${bot.messages_count || 0} conversations</span>
                        </div>
                    </div>
                    <div class="chatbot-card-footer">
                        <a href="create-chatbot.html?id=${bot.id}" class="btn btn-sm btn-secondary"><i class="fas fa-edit"></i> Edit</a>
                        <a href="create-chatbot.html?id=${bot.id}" class="btn btn-sm btn-secondary"><i class="fas fa-cog"></i> Settings</a>
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
  }

  setupEventListeners() {
    this.table.addEventListener("click", (e) => {
      const btn = e.target.closest('[data-action="delete"]');
      if (btn) {
        const id = btn.dataset.id;
        this.confirmDelete(id);
      }
    });
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
    // Simple stats calculation
    const total = guests.length;
    // Mocking status logic since we don't have detailed status in the Guest model yet (only is_speaker, etc.)
    // Assuming 'Active' for all for now, or based on properties if we add them.
    // For demonstration, let's treat everyone as 'Active' unless we add a status field.
    // In a real app we'd filter guests.filter(g => g.status === 'checked_in').length;

    const active = guests.length;
    const pending = 0; // Placeholder
    const vip = guests.filter((g) => g.is_speaker).length; // Let's use speakers as VIPs for now

    this.setText("total-guests-count", total);
    this.setText("active-guests-count", active);
    this.setText("pending-guests-count", pending);
    this.setText("vip-guests-count", vip);
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
        '<tr><td colspan="6" class="text-center">No guests found.</td></tr>';
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
                <td>${guest.email || "N/A"}</td>
                <td>${guest.chatbot_id ? "Linked Chatbot" : "General"}</td> <!-- We might need chatbot name here -->
                <td>${guest.is_speaker ? "Speaker" : "Standard"}</td>
                <td><span class="status-indicator status-active"><span class="status-dot"></span> Active</span></td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-sm btn-secondary"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${guest.id}"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `,
      )
      .join("");
  }
}
