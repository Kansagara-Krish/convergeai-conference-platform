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
      window.location.href = "/index.html";
      return;
    }

    this.setupHeader();
    this.setupLogout();
    this.loadChatbots();
  }

  setupHeader() {
    const userBtn = DomUtils.$(".user-profile-btn");
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

    // Update user name if displayed
    const userName = DomUtils.$("[data-user-name]");
    if (userName) {
      userName.textContent = this.currentUser.name;
    }
  }

  setupLogout() {
    const logoutBtn = DomUtils.$('[data-action="logout"]');
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => this.logout());
    }
  }

  async loadChatbots() {
    const page = window.location.pathname;
    if (page.includes("user/dashboard") || page.includes("user-dashboard")) {
      try {
        // Simulated chatbots data
        const chatbots = [
          {
            id: 1,
            name: "AI Research Summit 2024",
            event: "ICAI 2024",
            date: "2024-06-15",
            description:
              "Join our expert panelists discussing the future of AI Research",
            participants: ["Dr. Smith", "Prof. Johnson"],
          },
          {
            id: 2,
            name: "Machine Learning Conference",
            event: "ML Expo 2024",
            date: "2024-07-20",
            description: "Latest trends in Machine Learning and Deep Learning",
            participants: ["Dr. Lee", "Prof. Kumar"],
          },
          {
            id: 3,
            name: "Data Science Workshop",
            event: "Data Con 2024",
            date: "2024-08-10",
            description:
              "Hands-on workshop on advanced data analysis techniques",
            participants: ["Ms. Sarah", "Mr. Chen"],
          },
        ];

        this.renderChatbots(chatbots);
        NotificationManager.success("Chatbots loaded");
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
        <div class="chatbot-available-card-image">🤖</div>
        <div class="chatbot-available-card-content">
          <h3 class="chatbot-available-card-title">${chatbot.name}</h3>
          <div class="chatbot-available-card-date">📅 ${DateUtils.formatDate(chatbot.date)}</div>
          <p class="chatbot-available-card-desc">${chatbot.description}</p>
          <div class="chatbot-available-card-footer">
            <div class="chatbot-available-card-participants">
              ${chatbot.participants
            .slice(0, 3)
            .map(
              (p) => `
                <div class="chatbot-available-card-avatar" title="${p}">
                  ${p.substring(0, 1).toUpperCase()}
                </div>
              `,
            )
            .join("")}
              ${chatbot.participants.length > 3 ? `<span>+${chatbot.participants.length - 3}</span>` : ""}
            </div>
            <button class="btn btn-sm btn-primary" onclick="joinChatbot(${chatbot.id})">
              💬 Join
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
      window.location.href = "/index.html";
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
    this.chatbotId = this.getChatbotId();
    this.messages = [];
    this.init();
  }

  init() {
    if (!this.messagesArea || !this.inputField || !this.sendBtn) return;

    this.sendBtn.addEventListener("click", () => this.sendMessage());
    this.inputField.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.loadMessages();
    this.setupAutoScroll();
  }

  getChatbotId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id") || null;
  }

  async sendMessage() {
    const text = this.inputField.value.trim();
    if (!text) return;

    // Add user message
    this.addMessage(text, "user");
    this.inputField.value = "";
    this.inputField.style.height = "auto";
    this.sendBtn.disabled = true;

    try {
      // Simulate bot thinking
      await this.showTypingIndicator();

      // Simulated bot response
      const response = await this.getBotResponse(text);
      this.addMessage(response, "bot");

      // Save message to backend
      await API.post(`/api/chat/${this.chatbotId}/messages`, {
        message: text,
        response: response,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error sending message:", error);
      NotificationManager.error("Failed to send message");
    } finally {
      this.sendBtn.disabled = false;
      this.inputField.focus();
    }
  }

  addMessage(text, sender) {
    const timestamp = DateUtils.formatTime(new Date());
    const message = {
      id: Date.now(),
      text: text,
      sender: sender,
      timestamp: timestamp,
    };

    this.messages.push(message);

    const messageEl = DomUtils.create("div", `message-group ${sender}`);
    messageEl.innerHTML = `
      <div class="message-avatar ${sender}">
        ${sender === "user" ? "You" : "🤖"}
      </div>
      <div class="message-bubble">
        <div class="message-text">${this.escapeHtml(text)}</div>
        <div class="message-time">${timestamp}</div>
      </div>
    `;

    this.messagesArea.appendChild(messageEl);
    this.scrollToBottom();
  }

  async showTypingIndicator() {
    const indicator = DomUtils.create("div", "message-group");
    indicator.innerHTML = `
      <div class="message-avatar bot">🤖</div>
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    indicator.id = "typing-indicator";

    this.messagesArea.appendChild(indicator);
    this.scrollToBottom();

    // Simulate thinking time
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const indicator_el = DomUtils.$("#typing-indicator");
    if (indicator_el) indicator_el.remove();
  }

  async getBotResponse(message) {
    // Simulated responses
    const responses = [
      "That's an interesting question! Let me provide you with more details.",
      "Great point! Based on our conference theme, here's what I'd like to share...",
      "Thank you for asking. This is one of the key topics we'll be discussing.",
      "Absolutely! This is crucial for understanding our conference objectives.",
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  scrollToBottom() {
    setTimeout(() => {
      this.messagesArea.scrollTop = this.messagesArea.scrollHeight;
    }, 100);
  }

  setupAutoScroll() {
    this.inputField.addEventListener("input", () => {
      this.inputField.style.height = "auto";
      this.inputField.style.height =
        Math.min(this.inputField.scrollHeight, 120) + "px";
    });
  }

  async loadMessages() {
    try {
      // Load previous messages
      const response = await API.get(`/api/chat/${this.chatbotId}/messages`);
      if (response && response.messages) {
        response.messages.forEach((msg) => {
          this.addMessage(msg.text, msg.sender);
        });
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    }
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
      field.classList.add("input-success");
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
    }
    if (errorElement) {
      errorElement.textContent = "";
      errorElement.style.display = "none";
    }
  }

  validateAllFields() {
    const usernameValid = this.validateField("username");
    const passwordValid = this.validateField("password");
    console.log(`Validation result: User=${usernameValid}, Pass=${passwordValid}`); // DEBUG
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
      });

      console.log("API Response:", response); // DEBUG

      if (response.success) {
        Storage.setUser(response.user);
        Storage.setToken(response.token);

        NotificationManager.success("Login successful!");
        setTimeout(() => {
          // Use the user role from the backend response
          const userRole = response.user.role;
          const redirectUrl =
            userRole === "admin"
              ? "/admin/dashboard.html"
              : "/user/dashboard.html";
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
      this.showLoginError("Invalid credentials or server error", null);
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
      window.location.href = "/index.html";
      return;
    }

    this.loadProfileData();
    this.setupPasswordChange();
  }

  loadProfileData() {
    const nameEl = DomUtils.$("[data-profile-name]");
    const emailEl = DomUtils.$("[data-profile-email]");
    const roleEl = DomUtils.$("[data-profile-role]");
    const avatarEl = DomUtils.$("[data-profile-avatar]");

    if (nameEl) nameEl.textContent = this.currentUser.name;
    if (emailEl) emailEl.textContent = this.currentUser.email;
    if (roleEl) roleEl.textContent = this.currentUser.role;
    if (avatarEl)
      avatarEl.textContent = this.currentUser.name
        .substring(0, 1)
        .toUpperCase();
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
          await API.put(`/api/users/${this.currentUser.id}/password`, {
            current: currentPassword,
            new: newPassword,
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
  window.location.href = `/user/chat.html?id=${chatbotId}`;
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

  if (page.includes("user/dashboard")) {
    window.userPanel = new UserPanel();
  }

  if (page.includes("user/chat.html")) {
    window.chatInterface = new ChatInterface();
  }

  if (page.includes("user/profile.html")) {
    window.profilePage = new ProfilePage();
  }
});
