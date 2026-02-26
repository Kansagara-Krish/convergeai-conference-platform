class ForgotPasswordHandler {
  constructor() {
    this.form = document.getElementById("forgot-password-form");
    if (!this.form) return;

    this.stepRequest = document.getElementById("forgot-step-request");
    this.stepReset = document.getElementById("forgot-step-reset");
    this.usernameInput = document.getElementById("fp-username");
    this.emailInput = document.getElementById("fp-email");
    this.otpInput = document.getElementById("fp-otp");
    this.newPasswordInput = document.getElementById("fp-new-password");
    this.confirmPasswordInput = document.getElementById("fp-confirm-password");
    this.sendOtpBtn = document.getElementById("send-otp-btn");
    this.resetPasswordBtn = document.getElementById("reset-password-btn");
    this.resendOtpBtn = document.getElementById("resend-otp-btn");
    this.otpTimerEl = document.getElementById("otp-timer");
    this.otpBanner = document.getElementById("otp-banner");

    this.resendTimer = null;
    this.secondsLeft = 0;

    this.init();
  }

  init() {
    this.sendOtpBtn?.addEventListener("click", () => this.requestOtp(false));
    this.resendOtpBtn?.addEventListener("click", () => this.requestOtp(true));
    this.resetPasswordBtn?.addEventListener("click", () =>
      this.resetPassword(),
    );

    if (this.otpInput) {
      this.otpInput.addEventListener("input", () => {
        this.otpInput.value = this.otpInput.value
          .replace(/\D/g, "")
          .slice(0, 6);
      });
    }

    this.setupPasswordToggleIcons();
  }

  setupPasswordToggleIcons() {
    const toggles = this.form.querySelectorAll(".forgot-password-toggle");
    toggles.forEach((toggleBtn) => {
      toggleBtn.addEventListener("click", () => {
        const targetId = toggleBtn.getAttribute("data-target");
        if (!targetId) return;

        const input = document.getElementById(targetId);
        const icon = toggleBtn.querySelector(".material-symbols-outlined");
        if (!input || !icon) return;

        const isHidden = input.type === "password";
        input.type = isHidden ? "text" : "password";
        icon.textContent = isHidden ? "visibility_off" : "visibility";
        toggleBtn.setAttribute(
          "aria-label",
          isHidden ? "Hide password" : "Show password",
        );
      });
    });
  }

  setButtonLoading(button, isLoading) {
    if (!button) return;

    const text = button.querySelector(".btn-text");
    const loader = button.querySelector(".btn-loader");

    button.disabled = isLoading;
    button.setAttribute("aria-busy", isLoading ? "true" : "false");

    if (text) text.style.display = isLoading ? "none" : "inline";
    if (loader) loader.style.display = isLoading ? "inline-block" : "none";
  }

  switchToResetStep(message) {
    this.stepRequest?.classList.remove("active");
    this.stepReset?.classList.add("active");
    this.stepReset?.classList.add("step-enter");

    setTimeout(() => {
      this.stepReset?.classList.remove("step-enter");
    }, 320);

    if (this.otpBanner && message) {
      this.otpBanner.textContent = message;
    }

    this.otpInput?.focus();
  }

  startResendCountdown(seconds) {
    this.secondsLeft = Number.isFinite(Number(seconds)) ? Number(seconds) : 60;

    if (this.resendTimer) {
      clearInterval(this.resendTimer);
      this.resendTimer = null;
    }

    const tick = () => {
      if (this.secondsLeft <= 0) {
        this.resendOtpBtn.disabled = false;
        if (this.otpTimerEl)
          this.otpTimerEl.textContent = "You can resend OTP now";
        clearInterval(this.resendTimer);
        this.resendTimer = null;
        return;
      }

      this.resendOtpBtn.disabled = true;
      if (this.otpTimerEl)
        this.otpTimerEl.textContent = `Resend in ${this.secondsLeft}s`;
      this.secondsLeft -= 1;
    };

    tick();
    this.resendTimer = setInterval(tick, 1000);
  }

  validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  async requestOtp(isResend) {
    const username = (this.usernameInput?.value || "").trim();
    const email = (this.emailInput?.value || "").trim().toLowerCase();

    if (!username || !email) {
      NotificationManager.error("Please enter username and email");
      return;
    }

    if (!this.validateEmail(email)) {
      NotificationManager.error("Please enter a valid email address");
      return;
    }

    this.setButtonLoading(isResend ? this.resendOtpBtn : this.sendOtpBtn, true);

    try {
      const response = await API.post("/api/auth/forgot-password/request-otp", {
        username,
        email,
      });

      this.usernameInput.value = username;
      this.emailInput.value = email;
      this.usernameInput.readOnly = true;
      this.emailInput.readOnly = true;

      this.switchToResetStep(response?.message || "OTP sent to your email");
      this.startResendCountdown(response?.resend_in_seconds || 60);
      NotificationManager.success("OTP sent successfully");
    } catch (error) {
      NotificationManager.error(error.message || "Failed to send OTP");
    } finally {
      this.setButtonLoading(this.sendOtpBtn, false);
      this.setButtonLoading(this.resendOtpBtn, false);
      if (this.secondsLeft > 0) {
        this.resendOtpBtn.disabled = true;
      }
    }
  }

  async resetPassword() {
    const username = (this.usernameInput?.value || "").trim();
    const email = (this.emailInput?.value || "").trim().toLowerCase();
    const otp = (this.otpInput?.value || "").trim();
    const newPassword = this.newPasswordInput?.value || "";
    const confirmPassword = this.confirmPasswordInput?.value || "";

    if (!username || !email || !otp || !newPassword || !confirmPassword) {
      NotificationManager.error("Please fill all required fields");
      return;
    }

    if (!/^\d{6}$/.test(otp)) {
      NotificationManager.error("OTP must be a 6-digit code");
      return;
    }

    if (newPassword.length < 6) {
      NotificationManager.error("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      NotificationManager.error("Passwords do not match");
      return;
    }

    this.setButtonLoading(this.resetPasswordBtn, true);

    try {
      const response = await API.post("/api/auth/forgot-password/reset", {
        username,
        email,
        otp,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      NotificationManager.success(
        response?.message || "Password reset successful",
      );
      setTimeout(() => {
        window.location.href = "index.html";
      }, 1000);
    } catch (error) {
      NotificationManager.error(error.message || "Failed to reset password");
    } finally {
      this.setButtonLoading(this.resetPasswordBtn, false);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.forgotPasswordHandler = new ForgotPasswordHandler();
});
