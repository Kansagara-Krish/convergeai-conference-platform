/* ============================================
   UTILITIES & HELPER FUNCTIONS
   ============================================ */

// API Base URL Configuration
function resolveApiBaseUrl() {
  if (typeof window !== "undefined" && window.__API_BASE_URL__) {
    return String(window.__API_BASE_URL__).trim();
  }

  if (typeof window === "undefined") {
    return "http://localhost:5050";
  }

  const { protocol, hostname, port } = window.location;

  // If running on the same host but different ports, use the same hostname
  if (
    (hostname === "localhost" || hostname === "127.0.0.1") &&
    port === "5050"
  ) {
    return "";
  }

  if (protocol === "file:") {
    return "http://localhost:5050";
  }

  // For remote development/Docker: use same hostname as frontend but port 5050
  // This prevents CORS issues when frontend and backend are on same network
  return `${protocol}//${hostname}:5050`;
}

const API_BASE_URL = resolveApiBaseUrl();

// ============================================
// 0. DOM UTILITY CLASS
// ============================================

// DOM class removed to avoid conflict with const DOM helper object below

// ============================================
// 1. NOTIFICATION SYSTEM
// ============================================

class NotificationManager {
  static show(message, type = "info", duration = 3000) {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${this.getIcon(type)}</span>
      <span class="toast-message">${message}</span>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = "slideOut 0.3s ease-out forwards";
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  static success(message) {
    this.show(message, "success");
  }

  static error(message) {
    this.show(message, "error", 4000);
  }

  static warning(message) {
    this.show(message, "warning");
  }

  static info(message) {
    this.show(message, "info");
  }

  static getIcon(type) {
    const icons = {
      success: '<i class="fas fa-check-circle"></i>',
      error: '<i class="fas fa-exclamation-circle"></i>',
      warning: '<i class="fas fa-exclamation-triangle"></i>',
      info: '<i class="fas fa-info-circle"></i>',
    };
    return icons[type] || "";
  }
}

// ============================================
// 2. MODAL MANAGEMENT
// ============================================

class ModalManager {
  static create(title, content, actions = [], options = {}) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    const modalStyle = options.width
      ? `style="max-width: ${options.width};"`
      : "";
    overlay.innerHTML = `
      <div class="modal" ${modalStyle}>
        <div class="modal-header">
          <h2 class="modal-title">${title}</h2>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
        ${
          actions.length > 0
            ? `
          <div class="modal-footer">
            ${actions
              .map(
                (action) => `
              <button class="btn ${action.class || "btn-secondary"}" data-action="${action.id}">
                ${action.label}
              </button>
            `,
              )
              .join("")}
          </div>
        `
            : ""
        }
      </div>
    `;

    const closeBtn = overlay.querySelector(".modal-close");
    closeBtn.addEventListener("click", () => this.close(overlay));

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this.close(overlay);
    });

    actions.forEach((action) => {
      const btn = overlay.querySelector(`[data-action="${action.id}"]`);
      if (btn) {
        btn.addEventListener("click", () => {
          if (action.callback) action.callback();
          this.close(overlay);
        });
      }
    });

    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add("active"), 10);

    return overlay;
  }

  static close(modal) {
    modal.classList.remove("active");
    setTimeout(() => modal.remove(), 300);
  }

  static confirm(message, onConfirm) {
    this.create("Confirm Action", message, [
      {
        id: "cancel",
        label: "Cancel",
        class: "btn-secondary",
      },
      {
        id: "confirm",
        label: "Confirm",
        class: "btn-danger",
        callback: onConfirm,
      },
    ]);
  }

  static alert(message, onClose) {
    this.create("Alert", message, [
      {
        id: "close",
        label: "Close",
        class: "btn-primary",
        callback: onClose || (() => {}),
      },
    ]);
  }
}

// ============================================
// 3. FORM VALIDATION
// ============================================

class FormValidator {
  static validate(formElement) {
    const inputs = formElement.querySelectorAll("input, textarea, select");
    let isValid = true;

    inputs.forEach((input) => {
      const group = input.closest(".form-group");
      if (!group) return;

      const value = input.value.trim();
      const rules = input.dataset.rules?.split(",") || [];
      let errors = [];

      rules.forEach((rule) => {
        const result = this.validateRule(value, rule.trim(), input);
        if (!result) errors.push(rule);
      });

      if (errors.length > 0) {
        this.setError(group, `Invalid ${input.name || input.placeholder}`);
        isValid = false;
      } else {
        this.clearError(group);
      }
    });

    return isValid;
  }

  static validateRule(value, rule, input) {
    if (rule === "required") return value.length > 0;
    if (rule === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (rule === "minLength:8") return value.length >= 8;
    if (rule === "minLength:6") return value.length >= 6;
    if (rule === "match") {
      const matchInput = document.querySelector(
        `[name="${input.dataset.match}"]`,
      );
      return matchInput && value === matchInput.value;
    }
    return true;
  }

  static setError(group, message) {
    group.classList.add("error");
    group.classList.remove("success");
    let errorEl = group.querySelector(".form-error");
    if (!errorEl) {
      errorEl = document.createElement("div");
      errorEl.className = "form-error";
      group.appendChild(errorEl);
    }
    errorEl.textContent = message;
  }

  static clearError(group) {
    group.classList.remove("error");
    group.classList.add("success");
    const errorEl = group.querySelector(".form-error");
    if (errorEl) errorEl.remove();
  }
}

// ============================================
// 4. DATE/TIME UTILITIES
// ============================================

class DateUtils {
  static parse(date) {
    if (date instanceof Date) return date;

    if (typeof date === "string") {
      const raw = date.trim();
      const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
      const normalized = hasTimezone ? raw : `${raw}Z`;
      return new Date(normalized);
    }

    return new Date(date);
  }

  static format(date, format = "YYYY-MM-DD") {
    const d = this.parse(date);
    const map = {
      YYYY: d.getFullYear(),
      MM: String(d.getMonth() + 1).padStart(2, "0"),
      DD: String(d.getDate()).padStart(2, "0"),
      HH: String(d.getHours()).padStart(2, "0"),
      mm: String(d.getMinutes()).padStart(2, "0"),
      ss: String(d.getSeconds()).padStart(2, "0"),
    };
    return format.replace(/YYYY|MM|DD|HH|mm|ss/g, (m) => map[m]);
  }

  static formatTime(date) {
    const d = this.parse(date);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  static formatDate(date) {
    const d = this.parse(date);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  static formatDateRange(start, end) {
    if (!start && !end) return "N/A";
    if (start && !end) return `${this.formatDate(start)} - Ongoing`;
    if (!start && end) return this.formatDate(end);
    const s = this.parse(start);
    const e = this.parse(end);
    return `${this.formatDate(s)} - ${this.formatDate(e)}`;
  }

  static isToday(date) {
    const today = new Date();
    const d = this.parse(date);
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  }

  static daysUntil(date) {
    const today = new Date();
    const d = this.parse(date);
    const diff = d - today;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
}

// ============================================
// 5. API/FETCH WRAPPER
// ============================================

class API {
  static buildUrl(url) {
    return url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
  }

  static getBaseCandidates() {
    if (typeof window === "undefined") {
      return ["http://127.0.0.1:5000", "http://localhost:5000"];
    }

    const { protocol, hostname } = window.location;
    const currentHost = hostname || "127.0.0.1";

    const candidates = [
      API_BASE_URL,
      `${protocol}//127.0.0.1:5000`,
      `${protocol}//localhost:5000`,
      `${protocol}//${currentHost}:5000`,
      "",
    ].filter((value) => typeof value === "string");

    return [...new Set(candidates)];
  }

  static isNetworkFailure(error) {
    const message = String(error?.message || "").toLowerCase();
    return (
      message.includes("failed to fetch") ||
      message.includes("internet_disconnected") ||
      message.includes("networkerror")
    );
  }

  static async request(method, url, data = null) {
    const isAbsolute = url.startsWith("http");
    const isFormData = data instanceof FormData;
    const body =
      data == null ? undefined : isFormData ? data : JSON.stringify(data);

    const attemptUrls = isAbsolute
      ? [url]
      : this.getBaseCandidates().map((base) => `${base}${url}`);

    let lastError = null;

    for (const fullUrl of attemptUrls) {
      try {
        const response = await fetch(fullUrl, {
          method,
          headers: this.getHeaders(isFormData),
          body,
        });
        return this.handleResponse(response, url);
      } catch (error) {
        lastError = error;
        if (!this.isNetworkFailure(error)) {
          throw error;
        }
      }
    }

    throw lastError || new Error("Failed to fetch");
  }

  static handleNetworkError(error) {
    const message = (error && error.message) || "Failed to fetch";
    if (this.isNetworkFailure(error)) {
      throw new Error(
        `Cannot connect to API server. Make sure backend is running at ${
          API_BASE_URL || window.location.origin
        }`,
      );
    }
    throw error;
  }

  static getHeaders(isFormData = false) {
    const headers = {};
    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }
    const token = Storage.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  static async get(url) {
    try {
      return await this.request("GET", url);
    } catch (error) {
      console.error("API Error:", error);
      this.handleNetworkError(error);
    }
  }

  static async post(url, data) {
    try {
      return await this.request("POST", url, data);
    } catch (error) {
      console.error("API Error:", error);
      this.handleNetworkError(error);
    }
  }

  static async put(url, data) {
    try {
      return await this.request("PUT", url, data);
    } catch (error) {
      console.error("API Error:", error);
      this.handleNetworkError(error);
    }
  }

  static async delete(url) {
    try {
      return await this.request("DELETE", url);
    } catch (error) {
      console.error("API Error:", error);
      this.handleNetworkError(error);
    }
  }

  static async handleResponse(response, requestUrl = "") {
    if (!response.ok) {
      if (response.status === 401) {
        const isAuthLoginRequest =
          typeof requestUrl === "string" &&
          (requestUrl.includes("/api/auth/login") ||
            requestUrl.includes("/api/auth/register"));
        const hasToken = Boolean(Storage.getToken());

        // Token expired/invalid should only trigger redirect for authenticated requests,
        // not for login/register failures that also legitimately return 401.
        if (!isAuthLoginRequest && hasToken) {
          Storage.clear();
          AppAuth.redirectToLogin();
          throw new Error("Session expired. Please login again.");
        }
      }
      const data = await response.json().catch(() => ({}));
      throw new Error(
        data.message || `HTTP ${response.status}: ${response.statusText}`,
      );
    }
    const data = await response.json();
    return data;
  }
}

// ============================================
// 6. LOCAL STORAGE WRAPPER
// ============================================

class Storage {
  static AUTH_USER_KEY = "currentUser";
  static AUTH_TOKEN_KEY = "authToken";
  static AUTH_REMEMBER_KEY = "authRemember";

  static set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  static get(key) {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  }

  static remove(key) {
    localStorage.removeItem(key);
  }

  static clear() {
    const authKeys = [
      this.AUTH_USER_KEY,
      this.AUTH_TOKEN_KEY,
      this.AUTH_REMEMBER_KEY,
    ];

    authKeys.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  }

  static setUser(user) {
    if (this.getRememberMe()) {
      localStorage.setItem(this.AUTH_USER_KEY, JSON.stringify(user));
      sessionStorage.removeItem(this.AUTH_USER_KEY);
      return;
    }

    sessionStorage.setItem(this.AUTH_USER_KEY, JSON.stringify(user));
    localStorage.removeItem(this.AUTH_USER_KEY);
  }

  static getUser() {
    const sessionUser = sessionStorage.getItem(this.AUTH_USER_KEY);
    if (sessionUser) return JSON.parse(sessionUser);

    const localUser = localStorage.getItem(this.AUTH_USER_KEY);
    return localUser ? JSON.parse(localUser) : null;
  }

  static setToken(token, remember = null) {
    const shouldRemember =
      typeof remember === "boolean" ? remember : this.getRememberMe();

    if (shouldRemember) {
      localStorage.setItem(this.AUTH_TOKEN_KEY, JSON.stringify(token));
      sessionStorage.removeItem(this.AUTH_TOKEN_KEY);
      return;
    }

    sessionStorage.setItem(this.AUTH_TOKEN_KEY, JSON.stringify(token));
    localStorage.removeItem(this.AUTH_TOKEN_KEY);
  }

  static getToken() {
    const sessionToken = sessionStorage.getItem(this.AUTH_TOKEN_KEY);
    if (sessionToken) return JSON.parse(sessionToken);

    const localToken = localStorage.getItem(this.AUTH_TOKEN_KEY);
    return localToken ? JSON.parse(localToken) : null;
  }

  static setRememberMe(remember) {
    const value = Boolean(remember);
    localStorage.setItem(this.AUTH_REMEMBER_KEY, JSON.stringify(value));
    sessionStorage.setItem(this.AUTH_REMEMBER_KEY, JSON.stringify(value));
  }

  static getRememberMe() {
    const sessionRemember = sessionStorage.getItem(this.AUTH_REMEMBER_KEY);
    if (sessionRemember !== null) return JSON.parse(sessionRemember);

    const localRemember = localStorage.getItem(this.AUTH_REMEMBER_KEY);
    return localRemember ? JSON.parse(localRemember) : false;
  }

  static setAuthSession({ user, token, remember = false }) {
    this.setRememberMe(remember);
    this.setUser(user);
    this.setToken(token, remember);
  }
}

class AppAuth {
  static getLoginUrl() {
    const pagePath = window.location.pathname.toLowerCase();

    if (pagePath.includes("/admin/") || pagePath.includes("/user/")) {
      return "../index.html";
    }

    return "index.html";
  }

  static redirectToLogin() {
    window.location.href = this.getLoginUrl();
  }

  static isAdminSession() {
    const token = Storage.getToken();
    const user = Storage.getUser();
    const role = user?.role?.toLowerCase?.() || "";

    return Boolean(token && user && role === "admin");
  }
}

window.AppAuth = AppAuth;

// ============================================
// 7. DEBOUNCE & THROTTLE
// ============================================

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function throttle(func, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ============================================
// 8. DOM HELPERS
// ============================================

const DomUtils = {
  $(selector) {
    return document.querySelector(selector);
  },

  $$(selector) {
    return document.querySelectorAll(selector);
  },

  create(tag, className = "", innerHTML = "") {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (innerHTML) el.innerHTML = innerHTML;
    return el;
  },

  addClass(el, ...classes) {
    el.classList.add(...classes);
  },

  removeClass(el, ...classes) {
    el.classList.remove(...classes);
  },

  toggleClass(el, className) {
    el.classList.toggle(className);
  },

  hasClass(el, className) {
    return el.classList.contains(className);
  },

  on(el, event, handler) {
    el.addEventListener(event, handler);
  },

  off(el, event, handler) {
    el.removeEventListener(event, handler);
  },

  hide(el) {
    el.style.display = "none";
  },

  show(el, display = "block") {
    el.style.display = display;
  },

  text(el, text) {
    el.textContent = text;
  },

  html(el, html) {
    el.innerHTML = html;
  },

  attr(el, attr, value) {
    if (value === undefined) {
      return el.getAttribute(attr);
    }
    el.setAttribute(attr, value);
  },
};

// ============================================
// 9. ANIMATION HELPERS
// ============================================

const Animate = {
  fadeIn(el, duration = 300) {
    el.style.animation = `fadeIn ${duration}ms ease-out`;
  },

  slideUp(el, duration = 300) {
    el.style.animation = `slideUp ${duration}ms ease-out`;
  },

  slideDown(el, duration = 300) {
    el.style.animation = `slideDown ${duration}ms ease-out`;
  },

  bounce(el) {
    el.classList.add("animate-bounce");
    setTimeout(() => el.classList.remove("animate-bounce"), 1000);
  },
};

// ============================================
// 10. THEME MANAGEMENT
// ============================================

class ThemeManager {
  static init() {
    const savedTheme = Storage.get("theme") || "dark";
    this.setTheme(savedTheme);
  }

  static setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    Storage.set("theme", theme);
  }

  static toggle() {
    const current =
      document.documentElement.getAttribute("data-theme") || "dark";
    const newTheme = current === "dark" ? "light" : "dark";
    this.setTheme(newTheme);
  }
}

// Initialize theme on load
document.addEventListener("DOMContentLoaded", () => {
  ThemeManager.init();
});
