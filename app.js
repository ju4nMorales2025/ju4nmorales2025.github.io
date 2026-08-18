const state = {
  verses: [],
  offset: 0,
  installPrompt: null,
  oneSignalReady: false,
};

const $ = (id) => document.getElementById(id);

function dayIndex(date = new Date()) {
  const base = new Date(2026, 0, 1);
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.abs(Math.floor((local - base) / 86400000)) % state.verses.length;
}

function preference() {
  return localStorage.getItem("vd_bible_version") || "MIXED";
}

function desiredVersion(date = new Date()) {
  const pref = preference();
  if (pref === "RVR1960" || pref === "PDT") return pref;
  return date.getDate() % 2 === 0 ? "RVR1960" : "PDT";
}

function displayVerse(v, date = new Date()) {
  const version = desiredVersion(date);
  const exact = version === "RVR1960" ? v.rvr1960 : v.pdt;
  return {
    ...v,
    text: exact && exact.trim() ? exact.trim() : v.preview,
    version,
    exact: !!(exact && exact.trim())
  };
}

function currentVerse() {
  const index = (dayIndex() + state.offset) % state.verses.length;
  return displayVerse(state.verses[index]);
}

function favorites() {
  return JSON.parse(localStorage.getItem("vd_favorites") || "[]");
}

function setFavorites(list) {
  localStorage.setItem("vd_favorites", JSON.stringify(list));
}

function isFavorite(id) {
  return favorites().includes(id);
}

function toggleFavorite() {
  const v = currentVerse();
  const list = favorites();
  const idx = list.indexOf(v.id);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(v.id);
  setFavorites(list);
  render();
}

function renderDate() {
  const date = new Date();
  const fmt = new Intl.DateTimeFormat("es-AR", {
    weekday: "long", day: "numeric", month: "long"
  });
  $("today").textContent = fmt.format(date);
}

function render() {
  const v = currentVerse();
  renderDate();
  $("verseText").textContent = v.text;
  $("verseRef").textContent = v.reference;
  $("category").textContent = v.category;
  $("versionChip").textContent = v.exact ? v.version : "VISTA PREVIA";
  $("verseVersion").textContent = v.exact ? (v.version === "RVR1960" ? "Reina-Valera 1960" : "Palabra de Dios para Todos") : "";
  $("favBtn").textContent = isFavorite(v.id) ? "♥ Guardado" : "♡ Guardar";
  renderFavorites();
}

function renderFavorites() {
  const ids = favorites();
  const host = $("favoritesList");
  if (!ids.length) {
    host.innerHTML = `<div class="fav-item"><div class="fav-text">Todavía no guardaste ningún versículo.</div></div>`;
    return;
  }
  host.innerHTML = ids.map(id => {
    const raw = state.verses.find(v => v.id === id);
    if (!raw) return "";
    const v = displayVerse(raw);
    return `<div class="fav-item">
      <div class="fav-ref">${escapeHtml(v.reference)}</div>
      <div class="fav-text">${escapeHtml(v.text)}</div>
    </div>`;
  }).join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function updateInstallUI() {
  if (isStandalone()) {
    $("installedMsg").classList.remove("hidden");
    $("iosInstall").classList.add("hidden");
    $("installBtn").classList.add("hidden");
    return;
  }
  if (isIOS()) {
    $("iosInstall").classList.remove("hidden");
  } else if (state.installPrompt) {
    $("installBtn").classList.remove("hidden");
  }
}

async function initOneSignal() {
  const appId = window.VD_CONFIG?.oneSignalAppId?.trim();
  if (!appId) {
    $("pushStatus").textContent = "Falta conectar la cuenta gratuita de OneSignal.";
    return;
  }

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  OneSignalDeferred.push(async function(OneSignal) {
    try {
      await OneSignal.init({ appId });
      state.oneSignalReady = true;
      await syncPreferenceTag(OneSignal);
      const opted = OneSignal.User.PushSubscription.optedIn;
      $("pushStatus").textContent = opted ? "✓ Notificaciones activadas" : "";
      $("pushBtn").textContent = opted ? "Notificaciones activadas" : "Activar notificaciones";
    } catch (err) {
      console.error(err);
      $("pushStatus").textContent = "No se pudo inicializar OneSignal.";
    }
  });
}

async function syncPreferenceTag(OneSignalInstance) {
  try {
    OneSignalInstance.User.addTag("bible_version", preference());
  } catch (_) {}
}

async function requestPush() {
  const appId = window.VD_CONFIG?.oneSignalAppId?.trim();
  if (!appId) {
    $("pushStatus").textContent = "Primero debemos conectar OneSignal.";
    return;
  }
  if (isIOS() && !isStandalone()) {
    $("pushStatus").textContent = "En iPhone, primero agregá la web a la pantalla de inicio y abrila desde su ícono.";
    return;
  }

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  OneSignalDeferred.push(async function(OneSignal) {
    try {
      const supported = OneSignal.Notifications.isPushSupported();
      if (!supported) {
        $("pushStatus").textContent = "Este navegador no admite Web Push.";
        return;
      }
      await OneSignal.Notifications.requestPermission();
      await syncPreferenceTag(OneSignal);
      const opted = OneSignal.User.PushSubscription.optedIn;
      $("pushStatus").textContent = opted ? "✓ Notificaciones activadas" : "Permiso no concedido.";
      $("pushBtn").textContent = opted ? "Notificaciones activadas" : "Activar notificaciones";
    } catch (err) {
      console.error(err);
      $("pushStatus").textContent = "No se pudo activar la notificación.";
    }
  });
}

function setView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(v => v.classList.remove("active"));
  $(`view-${name}`).classList.add("active");
  document.querySelector(`.nav-btn[data-view="${name}"]`).classList.add("active");
}

function applyTheme() {
  const theme = localStorage.getItem("vd_theme") || "system";
  if (theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.dataset.theme = "dark";
  } else {
    document.documentElement.dataset.theme = "light";
  }
}

function toggleTheme() {
  const current = localStorage.getItem("vd_theme") || "system";
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem("vd_theme", next);
  applyTheme();
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  state.installPrompt = e;
  updateInstallUI();
});

$("installBtn").addEventListener("click", async () => {
  if (!state.installPrompt) return;
  state.installPrompt.prompt();
  await state.installPrompt.userChoice;
  state.installPrompt = null;
  updateInstallUI();
});

$("favBtn").addEventListener("click", toggleFavorite);
$("otherBtn").addEventListener("click", () => {
  state.offset = (state.offset + 1) % state.verses.length;
  render();
});
$("copyBtn").addEventListener("click", async () => {
  const v = currentVerse();
  await navigator.clipboard.writeText(`${v.text}\n${v.reference}`);
  $("copyBtn").textContent = "✓ Copiado";
  setTimeout(() => $("copyBtn").textContent = "⧉ Copiar", 1000);
});
$("themeBtn").addEventListener("click", toggleTheme);
$("pushBtn").addEventListener("click", requestPush);

$("versionSelect").addEventListener("change", async (e) => {
  localStorage.setItem("vd_bible_version", e.target.value);
  render();
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  OneSignalDeferred.push(async function(OneSignal) {
    await syncPreferenceTag(OneSignal);
  });
});

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => setView(btn.dataset.view));
});

async function start() {
  applyTheme();
  $("versionSelect").value = preference();
  const res = await fetch("data/verses.json", { cache: "no-store" });
  state.verses = await res.json();
  render();
  updateInstallUI();
  await initOneSignal();
}
start();
