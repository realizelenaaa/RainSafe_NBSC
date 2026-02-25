"use strict";

const API_BASE = ""; 

async function apiRequest(path, { method = "GET", body } = {}) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(API_BASE + path, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data && data.error ? data.error : "Request failed.";
    throw new Error(message);
  }

  return data;
}

async function apiGetSession() {
  return apiRequest("auth.php?action=session", { method: "GET" });
}

async function apiLogin(email, password) {
  return apiRequest("auth.php?action=login", {
    method: "POST",
    body: { email, password },
  });
}

async function apiSignup(email, password) {
  return apiRequest("auth.php?action=signup", {
    method: "POST",
    body: { email, password },
  });
}

async function apiLogout() {
  return apiRequest("auth.php?action=logout", { method: "POST" });
}

async function apiGetUserReports() {
  const { reports } = await apiRequest("reports.php", { method: "GET" });
  return reports || [];
}

async function apiGetAdminReports(filters = {}) {
  const params = new URLSearchParams();
  params.set("scope", "admin");
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.hazard_type) params.set("hazard_type", filters.hazard_type);

  const { reports } = await apiRequest(
    `reports.php?${params.toString()}`,
    { method: "GET" }
  );
  return reports || [];
}

async function apiCreateReport(payload) {
  return apiRequest("reports.php", {
    method: "POST",
    body: payload,
  });
}

async function apiGetUserActivityLogs() {
  const { logs } = await apiRequest("activity_logs.php", { method: "GET" });
  return logs || [];
}

async function apiGetAdminActivityLogs() {
  const params = new URLSearchParams();
  params.set("scope", "admin");
  const { logs } = await apiRequest(
    `activity_logs.php?${params.toString()}`,
    { method: "GET" }
  );
  return logs || [];
}

// Elements
const loginView = document.getElementById("loginView");
const userDashboardView = document.getElementById("userDashboardView");
const adminDashboardView = document.getElementById("adminDashboardView");

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const authMessage = document.getElementById("authMessage");

const reportForm = document.getElementById("reportForm");
const reportMessage = document.getElementById("reportMessage");
const userReportsList = document.getElementById("userReportsList");
const userActivityLogsList = document.getElementById("userActivityLogsList");
const userSideNav = document.getElementById("userSideNav");

const adminReportsList = document.getElementById("adminReportsList");
const adminSeverityFilter = document.getElementById("adminSeverityFilter");
const adminHazardFilter = document.getElementById("adminHazardFilter");
const adminRefreshBtn = document.getElementById("adminRefreshBtn");
const hotspotsTableBody = document.querySelector("#hotspotsTable tbody");
const adminActivityLogsList = document.getElementById("adminActivityLogsList");
const adminTopNav = document.getElementById("adminTopNav");

const currentUserLabel = document.getElementById("currentUserLabel");
const logoutBtn = document.getElementById("logoutBtn");

const severityToggle = document.getElementById("severityToggle");

let currentUser = null;
let selectedSeverity = "Low";

function setStatus(element, message, type = "") {
  if (!element) return;
  element.textContent = message || "";
  element.classList.remove("error", "success");
  if (type) {
    element.classList.add(type);
  }
}

function setLoading(button, isLoading, labelWhenIdle) {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalLabel = button.textContent;
    button.textContent = "Please wait…";
    button.disabled = true;
  } else {
    button.textContent = labelWhenIdle || button.dataset.originalLabel || "";
    button.disabled = false;
  }
}

function showView(view) {
  loginView.classList.add("hidden");
  userDashboardView.classList.add("hidden");
  adminDashboardView.classList.add("hidden");

  if (view === "login") {
    loginView.classList.remove("hidden");
    currentUserLabel.classList.add("hidden");
    logoutBtn.classList.add("hidden");
  } else if (view === "user") {
    userDashboardView.classList.remove("hidden");
    currentUserLabel.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
  } else if (view === "admin") {
    adminDashboardView.classList.remove("hidden");
    currentUserLabel.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
  }
}

function setUserTab(tab) {
  const buttons = document.querySelectorAll("[data-user-tab]");
  const panels = document.querySelectorAll("[data-user-tab-panel]");

  buttons.forEach((btn) => {
    const value = btn.getAttribute("data-user-tab");
    btn.classList.toggle("side-tab-active", value === tab);
  });

  panels.forEach((panel) => {
    const value = panel.getAttribute("data-user-tab-panel");
    panel.classList.toggle("hidden", value !== tab);
  });
}

function setAdminTab(tab) {
  const buttons = document.querySelectorAll("[data-admin-tab]");
  const panels = document.querySelectorAll("[data-admin-tab-panel]");

  buttons.forEach((btn) => {
    const value = btn.getAttribute("data-admin-tab");
    btn.classList.toggle("top-tab-active", value === tab);
  });

  panels.forEach((panel) => {
    const value = panel.getAttribute("data-admin-tab-panel");
    panel.classList.toggle("hidden", value !== tab);
  });
}

function getSeverityClass(severity) {
  if (severity === "High") return "tag-high";
  if (severity === "Medium") return "tag-medium";
  return "tag-low";
}

function formatDateTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderReports(listElement, reports, { showReporter = false } = {}) {
  if (!listElement) return;

  if (!reports || reports.length === 0) {
    listElement.innerHTML =
      '<p class="muted">No reports yet. Encourage students to submit after rainfall.</p>';
    listElement.classList.add("empty-state");
    return;
  }

  listElement.classList.remove("empty-state");

  listElement.innerHTML = reports
    .map((r) => {
      const severityClass = getSeverityClass(r.severity);
      const reporterLabel =
        r.reporter_name && r.reporter_name.trim().length > 0
          ? r.reporter_name
          : "Anonymous";

      return `
      <article class="report-card">
        <div class="report-card-header">
          <div>
            <div class="report-location">${r.location || "Unknown location"}</div>
            <div class="report-tags">
              <span class="tag tag-muted">${r.hazard_type}</span>
              <span class="tag ${severityClass}">${r.severity} severity</span>
            </div>
          </div>
        </div>
        <div class="report-body">
          ${r.description ? r.description : "<em>No additional details provided.</em>"}
        </div>
        <div class="report-footer">
          <span>${formatDateTime(r.created_at)}</span>
          <span>${
            showReporter ? `Reported by: ${reporterLabel}` : `You reported this`
          }</span>
        </div>
      </article>
    `;
    })
    .join("");
}

function renderActivityLogs(listElement, logs, { showUser = false } = {}) {
  if (!listElement) return;

  if (!logs || logs.length === 0) {
    listElement.innerHTML = '<p class="muted">No activity yet.</p>';
    listElement.classList.add("empty-state");
    return;
  }

  listElement.classList.remove("empty-state");

  listElement.innerHTML = logs
    .map((log) => {
      const who = showUser
        ? log.user_email || `User #${log.user_id}`
        : "";

      return `
      <article class="report-card">
        <div class="report-card-header">
          <div>
            <div class="report-location">${log.action}</div>
            ${
              who
                ? `<div class="report-tags"><span class="tag tag-muted">${who}</span></div>`
                : ""
            }
          </div>
        </div>
        <div class="report-body">
          ${log.details ? log.details : "<em>No extra details recorded.</em>"}
        </div>
        <div class="report-footer">
          <span>${formatDateTime(log.created_at)}</span>
        </div>
      </article>
    `;
    })
    .join("");
}

function groupHotspots(reports) {
  const byLocation = new Map();

  reports.forEach((r) => {
    const key = (r.location || "Unknown location").trim();
    if (!byLocation.has(key)) {
      byLocation.set(key, []);
    }
    byLocation.get(key).push(r);
  });

  const items = [];
  byLocation.forEach((rows, location) => {
    const reportsCount = rows.length;
    const sorted = [...rows].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
    const mostRecent = sorted[0];

    items.push({
      location,
      reportsCount,
      mostRecentSeverity: mostRecent.severity,
      lastReported: mostRecent.created_at,
    });
  });

  items.sort((a, b) => b.reportsCount - a.reportsCount);
  return items;
}

function renderHotspots(reports) {
  if (!hotspotsTableBody) return;

  const hotspots = groupHotspots(reports).slice(0, 10);

  if (hotspots.length === 0) {
    hotspotsTableBody.innerHTML =
      '<tr><td colspan="4" class="muted">No data yet.</td></tr>';
    return;
  }

  hotspotsTableBody.innerHTML = hotspots
    .map(
      (h) => `
      <tr>
        <td>${h.location}</td>
        <td>${h.reportsCount}</td>
        <td>${h.mostRecentSeverity}</td>
        <td>${formatDateTime(h.lastReported)}</td>
      </tr>
    `
    )
    .join("");
}

async function handleAuthChange(user) {
  currentUser = user;

  if (!user) {
    currentUserLabel.textContent = "";
    showView("login");
    return;
  }

  const role = user.role || "user";

  currentUserLabel.textContent = `${user.email} · ${role.toUpperCase()} MODE`;

  if (role === "admin") {
    showView("admin");
    setAdminTab("reports");
    await loadAdminReports();
    await loadAdminActivityLogs();
  } else {
    showView("user");
    setUserTab("submit");
    await loadUserReports();
    await loadUserActivityLogs();
  }
}

async function loadUserReports() {
  if (!currentUser) return;

  try {
    const reports = await apiGetUserReports();
    renderReports(userReportsList, reports, { showReporter: false });
  } catch (error) {
    console.error("Error loading user reports:", error);
    setStatus(
      reportMessage,
      "Unable to load your reports right now.",
      "error"
    );
  }
}

async function loadAdminReports() {
  const filters = {};
  const severity = adminSeverityFilter.value;
  const hazard = adminHazardFilter.value;

  if (severity) filters.severity = severity;
  if (hazard) filters.hazard_type = hazard;

  try {
    const reports = await apiGetAdminReports(filters);
    renderReports(adminReportsList, reports, { showReporter: true });
    renderHotspots(reports);
  } catch (error) {
    console.error("Error loading admin reports:", error);
    renderReports(adminReportsList, [], { showReporter: true });
  }
}

async function loadUserActivityLogs() {
  if (!currentUser) return;

  try {
    const logs = await apiGetUserActivityLogs();
    renderActivityLogs(userActivityLogsList, logs, { showUser: false });
  } catch (error) {
    console.error("Error loading user activity logs:", error);
    renderActivityLogs(userActivityLogsList, [], { showUser: false });
  }
}

async function loadAdminActivityLogs() {
  if (!currentUser) return;

  try {
    const logs = await apiGetAdminActivityLogs();
    renderActivityLogs(adminActivityLogsList, logs, { showUser: true });
  } catch (error) {
    console.error("Error loading admin activity logs:", error);
    renderActivityLogs(adminActivityLogsList, [], { showUser: true });
  }
}

// Event wiring

if (severityToggle) {
  severityToggle.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (!button) return;

    selectedSeverity = button.dataset.value;

    Array.from(severityToggle.querySelectorAll("button")).forEach((btn) => {
      btn.classList.remove("chip-selected");
    });
    button.classList.add("chip-selected");
  });
}

if (userSideNav) {
  userSideNav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-user-tab]");
    if (!button) return;
    const tab = button.getAttribute("data-user-tab");
    if (!tab) return;
    setUserTab(tab);
  });
}

if (adminTopNav) {
  adminTopNav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-admin-tab]");
    if (!button) return;
    const tab = button.getAttribute("data-admin-tab");
    if (!tab) return;
    setAdminTab(tab);
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(authMessage, "");

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    const submitBtn = document.getElementById("loginSubmitBtn");
    setLoading(submitBtn, true, "Sign In");

    try {
      const { user } = await apiLogin(email, password);
      setLoading(submitBtn, false, "Sign In");
      setStatus(authMessage, "Signed in successfully.", "success");
      await handleAuthChange(user);
    } catch (error) {
      console.error("Login error:", error);
      setLoading(submitBtn, false, "Sign In");
      setStatus(
        authMessage,
        error.message || "Sign in failed. Check your email and password.",
        "error"
      );
    }
  });
}

if (signupForm) {
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(authMessage, "");

    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;

    const submitBtn = document.getElementById("signupSubmitBtn");
    setLoading(submitBtn, true, "Create User Account");

    try {
      await apiSignup(email, password);
      setLoading(submitBtn, false, "Create User Account");
      setStatus(
        authMessage,
        "Account created. You can now sign in.",
        "success"
      );
      signupForm.reset();
    } catch (error) {
      console.error("Signup error:", error);
      setLoading(submitBtn, false, "Create User Account");
      setStatus(
        authMessage,
        error.message ||
          "Could not create account. Use a different email or try again.",
        "error"
      );
    }
  });
}

if (reportForm) {
  reportForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUser) {
      setStatus(reportMessage, "Please sign in again.", "error");
      return;
    }

    setStatus(reportMessage, "");

    const payload = {
      location: document.getElementById("location").value.trim(),
      hazard_type: document.getElementById("hazardType").value,
      severity: selectedSeverity,
      description: document.getElementById("description").value.trim(),
      reporter_name: document.getElementById("reporterName").value.trim(),
    };

    const submitBtn = document.getElementById("reportSubmitBtn");
    setLoading(submitBtn, true, "Submit Report");

    try {
      await apiCreateReport(payload);
      setLoading(submitBtn, false, "Submit Report");

      reportForm.reset();
      selectedSeverity = "Low";
      Array.from(severityToggle.querySelectorAll("button")).forEach((btn) => {
        btn.classList.toggle(
          "chip-selected",
          btn.dataset.value === selectedSeverity
        );
      });

      setStatus(
        reportMessage,
        "Thank you. Your report has been recorded.",
        "success"
      );

      await loadUserReports();
      await loadUserActivityLogs();
    } catch (error) {
      console.error("Error submitting report:", error);
      setLoading(submitBtn, false, "Submit Report");
      setStatus(
        reportMessage,
        error.message ||
          "Unable to submit report right now. Please try again.",
        "error"
      );
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await apiLogout();
    } catch (error) {
      console.error("Logout error:", error);
    }
    await handleAuthChange(null);
  });
}

if (adminRefreshBtn) {
  adminRefreshBtn.addEventListener("click", () => {
    loadAdminReports();
    loadAdminActivityLogs();
  });
}

if (adminSeverityFilter) {
  adminSeverityFilter.addEventListener("change", () => {
    loadAdminReports();
  });
}

if (adminHazardFilter) {
  adminHazardFilter.addEventListener("change", () => {
    loadAdminReports();
  });
}

// Initial session check on page load
(async function bootstrap() {
  try {
    const { user } = await apiGetSession();
    await handleAuthChange(user ?? null);
  } catch (err) {
    console.error("Error initializing session:", err);
    showView("login");
  }
})();