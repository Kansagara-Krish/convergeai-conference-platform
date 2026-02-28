/* ============================================
   USER PANEL & CHAT FUNCTIONALITY
   ============================================ */

class UserPanel {
  constructor() {
    this.currentUser = Storage.getUser();
    this.init();
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

    if (this.currentUser?.name) {
      avatarTargets.forEach((avatar) => {
        avatar.textContent = this.currentUser.name.charAt(0).toUpperCase();
      });
    }
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
    this.messagesArea = DomUtils.$(".messages-area");
    this.inputField = DomUtils.$(".input-field");
    this.sendBtn = DomUtils.$(".send-btn");
    this.convListEl = DomUtils.$("#chat-conversations-list");
    this.newChatBtn = DomUtils.$("#new-chat-btn");
    this.inputArea = DomUtils.$(".input-area");
    this.attachBtn = DomUtils.$("#chat-attach-btn");
    this.imageInput = DomUtils.$("#chat-image-input");
    this.filePreview = DomUtils.$("#chat-file-preview");
    this.overlay = DomUtils.$("#chat-overlay");
    this.overlayContent = DomUtils.$("#chat-overlay-content");
    this.overlayImage = DomUtils.$("#chat-overlay-image");
    this.overlayTitle = DomUtils.$("#chat-overlay-title");
    this.overlayHideTimer = null;
    this.selectedImageFile = null;
    this.selectedImagePreviewUrl = null;
    this.typingIndicatorEl = null;
    this.handleWindowResize = () => this.updateMessageViewportInset();
    this.chatUnavailable = false;
    this.chatUnavailableMessage = "";
    // chatbotId will be initialized via helper below
    this.chatbotId = null;
    this.messages = [];
    this.conversations = [];
    this.currentConversationId = null;
    // Guest and background image tracking
    this.selectedGuest = null;
    this.selectedGuestImage = null;
    this.backgroundImageUrl = null;
    this.guests = [];
    // set id then start
    this.chatbotId = this.getChatbotId();
    this.init();
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
    this.convListEl.innerHTML = this.conversations
      .map(
        (
          c,
        ) => `<div class="conversation-item ${this.currentConversationId === c.id ? "active" : ""}" data-id="${c.id}">
        <span class="conv-title">${this.escapeHtml(c.title || "New chat")}</span>
        <div class="conv-menu-container">
          <button class="conv-menu-btn" title="More options" aria-label="More options">
            <span class="material-symbols-outlined">more_vert</span>
          </button>
          <div class="conv-menu-dropdown">
            <button class="conv-menu-item conv-rename-item">Rename</button>
            <button class="conv-menu-item conv-delete-item">Delete</button>
          </div>
        </div>
      </div>`,
      )
      .join("");

    this.convListEl.querySelectorAll(".conversation-item").forEach((el) => {
      const id = parseInt(el.dataset.id);
      const titleEl = el.querySelector(".conv-title");
      const menuBtn = el.querySelector(".conv-menu-btn");
      const dropdown = el.querySelector(".conv-menu-dropdown");
      const renameBtn = el.querySelector(".conv-rename-item");
      const deleteBtn = el.querySelector(".conv-delete-item");

      // Handle conversation selection
      titleEl.addEventListener("click", () => this.selectConversation(id));

      // Handle menu toggle
      menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains("active");
        this.convListEl
          .querySelectorAll(".conv-menu-dropdown")
          .forEach((d) => d.classList.remove("active"));
        if (!isOpen) {
          dropdown.classList.add("active");
        }
      });

      // Handle rename
      renameBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        dropdown.classList.remove("active");
        this.showRenameConversationModal(id, titleEl.textContent);
      });

      // Handle delete
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        dropdown.classList.remove("active");
        this.showDeleteConversationModal(id, titleEl.textContent);
      });
    });

    // Close menu when clicking outside
    document.addEventListener("click", () => {
      this.convListEl
        .querySelectorAll(".conv-menu-dropdown")
        .forEach((d) => d.classList.remove("active"));
    });
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

  async init() {
    console.log("ChatInterface.init() called", { chatbotId: this.chatbotId });
    if (!this.messagesArea || !this.inputField || !this.sendBtn) {
      console.warn("ChatInterface missing required DOM elements", {
        messagesArea: this.messagesArea,
        inputField: this.inputField,
        sendBtn: this.sendBtn,
      });
      return;
    }

    this.setInputVisible(false);
    this.updateMessageViewportInset();

    if (!this.chatbotId) {
      await this.resolveDefaultChatbotId();
    }

    if (!this.chatbotId) {
      this.renderNoChatbotState();
      return;
    }

    this.messagesArea.innerHTML = "";

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

    try {
      await this.loadConversations();
      if (this.conversations.length === 0) {
        await this.createConversation("New chat");
      } else {
        await this.selectConversation(this.conversations[0].id);
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
      this.setInputVisible(false);
      return;
    }

    // prepare overlay support
    this.backgroundImageUrl = this.resolveMediaUrl(
      chatbotMeta?.background_image,
    );
    this.renderGuestWall(chatbotMeta?.guests || []);

    // Handle unavailable chatbot
    if (this.chatUnavailable) {
      this.renderChatUnavailableNotice();
      this.setInputVisible(false);
      return;
    }

    // Load message history for selected conversation
    if (this.currentConversationId) {
      await this.loadMessages(this.currentConversationId);
    }

    // Enable input and show it
    this.setInputVisible(true);
    this.autoResizeInput();
    this.setupAutoScroll();
    this.updateMessageViewportInset();
  }

  updateSendButtonState() {
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
    if (this.chatUnavailable) {
      NotificationManager.warning(
        this.chatUnavailableMessage ||
          "This chatbot is inactive and cannot accept new messages.",
      );
      return;
    }

    const text = this.inputField.value.trim();
    const selectedImage = this.selectedImageFile;

    // VALIDATION: User must upload an image
    if (!selectedImage) {
      NotificationManager.warning(
        "Please upload an image before sending a message. Click the + button to add an image.",
      );
      return;
    }

    if (!text && !selectedImage) return;

    if (!this.currentConversationId) {
      await this.createConversation("New chat");
    }

    const userMessagePreview = text || "[Image uploaded]";

    this.addMessage(userMessagePreview, "user", null, selectedImage);

    this.inputField.value = "";
    this.autoResizeInput();
    this.clearSelectedImage();
    this.sendBtn.disabled = true;

    try {
      this.startTypingIndicator();

      // Fetch guest image if a guest is selected
      let guestImageBlob = null;
      if (this.selectedGuestImage) {
        console.log("📸 Fetching guest image...", this.selectedGuestImage);
        guestImageBlob = await this.urlToBlob(
          this.selectedGuestImage,
          "guest_image.jpg",
        );
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
          guestImageBlob, // Pass fetched guest image blob
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

      if (botResponse?.content) {
        let botImageFile = null;

        // Check if bot response contains an image URL or image data
        if (botResponse?.image_url) {
          console.log("🤖 Bot response includes image:", botResponse.image_url);
          try {
            // Fetch and convert bot image URL to blob for display
            botImageFile = await this.urlToBlob(
              botResponse.image_url,
              "bot_image.jpg",
            );
          } catch (error) {
            console.error("Failed to fetch bot image:", error);
          }
        }

        this.addMessage(
          botResponse.content,
          "bot",
          botResponse.timestamp,
          botImageFile,
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);
      NotificationManager.error(error.message || "Failed to send message");
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
    backgroundImage,
  ) {
    if (selectedImage) {
      const formData = new FormData();
      formData.append("content", text);
      formData.append("image", selectedImage);

      // Include guest image if selected
      if (guestImage) {
        formData.append("guest_image", guestImage);
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
      const attachMenu = DomUtils.$("#chat-attach-menu");
      const attachUpload = DomUtils.$("#chat-attach-upload");
      const attachCamera = DomUtils.$("#chat-attach-camera");

      const closeAttachMenu = () => {
        if (!attachMenu) return;
        attachMenu.setAttribute("aria-hidden", "true");
        this.attachBtn.setAttribute("aria-expanded", "false");
        attachMenu.classList.remove("active");
      };

      const openAttachMenu = () => {
        if (!attachMenu) return;
        attachMenu.setAttribute("aria-hidden", "false");
        this.attachBtn.setAttribute("aria-expanded", "true");
        attachMenu.classList.add("active");
      };

      this.attachBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (attachMenu && attachMenu.classList.contains("active")) {
          closeAttachMenu();
        } else {
          openAttachMenu();
        }
      });

      // Close menu when clicking outside
      document.addEventListener("click", (ev) => {
        const target = ev.target;
        if (!attachMenu) return;
        if (!attachMenu.contains(target) && target !== this.attachBtn) {
          closeAttachMenu();
        }
      });

      if (attachUpload) {
        attachUpload.addEventListener("click", (ev) => {
          ev.stopPropagation();
          closeAttachMenu();
          this.imageInput.click();
        });
      }

      if (attachCamera) {
        attachCamera.addEventListener("click", (ev) => {
          ev.stopPropagation();
          closeAttachMenu();
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
    const closeBtn = DomUtils.$("#chat-camera-close");

    if (captureBtn) {
      captureBtn.onclick = async () => {
        await this._captureCameraPhoto();
      };
    }

    if (closeBtn) {
      closeBtn.onclick = () => {
        this.closeCameraModal();
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

  async _startCameraStream() {
    try {
      const video = DomUtils.$("#chat-camera-video");
      if (!video) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      video.srcObject = stream;
      video.play();
      this._cameraStream = stream;
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

        // Ask the user to confirm the photo contains a person before accepting
        const confirmMsg =
          "Does this photo contain a person? Click OK to use it, Cancel to retake.";
        const ok = window.confirm(confirmMsg);
        if (ok) {
          this.selectedImageFile = file;
          this.renderAttachmentPreview();
          this.closeCameraModal();
          resolve(file);
        } else {
          // Keep the camera modal open to allow retake
          NotificationManager.info("Please retake the photo");
          resolve(null);
        }
      }, "image/png");
    });
  }

  renderAttachmentPreview() {
    if (!this.filePreview) return;

    if (!this.selectedImageFile) {
      this.filePreview.innerHTML = "";
      this.filePreview.style.display = "none";
      if (this.selectedImagePreviewUrl) {
        URL.revokeObjectURL(this.selectedImagePreviewUrl);
        this.selectedImagePreviewUrl = null;
      }
      return;
    }

    if (this.selectedImagePreviewUrl) {
      URL.revokeObjectURL(this.selectedImagePreviewUrl);
    }
    this.selectedImagePreviewUrl = URL.createObjectURL(this.selectedImageFile);

    this.filePreview.innerHTML = `
      <div class="file-preview-item">
        <img class="file-preview-thumb" src="${this.selectedImagePreviewUrl}" alt="Selected image preview" />
        <button type="button" class="file-preview-remove" id="chat-file-remove" aria-label="Remove image">×</button>
      </div>
    `;
    this.filePreview.style.display = "flex";

    const removeBtn = document.getElementById("chat-file-remove");
    if (removeBtn) {
      removeBtn.addEventListener("click", () => this.clearSelectedImage());
    }
  }

  clearSelectedImage() {
    this.selectedImageFile = null;
    if (this.imageInput) {
      this.imageInput.value = "";
    }
    if (this.filePreview) {
      this.filePreview.innerHTML = "";
      this.filePreview.style.display = "none";
    }
    this.updateSendButtonState();
  }

  addMessage(text, sender, messageTimestamp = null, imageFile = null) {
    const timestamp = DateUtils.formatTime(messageTimestamp || new Date());
    const normalizedSender = sender === "user" ? "user" : "assistant";
    const message = {
      id: Date.now(),
      text: text,
      sender: normalizedSender,
      timestamp: timestamp,
    };

    this.messages.push(message);

    const messageEl = DomUtils.create(
      "div",
      `message-group ${normalizedSender}`,
    );

    let imageHtml = "";
    let imageSrc = "";

    // Create image URL if imageFile is provided
    if (imageFile) {
      imageSrc = URL.createObjectURL(imageFile);
      imageHtml = `<img class="message-image" src="${imageSrc}" alt="Message image" />`;
    }

    messageEl.innerHTML = `
      <div class="message-bubble">
        <div class="message-text">${this.renderMessageContent(text)}</div>
        ${imageHtml}
        <div class="message-time">${timestamp}</div>
      </div>
    `;

    this.messagesArea.appendChild(messageEl);
    this.scrollToBottom();
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

      // Hide skeleton loaders
      const skeletons = this.messagesArea.querySelectorAll(".skeleton-message");
      skeletons.forEach((s) => (s.style.display = "none"));

      // Hide the loading message
      const loadingMsg = this.messagesArea.querySelector(
        ".message-group.assistant",
      );
      if (loadingMsg) {
        loadingMsg.style.display = "none";
      }

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

      this.messages = [];
      this.messagesArea.innerHTML = "";
      const messages = Array.isArray(response?.data) ? response.data : [];
      messages.forEach((msg) => {
        if (!msg?.content) return;
        this.addMessage(msg.content, msg.sender || "bot", msg.timestamp);
      });
    } catch (error) {
      console.error("Error loading messages:", error);
      NotificationManager.error(error.message || "Failed to load messages");
    }
  }

  async loadChatbotMeta() {
    try {
      const response = await API.get(`/api/chatbots/${this.chatbotId}`);
      const chatbot = response?.data;
      if (!chatbot) return null;

      const topTitleEl = DomUtils.$("#chatbot-top-title");

      if (topTitleEl) {
        topTitleEl.textContent = chatbot.name || "Chatbot";
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
    this.selectedGuest = guest;
    this.selectedGuestImage = guest.photo
      ? this.resolveMediaUrl(guest.photo)
      : null;

    console.log("💬 Guest selected:", {
      name: guest.name,
      id: guest.id,
      photo: this.selectedGuestImage,
    });

    NotificationManager.success(`Selected: ${guest.name}`);
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
    if (this.form) {
      this.init();
    }
  }

  init() {
    this.restoreRememberPreference();
    this.redirectIfAuthenticated();

    console.log("LoginHandler initialized"); // DEBUG
    // Form submission
    this.form.addEventListener("submit", (e) => {
      console.log("Form submitted"); // DEBUG
      this.handleLogin(e);
    });

    // Real-time validation on blur
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

    let redirectUrl = "user/chat.html";

    try {
      // Prefer chatbots the user has been assigned/joined
      let chatbotResponse = await API.get("/api/user/my-chatbots");
      let chatbots = Array.isArray(chatbotResponse?.data)
        ? chatbotResponse.data
        : [];

      // Fallback to public available chatbots if none assigned
      if (!chatbots || chatbots.length === 0) {
        chatbotResponse = await API.get("/api/user/chatbots");
        chatbots = Array.isArray(chatbotResponse?.data)
          ? chatbotResponse.data
          : [];
      }

      if (chatbots[0]?.id) {
        redirectUrl = `user/chat.html?id=${chatbots[0].id}`;
      }
    } catch (error) {
      console.error("Failed loading user chatbots for auto-redirect:", error);
    }

    window.location.href = redirectUrl;
  }

  // ... (keeping validation methods same, skipping to handleLogin)

  validateField(fieldName) {
    // ... implementation matches original ...
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
    } else if (fieldName === "password") {
      if (!field.value) {
        isValid = false;
        errorMessage = "Password is required";
      }
    }

    // Update UI
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
    const passwordValid = this.validateField("password");
    console.log(
      `Validation result: User=${usernameValid}, Pass=${passwordValid}`,
    ); // DEBUG
    return usernameValid && passwordValid;
  }

  async handleLogin(e) {
    e.preventDefault();
    console.log("handleLogin called"); // DEBUG

    // Validate all fields first
    if (!this.validateAllFields()) {
      console.log("Validation failed"); // DEBUG
      return;
    }

    const username = this.form
      .querySelector('input[name="username"]')
      .value.trim();
    const password = this.form.querySelector('input[name="password"]').value;
    const remember = Boolean(
      this.form.querySelector('input[name="remember"]')?.checked,
    );

    console.log(`Attempting login for: ${username}`); // DEBUG

    const submitBtn = this.form.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector(".btn-text");
    const btnLoader = submitBtn.querySelector(".btn-loader");

    // Show loading state
    submitBtn.disabled = true;
    if (btnText && btnLoader) {
      btnText.style.display = "none";
      btnLoader.style.display = "inline-block";
    }

    try {
      console.log("Sending API request to /api/auth/login"); // DEBUG
      const response = await API.post("/api/auth/login", {
        username: username,
        password: password,
        remember: remember,
      });

      console.log("API Response:", response); // DEBUG

      if (response.success) {
        Storage.setAuthSession({
          user: response.user,
          token: response.token,
          remember,
        });

        NotificationManager.success("Login successful!");
        setTimeout(async () => {
          // Use the user role from the backend response
          const userRole = response.user.role;
          let redirectUrl = "admin/dashboard.html";

          if (userRole !== "admin") {
            redirectUrl = "user/chat.html";
            try {
              const chatbotResponse = await API.get("/api/user/chatbots");
              const chatbots = Array.isArray(chatbotResponse?.data)
                ? chatbotResponse.data
                : [];
              if (chatbots[0]?.id) {
                redirectUrl = `user/chat.html?id=${chatbots[0].id}`;
              }
            } catch (error) {
              console.error("Failed loading user chatbots after login:", error);
            }
          }

          console.log(`Redirecting to: ${redirectUrl}`); // DEBUG
          window.location.href = redirectUrl;
        }, 500);
      } else {
        // Handle specific error messages from backend
        console.log("Login failed with response:", response); // DEBUG
        this.showLoginError(response.message, response.field);
      }
    } catch (error) {
      console.error("Login error:", error);
      this.showLoginError(
        error.message || "Invalid credentials or server error",
        null,
      );
    } finally {
      // Hide loading state
      submitBtn.disabled = false;
      if (btnText && btnLoader) {
        btnText.style.display = "inline";
        btnLoader.style.display = "none";
      }
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

      if (nameEl) nameEl.textContent = profile.name || "-";
      if (emailEl) emailEl.textContent = profile.email || "-";
      if (roleEl) roleEl.textContent = profile.role || "-";
      if (avatarEl) {
        avatarEl.textContent = (profile.name || "U")
          .substring(0, 1)
          .toUpperCase();
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
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  }

  setupPasswordChange() {
    const form = DomUtils.$('form[data-form="change-password"]');
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const currentPassword = form.querySelector(
          'input[name="current-password"]',
        ).value;
        const newPassword = form.querySelector(
          'input[name="new-password"]',
        ).value;
        const confirmPassword = form.querySelector(
          'input[name="confirm-password"]',
        ).value;

        if (newPassword !== confirmPassword) {
          NotificationManager.error("Passwords do not match");
          return;
        }

        try {
          await API.put(`/api/auth/change-password`, {
            current_password: currentPassword,
            new_password: newPassword,
          });

          NotificationManager.success("Password changed successfully");
          form.reset();
        } catch (error) {
          NotificationManager.error("Failed to change password");
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
  console.log("Page loaded, path:", page); // DEBUG

  if (page === "/" || page.includes("login") || page.endsWith("index.html")) {
    console.log("Condition met: Initializing LoginHandler"); // DEBUG
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
