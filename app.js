const SUPABASE_URL = "https://nyjnuzslnvjsjijqayms.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55am51enNsbnZqc2ppanFheW1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMDc3OTksImV4cCI6MjA4NTc4Mzc5OX0.S4dh0wpjT9C90JBtG-eewta5kl6V-s-bZJ0qTfxFZrU";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

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

const adminReportsList = document.getElementById("adminReportsList");
const adminSeverityFilter = document.getElementById("adminSeverityFilter");
const adminHazardFilter = document.getElementById("adminHazardFilter");
const adminRefreshBtn = document.getElementById("adminRefreshBtn");
const hotspotsTableBody = document.querySelector("#hotspotsTable tbody");

const currentUserLabel = document.getElementById("currentUserLabel");
const logoutBtn = document.getElementById("logoutBtn");

const severityToggle = document.getElementById("severityToggle");

let currentUser = null;
let currentProfile = null;
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

async function fetchProfile(user) {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Error loading profile:", error);
    return null;
  }
  return data;
}

async function handleAuthChange(user) {
  currentUser = user;

  if (!user) {
    currentProfile = null;
    currentUserLabel.textContent = "";
    showView("login");
    return;
  }

  currentProfile = await fetchProfile(user);
  const role = currentProfile?.role || "user";

  currentUserLabel.textContent = `${user.email} · ${role.toUpperCase()} MODE`;

  if (role === "admin") {
    showView("admin");
    await loadAdminReports();
  } else {
    showView("user");
    await loadUserReports();
  }
}

async function loadUserReports() {
  if (!currentUser) return;

  const { data, error } = await supabaseClient
    .from("reports")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading user reports:", error);
    setStatus(
      reportMessage,
      "Unable to load your reports right now.",
      "error"
    );
    return;
  }

  renderReports(userReportsList, data || [], { showReporter: false });
}

async function loadAdminReports() {
  const filters = {};
  const severity = adminSeverityFilter.value;
  const hazard = adminHazardFilter.value;

  if (severity) filters.severity = severity;
  if (hazard) filters.hazard_type = hazard;

  let query = supabaseClient.from("reports").select("*");

  if (filters.severity) query = query.eq("severity", filters.severity);
  if (filters.hazard_type) query = query.eq("hazard_type", filters.hazard_type);

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error("Error loading admin reports:", error);
    renderReports(adminReportsList, [], { showReporter: true });
    return;
  }

  renderReports(adminReportsList, data || [], { showReporter: true });
  renderHotspots(data || []);
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

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(authMessage, "");

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    const submitBtn = document.getElementById("loginSubmitBtn");
    setLoading(submitBtn, true, "Sign In");

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(submitBtn, false, "Sign In");

    if (error) {
      console.error("Login error:", error);
      setStatus(
        authMessage,
        "Sign in failed. Check your email and password.",
        "error"
      );
      return;
    }

    setStatus(authMessage, "Signed in successfully.", "success");
    await handleAuthChange(data.user);
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

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
    });

    setLoading(submitBtn, false, "Create User Account");

    if (error) {
      console.error("Signup error:", error);
      setStatus(
        authMessage,
        "Could not create account. Use a different email or try again.",
        "error"
      );
      return;
    }

    setStatus(
      authMessage,
      "Account created. Check your inbox for verification, then sign in.",
      "success"
    );

    if (data.user) {
      await supabaseClient.from("profiles").insert({
        id: data.user.id,
        email,
        role: "user",
      });
    }

    signupForm.reset();
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
      user_id: currentUser.id,
    };

    const submitBtn = document.getElementById("reportSubmitBtn");
    setLoading(submitBtn, true, "Submit Report");

    const { error } = await supabaseClient.from("reports").insert(payload);

    setLoading(submitBtn, false, "Submit Report");

    if (error) {
      console.error("Error submitting report:", error);
      setStatus(
        reportMessage,
        "Unable to submit report right now. Please try again.",
        "error"
      );
      return;
    }

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
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    await handleAuthChange(null);
  });
}

if (adminRefreshBtn) {
  adminRefreshBtn.addEventListener("click", () => {
    loadAdminReports();
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
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    await handleAuthChange(session?.user ?? null);
  } catch (err) {
    console.error("Error initializing session:", err);
    showView("login");
  }
})();

