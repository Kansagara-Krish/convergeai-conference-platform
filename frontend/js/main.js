/* ============================================
   USER PANEL & CHAT FUNCTIONALITY
   ============================================ */

class UserPanel {
  constructor() {
    this.currentUser = Storage.getUser();
    this.init();
  }

  getAvatarInitial(userLike = {}) {
    const candidate =
      String(
        userLike?.name || userLike?.username || userLike?.email || "U",
      ).trim() || "U";
    return candidate.charAt(0).toUpperCase();
  }

  init() {
    if (!this.currentUser) {
      AppAuth.redirectToLogin();
      return;
    }

    this.setupHeader();
    this.setupLogout();
    this.loadChatbots();
  }

  setupHeader() {
    const userMenu =
      DomUtils.$(".header-user-menu") || DomUtils.$(".user-profile-menu");
    const userBtn =
      userMenu?.querySelector(".header-user-btn") ||
      userMenu?.querySelector(".user-profile-btn");
    const userDropdown =
      userMenu?.querySelector(".chat-header-dropdown") ||
      userMenu?.querySelector(".dropdown-menu");

    if (userBtn && userDropdown) {
      userBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const isOpening = !userDropdown.classList.contains("active");
        if (isOpening) {
          const attachMenu = DomUtils.$("#chat-attach-menu");
          const attachBtn = DomUtils.$("#chat-attach-btn");
          const modeMenu = DomUtils.$("#chat-mode-menu");
          const modeBtn = DomUtils.$("#chat-mode-btn");

          if (attachMenu) {
            attachMenu.classList.remove("active");
            attachMenu.setAttribute("aria-hidden", "true");
          }
          if (attachBtn) {
            attachBtn.setAttribute("aria-expanded", "false");
          }

          if (modeMenu) {
            modeMenu.classList.remove("active");
            modeMenu.setAttribute("aria-hidden", "true");
          }
          if (modeBtn) {
            modeBtn.setAttribute("aria-expanded", "false");
          }
        }

        DomUtils.toggleClass(userDropdown, "active");
        DomUtils.toggleClass(userBtn, "active");
      });

      userDropdown.addEventListener("click", (e) => {
        e.stopPropagation();
      });

      document.addEventListener("click", () => {
        DomUtils.removeClass(userDropdown, "active");
        DomUtils.removeClass(userBtn, "active");
      });
    }

    const avatarTargets = [
      ...DomUtils.$$("[data-user-avatar]"),
      ...DomUtils.$$("[data-user-name]"),
    ];

    const initial = this.getAvatarInitial(this.currentUser || {});
    avatarTargets.forEach((avatar) => {
      avatar.textContent = initial;
    });
  }

  setupLogout() {
    const logoutBtns = DomUtils.$$('[data-action="logout"]');
    logoutBtns.forEach((logoutBtn) => {
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        ModalManager.confirm("Are you sure you want to logout?", () =>
          this.logout(),
        );
      });
    });
  }

  async loadChatbots() {
    const page = window.location.pathname;
    if (page.includes("user/dashboard") || page.includes("user-dashboard")) {
      try {
        const response = await API.get("/api/user/chatbots");
        const chatbots = Array.isArray(response?.data) ? response.data : [];

        this.renderChatbots(chatbots);
      } catch (error) {
        console.error("Error loading chatbots:", error);
        NotificationManager.error("Failed to load chatbots");
      }
    }
  }

  renderChatbots(chatbots) {
    const grid = DomUtils.$(".chatbot-grid");
    if (!grid) return;

    grid.innerHTML = chatbots
      .map(
        (chatbot) => `
      <div class="chatbot-available-card">
        <div class="chatbot-available-card-image"><i class="fas fa-robot"></i></div>
        <div class="chatbot-available-card-content">
          <h3 class="chatbot-available-card-title">${chatbot.name}</h3>
          <div class="chatbot-available-card-date"><i class="far fa-calendar-alt"></i> ${DateUtils.formatDateRange(chatbot.start_date, chatbot.end_date)}</div>
          <p class="chatbot-available-card-desc">${chatbot.description || "No description provided."}</p>
          <div class="chatbot-available-card-footer">
            <div class="chatbot-available-card-participants">
              <div class="chatbot-available-card-avatar" title="${chatbot.event_name || "Event"}">
                ${(chatbot.event_name || "E").substring(0, 1).toUpperCase()}
              </div>
              <span>${chatbot.guests_count || 0} guests</span>
            </div>
            <button class="btn btn-sm btn-primary" onclick="joinChatbot(${chatbot.id})">
              <i class="far fa-comments"></i> Join
            </button>
          </div>
        </div>
      </div>
    `,
      )
      .join("");
  }

  logout() {
    Storage.clear();
    NotificationManager.success("Logging out...");
    setTimeout(() => {
      AppAuth.redirectToLogin();
    }, 500);
  }
}

// ============================================
// CHAT INTERFACE
// ============================================

class ChatInterface {
  constructor() {
    this.currentUser = Storage.getUser() || {};
    this.messagesArea = DomUtils.$(".messages-area");
    this.inputField = DomUtils.$(".input-field");
    this.sendBtn = DomUtils.$(".send-btn");
    this.convListEl = DomUtils.$("#chat-conversations-list");
    this.newChatBtn = DomUtils.$("#new-chat-btn");
    this.chatMain = DomUtils.$(".chat-main");
    this.historyPanel =
      DomUtils.$("#chat-conversations") || DomUtils.$("#sidebar");
    this.historyToggleBtn = DomUtils.$("#chat-history-toggle");
    this.historyCloseBtn =
      DomUtils.$("#chat-history-close") || DomUtils.$("#toggleSidebar");
    this.historyBackdrop = DomUtils.$("#chat-history-backdrop");
    this.usagePanel = DomUtils.$("#chat-usage-panel");
    this.usageStepsLabel = DomUtils.$("#chat-usage-steps-label");
    this.usageStepsBar = DomUtils.$("#chat-usage-steps-bar");
    this.usageNote = DomUtils.$("#chat-usage-note");
    this.chatInputInfo = DomUtils.$(".chat-input-info");
    this.inputArea = DomUtils.$(".input-area");
    this.attachBtn = DomUtils.$("#chat-attach-btn");
    this.attachMenu = DomUtils.$("#chat-attach-menu");
    this.imageInput = DomUtils.$("#chat-image-input");
    this.filePreview = DomUtils.$("#chat-file-preview");
    this.previewRow = DomUtils.$("#composer-preview-row");
    this.modeBtn = DomUtils.$("#chat-mode-btn");
    this.modeMenu = DomUtils.$("#chat-mode-menu");
    this.modeOptions = DomUtils.$$(".chat-mode-option");
    this.contactToggleBtn = DomUtils.$("#chat-contact-toggle");
    this.contactModal = DomUtils.$("#chat-contact-modal");
    this.contactForm = DomUtils.$("#chat-contact-form");
    this.contactCancelBtn = DomUtils.$("#chat-contact-cancel");
    this.contactSubmitBtn = DomUtils.$("#chat-contact-submit");
    this.contactMeta = DomUtils.$("#chat-contact-meta");
    this.contactNameInput = DomUtils.$("#chat-contact-name");
    this.contactWhatsappInput = DomUtils.$("#chat-contact-whatsapp");
    this.contactCountryCodeInput = DomUtils.$("#chat-contact-country-code");
    this.contactNameError = DomUtils.$("#chat-contact-name-error");
    this.contactWhatsappError = DomUtils.$("#chat-contact-whatsapp-error");
    this.imageLightbox = DomUtils.$("#chat-image-lightbox");
    this.imageLightboxPreview = DomUtils.$("#chat-image-lightbox-preview");
    this.imageLightboxClose = DomUtils.$("#chat-image-lightbox-close");
    this.imageLightboxSend = DomUtils.$("#chat-image-lightbox-send");
    this.guestModeIcon = DomUtils.$(
      '.chat-mode-option[data-mode="guest"] .chat-mode-icon-img',
    );
    this.guestSelectorPanel = DomUtils.$("#chat-guest-selector-panel");
    this.guestSelectorList = DomUtils.$("#chat-guest-selector-list");
    this.overlay = DomUtils.$("#chat-overlay");
    this.overlayContent = DomUtils.$("#chat-overlay-content");
    this.overlayImage = DomUtils.$("#chat-overlay-image");
    this.overlayTitle = DomUtils.$("#chat-overlay-title");
    this.overlayHideTimer = null;
    this._cameraFacingMode = "environment";
    this._cameraDevices = [];
    this.selectedImageFile = null;
    this.selectedImagePreviewUrl = null;
    this.typingIndicatorEl = null;
    this.selectedContactImageUrl = "";
    this.isContactSubmitting = false;
    this.handleWindowResize = () => {
      this.updateMessageViewportInset();
      this.syncHistoryDrawerState();
    };
    this.chatUnavailable = false;
    this.chatUnavailableMessage = "";
    // chatbotId will be initialized via helper below
    this.chatbotId = null;
    this.messages = [];
    this.conversations = [];
    this.currentConversationId = null;
    this.isDesktopSidebarCollapsed = false;
    this.desktopSidebarStateKey = "chat:sidebar:collapsed";
    this._conversationMenuDocHandlerAttached = false;
    // Guest and background image tracking
    this.selectedGuest = null;
    this.selectedGuestImage = null;
    this.backgroundImageUrl = null;
    this.guests = [];
    this.selectedGuestIds = [];
    this.chatMode = "single";
    this.personMode = "single";
    this.isGuestModeEnabled = false;
    this.isMultiplePersonMode = false;
    this.isGenerationLocked = false;
    this.defaultInputInfoText = this.chatInputInfo
      ? this.chatInputInfo.textContent
      : "Image responses may take a few seconds to generate.";
    // set id then start
    this.chatbotId = this.getChatbotId();
    this.init();
  }

  isVolunteerUser() {
    const role = String(this.currentUser?.role || "")
      .trim()
      .toLowerCase();
    return role === "volunteer";
  }

  updateUsagePanelVisibility() {
    if (!this.usagePanel) return;
    this.usagePanel.style.display = this.isVolunteerUser() ? "none" : "";
  }

  // --- Conversation API helpers ---
  async loadConversations() {
    const response = await API.get(
      `/api/user/chatbots/${this.chatbotId}/conversations`,
    );
    this.conversations = Array.isArray(response?.data) ? response.data : [];
    this.renderConversations();
    return this.conversations;
  }

  renderConversations() {
    if (!this.convListEl) return;

    // Hide skeleton loaders
    const skeletons = this.convListEl.querySelectorAll(
      ".skeleton-conversation",
    );
    skeletons.forEach((s) => (s.style.display = "none"));

    if (!this.conversations || this.conversations.length === 0) {
      this.convListEl.innerHTML =
        '<div class="chat-conversations-empty">No conversations</div>';
      return;
    }

    const grouped = this.groupConversationsByDate(this.conversations);

    this.convListEl.innerHTML = grouped
      .map(({ label, rows }) => {
        const groupItems = rows
          .map((c) => {
            const title = this.escapeHtml(c.title || "New chat");
            const initial = this.escapeHtml(
              (c.title || "N").charAt(0).toUpperCase(),
            );
            return `<div class="conversation-item ${this.currentConversationId === c.id ? "active" : ""}" data-id="${c.id}">
          <button type="button" class="conversation-main" aria-label="Open ${title}">
          <span class="conv-avatar" aria-hidden="true">${initial}</span>
          <span class="conv-title text">${title}</span>
        </button>
        <div class="conv-menu-container">
          <button class="conv-menu-btn" title="More options" aria-label="More options">
            <span class="material-symbols-outlined">more_vert</span>
          </button>
          <div class="conv-menu-dropdown">
            <button class="conv-menu-item conv-rename-item">Rename</button>
            <button class="conv-menu-item conv-delete-item">Delete</button>
          </div>
        </div>
      </div>`;
          })
          .join("");

        return `<div class="conversation-date-label">${this.escapeHtml(label)}</div>${groupItems}`;
      })
      .join("");

    this.convListEl.querySelectorAll(".conversation-item").forEach((el) => {
      const id = parseInt(el.dataset.id);
      const mainBtn = el.querySelector(".conversation-main");
      const menuBtn = el.querySelector(".conv-menu-btn");
      const dropdown = el.querySelector(".conv-menu-dropdown");
      const renameBtn = el.querySelector(".conv-rename-item");
      const deleteBtn = el.querySelector(".conv-delete-item");

      // Handle conversation selection
      mainBtn?.addEventListener("click", () => this.selectConversation(id));

      // Handle menu toggle
      menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains("active");
        this.convListEl.querySelectorAll(".conv-menu-dropdown").forEach((d) => {
          d.classList.remove("active");
          d.classList.remove("open-down");
        });
        this.convListEl
          .querySelectorAll(".conversation-item")
          .forEach((item) => item.classList.remove("menu-open"));
        if (!isOpen) {
          const listRect = this.convListEl?.getBoundingClientRect();
          const itemRect = el.getBoundingClientRect();
          const estimatedMenuHeight = 98;
          const spaceAbove = listRect ? itemRect.top - listRect.top : 0;
          const spaceBelow = listRect ? listRect.bottom - itemRect.bottom : 0;
          const shouldOpenDown =
            spaceAbove < estimatedMenuHeight &&
            spaceBelow >= estimatedMenuHeight;

          dropdown.classList.toggle("open-down", shouldOpenDown);
          dropdown.classList.add("active");
          el.classList.add("menu-open");
        }
      });

      // Handle rename
      renameBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        dropdown.classList.remove("active");
        dropdown.classList.remove("open-down");
        el.classList.remove("menu-open");
        this.showRenameConversationModal(
          id,
          el.querySelector(".conv-title")?.textContent || "Conversation",
        );
      });

      // Handle delete
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        dropdown.classList.remove("active");
        dropdown.classList.remove("open-down");
        el.classList.remove("menu-open");
        this.showDeleteConversationModal(
          id,
          el.querySelector(".conv-title")?.textContent || "Conversation",
        );
      });
    });

    // Close menu when clicking outside
    if (!this._conversationMenuDocHandlerAttached) {
      this._conversationMenuDocHandlerAttached = true;
      document.addEventListener("click", () => {
        this.convListEl
          ?.querySelectorAll(".conv-menu-dropdown")
          .forEach((d) => {
            d.classList.remove("active");
            d.classList.remove("open-down");
          });
        this.convListEl
          ?.querySelectorAll(".conversation-item")
          .forEach((item) => item.classList.remove("menu-open"));
      });
    }
  }

  getConversationLabelDate(conversation) {
    return (
      conversation?.updated_at ||
      conversation?.last_message_at ||
      conversation?.created_at ||
      null
    );
  }

  formatConversationDateLabel(dateValue) {
    if (!dateValue) return "Older";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "Older";

    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const dateStart = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    const dayDiff = Math.floor((todayStart - dateStart) / 86400000);

    if (dayDiff <= 0) return "Today";
    if (dayDiff === 1) return "Yesterday";
    if (dayDiff < 7) return "Previous 7 Days";
    if (dayDiff < 30) return "Previous 30 Days";
    return date.toLocaleString(undefined, { month: "short", year: "numeric" });
  }

  groupConversationsByDate(conversations) {
    const groups = [];
    const index = new Map();

    conversations.forEach((conversation) => {
      const label = this.formatConversationDateLabel(
        this.getConversationLabelDate(conversation),
      );
      if (!index.has(label)) {
        index.set(label, groups.length);
        groups.push({ label, rows: [] });
      }
      groups[index.get(label)].rows.push(conversation);
    });

    return groups;
  }

  showDeleteConversationModal(conversationId, conversationTitle) {
    const modal = document.createElement("div");
    modal.className = "delete-modal-overlay";
    modal.innerHTML = `
      <div class="delete-modal">
        <div class="delete-modal-header">
          <h3>Delete Conversation?</h3>
          <button class="delete-modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="delete-modal-body">
          <p>Are you sure you want to delete <strong>${this.escapeHtml(conversationTitle || "this conversation")}</strong>? This action cannot be undone.</p>
        </div>
        <div class="delete-modal-footer">
          <button class="delete-modal-cancel">Cancel</button>
          <button class="delete-modal-confirm">Delete</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    const confirm = async () => {
      closeModal();
      try {
        await API.delete(
          `/api/user/chatbots/${this.chatbotId}/conversations/${conversationId}`,
        );
        this.conversations = this.conversations.filter(
          (row) => row.id !== conversationId,
        );
        if (this.currentConversationId === conversationId) {
          this.currentConversationId = null;
          this.messagesArea.innerHTML = "";
          if (this.conversations.length > 0) {
            await this.selectConversation(this.conversations[0].id);
          }
        }
        this.renderConversations();
        NotificationManager.success("Conversation deleted");
      } catch (error) {
        NotificationManager.error(
          error.message || "Failed to delete conversation",
        );
      }
    };

    modal
      .querySelector(".delete-modal-close")
      .addEventListener("click", closeModal);
    modal
      .querySelector(".delete-modal-cancel")
      .addEventListener("click", closeModal);
    modal
      .querySelector(".delete-modal-confirm")
      .addEventListener("click", confirm);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }

  showRenameConversationModal(conversationId, currentTitle) {
    const modal = document.createElement("div");
    modal.className = "rename-modal-overlay";
    modal.innerHTML = `
      <div class="rename-modal">
        <div class="rename-modal-header">
          <h3>Rename Conversation</h3>
          <button class="rename-modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="rename-modal-body">
          <input type="text" class="rename-modal-input" value="${this.escapeHtml(currentTitle)}" placeholder="Enter new name" autofocus>
        </div>
        <div class="rename-modal-footer">
          <button class="rename-modal-cancel">Cancel</button>
          <button class="rename-modal-confirm">Rename</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    const inputEl = modal.querySelector(".rename-modal-input");

    const confirmRename = async () => {
      const newTitle = (inputEl.value || "").trim();
      if (!newTitle) {
        NotificationManager.error("Name cannot be empty");
        return;
      }
      closeModal();
      try {
        const response = await API.put(
          `/api/user/chatbots/${this.chatbotId}/conversations/${conversationId}`,
          { title: newTitle },
        );
        const updated = response?.data;
        if (updated) {
          this.conversations = this.conversations.map((row) =>
            row.id === conversationId ? updated : row,
          );
          this.renderConversations();
          NotificationManager.success("Conversation renamed");
        }
      } catch (error) {
        NotificationManager.error(
          error.message || "Failed to rename conversation",
        );
      }
    };

    modal
      .querySelector(".rename-modal-close")
      .addEventListener("click", closeModal);
    modal
      .querySelector(".rename-modal-cancel")
      .addEventListener("click", closeModal);
    modal
      .querySelector(".rename-modal-confirm")
      .addEventListener("click", confirmRename);
    inputEl.addEventListener("keypress", (e) => {
      if (e.key === "Enter") confirmRename();
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }

  async createConversation(title = "New chat") {
    const response = await API.post(
      `/api/user/chatbots/${this.chatbotId}/conversations`,
      { title },
    );
    const created = response?.data;
    if (!created) return;
    this.conversations = [
      created,
      ...this.conversations.filter((row) => row.id !== created.id),
    ];
    this.renderConversations();
    await this.selectConversation(created.id);
  }

  async selectConversation(id) {
    this.currentConversationId = id;
    this.renderConversations();
    this.messagesArea.innerHTML = "";
    await this.loadMessages(id);
    this.closeHistoryDrawer();
  }

  isHistoryDrawerMode() {
    return window.innerWidth <= 1024;
  }

  isDesktopSidebarMode() {
    return window.innerWidth > 1024;
  }

  setDesktopSidebarState(isCollapsed, persist = true) {
    this.isDesktopSidebarCollapsed = Boolean(isCollapsed);

    if (persist) {
      try {
        localStorage.setItem(
          this.desktopSidebarStateKey,
          this.isDesktopSidebarCollapsed ? "1" : "0",
        );
      } catch (error) {
        // no-op if storage is unavailable
      }
    }

    const shouldCollapse =
      this.isDesktopSidebarMode() && this.isDesktopSidebarCollapsed;
    document.body.classList.toggle("chat-sidebar-collapsed", shouldCollapse);
    this.historyPanel?.classList.toggle("sidebar-collapsed", shouldCollapse);
    this.historyPanel?.classList.toggle("collapsed", shouldCollapse);
    this.historyPanel?.classList.toggle("expanded", !shouldCollapse);
    this.setHistoryToggleState(
      this.historyPanel?.classList.contains("drawer-open"),
    );
  }

  setHistoryToggleState(isOpen) {
    if (!this.historyToggleBtn && !this.historyCloseBtn) return;

    const iconEl = this.historyToggleBtn?.querySelector(
      ".material-symbols-outlined",
    );
    const closeIconEl = this.historyCloseBtn?.querySelector(
      ".material-symbols-outlined",
    );

    if (!this.isHistoryDrawerMode()) {
      const isExpanded = !this.isDesktopSidebarCollapsed;
      if (this.historyToggleBtn) {
        this.historyToggleBtn.setAttribute(
          "aria-expanded",
          isExpanded ? "true" : "false",
        );
        this.historyToggleBtn.classList.toggle("active", !isExpanded);
        this.historyToggleBtn.setAttribute(
          "aria-label",
          isExpanded ? "Collapse sidebar" : "Expand sidebar",
        );
        this.historyToggleBtn.setAttribute(
          "title",
          isExpanded ? "Collapse sidebar" : "Expand sidebar",
        );
      }
      if (this.historyCloseBtn) {
        this.historyCloseBtn.setAttribute(
          "aria-expanded",
          isExpanded ? "true" : "false",
        );
        this.historyCloseBtn.classList.toggle("active", !isExpanded);
        this.historyCloseBtn.setAttribute(
          "aria-label",
          isExpanded ? "Collapse sidebar" : "Expand sidebar",
        );
        this.historyCloseBtn.setAttribute(
          "title",
          isExpanded ? "Collapse sidebar" : "Expand sidebar",
        );
      }
      if (iconEl) {
        iconEl.textContent = isExpanded ? "menu_open" : "menu";
      }
      if (closeIconEl) {
        closeIconEl.textContent = isExpanded ? "menu_open" : "menu";
      }
      return;
    }

    if (this.historyToggleBtn) {
      this.historyToggleBtn.setAttribute(
        "aria-expanded",
        isOpen ? "true" : "false",
      );
      this.historyToggleBtn.classList.toggle("active", Boolean(isOpen));
      this.historyToggleBtn.setAttribute(
        "aria-label",
        isOpen ? "Close sidebar" : "Open sidebar",
      );
      this.historyToggleBtn.setAttribute(
        "title",
        isOpen ? "Close sidebar" : "Open sidebar",
      );
    }
    if (this.historyCloseBtn) {
      this.historyCloseBtn.setAttribute(
        "aria-expanded",
        isOpen ? "true" : "false",
      );
      this.historyCloseBtn.classList.toggle("active", Boolean(isOpen));
      this.historyCloseBtn.setAttribute(
        "aria-label",
        isOpen ? "Close sidebar" : "Open sidebar",
      );
      this.historyCloseBtn.setAttribute(
        "title",
        isOpen ? "Close sidebar" : "Open sidebar",
      );
    }
    if (iconEl) {
      iconEl.textContent = "menu";
    }
    if (closeIconEl) {
      closeIconEl.textContent = isOpen ? "close" : "menu";
    }
  }

  openHistoryDrawer() {
    if (!this.historyPanel || !this.isHistoryDrawerMode()) return;
    this.historyPanel.classList.add("drawer-open");
    document.body.classList.add("chat-history-open");
    this.setHistoryToggleState(true);
  }

  closeHistoryDrawer() {
    if (!this.historyPanel) return;
    this.historyPanel.classList.remove("drawer-open");
    document.body.classList.remove("chat-history-open");
    this.setHistoryToggleState(false);
  }

  toggleHistoryDrawer() {
    if (!this.historyPanel || !this.isHistoryDrawerMode()) return;
    const isOpen = this.historyPanel.classList.contains("drawer-open");
    if (isOpen) {
      this.closeHistoryDrawer();
    } else {
      this.openHistoryDrawer();
    }
  }

  toggleSidebarPanel() {
    if (this.isHistoryDrawerMode()) {
      this.toggleHistoryDrawer();
      return;
    }

    this.setDesktopSidebarState(!this.isDesktopSidebarCollapsed, true);
  }

  syncHistoryDrawerState() {
    if (this.isHistoryDrawerMode()) {
      document.body.classList.remove("chat-sidebar-collapsed");
      this.historyPanel?.classList.remove("sidebar-collapsed");
      this.setHistoryToggleState(
        this.historyPanel?.classList.contains("drawer-open"),
      );
      return;
    }

    this.closeHistoryDrawer();
    this.setDesktopSidebarState(this.isDesktopSidebarCollapsed, false);
  }

  setupHistoryDrawer() {
    if (!this.historyPanel) return;

    try {
      const stored = localStorage.getItem(this.desktopSidebarStateKey);
      this.isDesktopSidebarCollapsed = stored === "1";
    } catch (error) {
      this.isDesktopSidebarCollapsed = false;
    }

    this.historyToggleBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toggleSidebarPanel();
    });

    this.historyCloseBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toggleSidebarPanel();
    });

    this.historyBackdrop?.addEventListener("click", () => {
      this.closeHistoryDrawer();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this.closeHistoryDrawer();
      }
    });

    this.setDesktopSidebarState(this.isDesktopSidebarCollapsed, false);
    this.syncHistoryDrawerState();
  }

  getChatbotId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id") || null;
  }

  resolveMediaUrl(pathValue) {
    if (!pathValue) return null;

    const raw = String(pathValue).trim();
    if (!raw) return null;

    if (
      raw.startsWith("http://") ||
      raw.startsWith("https://") ||
      raw.startsWith("data:") ||
      raw.startsWith("blob:")
    ) {
      return raw;
    }

    let normalized = raw.replace(/\\/g, "/").replace(/^\/+/, "");

    const imageNameOnlyPattern = /^[^/]+\.(png|jpe?g|webp|gif)$/i;
    const isImageNameOnly = imageNameOnlyPattern.test(normalized);

    if (isImageNameOnly) {
      if (/^(test_)?guest[_-]/i.test(normalized)) {
        normalized = `uploads/guests/${normalized}`;
      } else {
        normalized = `static/generated/${normalized}`;
      }
    }

    if (
      normalized.startsWith("backgrounds/") ||
      normalized.startsWith("guests/") ||
      normalized.startsWith("guest_lists/")
    ) {
      normalized = `uploads/${normalized}`;
    }

    const base = String(API_BASE_URL || "").replace(/\/+$/, "");
    return `${base}/${normalized}`;
  }

  async resolveDefaultChatbotId() {
    try {
      const response = await API.get("/api/user/my-chatbots");
      const chatbots = response?.data || [];
      if (chatbots.length > 0) {
        this.chatbotId = chatbots[0].id;
      }
    } catch (error) {
      console.error("Error resolving default chatbot:", error);
    }
  }

  async loadUsageSummary() {
    if (!this.usagePanel) return;

    this.updateUsagePanelVisibility();
    if (this.isVolunteerUser()) {
      this.applyGenerationLimitState(false, { limited: false });
      return;
    }

    try {
      const response = await API.get("/api/user/usage");
      const usage = response?.data || {};
      this.renderUsageSummary(usage);
    } catch (error) {
      console.error("Failed to load usage summary:", error);
    }
  }

  renderUsageSummary(usage) {
    if (!this.usagePanel) return;

    const used = Number.isFinite(Number(usage?.used)) ? Number(usage.used) : 0;
    const limited = Boolean(usage?.limited);
    const limit = Number.isFinite(Number(usage?.limit))
      ? Number(usage.limit)
      : 0;

    const stepsLabel = limited ? `${used} / ${limit}` : `${used} / Unlimited`;
    if (this.usageStepsLabel) {
      this.usageStepsLabel.textContent = stepsLabel;
    }

    const stepsPercent =
      limited && limit > 0 ? Math.min((used / limit) * 100, 100) : 100;
    if (this.usageStepsBar) {
      this.usageStepsBar.style.width = `${Math.max(0, stepsPercent)}%`;
    }

    if (this.usageNote) {
      this.usageNote.textContent = limited
        ? `Remaining image generations: ${Math.max(limit - used, 0)}`
        : "Volunteer access: unlimited image generations.";
    }

    const isLimitReached = Boolean(limited && limit > 0 && used >= limit);
    this.applyGenerationLimitState(isLimitReached, usage);
  }

  applyGenerationLimitState(isLocked, usage = {}) {
    this.isGenerationLocked = Boolean(isLocked);

    if (this.newChatBtn) {
      this.newChatBtn.disabled = this.isGenerationLocked;
      this.newChatBtn.style.opacity = this.isGenerationLocked ? "0.45" : "";
      this.newChatBtn.style.pointerEvents = this.isGenerationLocked
        ? "none"
        : "";
    }

    if (this.attachBtn) {
      this.attachBtn.disabled = this.isGenerationLocked;
      this.attachBtn.style.opacity = this.isGenerationLocked ? "0.45" : "";
      this.attachBtn.style.pointerEvents = this.isGenerationLocked
        ? "none"
        : "";
      this.attachBtn.title = this.isGenerationLocked
        ? "Image generation limit reached"
        : "Attachments";
    }

    if (this.modeBtn) {
      this.modeBtn.disabled = this.isGenerationLocked;
      this.modeBtn.style.opacity = this.isGenerationLocked ? "0.45" : "";
      this.modeBtn.style.pointerEvents = this.isGenerationLocked ? "none" : "";
      this.modeBtn.title = this.isGenerationLocked
        ? "Image generation limit reached"
        : "Modes";
    }

    if (this.imageInput) {
      this.imageInput.disabled = this.isGenerationLocked;
    }

    if (this.inputField) {
      this.inputField.readOnly = this.isGenerationLocked;
      this.inputField.placeholder = this.isGenerationLocked
        ? "Image generation limit reached"
        : "Message ConvergeAI...";
    }

    if (this.isGenerationLocked) {
      this.closeAttachMenu();
      if (this.modeMenu && this.modeBtn) {
        this.modeMenu.classList.remove("active");
        this.modeMenu.setAttribute("aria-hidden", "true");
        this.modeBtn.setAttribute("aria-expanded", "false");
      }
      this.closeGuestSelectorPanel();
      this.clearSelectedImage();
      this.sendBtn.disabled = true;
      this.sendBtn.style.opacity = "0.45";
      this.sendBtn.classList.add("send-disabled");
      if (this.chatInputInfo) {
        const limit = Number.isFinite(Number(usage?.limit))
          ? Number(usage.limit)
          : 3;
        this.chatInputInfo.textContent = `Limit reached: you already generated ${limit} images. Contact admin to get volunteer access.`;
      }
      return;
    }

    if (this.chatInputInfo) {
      this.chatInputInfo.textContent = this.defaultInputInfoText;
    }

    this.updateSendButtonState();
  }

  async init() {
    if (!this.messagesArea || !this.inputField || !this.sendBtn) {
      console.warn("ChatInterface missing required DOM elements", {
        messagesArea: this.messagesArea,
        inputField: this.inputField,
        sendBtn: this.sendBtn,
      });
      return;
    }

    this.setInputVisible(true);
    this.updateMessageViewportInset();
    this.renderInitialChatLoading();

    if (!this.chatbotId) {
      await this.resolveDefaultChatbotId();
    }

    await this.loadUsageSummary();

    if (!this.chatbotId) {
      this.clearInitialChatLoading();
      this.renderNoChatbotState();
      return;
    }

    this.sendBtn.addEventListener("click", () => this.sendMessage());
    this.inputField.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    this.inputField.addEventListener("input", () => {
      this.autoResizeInput();
      this.updateSendButtonState();
    });

    this.setupAttachmentHandlers();
    this.setupGuestModeControls();
    this.setupGuestModeIcon();
    this.setupContactDetailsHandlers();
    this.setupImageLightboxHandlers();
    this.setupHistoryDrawer();

    let hasLoadedInitialConversationMessages = false;

    try {
      await this.loadConversations();
      if (this.conversations.length === 0) {
        await this.createConversation("New chat");
        hasLoadedInitialConversationMessages = true;
      } else {
        await this.selectConversation(this.conversations[0].id);
        hasLoadedInitialConversationMessages = true;
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
      NotificationManager.error(
        error.message || "Failed to load conversations",
      );
    }

    if (this.newChatBtn) {
      this.newChatBtn.addEventListener("click", async () => {
        try {
          await this.createConversation("New chat");
        } catch (error) {
          NotificationManager.error(
            error.message || "Failed to create conversation",
          );
        }
      });
    }

    // initialize send button state
    this.updateSendButtonState();

    const chatbotMeta = await this.loadChatbotMeta();

    if (!chatbotMeta) {
      this.clearInitialChatLoading();
      this.setInputVisible(false);
      return;
    }

    // prepare overlay support
    this.backgroundImageUrl = this.resolveMediaUrl(
      chatbotMeta?.background_image,
    );
    this.renderGuestWall(chatbotMeta?.guests || []);
    await this.initializeGuestSelectorData(chatbotMeta?.guests || []);

    // Handle unavailable chatbot
    if (this.chatUnavailable) {
      this.renderChatUnavailableNotice();
      this.clearInitialChatLoading();
      this.setInputVisible(false);
      return;
    }

    // Load message history for selected conversation
    if (this.currentConversationId && !hasLoadedInitialConversationMessages) {
      await this.loadMessages(this.currentConversationId);
    }

    this.clearInitialChatLoading();

    // Enable input and show it
    this.setInputVisible(true);
    this.autoResizeInput();
    this.setupAutoScroll();
    this.updateMessageViewportInset();
  }

  getMessagesSkeletonMarkup() {
    return `
      <div class="skeleton-message assistant">
        <div class="skeleton-message-bubble"></div>
      </div>
      <div class="skeleton-message assistant">
        <div class="skeleton-message-bubble skeleton-message-bubble-image"></div>
      </div>
      <div class="skeleton-message user">
        <div class="skeleton-message-bubble"></div>
      </div>
      <div class="skeleton-message assistant">
        <div class="skeleton-message-bubble"></div>
      </div>
    `;
  }

  renderInitialChatLoading() {
    if (this.convListEl) {
      this.convListEl.innerHTML = `
        <div class="skeleton-conversation"></div>
        <div class="skeleton-conversation"></div>
        <div class="skeleton-conversation"></div>
        <div class="skeleton-conversation"></div>
        <div class="skeleton-conversation"></div>
        <div class="chat-conversations-empty">No conversations yet. Start a new chat!</div>
      `;
    }

    this.showMessagesLoadingSkeleton();
  }

  clearInitialChatLoading() {
    if (this.inputArea) {
      this.inputArea.classList.remove("chat-input-loading");
    }
  }

  showMessagesLoadingSkeleton() {
    if (!this.messagesArea) return;
    this.messagesArea.innerHTML = this.getMessagesSkeletonMarkup();
  }

  setupGuestModeControls() {
    const closeModeMenu = () => {
      if (!this.modeMenu || !this.modeBtn) return;
      this.modeMenu.classList.remove("active");
      this.modeMenu.setAttribute("aria-hidden", "true");
      this.modeBtn.setAttribute("aria-expanded", "false");
    };

    const openModeMenu = () => {
      if (!this.modeMenu || !this.modeBtn) return;
      this.closeHeaderDropdown();
      this.closeAttachMenu();
      this.modeMenu.classList.add("active");
      this.modeMenu.setAttribute("aria-hidden", "false");
      this.modeBtn.setAttribute("aria-expanded", "true");
    };

    if (this.modeBtn) {
      this.modeBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        this.closeHeaderDropdown();
        this.closeAttachMenu();

        const isOpen = this.modeMenu?.classList.contains("active");
        if (isOpen) {
          closeModeMenu();
        } else {
          openModeMenu();
        }
      });
    }

    if (this.modeOptions && this.modeOptions.length > 0) {
      this.modeOptions.forEach((option) => {
        const guestImageEl = option.querySelector(".chat-mode-icon-img");
        if (guestImageEl) {
          guestImageEl.addEventListener("error", () => {
            option.classList.add("guest-icon-fallback");
          });
          guestImageEl.addEventListener("load", () => {
            option.classList.remove("guest-icon-fallback");
          });
        }

        option.addEventListener("click", (event) => {
          event.stopPropagation();
          const nextMode = option.dataset.mode || "guest";
          this.applyModeSelection(nextMode, true);
          closeModeMenu();
        });
      });
    }

    document.addEventListener("click", (event) => {
      const target = event.target;

      const clickedInsideMenu = this.modeMenu && this.modeMenu.contains(target);
      const clickedModeBtn = this.modeBtn && this.modeBtn.contains(target);

      if (!clickedInsideMenu && !clickedModeBtn) {
        closeModeMenu();
      }

      const isGuestPanelOpen =
        this.guestSelectorPanel &&
        this.guestSelectorPanel.classList.contains("active");
      if (!isGuestPanelOpen) return;

      const clickedInsideGuestPanel =
        this.guestSelectorPanel && this.guestSelectorPanel.contains(target);

      if (!clickedInsideGuestPanel && !clickedInsideMenu && !clickedModeBtn) {
        this.closeGuestSelectorPanel();
      }
    });

    if (this.modeMenu) {
      this.modeMenu.addEventListener("click", (event) => {
        event.stopPropagation();
      });
    }

    this.applyModeSelection("single", true);
  }

  setupGuestModeIcon() {
    if (!this.guestModeIcon) return;

    const base = String(API_BASE_URL || "").replace(/\/+$/, "");
    const iconUrl = base
      ? `${base}/uploads/guest_icon.jpg`
      : "/uploads/guest_icon.jpg";
    const fallbackUrl = "../assets/images/guest-mode-icon.svg";

    this.guestModeIcon.onerror = () => {
      this.guestModeIcon.onerror = null;
      this.guestModeIcon.src = fallbackUrl;
    };

    this.guestModeIcon.src = iconUrl;
  }

  applyModeSelection(modeValue, shouldSyncSelector = false) {
    const normalizedMode = ["guest", "single", "multiple"].includes(modeValue)
      ? modeValue
      : "single";

    if (normalizedMode === "guest") {
      this.isGuestModeEnabled = !this.isGuestModeEnabled;
    } else {
      this.personMode = normalizedMode;
      this.isMultiplePersonMode = normalizedMode === "multiple";
    }

    // Keep chatMode as the active person-mode for compatibility with existing flows.
    this.chatMode = this.personMode;

    if (shouldSyncSelector) {
      this.syncModeOptionSelection();
    }

    this.updateGuestSelectorVisibility();
    this.enforceGuestSelectionMode();
  }

  syncModeOptionSelection() {
    if (!this.modeOptions || this.modeOptions.length === 0) return;

    this.modeOptions.forEach((option) => {
      const optionMode = option.dataset.mode || "";
      let isActive = false;

      if (optionMode === "guest") {
        isActive = Boolean(this.isGuestModeEnabled);
      } else if (optionMode === "single") {
        isActive = this.personMode === "single";
      } else if (optionMode === "multiple") {
        isActive = this.personMode === "multiple";
      }

      option.classList.toggle("active", isActive);
      option.setAttribute("aria-pressed", String(isActive));
    });

    this.updateModeButtonVisual();
  }

  updateModeButtonVisual() {
    if (!this.modeBtn) return;

    const iconEl = this.modeBtn.querySelector(".material-symbols-outlined");
    if (iconEl) {
      iconEl.textContent = "tune";
    }

    this.modeBtn.setAttribute("title", "Modes");
    this.modeBtn.setAttribute("aria-label", "Modes");
  }

  isGuestMode() {
    return Boolean(this.isGuestModeEnabled);
  }

  getRequestModeValue() {
    if (this.isGuestMode()) {
      return "guest";
    }
    return this.isMultiplePersonMode ? "multiple_person" : "single_person";
  }

  updateGuestSelectorVisibility() {
    if (!this.guestSelectorPanel) return;

    const isVisible = this.isGuestMode();
    this.guestSelectorPanel.classList.toggle("active", isVisible);
    this.guestSelectorPanel.setAttribute("aria-hidden", String(!isVisible));
    if (this.inputArea) {
      this.inputArea.classList.toggle("guest-panel-open", isVisible);
    }
    this.updateMessageViewportInset();
  }

  openGuestSelectorPanel() {
    if (!this.guestSelectorPanel || !this.isGuestMode()) return;
    this.guestSelectorPanel.classList.add("active");
    this.guestSelectorPanel.setAttribute("aria-hidden", "false");
    if (this.inputArea) {
      this.inputArea.classList.add("guest-panel-open");
    }
    this.updateMessageViewportInset();
  }

  closeGuestSelectorPanel() {
    if (!this.guestSelectorPanel) return;
    this.guestSelectorPanel.classList.remove("active");
    this.guestSelectorPanel.setAttribute("aria-hidden", "true");
    if (this.inputArea) {
      this.inputArea.classList.remove("guest-panel-open");
    }
    this.updateMessageViewportInset();
  }

  closeHeaderDropdown() {
    const userDropdown = DomUtils.$(".chat-header-dropdown");
    const userBtn = DomUtils.$(".header-user-btn");

    if (userDropdown) {
      userDropdown.classList.remove("active");
    }
    if (userBtn) {
      userBtn.classList.remove("active");
    }
  }

  openAttachMenu() {
    if (!this.attachMenu || !this.attachBtn) return;

    this.closeHeaderDropdown();

    if (this.modeMenu && this.modeBtn) {
      this.modeMenu.classList.remove("active");
      this.modeMenu.setAttribute("aria-hidden", "true");
      this.modeBtn.setAttribute("aria-expanded", "false");
    }

    this.attachMenu.setAttribute("aria-hidden", "false");
    this.attachBtn.setAttribute("aria-expanded", "true");
    this.attachMenu.classList.add("active");
  }

  closeAttachMenu() {
    if (!this.attachMenu || !this.attachBtn) return;
    this.attachMenu.setAttribute("aria-hidden", "true");
    this.attachBtn.setAttribute("aria-expanded", "false");
    this.attachMenu.classList.remove("active");
  }

  validateSendRequirements() {
    return true;
  }

  setContactCtaVisible(visible) {
    if (!this.contactToggleBtn) return;
    this.contactToggleBtn.style.display = visible ? "inline-flex" : "none";
    this.updateMessageViewportInset();
  }

  sanitizeWhatsappDigits(value = "") {
    return String(value || "")
      .replace(/\D/g, "")
      .slice(0, 12);
  }

  sanitizeCountryCode(value = "") {
    const digits = String(value || "")
      .replace(/\D/g, "")
      .slice(0, 4);
    return digits ? `+${digits}` : "+";
  }

  setContactFieldError(field, message = "") {
    const normalizedMessage = String(message || "").trim();
    if (field === "name") {
      if (this.contactNameError) {
        this.contactNameError.textContent = normalizedMessage;
      }
      if (this.contactNameInput) {
        this.contactNameInput.classList.toggle(
          "is-invalid",
          !!normalizedMessage,
        );
        this.contactNameInput.setAttribute(
          "aria-invalid",
          normalizedMessage ? "true" : "false",
        );
      }
      return;
    }

    if (field === "whatsapp") {
      if (this.contactWhatsappError) {
        this.contactWhatsappError.textContent = normalizedMessage;
      }
      if (this.contactWhatsappInput) {
        this.contactWhatsappInput.classList.toggle(
          "is-invalid",
          !!normalizedMessage,
        );
        this.contactWhatsappInput.setAttribute(
          "aria-invalid",
          normalizedMessage ? "true" : "false",
        );
      }
      if (this.contactCountryCodeInput) {
        this.contactCountryCodeInput.classList.toggle(
          "is-invalid",
          !!normalizedMessage,
        );
        this.contactCountryCodeInput.setAttribute(
          "aria-invalid",
          normalizedMessage ? "true" : "false",
        );
      }
    }
  }

  clearContactValidationState() {
    this.setContactFieldError("name", "");
    this.setContactFieldError("whatsapp", "");
  }

  validateContactForm({ showErrors = false } = {}) {
    const name = String(this.contactNameInput?.value || "").trim();
    const countryCode = this.sanitizeCountryCode(
      this.contactCountryCodeInput?.value || "+91",
    );
    const whatsappDigits = this.sanitizeWhatsappDigits(
      this.contactWhatsappInput?.value || "",
    );
    const isNameValid = name.length >= 2;
    const isCountryCodeValid = /^\+[1-9]\d{0,3}$/.test(countryCode);
    const isWhatsappValid = /^\d{6,12}$/.test(whatsappDigits);
    const fullWhatsappNumber = `${countryCode}${whatsappDigits}`;
    const isFullWhatsappValid = /^\+[1-9]\d{7,14}$/.test(fullWhatsappNumber);

    if (showErrors) {
      this.setContactFieldError(
        "name",
        isNameValid ? "" : "Please enter at least 2 characters.",
      );
      this.setContactFieldError(
        "whatsapp",
        isCountryCodeValid && isWhatsappValid && isFullWhatsappValid
          ? ""
          : "Enter a valid country code and mobile number.",
      );
    }

    return {
      isValid:
        isNameValid &&
        isCountryCodeValid &&
        isWhatsappValid &&
        isFullWhatsappValid,
      isNameValid,
      isCountryCodeValid,
      isWhatsappValid,
      name,
      countryCode,
      whatsappDigits,
      fullWhatsappNumber,
    };
  }

  updateContactSubmitState() {
    if (!this.contactSubmitBtn) return;
    const { isValid } = this.validateContactForm({ showErrors: false });
    this.contactSubmitBtn.disabled = !isValid || this.isContactSubmitting;
  }

  getContactDetailsStorageKey() {
    if (this.isVolunteerUser()) return "";

    const userPart =
      this.currentUser?.id ||
      this.currentUser?.username ||
      this.currentUser?.email ||
      "default";
    return `chat_image_contact_details_${String(userPart).trim().toLowerCase()}`;
  }

  loadStoredContactDetails() {
    const key = this.getContactDetailsStorageKey();
    if (!key) return null;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  saveContactDetails(details = {}) {
    const key = this.getContactDetailsStorageKey();
    if (!key) return;

    const name = String(details?.name || "").trim();
    const countryCode = this.sanitizeCountryCode(details?.countryCode || "+91");
    const whatsappDigits = this.sanitizeWhatsappDigits(
      details?.whatsappDigits || "",
    );

    if (!name || !whatsappDigits) return;

    const payload = {
      name,
      countryCode,
      whatsappDigits,
      savedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (_) {
      // Ignore storage write issues (private mode/quota)
    }
  }

  prefillContactDetailsFromStorage() {
    if (this.isVolunteerUser()) return;

    const saved = this.loadStoredContactDetails();
    if (!saved) return;

    if (
      this.contactNameInput &&
      !String(this.contactNameInput.value || "").trim()
    ) {
      this.contactNameInput.value = String(saved?.name || "").trim();
    }

    if (this.contactCountryCodeInput) {
      const value = String(this.contactCountryCodeInput.value || "").trim();
      if (!value || value === "+") {
        this.contactCountryCodeInput.value = this.sanitizeCountryCode(
          saved?.countryCode || "+91",
        );
      }
    }

    if (
      this.contactWhatsappInput &&
      !String(this.contactWhatsappInput.value || "").trim()
    ) {
      this.contactWhatsappInput.value = this.sanitizeWhatsappDigits(
        saved?.whatsappDigits || "",
      );
    }
  }

  setContactSubmitLoading(isLoading) {
    this.isContactSubmitting = !!isLoading;
    if (!this.contactSubmitBtn) return;

    this.contactSubmitBtn.disabled = true;
    this.contactSubmitBtn.classList.toggle("is-loading", !!isLoading);
    this.contactSubmitBtn.textContent = isLoading ? "Sending..." : "Send";

    if (!isLoading) {
      this.updateContactSubmitState();
    }
  }

  openContactModal(imageUrl = "") {
    if (!this.contactModal) return;
    this.selectedContactImageUrl = String(
      imageUrl || this.selectedContactImageUrl || "",
    ).trim();
    if (this.contactCountryCodeInput) {
      const normalizedCode = this.sanitizeCountryCode(
        this.contactCountryCodeInput.value || "+91",
      );
      this.contactCountryCodeInput.value =
        normalizedCode === "+" ? "+91" : normalizedCode;
    }
    this.prefillContactDetailsFromStorage();
    this.clearContactValidationState();
    this.updateContactSubmitState();
    if (this.contactMeta) {
      this.contactMeta.textContent = this.selectedContactImageUrl
        ? "Selected image is ready to send."
        : "Select a generated image first.";
      this.contactMeta.classList.remove("is-error", "is-success");
    }
    this.contactModal.classList.add("active");
    this.contactModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("chat-contact-open");
    setTimeout(() => {
      this.contactNameInput?.focus();
    }, 80);
  }

  closeContactModal() {
    if (!this.contactModal) return;
    this.contactModal.classList.remove("active");
    this.contactModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("chat-contact-open");
    this.setContactSubmitLoading(false);
  }

  setupImageLightboxHandlers() {
    if (
      !this.messagesArea ||
      !this.imageLightbox ||
      !this.imageLightboxPreview
    ) {
      return;
    }

    this.messagesArea.addEventListener("click", (event) => {
      const clickedEl = event.target;
      if (!(clickedEl instanceof HTMLElement)) return;

      const target = clickedEl.classList.contains("message-image")
        ? clickedEl
        : clickedEl
            .closest(".message-image-frame")
            ?.querySelector(".message-image");
      if (!(target instanceof HTMLImageElement)) return;

      const src = String(target.getAttribute("src") || "").trim();
      if (!src) return;

      this.imageLightboxPreview.src = src;
      this.imageLightboxPreview.alt = String(
        target.getAttribute("alt") || "Image preview",
      );

      const canSendFromLightbox =
        String(target.dataset.contactEligible || "false") === "true";
      const canDriveFromLightbox =
        String(target.dataset.driveEligible || "false") === "true";
      this.selectedContactImageUrl = canSendFromLightbox ? src : "";
      if (this.imageLightboxSend) {
        this.imageLightboxSend.style.display = canSendFromLightbox
          ? "inline-flex"
          : "none";
        this.imageLightboxSend.setAttribute(
          "aria-hidden",
          String(!canSendFromLightbox),
        );
      }

      this.imageLightbox.classList.add("active");
      this.imageLightbox.setAttribute("aria-hidden", "false");
      document.body.classList.add("chat-image-lightbox-open");
    });

    const closeLightbox = () => {
      this.imageLightbox.classList.remove("active");
      this.imageLightbox.setAttribute("aria-hidden", "true");
      document.body.classList.remove("chat-image-lightbox-open");
      this.imageLightboxPreview.src = "";
    };

    this.imageLightboxClose?.addEventListener("click", closeLightbox);
    this.imageLightbox.addEventListener("click", (event) => {
      const clickedEl = event.target;
      if (!(clickedEl instanceof HTMLElement)) return;

      const isDesktop = window.matchMedia("(min-width: 769px)").matches;
      const clickedPreview = clickedEl.closest(".chat-image-lightbox-preview");
      const clickedSend = clickedEl.closest(".chat-image-lightbox-send");

      if (isDesktop && !clickedPreview && !clickedSend) {
        closeLightbox();
        return;
      }

      if (clickedEl === this.imageLightbox) {
        closeLightbox();
      }
    });

    this.imageLightboxSend?.addEventListener("click", () => {
      const focusedImageUrl = String(
        this.imageLightboxPreview?.src || "",
      ).trim();
      closeLightbox();
      this.openContactModal(focusedImageUrl);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;

      if (this.imageLightbox.classList.contains("active")) {
        closeLightbox();
        return;
      }

      if (this.contactModal.classList.contains("active")) {
        this.closeContactModal();
      }
    });
  }

  setupContactDetailsHandlers() {
    if (!this.contactModal || !this.contactForm) {
      return;
    }

    this.contactNameInput?.addEventListener("input", () => {
      this.setContactFieldError("name", "");
      if (this.contactMeta?.classList.contains("is-error")) {
        this.contactMeta.textContent = "";
        this.contactMeta.classList.remove("is-error", "is-success");
      }
      this.updateContactSubmitState();
    });

    this.contactCountryCodeInput?.addEventListener("input", () => {
      const sanitizedCode = this.sanitizeCountryCode(
        this.contactCountryCodeInput?.value || "+",
      );
      if (this.contactCountryCodeInput) {
        this.contactCountryCodeInput.value = sanitizedCode;
      }
      this.setContactFieldError("whatsapp", "");
      if (this.contactMeta?.classList.contains("is-error")) {
        this.contactMeta.textContent = "";
        this.contactMeta.classList.remove("is-error", "is-success");
      }
      this.updateContactSubmitState();
    });

    this.contactWhatsappInput?.addEventListener("input", () => {
      const sanitized = this.sanitizeWhatsappDigits(
        this.contactWhatsappInput?.value || "",
      );
      if (this.contactWhatsappInput) {
        this.contactWhatsappInput.value = sanitized;
      }
      this.setContactFieldError("whatsapp", "");
      if (this.contactMeta?.classList.contains("is-error")) {
        this.contactMeta.textContent = "";
        this.contactMeta.classList.remove("is-error", "is-success");
      }
      this.updateContactSubmitState();
    });

    this.contactCountryCodeInput?.addEventListener("blur", () => {
      const { isCountryCodeValid } = this.validateContactForm({
        showErrors: false,
      });
      if (!isCountryCodeValid) {
        this.setContactFieldError(
          "whatsapp",
          "Enter a valid country code and mobile number.",
        );
      }
    });

    this.contactWhatsappInput?.addEventListener("blur", () => {
      const { isWhatsappValid } = this.validateContactForm({
        showErrors: false,
      });
      if (!isWhatsappValid) {
        this.setContactFieldError(
          "whatsapp",
          "Enter a valid country code and mobile number.",
        );
      }
    });

    this.contactToggleBtn?.addEventListener("click", () => {
      this.openContactModal();
    });

    this.contactCancelBtn?.addEventListener("click", () =>
      this.closeContactModal(),
    );

    this.contactModal.addEventListener("click", (event) => {
      if (event.target === this.contactModal) {
        this.closeContactModal();
      }
    });

    this.contactForm.addEventListener("submit", (event) => {
      event.preventDefault();

      if (this.isContactSubmitting) return;

      const validation = this.validateContactForm({ showErrors: true });
      if (!validation.isValid) {
        this.updateContactSubmitState();
        return;
      }

      const name = validation.name;
      const whatsappFullNumber = validation.fullWhatsappNumber;

      const imageUrlToSend = String(this.selectedContactImageUrl || "").trim();
      if (!imageUrlToSend) {
        if (this.contactMeta) {
          this.contactMeta.textContent =
            "No generated image selected. Please use Send under an image.";
          this.contactMeta.classList.add("is-error");
          this.contactMeta.classList.remove("is-success");
        }
        NotificationManager.error("Please select a generated image first");
        return;
      }

      const sendDetails = async () => {
        try {
          this.setContactSubmitLoading(true);

          await API.post("/api/whatsapp/send-image", {
            name,
            whatsapp_number: whatsappFullNumber,
            image_url: imageUrlToSend,
            caption: `Hi ${name}, here is your generated conference image.`,
            conversation_id: this.currentConversationId,
            chatbot_id: this.chatbotId,
          });

          this.saveContactDetails({
            name,
            countryCode: validation.countryCode,
            whatsappDigits: validation.whatsappDigits,
          });

          if (this.contactMeta) {
            this.contactMeta.textContent = "Image sent successfully";
            this.contactMeta.classList.remove("is-error");
            this.contactMeta.classList.add("is-success");
          }
          NotificationManager.success("Image sent successfully");
          this.contactForm.reset();
          this.selectedContactImageUrl = "";
          setTimeout(() => this.closeContactModal(), 450);
        } catch (error) {
          const message = error?.message || "Failed to send image details";
          if (this.contactMeta) {
            this.contactMeta.textContent = message;
            this.contactMeta.classList.add("is-error");
            this.contactMeta.classList.remove("is-success");
          }
          NotificationManager.error(message);
        } finally {
          this.setContactSubmitLoading(false);
        }
      };

      sendDetails();
    });

    this.updateContactSubmitState();
  }

  getImageGenerationHelpMessage(rawMessage = "") {
    const msg = String(rawMessage || "").toLowerCase();

    if (
      msg.includes("api key") ||
      msg.includes("invalid_argument") ||
      msg.includes("permission") ||
      msg.includes("unauthorized") ||
      msg.includes("forbidden")
    ) {
      return "Image generation is temporarily unavailable due to API configuration. Please contact admin or volunteer support.";
    }

    if (
      msg.includes("quota") ||
      msg.includes("limit") ||
      msg.includes("resource_exhausted") ||
      msg.includes("rate") ||
      msg.includes("429")
    ) {
      return "Image generation limit has been reached for now. Please contact admin or volunteer support.";
    }

    return "Unable to generate image right now. Please try again or contact admin/volunteer support.";
  }

  isLikelyImageRequest(text, selectedImage) {
    if (selectedImage) return true;

    const requestedMode = this.getRequestModeValue();
    if (["guest", "single_person", "multiple_person"].includes(requestedMode)) {
      return true;
    }

    const content = String(text || "").toLowerCase();
    return /(generate|create|make|render)\s+.*(image|photo|portrait|picture)/.test(
      content,
    );
  }

  shouldShowImageGenerationLoader(text, selectedImage) {
    return this.isLikelyImageRequest(text, selectedImage);
  }

  showImageGenerationLoader() {
    if (!this.messagesArea) return null;

    const timestamp = DateUtils.formatTime(new Date());
    const loaderEl = DomUtils.create("div", "message-group assistant");
    loaderEl.classList.add("image-generation-loader");
    loaderEl.innerHTML = `
      <div class="message-bubble">
        <div class="message-image-loader-card" aria-hidden="true">
          <div class="message-image-loader-glow"></div>
          <div class="message-image-loader-sheen"></div>
        </div>
        <div class="message-image-loader-label">
          <span class="loader-text">Generating image...</span>
        </div>
        <div class="message-time">${timestamp}</div>
      </div>
    `;

    this.messagesArea.appendChild(loaderEl);
    this.scrollToBottom();

    return {
      element: loaderEl,
      startedAt: Date.now(),
      minDurationMs: 3000,
    };
  }

  async clearImageGenerationLoader(loaderState) {
    if (!loaderState || !loaderState.element) return;

    const elapsed = Date.now() - Number(loaderState.startedAt || Date.now());
    const remaining = Math.max(
      Number(loaderState.minDurationMs || 0) - elapsed,
      0,
    );

    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }

    if (loaderState.element.isConnected) {
      // Add fade-out animation
      loaderState.element.classList.add("fade-out");
      await new Promise((resolve) => setTimeout(resolve, 400));
      loaderState.element.remove();
    }
  }

  async preloadMessageImages(imageUrls = [], timeoutMs = 6000) {
    const sources = (Array.isArray(imageUrls) ? imageUrls : [])
      .map((url) => String(this.resolveMediaUrl(url) || url || "").trim())
      .filter((url) => Boolean(url));

    if (sources.length === 0) return;

    await Promise.all(
      sources.map(
        (src) =>
          new Promise((resolve) => {
            const img = new Image();
            let settled = false;
            const finish = () => {
              if (settled) return;
              settled = true;
              resolve();
            };
            const timer = setTimeout(
              finish,
              Math.max(Number(timeoutMs) || 0, 0),
            );

            img.onload = async () => {
              try {
                if (typeof img.decode === "function") {
                  await img.decode();
                }
              } catch (_) {
                // Decoding errors are non-fatal; continue with loaded image.
              }
              clearTimeout(timer);
              finish();
            };
            img.onerror = () => {
              clearTimeout(timer);
              finish();
            };

            img.src = src;
          }),
      ),
    );
  }

  async initializeGuestSelectorData(fallbackGuests = []) {
    const guestRecords = await this.loadGuestsFromApi();

    if (guestRecords.length > 0) {
      this.guests = guestRecords;
    } else if (Array.isArray(fallbackGuests)) {
      this.guests = fallbackGuests;
    }

    this.renderGuestSelectorList();
    this.enforceGuestSelectionMode();
  }

  async loadGuestsFromApi() {
    if (!this.chatbotId) return [];

    const endpoints = [`/api/user/guests?chatbot_id=${this.chatbotId}`];

    for (const endpoint of endpoints) {
      try {
        const response = await API.get(endpoint);
        const records = Array.isArray(response?.data) ? response.data : [];
        const normalized = this.normalizeGuestRecords(records);
        if (normalized.length > 0) {
          return normalized;
        }
      } catch (error) {
        continue;
      }
    }

    return [];
  }

  normalizeGuestRecords(guestRecords) {
    if (!Array.isArray(guestRecords)) return [];

    return guestRecords
      .map((guest) => {
        const guestId = Number(guest?.id);
        if (!Number.isFinite(guestId)) return null;

        const chatbotId = Number(guest?.chatbot_id);
        if (
          Number.isFinite(chatbotId) &&
          chatbotId !== Number(this.chatbotId)
        ) {
          return null;
        }

        return {
          ...guest,
          id: guestId,
          name: String(guest?.name || "").trim(),
          photo: guest?.photo || "",
        };
      })
      .filter((guest) => Boolean(guest?.name));
  }

  renderGuestSelectorList() {
    if (!this.guestSelectorList) return;

    this.guestSelectorList.innerHTML = "";

    if (!Array.isArray(this.guests) || this.guests.length === 0) {
      this.guestSelectorList.innerHTML =
        '<div class="chat-guest-selector-empty">No guests available</div>';
      return;
    }

    this.guests.forEach((guest) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "chat-guest-card";
      card.dataset.guestId = String(guest.id);
      card.setAttribute("aria-pressed", "false");

      const imageUrl = this.resolveMediaUrl(guest.photo);
      const safeName = this.escapeHtml(guest.name || "Guest");
      const fallbackLetter = safeName.charAt(0).toUpperCase() || "G";
      const imageMarkup = imageUrl
        ? `<img class="chat-guest-card-image" src="${imageUrl}" alt="${safeName}">`
        : `<div class="chat-guest-card-image">${fallbackLetter}</div>`;

      card.innerHTML = `
        ${imageMarkup}
        <div class="chat-guest-card-name">${safeName}</div>
      `;

      card.addEventListener("click", () => {
        this.toggleGuestSelection(guest.id);
      });

      this.guestSelectorList.appendChild(card);
    });

    this.syncGuestCardSelection();
  }

  toggleGuestSelection(guestId) {
    const normalizedId = Number(guestId);
    if (!Number.isFinite(normalizedId)) return;

    const hasSelected = this.selectedGuestIds.includes(normalizedId);

    if (this.isMultiplePersonMode) {
      this.selectedGuestIds = hasSelected
        ? this.selectedGuestIds.filter((id) => id !== normalizedId)
        : [...this.selectedGuestIds, normalizedId];
    } else {
      this.selectedGuestIds = hasSelected ? [] : [normalizedId];
    }

    this.syncGuestCardSelection();
    this.syncPrimarySelectedGuest();

    if (this.selectedGuestIds.length > 0) {
      this.closeGuestSelectorPanel();
    }
  }

  syncGuestCardSelection() {
    if (!this.guestSelectorList) return;

    this.guestSelectorList
      .querySelectorAll(".chat-guest-card")
      .forEach((card) => {
        const guestId = Number(card.dataset.guestId);
        const isSelected = this.selectedGuestIds.includes(guestId);
        card.classList.toggle("selected", isSelected);
        card.setAttribute("aria-pressed", String(isSelected));
      });
  }

  enforceGuestSelectionMode() {
    if (!this.isMultiplePersonMode && this.selectedGuestIds.length > 1) {
      this.selectedGuestIds = [this.selectedGuestIds[0]];
    }

    this.syncGuestCardSelection();
    this.syncPrimarySelectedGuest();
  }

  syncPrimarySelectedGuest() {
    const primaryGuestId = this.selectedGuestIds[0];
    const primaryGuest = this.guests.find(
      (guest) => guest.id === primaryGuestId,
    );

    if (!primaryGuest) {
      this.selectedGuest = null;
      this.selectedGuestImage = null;
      this.renderAttachmentPreview();
      return;
    }

    this.selectedGuest = primaryGuest;
    this.selectedGuestImage = primaryGuest.photo
      ? this.resolveMediaUrl(primaryGuest.photo)
      : null;
    this.renderAttachmentPreview();
  }

  updateSendButtonState() {
    if (this.isGenerationLocked) {
      if (this.sendBtn) {
        this.sendBtn.disabled = true;
        this.sendBtn.style.opacity = "0.45";
        this.sendBtn.classList.add("send-disabled");
      }
      return;
    }

    const hasText = Boolean(this.inputField && this.inputField.value.trim());
    const hasImage = Boolean(this.selectedImageFile);
    if (!this.sendBtn) return;
    if (hasText || hasImage) {
      this.sendBtn.disabled = false;
      this.sendBtn.style.opacity = "";
      this.sendBtn.classList.remove("send-disabled");
    } else {
      this.sendBtn.disabled = true;
      this.sendBtn.style.opacity = "0.45";
      this.sendBtn.classList.add("send-disabled");
    }
  }

  autoResizeInput() {
    if (!this.inputField) return;
    this.inputField.style.height = "auto";
    const nextHeight = Math.min(this.inputField.scrollHeight, 160);
    this.inputField.style.height = `${Math.max(nextHeight, 24)}px`;
    this.inputField.style.overflowY =
      this.inputField.scrollHeight > 160 ? "auto" : "hidden";
    this.updateMessageViewportInset();
  }

  updateMessageViewportInset() {
    if (!this.messagesArea) return;

    const previewIsVisible =
      this.previewRow && this.previewRow.style.display !== "none";
    const previewHeight = previewIsVisible
      ? this.previewRow.offsetHeight || 0
      : 0;

    if (this.inputArea) {
      this.inputArea.style.setProperty(
        "--composer-preview-height",
        `${previewHeight}px`,
      );
    }

    const isInputVisible =
      this.inputArea && !this.inputArea.classList.contains("chat-input-hidden");
    const bottomInset = isInputVisible
      ? Math.max((this.inputArea?.offsetHeight || 0) + 6, 90)
      : 24;

    this.messagesArea.style.setProperty(
      "--chat-bottom-inset",
      `${bottomInset}px`,
    );
  }

  renderNoChatbotState() {
    this.messagesArea.innerHTML = `
      <div class="chat-empty-state">
        <div class="chat-empty-title">No event chatbot assigned yet</div>
        <div class="chat-empty-text">Contact your administrator to get access to an event chatbot.</div>
      </div>
    `;
  }

  async sendMessage() {
    if (this.isGenerationLocked) {
      NotificationManager.warning(
        "Image generation limit reached. Contact admin to get volunteer access.",
      );
      return;
    }

    if (this.chatUnavailable) {
      NotificationManager.warning(
        this.chatUnavailableMessage ||
          "This chatbot is inactive and cannot accept new messages.",
      );
      return;
    }

    const text = this.inputField.value.trim();
    const selectedImage = this.selectedImageFile;

    if (!this.validateSendRequirements()) {
      return;
    }

    if (!text && !selectedImage) return;

    if (!this.currentConversationId) {
      await this.createConversation("New chat");
    }

    const userMessagePreview = text || "";

    const selectedGuestPreviewUrls = (
      Array.isArray(this.selectedGuestIds) ? this.selectedGuestIds : []
    )
      .map((guestId) =>
        this.guests.find((guest) => Number(guest?.id) === Number(guestId)),
      )
      .filter((guest) => Boolean(guest?.photo))
      .map((guest) => this.resolveMediaUrl(guest.photo))
      .filter((url) => Boolean(String(url || "").trim()));

    const userMessageImages = [];
    if (selectedImage) {
      userMessageImages.push(selectedImage);
    }
    selectedGuestPreviewUrls.forEach((url) => userMessageImages.push(url));
    if (this.backgroundImageUrl) {
      userMessageImages.push(this.backgroundImageUrl);
    }

    this.addMessage(
      userMessagePreview,
      "user",
      null,
      userMessageImages.length > 0 ? userMessageImages : null,
    );

    const selectedGuestImageForRequest = this.selectedGuestImage;

    const selectedGuestIdsForRequest = Array.from(
      new Set(
        (Array.isArray(this.selectedGuestIds) ? this.selectedGuestIds : [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id)),
      ),
    );
    if (
      selectedGuestIdsForRequest.length === 0 &&
      Number.isFinite(Number(this.selectedGuest?.id))
    ) {
      selectedGuestIdsForRequest.push(Number(this.selectedGuest.id));
    }

    this.inputField.value = "";
    this.autoResizeInput();
    this.clearSelectedImage();
    this.clearSelectedGuests();
    this.sendBtn.disabled = true;

    const useImageLoader = this.shouldShowImageGenerationLoader(
      text,
      selectedImage,
    );
    let imageLoaderState = null;

    try {
      if (useImageLoader) {
        imageLoaderState = this.showImageGenerationLoader();
      } else {
        this.startTypingIndicator();
      }

      // Fetch guest image if a guest is selected
      let guestImageBlob = null;
      if (selectedGuestImageForRequest) {
        console.log("📸 Fetching guest image...", selectedGuestImageForRequest);
        guestImageBlob = await this.urlToBlob(
          selectedGuestImageForRequest,
          "guest_image.jpg",
        );
      }

      const guestImageBlobs = [];
      for (const guestId of selectedGuestIdsForRequest) {
        const guest = this.guests.find((item) => Number(item?.id) === guestId);
        const guestPhotoUrl = guest?.photo
          ? this.resolveMediaUrl(guest.photo)
          : "";
        if (!guestPhotoUrl) continue;
        const blob = await this.urlToBlob(
          guestPhotoUrl,
          `guest_${guestId}.jpg`,
        );
        if (blob) {
          guestImageBlobs.push({ id: guestId, blob });
        }
      }

      // Fetch background image if available
      let backgroundImageBlob = null;
      if (this.backgroundImageUrl) {
        console.log("🖼️ Fetching background image...", this.backgroundImageUrl);
        backgroundImageBlob = await this.urlToBlob(
          this.backgroundImageUrl,
          "background_image.jpg",
        );
      }

      let response;
      try {
        response = await this.postChatMessage(
          text,
          selectedImage,
          this.currentConversationId,
          guestImageBlob,
          guestImageBlobs,
          selectedGuestIdsForRequest,
          backgroundImageBlob, // Pass fetched background image blob
        );
      } catch (error) {
        if (this.isNotJoinedError(error)) {
          const joined = await this.joinCurrentChatbotSilently();
          if (!joined) {
            throw error;
          }
          response = await this.postChatMessage(
            text,
            selectedImage,
            this.currentConversationId,
            guestImageBlob,
            guestImageBlobs,
            selectedGuestIdsForRequest,
            backgroundImageBlob,
          );
        } else {
          throw error;
        }
      }

      const payload = response?.data || {};
      const botResponse = payload.bot_response;
      const updatedConversation = payload.conversation;

      if (updatedConversation?.id) {
        this.conversations = [
          updatedConversation,
          ...this.conversations.filter(
            (row) => row.id !== updatedConversation.id,
          ),
        ];
        this.currentConversationId = updatedConversation.id;
        this.renderConversations();
      }

      const botText = String(botResponse?.content || "");
      const botMessageType = String(
        botResponse?.message_type || "text",
      ).toLowerCase();
      const responseImageUrls = [];

      if (botResponse?.image_url) {
        responseImageUrls.push(botResponse.image_url);
      }

      if (Array.isArray(botResponse?.image_urls)) {
        botResponse.image_urls
          .filter((url) => Boolean(String(url || "").trim()))
          .forEach((url) => responseImageUrls.push(url));
      }

      if (botMessageType === "image" && responseImageUrls.length > 0) {
        if (!imageLoaderState) {
          imageLoaderState = this.showImageGenerationLoader();
        }
        await this.preloadMessageImages(responseImageUrls);
        await this.clearImageGenerationLoader(imageLoaderState);
        this.addMessage(
          botText || "",
          "bot",
          botResponse?.timestamp,
          responseImageUrls,
          {
            showImageContactCta: true,
            showDriveUploadCta: true,
            fadeInMessage: true,
          },
        );
        this.setContactCtaVisible(true);
      } else if (botText || responseImageUrls.length > 0) {
        const shouldEnableContactCta =
          responseImageUrls.length > 0 &&
          this.isLikelyImageRequest(text, selectedImage);

        if (responseImageUrls.length > 0) {
          if (!imageLoaderState && shouldEnableContactCta) {
            imageLoaderState = this.showImageGenerationLoader();
          }
          await this.preloadMessageImages(responseImageUrls);
        }

        await this.clearImageGenerationLoader(imageLoaderState);
        this.addMessage(
          botText || "[Image generated]",
          "bot",
          botResponse?.timestamp,
          responseImageUrls,
          {
            showImageContactCta: shouldEnableContactCta,
            showDriveUploadCta: shouldEnableContactCta,
            fadeInMessage: shouldEnableContactCta,
          },
        );

        if (shouldEnableContactCta) {
          this.setContactCtaVisible(true);
        }
      }

      await this.loadUsageSummary();
    } catch (error) {
      console.error("Error sending message:", error);
      await this.clearImageGenerationLoader(imageLoaderState);
      if (this.isLikelyImageRequest(text, selectedImage)) {
        const helpMessage = this.getImageGenerationHelpMessage(error?.message);
        this.addMessage(helpMessage, "bot");
        NotificationManager.warning(helpMessage);
      } else {
        NotificationManager.error(error.message || "Failed to send message");
      }
      await this.loadUsageSummary();
    } finally {
      this.stopTypingIndicator();
      this.sendBtn.disabled = false;
      this.inputField.focus();
    }
  }

  async postChatMessage(
    text,
    selectedImage,
    conversationId,
    guestImage,
    guestImages,
    selectedGuestIds,
    backgroundImage,
  ) {
    const requestMode = this.getRequestModeValue();
    const normalizedGuestIds = Array.from(
      new Set(
        (Array.isArray(selectedGuestIds) ? selectedGuestIds : [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id)),
      ),
    );
    if (
      normalizedGuestIds.length === 0 &&
      Number.isFinite(Number(this.selectedGuest?.id))
    ) {
      normalizedGuestIds.push(Number(this.selectedGuest.id));
    }

    if (selectedImage) {
      const formData = new FormData();
      formData.append("content", text);
      formData.append("image", selectedImage);
      formData.append("mode", requestMode);
      formData.append(
        "multiple_person_mode",
        String(Boolean(this.isMultiplePersonMode)),
      );

      if (normalizedGuestIds.length > 0) {
        formData.append("guest_ids", JSON.stringify(normalizedGuestIds));
      }

      // Include guest image if selected
      if (guestImage) {
        formData.append("guest_image", guestImage);
      }

      if (Array.isArray(guestImages) && guestImages.length > 0) {
        guestImages.forEach((entry) => {
          if (!entry?.blob) return;
          formData.append(
            "guest_images",
            entry.blob,
            `guest_${entry.id || "image"}.jpg`,
          );
        });
      }

      // Include background image if available
      if (backgroundImage) {
        formData.append("background_image", backgroundImage);
      }

      // Include guest info if selected
      if (this.selectedGuest) {
        formData.append("guest_id", this.selectedGuest.id);
        formData.append("guest_name", this.selectedGuest.name);
      }

      if (conversationId) {
        formData.append("conversation_id", String(conversationId));
      }
      return API.post(
        `/api/user/chatbots/${this.chatbotId}/messages`,
        formData,
      );
    }

    return API.post(`/api/user/chatbots/${this.chatbotId}/messages`, {
      content: text,
      conversation_id: conversationId,
      mode: requestMode,
      multiple_person_mode: Boolean(this.isMultiplePersonMode),
      guest_ids: normalizedGuestIds,
    });
  }

  isNotJoinedError(error) {
    const message = String(error?.message || "").toLowerCase();
    return message.includes("not joined this chatbot");
  }

  async joinCurrentChatbotSilently() {
    if (!this.chatbotId) return false;

    try {
      await API.post(`/api/user/chatbots/${this.chatbotId}/join`, {});
      return true;
    } catch (joinError) {
      const message = String(joinError?.message || "").toLowerCase();
      if (message.includes("already joined")) {
        return true;
      }
      return false;
    }
  }

  setupAttachmentHandlers() {
    if (this.attachBtn && this.imageInput) {
      // Toggle attach menu instead of instantly opening file picker
      const attachMenu = this.attachMenu;
      const attachUpload = DomUtils.$("#chat-attach-upload");
      const attachCamera = DomUtils.$("#chat-attach-camera");

      this.attachBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (attachMenu && attachMenu.classList.contains("active")) {
          this.closeAttachMenu();
        } else {
          this.openAttachMenu();
        }
      });

      // Close menu when clicking outside
      document.addEventListener("click", (ev) => {
        const target = ev.target;
        if (!attachMenu) return;
        if (!attachMenu.contains(target) && target !== this.attachBtn) {
          this.closeAttachMenu();
        }
      });

      if (attachUpload) {
        attachUpload.addEventListener("click", (ev) => {
          ev.stopPropagation();
          this.closeAttachMenu();
          this.imageInput.click();
        });
      }

      if (attachCamera) {
        attachCamera.addEventListener("click", (ev) => {
          ev.stopPropagation();
          this.closeAttachMenu();
          this.openCameraModal();
        });
      }

      this.imageInput.addEventListener("change", () => {
        const file = this.imageInput.files?.[0] || null;
        if (!file) {
          this.clearSelectedImage();
          return;
        }

        const allowedMime = [
          "image/png",
          "image/jpeg",
          "image/jpg",
          "image/webp",
          "image/gif",
        ];

        if (!allowedMime.includes(file.type)) {
          NotificationManager.error(
            "Please choose PNG, JPG, JPEG, WEBP or GIF image",
          );
          this.clearSelectedImage();
          return;
        }

        if (file.size > 8 * 1024 * 1024) {
          NotificationManager.error("Image must be 8MB or smaller");
          this.clearSelectedImage();
          return;
        }

        this.selectedImageFile = file;
        this.renderAttachmentPreview();
        this.updateSendButtonState();
      });
    }
  }

  // Camera modal helpers
  openCameraModal() {
    // ask user to confirm that the photo should contain a person
    if (
      !confirm(
        "Please make sure the photo contains a person before continuing.",
      )
    ) {
      return;
    }
    const modal = DomUtils.$("#chat-camera-modal");
    const video = DomUtils.$("#chat-camera-video");
    if (!modal || !video) return;
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    this._startCameraStream();

    const captureBtn = DomUtils.$("#chat-camera-capture");
    const switchBtn = DomUtils.$("#chat-camera-switch");
    const closeBtn = DomUtils.$("#chat-camera-close");
    const backBtn = DomUtils.$("#chat-camera-back");

    if (captureBtn) {
      captureBtn.onclick = async () => {
        await this._captureCameraPhoto();
      };
    }

    if (switchBtn) {
      switchBtn.onclick = async () => {
        await this._toggleCameraFacingMode();
      };
    }

    if (closeBtn) {
      closeBtn.onclick = () => {
        this.closeCameraModal();
      };
    }

    if (backBtn) {
      backBtn.onclick = () => {
        this._returnToChatFromCamera();
      };
    }
  }

  closeCameraModal() {
    const modal = DomUtils.$("#chat-camera-modal");
    if (!modal) return;
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    this._stopCameraStream();
  }

  _returnToChatFromCamera() {
    this.closeCameraModal();
    const inputField = DomUtils.$(".input-field");
    if (inputField) {
      inputField.focus();
      return;
    }

    if (!/chat\.html$/i.test(window.location.pathname)) {
      window.location.href = "chat.html";
    }
  }

  async _startCameraStream() {
    try {
      const video = DomUtils.$("#chat-camera-video");
      if (!video) return;
      this._stopCameraStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: this._cameraFacingMode },
        },
      });
      video.srcObject = stream;
      video.play();
      this._cameraStream = stream;

      if (navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        this._cameraDevices = devices.filter((d) => d.kind === "videoinput");
      }

      this._updateCameraSwitchButtonState();
    } catch (err) {
      console.error("Camera access denied or unavailable:", err);
      const reason = err && err.message ? ` (${err.message})` : "";
      NotificationManager.error(
        "Unable to access camera — check your browser permissions, ensure a camera is connected, and that the page is served over HTTPS." +
          reason,
      );
      this.closeCameraModal();
    }
  }

  _updateCameraSwitchButtonState() {
    const switchBtn = DomUtils.$("#chat-camera-switch");
    if (!switchBtn) return;

    const hasMultipleCameras = (this._cameraDevices || []).length > 1;
    switchBtn.disabled = !hasMultipleCameras;
    switchBtn.style.opacity = hasMultipleCameras ? "" : "0.55";
    switchBtn.textContent =
      this._cameraFacingMode === "user" ? "Back Camera" : "Front Camera";
  }

  async _toggleCameraFacingMode() {
    this._cameraFacingMode =
      this._cameraFacingMode === "environment" ? "user" : "environment";
    await this._startCameraStream();
  }

  _stopCameraStream() {
    const stream = this._cameraStream;
    if (!stream) return;
    try {
      stream.getTracks().forEach((t) => t.stop());
    } catch (e) {
      // ignore
    }
    this._cameraStream = null;
    const video = DomUtils.$("#chat-camera-video");
    if (video) video.srcObject = null;
  }

  async _captureCameraPhoto() {
    const video = DomUtils.$("#chat-camera-video");
    const canvas = DomUtils.$("#chat-camera-canvas");
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          NotificationManager.error("Capture failed");
          resolve(null);
          return;
        }

        const file = new File([blob], `capture_${Date.now()}.png`, {
          type: blob.type,
        });
        this.selectedImageFile = file;
        this.renderAttachmentPreview();
        this.closeCameraModal();
        resolve(file);
      }, "image/png");
    });
  }

  renderAttachmentPreview() {
    if (!this.filePreview) return;

    const hasImage = Boolean(this.selectedImageFile);
    const hasGuests =
      Array.isArray(this.selectedGuestIds) && this.selectedGuestIds.length > 0;

    if (!hasImage && !hasGuests) {
      this.filePreview.innerHTML = "";
      this.filePreview.style.display = "none";
      if (this.previewRow) {
        this.previewRow.style.display = "none";
      }
      if (this.selectedImagePreviewUrl) {
        URL.revokeObjectURL(this.selectedImagePreviewUrl);
        this.selectedImagePreviewUrl = null;
      }
      this.updateMessageViewportInset();
      requestAnimationFrame(() => this.updateMessageViewportInset());
      return;
    }

    if (hasImage) {
      if (this.selectedImagePreviewUrl) {
        URL.revokeObjectURL(this.selectedImagePreviewUrl);
      }
      this.selectedImagePreviewUrl = URL.createObjectURL(
        this.selectedImageFile,
      );
    } else if (this.selectedImagePreviewUrl) {
      URL.revokeObjectURL(this.selectedImagePreviewUrl);
      this.selectedImagePreviewUrl = null;
    }

    const imagePreviewMarkup = hasImage
      ? `
      <div class="file-preview-item guest-preview-item image-preview-item">
        <img class="file-preview-thumb guest-preview-thumb" src="${this.selectedImagePreviewUrl}" alt="Selected image preview" />
        <div class="guest-preview-name">Your photo</div>
        <button type="button" class="file-preview-remove file-preview-remove-image" aria-label="Remove image">×</button>
      </div>
    `
      : "";

    const guestPreviewMarkup = (hasGuests ? this.selectedGuestIds : [])
      .map((guestId) => {
        const guest = this.guests.find((item) => item.id === Number(guestId));
        if (!guest) return "";
        const guestName = this.escapeHtml(guest.name || "Guest");
        const guestPhotoUrl = guest.photo
          ? this.resolveMediaUrl(guest.photo)
          : "";
        const guestInitial = (guestName || "G").charAt(0).toUpperCase();
        const thumbMarkup = guestPhotoUrl
          ? `<img class="file-preview-thumb guest-preview-thumb" src="${guestPhotoUrl}" alt="${guestName}">`
          : `<div class="file-preview-thumb guest-preview-fallback">${guestInitial}</div>`;

        return `
        <div class="file-preview-item guest-preview-item">
          ${thumbMarkup}
          <div class="guest-preview-name">${guestName}</div>
          <button type="button" class="file-preview-remove file-preview-remove-guest" data-guest-id="${guest.id}" aria-label="Remove ${guestName}">×</button>
        </div>
      `;
      })
      .join("");

    this.filePreview.innerHTML = `${imagePreviewMarkup}${guestPreviewMarkup}`;
    this.filePreview.style.display = "flex";
    if (this.previewRow) {
      this.previewRow.style.display = "flex";
    }

    const imageRemoveBtn = this.filePreview.querySelector(
      ".file-preview-remove-image",
    );
    if (imageRemoveBtn) {
      imageRemoveBtn.addEventListener("click", () => this.clearSelectedImage());
    }

    this.filePreview
      .querySelectorAll(".file-preview-remove-guest")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const guestId = Number(btn.dataset.guestId);
          if (!Number.isFinite(guestId)) return;
          this.selectedGuestIds = this.selectedGuestIds.filter(
            (id) => id !== guestId,
          );
          this.syncGuestCardSelection();
          this.syncPrimarySelectedGuest();
        });
      });

    this.updateMessageViewportInset();
    requestAnimationFrame(() => this.updateMessageViewportInset());
  }

  clearSelectedImage() {
    this.selectedImageFile = null;
    if (this.imageInput) {
      this.imageInput.value = "";
    }
    this.renderAttachmentPreview();
    this.updateSendButtonState();
  }

  clearSelectedGuests() {
    this.selectedGuestIds = [];
    this.selectedGuest = null;
    this.selectedGuestImage = null;
    this.syncGuestCardSelection();
    this.renderAttachmentPreview();
    this.updateSendButtonState();
  }

  extractImageUrlsFromText(text) {
    const sourceText = String(text || "");
    const imageUrls = [];
    const seen = new Set();
    const markdownImageRegex =
      /!\[[^\]]*\]\((https?:\/\/[^\s)]+|\/uploads\/[^\s)]+)\)/gi;

    let cleanedText = sourceText.replace(markdownImageRegex, (match, url) => {
      const normalizedUrl = String(url || "").trim();
      if (normalizedUrl && !seen.has(normalizedUrl)) {
        seen.add(normalizedUrl);
        imageUrls.push(normalizedUrl);
      }
      return "";
    });

    cleanedText = cleanedText.replace(/\n{3,}/g, "\n\n").trim();

    return {
      cleanText: cleanedText,
      imageUrls,
    };
  }

  addMessage(
    text,
    sender,
    messageTimestamp = null,
    imageInput = null,
    options = {},
  ) {
    const showImageContactCta = Boolean(options?.showImageContactCta);
    const showDriveUploadCta = Boolean(options?.showDriveUploadCta);
    const fadeInMessage = Boolean(options?.fadeInMessage);
    const timestamp = DateUtils.formatTime(messageTimestamp || new Date());
    const normalizedSender = sender === "user" ? "user" : "assistant";
    const placeholderValues = new Set(["[image uploaded]", "[image message]"]);
    const rawText = String(text || "").trim();
    const textForDisplay = placeholderValues.has(rawText.toLowerCase())
      ? ""
      : text;
    const { cleanText, imageUrls: inlineImageUrls } =
      this.extractImageUrlsFromText(textForDisplay);

    const message = {
      id: Date.now(),
      text: cleanText,
      sender: normalizedSender,
      timestamp: timestamp,
    };

    this.messages.push(message);

    const messageEl = DomUtils.create(
      "div",
      `message-group ${normalizedSender}`,
    );

    const imageSources = [];
    const pushImageSource = (value) => {
      if (!value) return;
      if (typeof value === "string") {
        const normalized = String(value).trim();
        if (!normalized) return;
        const resolved = this.resolveMediaUrl(normalized) || normalized;
        if (!imageSources.includes(resolved)) {
          imageSources.push(resolved);
        }
        return;
      }
      const objectUrl = URL.createObjectURL(value);
      if (!imageSources.includes(objectUrl)) {
        imageSources.push(objectUrl);
      }
    };

    if (Array.isArray(imageInput)) {
      imageInput.forEach((entry) => pushImageSource(entry));
    } else {
      pushImageSource(imageInput);
    }

    inlineImageUrls.forEach((entry) => pushImageSource(entry));

    const withImageFallback = (source) => {
      const safeSource = this.escapeHtml(source);
      return `<div class="message-image-frame loading"><span class="message-image-frame-skeleton" aria-hidden="true"></span><img class="message-image" src="${safeSource}" alt="Message image" loading="lazy" data-contact-eligible="${showImageContactCta ? "true" : "false"}" data-drive-eligible="${showDriveUploadCta ? "true" : "false"}" data-fallback-step="0" onload="(function(img){var frame=img.parentElement; if(frame){frame.classList.remove('loading');}})(this)" onerror="(function(img){var step=Number(img.dataset.fallbackStep||'0'); if(step===0){img.dataset.fallbackStep='1'; img.src=img.src.replace('/static/generated/','/uploads/messages/'); return;} if(step===1){img.dataset.fallbackStep='2'; img.src=img.src.replace('/uploads/messages/','/uploads/guests/'); return;} img.onerror=null; var frame=img.parentElement; if(frame){frame.classList.remove('loading'); frame.classList.add('failed');}})(this)" /></div>`;
    };

    let imageHtml = "";
    if (imageSources.length === 1) {
      imageHtml = withImageFallback(imageSources[0]);
    } else if (imageSources.length > 1) {
      const galleryItems = imageSources
        .map((source) => withImageFallback(source))
        .join("");
      imageHtml = `<div class="message-image-group count-${Math.min(imageSources.length, 6)}">${galleryItems}</div>`;
    }

    const renderedText = this.renderMessageContent(cleanText);
    const hideAssistantTextWhenImage =
      normalizedSender === "assistant" && imageSources.length > 0;
    const textHtml =
      !hideAssistantTextWhenImage && renderedText
        ? `<div class="message-text">${renderedText}</div>`
        : "";
    const shouldShowImageActions =
      normalizedSender === "assistant" && imageSources.length > 0;
    const imageActionButtonsHtml = shouldShowImageActions
      ? `
          <div class="message-image-actions">
            ${
              showImageContactCta
                ? `<button type="button" class="message-image-contact-btn" data-image-url="${this.escapeHtml(imageSources[0])}" aria-label="Send details for this generated image">
              <i class="fab fa-whatsapp" aria-hidden="true"></i>
              <span>Send</span>
            </button>`
                : ""
            }
          </div>
        `
      : "";

    messageEl.innerHTML = `
      <div class="message-bubble">
        ${textHtml}
        ${imageHtml}
        ${imageActionButtonsHtml}
        <div class="message-time">${timestamp}</div>
      </div>
    `;

    const messageContactBtn = messageEl.querySelector(
      ".message-image-contact-btn",
    );
    if (messageContactBtn) {
      messageContactBtn.addEventListener("click", () => {
        const selectedImage = String(
          messageContactBtn.dataset.imageUrl || "",
        ).trim();
        this.openContactModal(selectedImage);
      });
    }

    this.messagesArea.appendChild(messageEl);

    if (fadeInMessage) {
      messageEl.classList.add("message-fade-in");
      requestAnimationFrame(() => {
        messageEl.classList.add("message-fade-in-active");
      });
    }

    this.scrollToBottom();
  }

  async downloadGeneratedImage(imageUrl = "") {
    const sourceUrl = String(imageUrl || "").trim();
    if (!sourceUrl) return;

    const fallbackDownload = () => {
      const fallbackAnchor = document.createElement("a");
      fallbackAnchor.href = sourceUrl;
      fallbackAnchor.target = "_blank";
      fallbackAnchor.rel = "noopener noreferrer";
      fallbackAnchor.download = "ai-generated-image";
      document.body.appendChild(fallbackAnchor);
      fallbackAnchor.click();
      fallbackAnchor.remove();
    };

    try {
      const response = await fetch(sourceUrl, { mode: "cors" });
      if (!response.ok) {
        throw new Error("Unable to fetch generated image");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const extension = blob.type?.split("/")?.[1] || "png";
      const downloadAnchor = document.createElement("a");
      downloadAnchor.href = objectUrl;
      downloadAnchor.download = `ai-generated-${Date.now()}.${extension}`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1200);
    } catch (_) {
      fallbackDownload();
    }
  }

  async getGoogleDriveAuthStatus() {
    if (this.isVolunteerUser()) return false;
    try {
      const response = await API.get("/api/google/auth/status");
      return Boolean(response?.data?.connected);
    } catch (_) {
      return false;
    }
  }

  connectGoogleDriveWithPopup(authUrl, existingPopup = null) {
    return new Promise((resolve, reject) => {
      let popup = existingPopup;
      if (popup && !popup.closed) {
        try {
          popup.location.href = authUrl;
          popup.focus();
        } catch (_) {
          try {
            popup.close();
          } catch (_) {
            // no-op
          }
          popup = null;
        }
      }

      if (!popup) {
        popup = window.open(
          authUrl,
          "googleDriveOAuth",
          "popup=yes,width=560,height=720",
        );
      }

      if (!popup) {
        reject(new Error("Popup blocked. Please allow popups and try again."));
        return;
      }

      let settled = false;
      const timeoutMs = 120000;
      const startedAt = Date.now();

      const cleanup = () => {
        window.removeEventListener("message", handleMessage);
        window.clearInterval(pollTimer);
      };

      const finish = (ok, message = "") => {
        if (settled) return;
        settled = true;
        cleanup();
        if (ok) {
          resolve({ success: true, message });
        } else {
          reject(new Error(message || "Google Drive connection failed."));
        }
      };

      const handleMessage = (event) => {
        if (event.origin !== window.location.origin) return;
        const payload = event?.data || {};
        if (payload?.type !== "google-drive-connected") return;
        finish(Boolean(payload?.success), String(payload?.message || ""));
      };

      const pollTimer = window.setInterval(() => {
        if (popup.closed) {
          finish(false, "Google Drive connection window was closed.");
          return;
        }
        if (Date.now() - startedAt > timeoutMs) {
          try {
            popup.close();
          } catch (_) {
            // no-op
          }
          finish(false, "Google Drive connection timed out. Please try again.");
        }
      }, 500);

      window.addEventListener("message", handleMessage);
    });
  }

  async connectGoogleDrive(existingPopup = null) {
    const returnTo = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    const response = await API.get(
      `/api/google/auth/login?mode=json&popup=1&return_to=${encodeURIComponent(returnTo)}`,
    );
    const authUrl = String(response?.data?.auth_url || "").trim();
    if (!authUrl) {
      throw new Error("Unable to start Google Drive connection.");
    }

    await this.connectGoogleDriveWithPopup(authUrl, existingPopup);
    return this.getGoogleDriveAuthStatus();
  }

  preopenGoogleDrivePopup() {
    let popup = null;
    try {
      popup = window.open(
        "about:blank",
        "googleDriveOAuth",
        "popup=yes,width=560,height=720",
      );

      if (popup && !popup.closed) {
        popup.document.write(
          "<title>Connecting to Google Drive</title>" +
            '<body style="font-family:Arial,sans-serif;padding:16px;">Connecting to Google Drive...</body>',
        );
      }
    } catch (_) {
      // Ignore DOM setup errors
    }
    return popup;
  }

  closeDrivePopupSafely(popup) {
    if (!popup || popup.closed) return;
    try {
      popup.close();
    } catch (_) {
      // no-op
    }
  }

  async uploadGeneratedImageToDrive(imageUrl = "") {
    const chatbotId = Number(this.chatbotId);
    if (!Number.isFinite(chatbotId)) {
      throw new Error(
        "Chatbot context missing. Reload this chat and try again.",
      );
    }

    const response = await API.post("/api/drive/upload-generated-image", {
      chatbot_id: chatbotId,
      image_url: String(imageUrl || "").trim(),
    });

    const driveLink = String(response?.data?.drive_link || "").trim();
    if (!driveLink) {
      throw new Error(
        "Google Drive upload succeeded but no Drive link was returned.",
      );
    }

    return driveLink;
  }

  async uploadGeneratedImageToDriveDirect(imageUrl = "", triggerButton = null) {
    const selectedImage = String(imageUrl || "").trim();
    if (!selectedImage) {
      NotificationManager.error("Select a generated image first");
      return;
    }

    const actionButton =
      triggerButton instanceof HTMLElement ? triggerButton : null;
    const actionLabel = actionButton?.querySelector("span");
    const defaultLabel =
      actionLabel?.textContent ||
      (this.isVolunteerUser() ? "Choose Drive & Upload" : "Upload to Drive");
    const preopenedPopup = this.preopenGoogleDrivePopup();

    try {
      if (actionButton) {
        actionButton.disabled = true;
      }
      if (actionLabel) {
        actionLabel.textContent = "Uploading...";
      }

      let isConnected = await this.getGoogleDriveAuthStatus();
      if (!isConnected) {
        isConnected = await this.connectGoogleDrive(preopenedPopup);
      } else if (preopenedPopup && !preopenedPopup.closed) {
        this.closeDrivePopupSafely(preopenedPopup);
      }

      if (!isConnected) {
        throw new Error("Google Drive is not connected. Please try again.");
      }

      await this.uploadGeneratedImageToDrive(selectedImage);
      NotificationManager.success("Image uploaded to your Google Drive.");
    } catch (error) {
      this.closeDrivePopupSafely(preopenedPopup);
      NotificationManager.error(
        error?.message || "Failed to upload image to Google Drive.",
      );
    } finally {
      this.closeDrivePopupSafely(preopenedPopup);
      if (actionButton) {
        actionButton.disabled = false;
      }
      if (actionLabel) {
        actionLabel.textContent = defaultLabel;
      }
    }
  }

  isGeneratedAiImageMessage(
    content = "",
    messageType = "",
    isAssistant = false,
  ) {
    if (!isAssistant) return false;
    const normalizedType = String(messageType || "").toLowerCase();
    if (normalizedType === "image") return true;

    const normalizedContent = String(content || "").toLowerCase();
    return (
      normalizedContent.includes("image generated") ||
      normalizedContent.includes("generated image") ||
      normalizedContent.includes("ai generated")
    );
  }

  startTypingIndicator() {
    this.stopTypingIndicator();

    const indicator = DomUtils.create("div", "message-group assistant");
    indicator.innerHTML = `
      <div class="message-bubble typing-bubble">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    `;
    indicator.id = "typing-indicator";
    indicator.classList.add("typing-indicator-enter");

    this.messagesArea.appendChild(indicator);
    this.typingIndicatorEl = indicator;
    requestAnimationFrame(() => {
      indicator.classList.add("typing-indicator-enter-active");
    });
    this.scrollToBottom();
  }

  stopTypingIndicator() {
    const indicatorEl =
      this.typingIndicatorEl || DomUtils.$("#typing-indicator");
    if (indicatorEl) {
      indicatorEl.classList.remove("typing-indicator-enter-active");
      indicatorEl.classList.add("typing-indicator-exit");
      setTimeout(() => {
        indicatorEl.remove();
      }, 220);
    }
    this.typingIndicatorEl = null;
  }

  scrollToBottom() {
    setTimeout(() => {
      this.messagesArea.scrollTop = this.messagesArea.scrollHeight;
    }, 100);
  }

  setupAutoScroll() {
    window.addEventListener("resize", this.handleWindowResize);
    this.updateMessageViewportInset();
  }

  async loadMessages(conversationId = null) {
    try {
      const activeConversationId = conversationId || this.currentConversationId;
      if (!activeConversationId) {
        this.messagesArea.innerHTML = "";
        return;
      }

      this.showMessagesLoadingSkeleton();

      let response;
      try {
        response = await API.get(
          `/api/user/chatbots/${this.chatbotId}/conversations/${activeConversationId}/messages`,
        );
      } catch (error) {
        if (!this.isNotJoinedError(error)) {
          throw error;
        }

        const joined = await this.joinCurrentChatbotSilently();
        if (!joined) {
          throw error;
        }

        response = await API.get(
          `/api/user/chatbots/${this.chatbotId}/conversations/${activeConversationId}/messages`,
        );
      }

      const messages = Array.isArray(response?.data) ? response.data : [];
      const historyImageUrls = [];

      messages.forEach((msg) => {
        if (msg?.image_url) {
          historyImageUrls.push(msg.image_url);
        }
        if (Array.isArray(msg?.image_urls)) {
          msg.image_urls
            .filter((url) => Boolean(String(url || "").trim()))
            .forEach((url) => historyImageUrls.push(url));
        }
      });

      const hasHistoryImages = historyImageUrls.length > 0;
      const minSkeletonDelay = hasHistoryImages
        ? new Promise((resolve) => setTimeout(resolve, 3000))
        : Promise.resolve();

      await Promise.all([
        minSkeletonDelay,
        hasHistoryImages
          ? this.preloadMessageImages(historyImageUrls)
          : Promise.resolve(),
      ]);

      this.messages = [];
      this.messagesArea.innerHTML = "";
      let hasContactEligibleHistoryImage = false;

      messages.forEach((msg) => {
        const content = String(msg?.content || "");
        const messageType = String(msg?.message_type || "text").toLowerCase();
        const normalizedSender = msg?.sender === "user" ? "user" : "bot";
        const messageImageUrls = [];

        if (msg?.image_url) {
          messageImageUrls.push(msg.image_url);
        }
        if (Array.isArray(msg?.image_urls)) {
          msg.image_urls
            .filter((url) => Boolean(String(url || "").trim()))
            .forEach((url) => messageImageUrls.push(url));
        }

        const isAssistantImageMessage =
          normalizedSender !== "user" && messageImageUrls.length > 0;
        if (isAssistantImageMessage) {
          hasContactEligibleHistoryImage = true;
        }

        const shouldShowDriveUpload = this.isGeneratedAiImageMessage(
          content,
          messageType,
          normalizedSender !== "user",
        );

        if (messageType === "image") {
          if (messageImageUrls.length === 0) return;
          this.addMessage(
            content || "",
            normalizedSender,
            msg.timestamp,
            messageImageUrls,
            {
              showImageContactCta: isAssistantImageMessage,
              showDriveUploadCta: shouldShowDriveUpload,
            },
          );
          return;
        }

        if (!content && messageImageUrls.length === 0) return;
        this.addMessage(
          content || "[Image message]",
          normalizedSender,
          msg.timestamp,
          messageImageUrls,
          {
            showImageContactCta: isAssistantImageMessage,
            showDriveUploadCta: shouldShowDriveUpload,
          },
        );
      });

      this.setContactCtaVisible(hasContactEligibleHistoryImage);
    } catch (error) {
      console.error("Error loading messages:", error);
      if (this.messagesArea) {
        this.messagesArea.innerHTML = `
          <div class="message-group assistant">
            <div class="message-bubble">
              <div class="message-text">Unable to load messages right now. Please refresh and try again.</div>
              <div class="message-time">--:--</div>
            </div>
          </div>
        `;
      }
      NotificationManager.error(error.message || "Failed to load messages");
    }
  }

  async loadChatbotMeta() {
    try {
      const response = await API.get(`/api/chatbots/${this.chatbotId}`);
      const chatbot = response?.data;
      if (!chatbot) return null;

      const topTitleEl = DomUtils.$("#chatbot-top-title");
      const topAvatarEl = DomUtils.$("#chatbot-top-avatar");

      if (topTitleEl) {
        topTitleEl.textContent = chatbot.name || "ConvergeAI";
      }

      if (topAvatarEl) {
        topAvatarEl.textContent = String(chatbot.name || "ConvergeAI")
          .trim()
          .charAt(0)
          .toUpperCase();
      }

      const isExpired = chatbot.status === "expired";
      const isInactive =
        chatbot.active === false || chatbot.status === "inactive";
      this.chatUnavailable = Boolean(isExpired || isInactive);

      if (this.chatUnavailable) {
        const endDateText = chatbot.end_date
          ? DateUtils.formatDate(chatbot.end_date)
          : "its end date";
        this.chatUnavailableMessage = isExpired
          ? `This chatbot is inactive because the event ended on ${endDateText}.`
          : "This chatbot is currently inactive and cannot accept new messages.";
      }

      return chatbot;
    } catch (error) {
      console.error("Error loading chatbot meta:", error);
      return null;
    }
  }

  // ----- guest wall support -----

  renderGuestWall(guests) {
    const listEl = DomUtils.$("#chat-guest-wall-list");
    if (!listEl) return;
    listEl.innerHTML = "";
    const hasGuests = Array.isArray(guests) && guests.length > 0;

    // Store guests for tracking
    this.guests = hasGuests ? guests : [];

    if (hasGuests) {
      guests.forEach((g) => {
        const pill = document.createElement("div");
        pill.className = "chat-guest-pill";
        pill.textContent = g.name || "";
        pill.dataset.photo = g.photo || "";
        pill.dataset.guestId = g.id || "";
        pill.dataset.guestName = g.name || "";
        listEl.appendChild(pill);

        // Hover preview
        pill.addEventListener("mouseenter", () => {
          const url = this.resolveMediaUrl(pill.dataset.photo);
          this.showFocusPreview(url, "Guest");
        });

        // CLICK: Select guest
        pill.addEventListener("click", () => {
          this.selectGuest(g);
          pill.classList.add("active");
          // Remove active class from other pills
          listEl.querySelectorAll(".chat-guest-pill").forEach((p) => {
            if (p !== pill) p.classList.remove("active");
          });
        });
      });
    }

    if (this.backgroundImageUrl) {
      const backgroundPill = document.createElement("div");
      backgroundPill.className = "chat-guest-pill chat-guest-pill-bg";
      backgroundPill.textContent = "Event Background";
      listEl.appendChild(backgroundPill);

      backgroundPill.addEventListener("mouseenter", () => {
        this.showFocusPreview(this.backgroundImageUrl, "Background");
      });
    }

    if (!hasGuests && !this.backgroundImageUrl) {
      listEl.innerHTML = '<div class="chat-guest-wall-empty">No guests</div>';
    }

    const wall = DomUtils.$("#chat-guest-wall");

    if (wall) {
      const firstGuestWithPhoto = Array.isArray(guests)
        ? guests.find((g) => Boolean(g?.photo))
        : null;
      const defaultGuestUrl = firstGuestWithPhoto?.photo
        ? this.resolveMediaUrl(firstGuestWithPhoto.photo)
        : null;

      wall.addEventListener("mouseenter", () => {
        this.showFocusPreview(defaultGuestUrl, "Guest");
      });
      wall.addEventListener("mouseleave", () => {
        this.hideFocusPreview();
      });
    }
  }

  /**
   * Select a guest and store their image URL
   */
  selectGuest(guest) {
    const guestId = Number(guest?.id);
    if (Number.isFinite(guestId)) {
      this.selectedGuestIds = this.isMultiplePersonMode
        ? Array.from(new Set([...this.selectedGuestIds, guestId]))
        : [guestId];
      this.syncGuestCardSelection();
    }

    this.selectedGuest = guest;
    this.selectedGuestImage = guest.photo
      ? this.resolveMediaUrl(guest.photo)
      : null;

    console.log("💬 Guest selected:", {
      name: guest.name,
      id: guest.id,
      photo: this.selectedGuestImage,
    });

    if (!this.isMultiplePersonMode) {
      NotificationManager.success(`Selected: ${guest.name}`);
    }
  }

  /**
   * Convert an image URL to a Blob for FormData submission
   * @param {string} imageUrl - The URL of the image to convert
   * @param {string} filename - The filename to use for the Blob
   * @returns {Promise<Blob|null>} The Blob object or null if conversion fails
   */
  async urlToBlob(imageUrl, filename = "image.jpg") {
    try {
      if (!imageUrl) return null;

      const response = await fetch(imageUrl);
      if (!response.ok) {
        console.error(`Failed to fetch image: ${response.status}`);
        return null;
      }

      const blob = await response.blob();
      console.log(`✅ Converted image to Blob:`, filename, blob.size, "bytes");
      return blob;
    } catch (error) {
      console.error(`Error converting image URL to Blob:`, error);
      return null;
    }
  }

  showFocusPreview(url, label = "Guest Preview") {
    if (!this.overlay || !this.overlayImage || !url) return;

    if (this.overlayHideTimer) {
      clearTimeout(this.overlayHideTimer);
      this.overlayHideTimer = null;
    }

    if (this.overlayTitle) {
      this.overlayTitle.textContent = `${label} Preview`;
    }

    this.overlay.classList.remove("leaving");
    this.overlay.classList.add("active", "entering");
    document.body.classList.add("chat-focus-active");

    this.overlayImage.onerror = () => {
      this.hideFocusPreview();
    };
    this.overlayImage.onload = () => {
      this.overlay.classList.remove("entering");
      void this.overlay.offsetWidth;
      this.overlay.classList.add("entering");
    };

    this.overlayImage.src = url;
  }

  hideFocusPreview() {
    if (!this.overlay || !this.overlay.classList.contains("active")) return;

    this.overlay.classList.remove("entering");
    this.overlay.classList.add("leaving");

    if (this.overlayHideTimer) {
      clearTimeout(this.overlayHideTimer);
    }

    this.overlayHideTimer = setTimeout(() => {
      this.overlay.classList.remove("active", "leaving");
      document.body.classList.remove("chat-focus-active");
    }, 280);
  }

  renderChatUnavailableNotice() {
    const notice = DomUtils.create("div", "chat-empty-state");
    notice.innerHTML = `
      <div class="chat-empty-title">Chat is unavailable</div>
      <div class="chat-empty-text">${this.escapeHtml(
        this.chatUnavailableMessage ||
          "This chatbot is inactive and cannot accept new messages.",
      )}</div>
    `;
    this.messagesArea.appendChild(notice);
    this.scrollToBottom();
  }

  setInputVisible(visible) {
    if (!this.inputArea) return;

    if (!visible) {
      this.inputArea.classList.add("chat-input-hidden");
      this.inputArea.classList.remove("chat-input-reveal");
      this.updateMessageViewportInset();
      return;
    }

    this.inputArea.classList.remove("chat-input-hidden");
    this.inputArea.classList.add("chat-input-reveal");
    this.updateMessageViewportInset();
    setTimeout(() => {
      this.inputArea.classList.remove("chat-input-reveal");
      this.updateMessageViewportInset();
      this.inputField.focus();
    }, 450);
  }

  renderMessageContent(text) {
    const normalized = String(text || "").replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    const htmlParts = [];
    let inUl = false;
    let inOl = false;

    const closeLists = () => {
      if (inUl) {
        htmlParts.push("</ul>");
        inUl = false;
      }
      if (inOl) {
        htmlParts.push("</ol>");
        inOl = false;
      }
    };

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        closeLists();
        htmlParts.push("<p></p>");
        return;
      }

      const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/);
      if (unorderedMatch) {
        if (inOl) {
          htmlParts.push("</ol>");
          inOl = false;
        }
        if (!inUl) {
          htmlParts.push("<ul>");
          inUl = true;
        }
        htmlParts.push(
          `<li>${this.formatInlineMarkdown(unorderedMatch[1])}</li>`,
        );
        return;
      }

      const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
      if (orderedMatch) {
        if (inUl) {
          htmlParts.push("</ul>");
          inUl = false;
        }
        if (!inOl) {
          htmlParts.push("<ol>");
          inOl = true;
        }
        htmlParts.push(
          `<li>${this.formatInlineMarkdown(orderedMatch[1])}</li>`,
        );
        return;
      }

      closeLists();
      htmlParts.push(`<p>${this.formatInlineMarkdown(trimmed)}</p>`);
    });

    closeLists();

    return htmlParts
      .join("")
      .replace(/(<p><\/p>){2,}/g, "<p></p>")
      .replace(/^<p><\/p>|<p><\/p>$/g, "");
  }

  formatInlineMarkdown(text) {
    let escaped = this.escapeHtml(text);
    escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
    escaped = escaped.replace(/\*\*([^*][\s\S]*?)\*\*/g, "<strong>$1</strong>");
    escaped = escaped.replace(/__([^_][\s\S]*?)__/g, "<strong>$1</strong>");
    escaped = escaped.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
    escaped = escaped.replace(/_([^_\n]+)_/g, "<em>$1</em>");
    return escaped;
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// ============================================
// LOGIN HANDLER
// ============================================

class LoginHandler {
  constructor() {
    this.form = DomUtils.$('form[data-form="login"]');
    this.loginMode = "password";
    this.otpRequested = false;
    this.otpExpiresAt = 0;
    this.otpResendAt = 0;
    this.otpCountdownTimer = null;
    if (this.form) {
      this.init();
    }
  }

  init() {
    this.restoreRememberPreference();
    this.redirectIfAuthenticated();

    this.passwordGroup = this.form.querySelector("#password-login-fields");
    this.otpGroup = this.form.querySelector("#otp-login-fields");
    this.otpEntryGroup = this.form.querySelector("#otp-entry-group");
    this.otpInput = this.form.querySelector('input[name="otp"]');
    this.otpMeta = this.form.querySelector("#otp-meta");
    this.otpTimer = this.form.querySelector("#otp-timer");
    this.otpRequestBtn = this.form.querySelector("#otp-request-btn");
    this.otpResendBtn = this.form.querySelector("#otp-resend-btn");
    this.otpLinkBtn = this.form.querySelector("#otp-login-link");
    this.passwordLinkBtn = this.form.querySelector("#password-login-link");
    this.submitBtn = this.form.querySelector('button[type="submit"]');
    this.submitBtnText = this.submitBtn?.querySelector(".btn-text");
    this.submitBtnLoader = this.submitBtn?.querySelector(".btn-loader");

    this.setupModeLinks();
    this.setMode("password");

    this.form.addEventListener("submit", (e) => {
      this.handleLogin(e);
    });

    const usernameInput = this.form.querySelector('input[name="username"]');
    const passwordInput = this.form.querySelector('input[name="password"]');

    if (usernameInput) {
      usernameInput.addEventListener("blur", () =>
        this.validateField("username"),
      );
      usernameInput.addEventListener("input", () =>
        this.clearError("username"),
      );
    }

    if (passwordInput) {
      passwordInput.addEventListener("blur", () =>
        this.validateField("password"),
      );
      passwordInput.addEventListener("input", () =>
        this.clearError("password"),
      );
    }

    if (this.otpInput) {
      this.otpInput.addEventListener("input", () => {
        this.clearError("otp");
        this.otpInput.value = this.otpInput.value
          .replace(/\D/g, "")
          .slice(0, 6);
      });
      this.otpInput.addEventListener("blur", () => this.validateField("otp"));
    }

    if (this.otpRequestBtn) {
      this.otpRequestBtn.addEventListener("click", () =>
        this.requestOtp(false),
      );
    }

    if (this.otpResendBtn) {
      this.otpResendBtn.addEventListener("click", () => this.requestOtp(true));
    }
  }

  restoreRememberPreference() {
    const rememberInput = this.form.querySelector('input[name="remember"]');
    if (!rememberInput) return;

    rememberInput.checked = Boolean(Storage.getRememberMe());
  }

  async redirectIfAuthenticated() {
    const token = Storage.getToken();
    const user = Storage.getUser();

    if (!token || !user) {
      return;
    }

    let role = String(user.role || "").toLowerCase();

    try {
      const verifyResponse = await API.get("/api/auth/verify");
      const verifiedUser = verifyResponse?.user || user;
      Storage.setUser(verifiedUser);
      role = String(verifiedUser.role || role).toLowerCase();
    } catch (error) {
      console.warn("Existing session is not valid:", error);
      return;
    }

    if (role === "admin") {
      window.location.href = "admin/dashboard.html";
      return;
    }

    const redirectUrl = await this.resolvePostLoginDestination(role);
    window.location.href = redirectUrl;
  }

  escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = String(value || "");
    return div.innerHTML;
  }

  setupModeLinks() {
    this.otpLinkBtn?.addEventListener("click", () => this.setMode("otp"));
    this.passwordLinkBtn?.addEventListener("click", () =>
      this.setMode("password"),
    );
  }

  setElementVisibility(element, visible, displayValue = "inline-flex") {
    if (!element) return;
    element.style.display = visible ? displayValue : "none";
  }

  setPanelActive(panel, active) {
    if (!panel) return;
    panel.classList.toggle("is-active", active);
    panel.setAttribute("aria-hidden", active ? "false" : "true");
  }

  animatePanelSwitch(fromPanel, toPanel) {
    if (!fromPanel || !toPanel || fromPanel === toPanel) {
      this.setPanelActive(fromPanel, false);
      this.setPanelActive(toPanel, true);
      return;
    }

    fromPanel.classList.remove("panel-slide-in");
    toPanel.classList.remove("panel-slide-out");

    fromPanel.classList.add("panel-slide-out");
    this.setPanelActive(toPanel, true);

    requestAnimationFrame(() => {
      toPanel.classList.add("panel-slide-in");
    });

    setTimeout(() => {
      this.setPanelActive(fromPanel, false);
      fromPanel.classList.remove("panel-slide-out");
      toPanel.classList.remove("panel-slide-in");
    }, 220);
  }

  resetOtpState() {
    this.otpRequested = false;
    this.otpExpiresAt = 0;
    this.otpResendAt = 0;

    if (this.otpCountdownTimer) {
      clearInterval(this.otpCountdownTimer);
      this.otpCountdownTimer = null;
    }

    if (this.otpInput) {
      this.otpInput.value = "";
    }

    this.updateOtpMetaText("");
    if (this.otpTimer) {
      this.otpTimer.textContent = "";
    }
    this.clearError("otp");
  }

  setMode(mode) {
    const modeChanged = this.loginMode !== mode;
    this.loginMode = mode;

    if (mode === "password" && modeChanged) {
      this.resetOtpState();
    }

    if (modeChanged) {
      if (mode === "otp") {
        this.animatePanelSwitch(this.passwordGroup, this.otpGroup);
      } else if (mode === "password") {
        this.animatePanelSwitch(this.otpGroup, this.passwordGroup);
      }
    } else {
      this.setPanelActive(this.passwordGroup, mode === "password");
      this.setPanelActive(this.otpGroup, mode === "otp");
    }

    if (this.submitBtnText) {
      this.submitBtnText.textContent =
        mode === "otp" ? "Verify OTP" : "Sign In";
    }

    this.setElementVisibility(
      this.otpLinkBtn,
      mode === "password",
      "inline-flex",
    );
    this.setElementVisibility(
      this.passwordLinkBtn,
      mode === "otp",
      "inline-flex",
    );

    this.clearError("password");
    this.updateOtpButtonsState();
  }

  updateOtpMetaText(text) {
    if (this.otpMeta) {
      this.otpMeta.textContent = text || "";
    }
  }

  startOtpCountdown() {
    if (this.otpCountdownTimer) {
      clearInterval(this.otpCountdownTimer);
      this.otpCountdownTimer = null;
    }

    this.updateOtpButtonsState();

    this.otpCountdownTimer = setInterval(() => {
      const now = Date.now();
      if (this.otpExpiresAt <= now && this.otpResendAt <= now) {
        clearInterval(this.otpCountdownTimer);
        this.otpCountdownTimer = null;
      }
      this.updateOtpButtonsState();
    }, 1000);
  }

  updateOtpButtonsState() {
    const now = Date.now();
    const otpExpired = this.otpRequested && this.otpExpiresAt <= now;
    const resendLocked = this.otpRequested && this.otpResendAt > now;

    if (this.otpEntryGroup) {
      this.otpEntryGroup.classList.toggle("is-visible", this.otpRequested);
    }

    if (this.otpTimer) {
      if (!this.otpRequested) {
        this.otpTimer.textContent = "";
      } else if (resendLocked) {
        const seconds = Math.max(0, Math.ceil((this.otpResendAt - now) / 1000));
        this.otpTimer.textContent = `You can request OTP again in ${seconds}s`;
      } else if (!otpExpired) {
        const seconds = Math.max(
          0,
          Math.ceil((this.otpExpiresAt - now) / 1000),
        );
        this.otpTimer.textContent = `OTP expires in ${seconds}s`;
      } else {
        this.otpTimer.textContent = "OTP expired. You can resend OTP now.";
      }
    }

    if (this.otpRequestBtn) {
      this.otpRequestBtn.disabled = false;
      this.setElementVisibility(
        this.otpRequestBtn,
        !this.otpRequested,
        "inline-flex",
      );
    }

    if (this.otpResendBtn) {
      this.setElementVisibility(
        this.otpResendBtn,
        this.otpRequested,
        "inline-flex",
      );
      this.otpResendBtn.disabled = !this.otpRequested || resendLocked;
    }

    if (this.submitBtn) {
      const shouldShowVerify = this.loginMode === "otp" && this.otpRequested;
      const shouldShowSignIn = this.loginMode === "password";
      this.setElementVisibility(
        this.submitBtn,
        shouldShowVerify || shouldShowSignIn,
        "inline-flex",
      );
    }
  }

  async fetchAssignedChatbots() {
    try {
      const response = await API.get("/api/user/my-chatbots");
      return Array.isArray(response?.data) ? response.data : [];
    } catch (error) {
      console.error("Failed loading assigned chatbots:", error);
      return [];
    }
  }

  buildChatbotSelectionMarkup(chatbots = []) {
    const cards = chatbots
      .map((chatbot) => {
        const chatbotId = Number(chatbot?.id);
        if (!Number.isFinite(chatbotId)) return "";

        const eventName = String(
          chatbot?.event_name || chatbot?.name || "Event",
        ).trim();
        const chatbotName = String(
          chatbot?.name || "Conference Chatbot",
        ).trim();
        const dateText = DateUtils.formatDateRange(
          chatbot?.start_date,
          chatbot?.end_date,
        );

        return `
          <button type="button" class="login-chatbot-option" data-chatbot-id="${chatbotId}">
            <span class="login-chatbot-option-event">${this.escapeHtml(eventName)}</span>
            <span class="login-chatbot-option-name">${this.escapeHtml(chatbotName)}</span>
            <span class="login-chatbot-option-date">${this.escapeHtml(dateText)}</span>
          </button>
        `;
      })
      .join("");

    return `
      <div class="login-chatbot-picker">
        <p class="login-chatbot-picker-text">You are assigned to multiple events. Select which chatbot you want to open.</p>
        <div class="login-chatbot-picker-list">
          ${cards || '<div class="login-chatbot-picker-empty">No assigned events found.</div>'}
        </div>
      </div>
    `;
  }

  async promptChatbotSelection(chatbots = []) {
    if (!Array.isArray(chatbots) || chatbots.length <= 1) {
      const firstId = Number(chatbots?.[0]?.id);
      return Number.isFinite(firstId) ? firstId : null;
    }

    const content = this.buildChatbotSelectionMarkup(chatbots);

    return new Promise((resolve) => {
      const overlay = ModalManager.create("Select Event Chatbot", content, [], {
        width: "760px",
      });

      overlay.classList.add("login-chatbot-overlay");
      const modalCard = overlay.querySelector(".modal");
      if (modalCard) {
        modalCard.classList.add("login-chatbot-modal");
      }

      let settled = false;
      const settle = (value = null) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      overlay.querySelectorAll(".login-chatbot-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          const selectedId = Number(btn.getAttribute("data-chatbot-id"));
          settle(Number.isFinite(selectedId) ? selectedId : null);
          ModalManager.close(overlay);
        });
      });

      const closeBtn = overlay.querySelector(".modal-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => settle(null));
      }

      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          settle(null);
        }
      });
    });
  }

  async resolvePostLoginDestination(rawRole) {
    const role = String(rawRole || "").toLowerCase();
    if (role === "admin") {
      return "admin/dashboard.html";
    }

    const assignedChatbots = await this.fetchAssignedChatbots();

    if (assignedChatbots.length > 1) {
      const selectedChatbotId =
        await this.promptChatbotSelection(assignedChatbots);

      if (Number.isFinite(Number(selectedChatbotId))) {
        return `user/chat.html?id=${Number(selectedChatbotId)}`;
      }

      return "user/dashboard.html";
    }

    if (assignedChatbots.length === 1 && assignedChatbots[0]?.id) {
      return `user/chat.html?id=${assignedChatbots[0].id}`;
    }

    try {
      const fallbackResponse = await API.get("/api/user/chatbots");
      const fallbackChatbots = Array.isArray(fallbackResponse?.data)
        ? fallbackResponse.data
        : [];
      if (fallbackChatbots[0]?.id) {
        return `user/chat.html?id=${fallbackChatbots[0].id}`;
      }
    } catch (error) {
      console.error("Failed loading fallback chatbots:", error);
    }

    return "user/dashboard.html";
  }

  // ... (keeping validation methods same, skipping to handleLogin)

  validateField(fieldName) {
    const field = this.form.querySelector(`[name="${fieldName}"]`);
    const errorElement = this.form.querySelector(`#${fieldName}-error`);

    if (!field) return true;

    let isValid = true;
    let errorMessage = "";

    if (fieldName === "username") {
      if (!field.value.trim()) {
        isValid = false;
        errorMessage = "Username is required";
      } else if (field.value.trim().length < 3) {
        isValid = false;
        errorMessage = "Username must be at least 3 characters";
      }
    } else if (fieldName === "password" && this.loginMode === "password") {
      if (!field.value) {
        isValid = false;
        errorMessage = "Password is required";
      }
    } else if (fieldName === "otp" && this.loginMode === "otp") {
      if (!field.value.trim()) {
        isValid = false;
        errorMessage = "OTP is required";
      } else if (!/^\d{6}$/.test(field.value.trim())) {
        isValid = false;
        errorMessage = "OTP must be 6 digits";
      }
    }

    if (isValid) {
      field.classList.remove("input-error");
      field.classList.remove("input-success");
      if (errorElement) {
        errorElement.textContent = "";
        errorElement.style.display = "none";
      }
    } else {
      field.classList.remove("input-success");
      field.classList.add("input-error");
      if (errorElement) {
        errorElement.textContent = errorMessage;
        errorElement.style.display = "block";
      }
    }

    return isValid;
  }

  clearError(fieldName) {
    const field = this.form.querySelector(`[name="${fieldName}"]`);
    const errorElement = this.form.querySelector(`#${fieldName}-error`);

    if (field) {
      field.classList.remove("input-error");
      field.classList.remove("input-success");
    }
    if (errorElement) {
      errorElement.textContent = "";
      errorElement.style.display = "none";
    }
  }

  validateAllFields() {
    const usernameValid = this.validateField("username");
    if (this.loginMode === "otp") {
      const otpValid = this.validateField("otp");
      return usernameValid && otpValid;
    }

    const passwordValid = this.validateField("password");
    return usernameValid && passwordValid;
  }

  async handleLogin(e) {
    e.preventDefault();
    if (this.loginMode === "otp") {
      await this.handleOtpVerify();
      return;
    }

    await this.handlePasswordLogin();
  }

  async handlePasswordLogin() {
    if (!this.validateAllFields()) {
      return;
    }

    const username = this.form
      .querySelector('input[name="username"]')
      .value.trim();
    const password = this.form.querySelector('input[name="password"]').value;
    const remember = Boolean(
      this.form.querySelector('input[name="remember"]')?.checked,
    );

    this.setSubmitLoading(true);

    try {
      const response = await API.post("/api/auth/login", {
        username,
        password,
        remember,
      });

      await this.onLoginSuccess(response, remember, "Login successful!");
    } catch (error) {
      this.showLoginError(
        error.message || "Invalid credentials or server error",
        null,
      );
    } finally {
      this.setSubmitLoading(false);
    }
  }

  async requestOtp(isResend) {
    const username =
      this.form.querySelector('input[name="username"]')?.value.trim() || "";
    if (!username) {
      this.showLoginError("Username is required", "username");
      return;
    }

    this.clearError("username");
    this.clearError("otp");
    this.updateOtpMetaText("");

    const targetBtn = isResend ? this.otpResendBtn : this.otpRequestBtn;
    const originalLabel = targetBtn ? targetBtn.textContent : "";
    if (targetBtn) {
      targetBtn.disabled = true;
      targetBtn.textContent = isResend ? "Resending..." : "Sending...";
    }

    try {
      const endpoint = isResend
        ? "/api/auth/login-otp/resend"
        : "/api/auth/login-otp/request";

      const response = await API.post(endpoint, { username });

      this.otpRequested = true;
      this.otpInput.value = "";

      const now = Date.now();
      const expiresIn = Number(response?.expires_in_seconds || 60);
      const resendIn = Number(response?.resend_in_seconds || 20);
      this.otpExpiresAt = now + expiresIn * 1000;
      this.otpResendAt = now + resendIn * 1000;

      const masked = response?.masked_whatsapp_number
        ? `OTP sent to ${response.masked_whatsapp_number}`
        : "OTP sent to your linked WhatsApp number";
      this.updateOtpMetaText(masked);

      this.startOtpCountdown();
      this.otpInput?.focus();
      NotificationManager.success(response?.message || "OTP sent successfully");
    } catch (error) {
      const waitSeconds = Number(error?.wait_seconds || 0);
      if (waitSeconds > 0) {
        this.otpRequested = true;
        this.otpResendAt = Date.now() + waitSeconds * 1000;
        this.otpExpiresAt = Math.max(this.otpExpiresAt, this.otpResendAt);
        this.startOtpCountdown();
      }
      this.updateOtpMetaText(error?.message || "Unable to send OTP");
      NotificationManager.error(error?.message || "Failed to send OTP");
    } finally {
      if (targetBtn) {
        targetBtn.textContent = originalLabel;
      }
      this.updateOtpButtonsState();
    }
  }

  async handleOtpVerify() {
    if (!this.otpRequested) {
      NotificationManager.warning("Request OTP before verification");
      return;
    }

    if (!this.validateAllFields()) {
      return;
    }

    if (Date.now() > this.otpExpiresAt) {
      this.showLoginError("OTP expired. Request a new one.", "otp");
      this.updateOtpButtonsState();
      return;
    }

    const username =
      this.form.querySelector('input[name="username"]')?.value.trim() || "";
    const otp = this.otpInput?.value.trim() || "";
    const remember = Boolean(
      this.form.querySelector('input[name="remember"]')?.checked,
    );

    this.setSubmitLoading(true);

    try {
      const response = await API.post("/api/auth/login-otp/verify", {
        username,
        otp,
        remember,
      });

      await this.onLoginSuccess(response, remember, "OTP login successful!");
    } catch (error) {
      this.showLoginError(error?.message || "Invalid or expired OTP", "otp");
    } finally {
      this.setSubmitLoading(false);
    }
  }

  async onLoginSuccess(response, remember, successMessage) {
    if (!response?.success) {
      this.showLoginError(
        response?.message || "Login failed",
        response?.field || null,
      );
      return;
    }

    Storage.setAuthSession({
      user: response.user,
      token: response.token,
      remember,
    });

    NotificationManager.success(successMessage || "Login successful!");
    setTimeout(async () => {
      const userRole = response.user?.role;
      const redirectUrl = await this.resolvePostLoginDestination(userRole);
      window.location.href = redirectUrl;
    }, 400);
  }

  setSubmitLoading(isLoading) {
    if (!this.submitBtn) return;

    this.submitBtn.disabled = Boolean(isLoading);
    if (this.submitBtnText && this.submitBtnLoader) {
      this.submitBtnText.style.display = isLoading ? "none" : "inline";
      this.submitBtnLoader.style.display = isLoading ? "inline-block" : "none";
    }
  }

  showLoginError(message, field) {
    // Show specific field error if provided
    if (field && field === "username") {
      const usernameError = this.form.querySelector("#username-error");
      if (usernameError) {
        usernameError.textContent = message || "Username not found";
        usernameError.style.display = "block";
        const usernameInput = this.form.querySelector('input[name="username"]');
        if (usernameInput) {
          usernameInput.classList.add("input-error");
          usernameInput.focus();
        }
      }
    } else if (field && field === "password") {
      const passwordError = this.form.querySelector("#password-error");
      if (passwordError) {
        passwordError.textContent = message || "Incorrect password";
        passwordError.style.display = "block";
        const passwordInput = this.form.querySelector('input[name="password"]');
        if (passwordInput) {
          passwordInput.classList.add("input-error");
          passwordInput.focus();
        }
      }
    } else if (field && field === "otp") {
      const otpError = this.form.querySelector("#otp-error");
      if (otpError) {
        otpError.textContent = message || "Invalid OTP";
        otpError.style.display = "block";
        const otpInput = this.form.querySelector('input[name="otp"]');
        if (otpInput) {
          otpInput.classList.add("input-error");
          otpInput.focus();
        }
      }
    } else {
      // Show general error
      NotificationManager.error(message || "Login failed");
    }
  }
}

// ============================================
// PROFILE PAGE
// ============================================

class ProfilePage {
  constructor() {
    this.currentUser = Storage.getUser();
    this.init();
  }

  getAvatarInitial(userLike = {}) {
    const candidate =
      String(
        userLike?.name || userLike?.username || userLike?.email || "U",
      ).trim() || "U";
    return candidate.charAt(0).toUpperCase();
  }

  init() {
    if (!this.currentUser) {
      AppAuth.redirectToLogin();
      return;
    }

    this.loadProfileData();
    this.setupPasswordChange();
  }

  async loadProfileData() {
    const nameEl = DomUtils.$("[data-profile-name]");
    const emailEl = DomUtils.$("[data-profile-email]");
    const roleEl = DomUtils.$("[data-profile-role]");
    const avatarEl = DomUtils.$("[data-profile-avatar]");

    try {
      const response = await API.get("/api/user/profile");
      const profile = response?.data || this.currentUser;

      Storage.setUser({ ...this.currentUser, ...profile });
      this.currentUser = { ...this.currentUser, ...profile };

      if (nameEl) nameEl.textContent = profile.name || "-";
      if (emailEl) emailEl.textContent = profile.email || "-";
      if (roleEl) roleEl.textContent = profile.role || "-";
      if (avatarEl) {
        avatarEl.textContent = this.getAvatarInitial(profile);
      }

      const usernameEl = DomUtils.$("[data-profile-username]");
      const memberSinceEl = DomUtils.$("[data-profile-member-since]");
      const joinedEventsEl = DomUtils.$("[data-profile-joined-events]");
      const messagesSentEl = DomUtils.$("[data-profile-messages-sent]");

      if (usernameEl) usernameEl.textContent = profile.username || "-";
      if (memberSinceEl) {
        memberSinceEl.textContent = profile.created_at
          ? DateUtils.formatDate(profile.created_at)
          : "-";
      }
      if (joinedEventsEl) {
        joinedEventsEl.textContent = `${profile.joined_chatbots || 0} events`;
      }
      if (messagesSentEl) {
        messagesSentEl.textContent = `${profile.messages_sent || 0} messages`;
      }

      this.syncHeaderProfile(profile);
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  }

  syncHeaderProfile(profile) {
    if (!profile) return;

    const initials = this.getAvatarInitial(profile);
    const headerAvatarEls = [
      ...DomUtils.$$("[data-user-avatar]"),
      ...DomUtils.$$("[data-user-name]"),
    ];

    headerAvatarEls.forEach((el) => {
      el.textContent = initials;
    });
  }

  setupPasswordChange() {
    const form = DomUtils.$('form[data-form="change-password"]');
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');

        const currentPassword = form.querySelector(
          'input[name="current-password"]',
        )?.value;
        const newPassword = form.querySelector(
          'input[name="new-password"]',
        )?.value;
        const confirmPassword = form.querySelector(
          'input[name="confirm-password"]',
        )?.value;

        if (!currentPassword || !newPassword || !confirmPassword) {
          NotificationManager.error("Please fill in all password fields");
          return;
        }

        if (newPassword !== confirmPassword) {
          NotificationManager.error("Passwords do not match");
          return;
        }

        if (newPassword.length < 6) {
          NotificationManager.error(
            "New password must be at least 6 characters long",
          );
          return;
        }

        if (currentPassword === newPassword) {
          NotificationManager.error(
            "New password must be different from your current password",
          );
          return;
        }

        try {
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML =
              '<span class="material-symbols-outlined icon-inline">autorenew</span>Updating...';
          }

          await API.put(`/api/auth/change-password`, {
            current_password: currentPassword,
            new_password: newPassword,
          });

          NotificationManager.success("Password changed successfully");
          form.reset();
        } catch (error) {
          NotificationManager.error(
            error?.message || "Failed to change password",
          );
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML =
              '<span class="material-symbols-outlined icon-inline">autorenew</span>Change Password';
          }
        }
      });
    }
  }
}

// ============================================
// GLOBAL FUNCTIONS
// ============================================

window.joinChatbot = function (chatbotId) {
  (async () => {
    try {
      await API.post(`/api/user/chatbots/${chatbotId}/join`, {});
    } catch (error) {
      if (
        !String(error?.message || "")
          .toLowerCase()
          .includes("already joined")
      ) {
        NotificationManager.error(error.message || "Unable to join chatbot");
        return;
      }
    }
    window.location.href = `chat.html?id=${chatbotId}`;
  })();
};

window.downloadCredentials = function () {
  NotificationManager.success("Download started");
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  // Initialize based on current page
  const page = window.location.pathname;

  if (page === "/" || page.includes("login") || page.endsWith("index.html")) {
    window.loginHandler = new LoginHandler();
  }

  if (page.includes("user/")) {
    window.userPanel = new UserPanel();
  }

  if (page.includes("user/chat.html")) {
    window.chatInterface = new ChatInterface();
  }

  if (page.includes("user/profile.html")) {
    window.profilePage = new ProfilePage();
  }
});
