/* ============================================
   ADMIN ANALYTICS PAGE SCRIPT
   ============================================ */

class AdminAnalyticsPage {
  constructor() {
    this.chatbotSelect = document.getElementById("analytics-chatbot-select");
    this.usernameInput = document.getElementById("analytics-username-search");
    this.summaryGrid = document.getElementById("analytics-summary");
    this.contentGrid = document.getElementById("analytics-content-grid");
    this.breakdownList = document.getElementById("analytics-breakdown-list");
    this.emptyState = document.getElementById("analytics-empty-state");

    this.totalImagesEl = document.getElementById("summary-total-images");
    this.userImagesEl = document.getElementById("summary-user-images");
    this.volunteerImagesEl = document.getElementById(
      "summary-volunteer-images",
    );

    this.pieCanvas = document.getElementById("analytics-pie-chart");
    this.lineCanvas = document.getElementById("analytics-line-chart");

    this.pieChart = null;
    this.lineChart = null;
    this.requestCounter = 0;

    this.init();
  }

  init() {
    if (!AdminAuth.isAdminSession()) {
      NotificationManager.warning("Please login as admin to continue");
      AdminAuth.redirectToLogin();
      return;
    }

    this.bindEvents();
    this.loadChatbots();
  }

  bindEvents() {
    if (this.chatbotSelect) {
      this.chatbotSelect.addEventListener("change", () => {
        this.fetchAnalytics();
      });
    }

    if (this.usernameInput) {
      this.usernameInput.parentElement.style.position = "relative";
      this.usernameInput.parentElement.style.overflow = "visible";
      this.usernameSuggestions = document.createElement("div");
      this.usernameSuggestions.className = "analytics-search-suggestions";
      this.usernameSuggestions.style.position = "absolute";
      this.usernameSuggestions.style.zIndex = "20000";
      this.usernameSuggestions.style.overflow = "visible";
      this.usernameInput.parentElement.appendChild(this.usernameSuggestions);
      this.usernameSuggestionIndex = -1;

      const debouncedSearch = debounce(async () => {
        await this.loadAnalyticsUsernameSuggestions();
        this.fetchAnalytics();
      }, 250);

      this.usernameInput.addEventListener("input", debouncedSearch);

      this.usernameInput.addEventListener("keydown", (event) => {
        const items = Array.from(
          this.usernameSuggestions.querySelectorAll(
            "button.analytics-search-suggestion",
          ),
        );

        if (items.length === 0) {
          return;
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          this.usernameSuggestionIndex = Math.min(
            (this.usernameSuggestionIndex || -1) + 1,
            items.length - 1,
          );
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          this.usernameSuggestionIndex = Math.max(
            (this.usernameSuggestionIndex || 0) - 1,
            0,
          );
        } else if (event.key === "Enter") {
          if (
            this.usernameSuggestionIndex >= 0 &&
            this.usernameSuggestionIndex < items.length
          ) {
            event.preventDefault();
            items[this.usernameSuggestionIndex].click();
            return;
          }
        } else if (event.key === "Escape") {
          this.usernameSuggestions.innerHTML = "";
          this.usernameSuggestions.style.display = "none";
          this.usernameSuggestionIndex = -1;
          return;
        }

        items.forEach((item, idx) => {
          item.classList.toggle("active", idx === this.usernameSuggestionIndex);
        });
      });

      document.addEventListener("click", (event) => {
        if (
          this.usernameSuggestions &&
          !this.usernameSuggestions.contains(event.target) &&
          event.target !== this.usernameInput
        ) {
          this.usernameSuggestions.innerHTML = "";
          this.usernameSuggestions.style.display = "none";
          this.usernameSuggestionIndex = -1;
        }
      });
    }
  }

  async loadAnalyticsUsernameSuggestions() {
    if (!this.usernameSuggestions || !this.usernameInput) return;

    const rawTerm = (this.usernameInput.value || "").trim();
    if (rawTerm.length < 1) {
      this.usernameSuggestions.innerHTML = "";
      this.usernameSuggestions.style.display = "none";
      this.usernameSuggestionIndex = -1;
      return;
    }

    try {
      const response = await API.get(
        `/api/admin/users?search=${encodeURIComponent(rawTerm)}&per_page=6`,
      );
      const users = Array.isArray(response?.data) ? response.data : [];
      if (users.length === 0) {
        this.usernameSuggestions.innerHTML = "";
        this.usernameSuggestions.style.display = "none";
        this.usernameSuggestionIndex = -1;
        return;
      }

      this.usernameSuggestions.innerHTML = users
        .map((user) => {
          const username = String(user.username || "").trim();
          const name = String(user.name || "").trim();
          const label = username
            ? `${username}${name ? ` (${name})` : ""}`
            : name;
          return `<button type="button" class="analytics-search-suggestion" data-username="${this.escapeHtml(
            username,
          )}">${this.escapeHtml(label)}</button>`;
        })
        .join("");

      this.usernameSuggestions.style.display = "block";
      const inputRect = this.usernameInput.getBoundingClientRect();
      this.usernameSuggestions.style.width = `${inputRect.width}px`;
      this.usernameSuggestions.style.left = `${this.usernameInput.offsetLeft}px`;

      const items = Array.from(
        this.usernameSuggestions.querySelectorAll(
          "button.analytics-search-suggestion",
        ),
      );

      items.forEach((button, idx) => {
        button.addEventListener("click", () => {
          const selected = button.getAttribute("data-username") || "";
          this.usernameInput.value = selected;
          this.usernameSuggestions.innerHTML = "";
          this.usernameSuggestions.style.display = "none";
          this.usernameSuggestionIndex = -1;
          this.fetchAnalytics();
        });
      });

      this.usernameSuggestionIndex = -1;
    } catch (error) {
      console.error("Failed to load analytics username suggestions:", error);
      this.usernameSuggestions.innerHTML = "";
      this.usernameSuggestions.style.display = "none";
      this.usernameSuggestionIndex = -1;
    }
  }

  async loadChatbots() {
    if (!this.chatbotSelect) return;

    this.chatbotSelect.innerHTML =
      '<option value="">Loading chatbots...</option>';

    try {
      const response = await API.get("/api/admin/chatbots?per_page=200");
      const chatbots = Array.isArray(response?.data) ? response.data : [];

      if (chatbots.length === 0) {
        this.chatbotSelect.innerHTML =
          '<option value="">No chatbots available</option>';
        this.showEmptyState(true);
        this.stopLoadingState();
        return;
      }

      const sortedChatbots = [...chatbots].sort((a, b) => {
        const aName = String(a?.event_name || a?.name || "").toLowerCase();
        const bName = String(b?.event_name || b?.name || "").toLowerCase();
        return aName.localeCompare(bName);
      });

      this.chatbotSelect.innerHTML = [
        ...sortedChatbots.map((bot) => {
          const displayName = bot.event_name
            ? `${bot.name} - ${bot.event_name}`
            : bot.name || `Chatbot ${bot.id}`;
          return `<option value="${bot.id}">${this.escapeHtml(displayName)}</option>`;
        }),
      ].join("");

      if (this.chatbotSelect.options.length > 0) {
        const randomIndex = Math.floor(
          Math.random() * this.chatbotSelect.options.length,
        );
        this.chatbotSelect.selectedIndex = randomIndex;
      }

      this.fetchAnalytics();
    } catch (error) {
      console.error("Error loading chatbots:", error);
      this.chatbotSelect.innerHTML =
        '<option value="">Failed to load chatbots</option>';
      NotificationManager.error(error.message || "Failed to load chatbot list");
      this.showEmptyState(true);
      this.stopLoadingState();
    }
  }

  async fetchAnalytics() {
    const chatbotId = Number.parseInt(this.chatbotSelect?.value || "", 10);
    if (!Number.isFinite(chatbotId) || chatbotId <= 0) {
      this.showEmptyState(true);
      this.updateSummary({
        total_images: 0,
        user_images: 0,
        volunteer_images: 0,
      });
      this.renderBreakdown([]);
      this.renderCharts({ timeline: [], user_images: 0, volunteer_images: 0 });
      return;
    }

    const username = String(this.usernameInput?.value || "").trim();
    const params = new URLSearchParams({ chatbot_id: String(chatbotId) });
    if (username) {
      params.set("username", username);
    }

    const requestId = ++this.requestCounter;
    this.startLoadingState();

    try {
      const response = await API.get(
        `/api/admin/analytics?${params.toString()}`,
      );

      // Ignore stale responses when newer requests are already in flight.
      if (requestId !== this.requestCounter) {
        return;
      }

      const payload = this.normalizePayload(response);
      this.updateSummary(payload);
      this.renderBreakdown(payload.user_breakdown || []);
      this.renderCharts(payload);

      const hasAnyData = Number(payload.total_images || 0) > 0;
      this.showEmptyState(!hasAnyData);
    } catch (error) {
      if (requestId !== this.requestCounter) {
        return;
      }
      console.error("Error loading analytics:", error);
      NotificationManager.error(
        error.message || "Failed to load analytics data",
      );
      this.showEmptyState(true);
      this.updateSummary({
        total_images: 0,
        user_images: 0,
        volunteer_images: 0,
      });
      this.renderBreakdown([]);
      this.renderCharts({ timeline: [], user_images: 0, volunteer_images: 0 });
    } finally {
      if (requestId === this.requestCounter) {
        this.stopLoadingState();
      }
    }
  }

  normalizePayload(response) {
    const payload =
      response?.data && typeof response.data === "object"
        ? response.data
        : response;

    return {
      total_images: Number(payload?.total_images || 0),
      user_images: Number(payload?.user_images || 0),
      volunteer_images: Number(payload?.volunteer_images || 0),
      timeline: Array.isArray(payload?.timeline) ? payload.timeline : [],
      user_breakdown: Array.isArray(payload?.user_breakdown)
        ? payload.user_breakdown
        : [],
    };
  }

  updateSummary(payload) {
    this.totalImagesEl.textContent = this.formatNumber(payload.total_images);
    this.userImagesEl.textContent = this.formatNumber(payload.user_images);
    this.volunteerImagesEl.textContent = this.formatNumber(
      payload.volunteer_images,
    );
  }

  renderBreakdown(userBreakdown) {
    if (!this.breakdownList) return;

    if (!Array.isArray(userBreakdown) || userBreakdown.length === 0) {
      this.breakdownList.innerHTML = `
        <div class="analytics-breakdown-row">
          <div class="analytics-breakdown-name">No matching users found</div>
          <div class="analytics-breakdown-count">0</div>
        </div>
      `;
      return;
    }

    this.breakdownList.innerHTML = userBreakdown
      .map((entry) => {
        const username = this.escapeHtml(String(entry?.username || "Unknown"));
        const count = this.formatNumber(entry?.count || 0);
        return `
          <div class="analytics-breakdown-row">
            <div class="analytics-breakdown-name">${username}</div>
            <div class="analytics-breakdown-count">${count}</div>
          </div>
        `;
      })
      .join("");
  }

  renderCharts(payload) {
    this.renderPieChart(
      payload.user_images || 0,
      payload.volunteer_images || 0,
    );
    this.renderLineChart(payload.timeline || []);
  }

  renderPieChart(userImages, volunteerImages) {
    if (!this.pieCanvas || typeof Chart === "undefined") return;

    const ctx = this.pieCanvas.getContext("2d");
    const userGradient = ctx.createLinearGradient(0, 0, 260, 220);
    userGradient.addColorStop(0, "rgba(34, 197, 229, 0.95)");
    userGradient.addColorStop(1, "rgba(59, 130, 246, 0.9)");

    const volunteerGradient = ctx.createLinearGradient(0, 0, 260, 220);
    volunteerGradient.addColorStop(0, "rgba(255, 124, 67, 0.95)");
    volunteerGradient.addColorStop(1, "rgba(249, 115, 22, 0.9)");

    if (this.pieChart) {
      this.pieChart.data.datasets[0].data = [userImages, volunteerImages];
      this.pieChart.update();
      return;
    }

    this.pieChart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: ["Users", "Volunteers"],
        datasets: [
          {
            data: [userImages, volunteerImages],
            backgroundColor: [userGradient, volunteerGradient],
            borderColor: "rgba(15, 23, 42, 0.9)",
            borderWidth: 2,
            hoverOffset: 12,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 820,
          easing: "easeOutQuart",
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "#cbd5e1",
              usePointStyle: true,
              padding: 18,
            },
          },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            borderColor: "rgba(148, 163, 184, 0.25)",
            borderWidth: 1,
          },
        },
      },
    });
  }

  renderLineChart(timeline) {
    if (!this.lineCanvas || typeof Chart === "undefined") return;

    const normalizedTimeline = this.normalizeTimelineForChart(timeline);
    const labels = normalizedTimeline.map((entry) =>
      this.formatDate(entry.date),
    );
    const values = normalizedTimeline.map((entry) => Number(entry?.count || 0));

    const ctx = this.lineCanvas.getContext("2d");
    const lineGradient = ctx.createLinearGradient(0, 0, 360, 0);
    lineGradient.addColorStop(0, "rgba(34, 211, 238, 0.98)");
    lineGradient.addColorStop(1, "rgba(129, 140, 248, 0.95)");

    const areaGradient = ctx.createLinearGradient(0, 0, 0, 280);
    areaGradient.addColorStop(0, "rgba(56, 189, 248, 0.38)");
    areaGradient.addColorStop(1, "rgba(56, 189, 248, 0.02)");

    if (this.lineChart) {
      this.lineChart.data.labels = labels;
      this.lineChart.data.datasets[0].data = values;
      this.lineChart.update();
      return;
    }

    this.lineChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Images",
            data: values,
            borderColor: lineGradient,
            backgroundColor: areaGradient,
            showLine: true,
            fill: true,
            tension: 0.36,
            borderWidth: 3,
            pointRadius: values.length <= 2 ? 4 : 3,
            pointHoverRadius: values.length <= 2 ? 6 : 5,
            pointBorderColor: "rgba(15, 23, 42, 0.95)",
            pointBorderWidth: 2,
            pointBackgroundColor: "#22d3ee",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 780,
          easing: "easeOutCubic",
        },
        scales: {
          x: {
            ticks: {
              color: "#94a3b8",
              maxRotation: 0,
            },
            grid: {
              color: "rgba(148, 163, 184, 0.12)",
            },
          },
          y: {
            beginAtZero: true,
            grace: "18%",
            ticks: {
              color: "#94a3b8",
              precision: 0,
            },
            grid: {
              color: "rgba(148, 163, 184, 0.12)",
            },
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            borderColor: "rgba(148, 163, 184, 0.25)",
            borderWidth: 1,
          },
        },
      },
    });
  }

  normalizeTimelineForChart(timeline) {
    const safeTimeline = Array.isArray(timeline) ? timeline : [];
    if (safeTimeline.length !== 1) {
      return safeTimeline;
    }

    const singleEntry = safeTimeline[0];
    const rawDate = String(singleEntry?.date || "");
    const parsed = new Date(`${rawDate}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) {
      return safeTimeline;
    }

    // Keep the trend line visible even when filtered data has a single day.
    const nextDate = new Date(parsed);
    nextDate.setDate(nextDate.getDate() + 1);

    return [
      {
        date: rawDate,
        count: Number(singleEntry?.count || 0),
      },
      {
        date: nextDate.toISOString().slice(0, 10),
        count: Number(singleEntry?.count || 0),
      },
    ];
  }

  showEmptyState(shouldShow) {
    if (!this.emptyState) return;
    this.emptyState.hidden = !shouldShow;
  }

  startLoadingState() {
    this.summaryGrid?.classList.add("loading");
    this.contentGrid?.classList.add("loading");
    this.breakdownList?.classList.add("loading");
  }

  stopLoadingState() {
    this.summaryGrid?.classList.remove("loading");
    this.contentGrid?.classList.remove("loading");
    this.breakdownList?.classList.remove("loading");
  }

  formatDate(rawDate) {
    if (!rawDate) return "";
    const parsed = new Date(`${rawDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return String(rawDate);
    }
    return parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  formatNumber(value) {
    const safe = Number(value || 0);
    return Number.isFinite(safe) ? safe.toLocaleString() : "0";
  }

  escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("analytics-chatbot-select")) {
    window.adminAnalyticsPage = new AdminAnalyticsPage();
  }
});
