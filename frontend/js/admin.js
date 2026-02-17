/* ============================================
   ADMIN PANEL FUNCTIONALITY
   ============================================ */

class AdminPanel {
  constructor() {
    this.currentChatbotId = null;
    this.init();
  }

  init() {
    this.setupSidebar();
    this.setupHeader();
    this.setupEventListeners();
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
    const logoutBtn = DomUtils.$('[data-action="logout"]');
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => this.logout());
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
      // Simulated data - replace with API call
      const stats = {
        totalChatbots: 12,
        activeEvents: 5,
        totalUsers: 847,
        upcomingEvents: 3,
      };

      // Update stat cards
      this.updateStatCard("total-chatbots", stats.totalChatbots);
      this.updateStatCard("total-users", stats.totalUsers);
      this.updateStatCard("upcoming-events", stats.upcomingEvents);

      // NotificationManager.success("Dashboard loaded successfully"); // Removed as requested
    } catch (error) {
      console.error("Error loading dashboard:", error);
      NotificationManager.error("Failed to load dashboard");
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
      await API.delete(`/api/chatbots/${id}`);
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
      window.location.href = "/index.html";
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
    this.setupDatePicker();
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
        () => (window.location.href = "/admin/chatbot-list.html"),
        1000,
      );
    } catch (error) {
      console.error("Form submission error:", error);
      NotificationManager.error("Failed to save chatbot");
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
  window.importExcel = new ImportExcelHandler();
  window.userManagement = new UserManagementHandler();
});
