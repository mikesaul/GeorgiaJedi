// --- admin-auth.js ---
// Centralized admin token and visibility manager for GeorgiaJedi.net

(function() {
    const ADMIN_KEY = "galactic_admin_token";
    const VALID_TOKEN = "ForceGranted"; // expected token value
  
    // --- Step 1: Capture ?admin=ForceGranted in URL and persist it ---
    const params = new URLSearchParams(window.location.search);
    if (params.has("admin")) {
      const token = params.get("admin");
      localStorage.setItem(ADMIN_KEY, token);
      history.replaceState(null, "", window.location.pathname); // clean URL
    }
  
    // --- Step 2: Check if user is admin ---
    function isAdmin() {
      return localStorage.getItem(ADMIN_KEY) === VALID_TOKEN;
    }
  
    // --- Step 3: Show/hide admin-only elements ---
    function updateAdminVisibility() {
      const adminEls = document.querySelectorAll(".admin-only");
      const logoutLink = document.getElementById("logoutAdmin");
      const visible = isAdmin();
  
      adminEls.forEach(el => {
        el.style.display = visible ? "" : "none";
      });
  
      if (logoutLink) {
        logoutLink.style.display = visible ? "" : "none";
      }
    }
  
    // --- Step 4: Bind logout handler ---
    function setupLogoutHandler() {
      const logoutLink = document.getElementById("logoutAdmin");
      if (!logoutLink) return;
  
      logoutLink.addEventListener("click", e => {
        e.preventDefault();
        localStorage.removeItem(ADMIN_KEY);
        updateAdminVisibility();
        alert("Admin access removed.");
      });
    }
  
    // --- Step 5: Initialize once DOM is ready ---
    document.addEventListener("DOMContentLoaded", () => {
      updateAdminVisibility();
      setupLogoutHandler();
    });
  })();
  