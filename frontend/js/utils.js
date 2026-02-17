/* ============================================
   UTILITIES & HELPER FUNCTIONS
   ============================================ */

// API Base URL Configuration
const API_BASE_URL = "http://localhost:5000";

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
      <span>${this.getIcon(type)}</span>
      <span>${message}</span>
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
      success: "✓",
      error: "✕",
      warning: "⚠",
      info: "ℹ",
    };
    return icons[type] || "";
  }
}

// ============================================
// 2. MODAL MANAGEMENT
// ============================================

class ModalManager {
  static create(title, content, actions = []) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">${title}</h2>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
        ${actions.length > 0
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
        callback: onClose || (() => { }),
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
  static format(date, format = "YYYY-MM-DD") {
    if (typeof date === "string") date = new Date(date);
    const d = new Date(date);
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
    const d = new Date(date);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  static formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  static isToday(date) {
    const today = new Date();
    const d = new Date(date);
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  }

  static daysUntil(date) {
    const today = new Date();
    const d = new Date(date);
    const diff = d - today;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
}

// ============================================
// 5. API/FETCH WRAPPER
// ============================================

class API {
  static async get(url) {
    try {
      const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
      const response = await fetch(fullUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      return this.handleResponse(response);
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  }

  static async post(url, data) {
    try {
      const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
      const response = await fetch(fullUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return this.handleResponse(response);
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  }

  static async put(url, data) {
    try {
      const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
      const response = await fetch(fullUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return this.handleResponse(response);
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  }

  static async delete(url) {
    try {
      const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
      const response = await fetch(fullUrl, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      return this.handleResponse(response);
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  }

  static async handleResponse(response) {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  }
}

// ============================================
// 6. LOCAL STORAGE WRAPPER
// ============================================

class Storage {
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
    localStorage.clear();
  }

  static setUser(user) {
    this.set("currentUser", user);
  }

  static getUser() {
    return this.get("currentUser");
  }

  static setToken(token) {
    this.set("authToken", token);
  }

  static getToken() {
    return this.get("authToken");
  }
}

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
