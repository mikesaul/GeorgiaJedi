(function () {
  const ADMIN_KEY = "isAdmin";
  const ADMIN_TIMEOUT_KEY = "adminTimeout";
  const ADMIN_PASSWORD = "ForceGranted";
  const ADMIN_DURATION_MS = 60 * 60 * 1000; // 60 minutes

  function isAdminMode() {
    const flag = localStorage.getItem(ADMIN_KEY);
    const timeout = localStorage.getItem(ADMIN_TIMEOUT_KEY);
    if (!flag || !timeout) return false;
    if (Date.now() > parseInt(timeout, 10)) {
      // Expired
      localStorage.removeItem(ADMIN_KEY);
      localStorage.removeItem(ADMIN_TIMEOUT_KEY);
      return false;
    }
    return flag === "true";
  }

  function enableAdminMode() {
    localStorage.setItem(ADMIN_KEY, "true");
    localStorage.setItem(ADMIN_TIMEOUT_KEY, Date.now() + ADMIN_DURATION_MS);
    alert("✅ Admin mode enabled for 60 minutes.");
    updateAdminVisibility();
  }

  function disableAdminMode() {
    localStorage.removeItem(ADMIN_KEY);
    localStorage.removeItem(ADMIN_TIMEOUT_KEY);
    alert("🚪 Admin mode disabled.");
    updateAdminVisibility();
  }

  function updateAdminVisibility() {
    const adminElements = document.querySelectorAll(".admin-only");
    const adminMode = isAdminMode();

    adminElements.forEach((el) => {
      el.style.display = adminMode ? "" : "none";
    });

    const adminToggle = document.getElementById("adminToggle");
    const logoutLink = document.getElementById("logoutAdmin");

    if (adminToggle) adminToggle.style.display = adminMode ? "none" : "";
    if (logoutLink) logoutLink.style.display = adminMode ? "" : "none";
  }

  document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === ADMIN_PASSWORD) {
      enableAdminMode();
      params.delete("admin");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      updateAdminVisibility();
    }

    const logoutLink = document.getElementById("logoutAdmin");
    if (logoutLink) logoutLink.addEventListener("click", disableAdminMode);
  });

  // 🔹 Make visibility updater available globally for dynamic tables
  window.updateAdminVisibility = updateAdminVisibility;
})();
