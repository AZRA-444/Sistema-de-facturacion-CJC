// ============================================================
// GUARDIA DE SESIÓN PARA PÁGINAS DE ADMINISTRACIÓN
// ============================================================

(function () {
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("No se pudo cargar la librería de Supabase (supabase-js). Revisa tu conexión a internet.");
    return;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.__authClient = client;

  function irALogin() {
    // Evita loops de redirección si ya estamos en login.html
    if (!location.pathname.endsWith("login.html")) {
      window.location.href = "login.html";
    }
  }

  client.auth.getSession().then(({ data, error }) => {
    if (error || !data?.session) {
      irALogin();
    }
  });

  client.auth.onAuthStateChange((_event, session) => {
    if (!session) irALogin();
  });
})();

function cerrarSesion() {
  window.__authClient?.auth.signOut().finally(() => {
    window.location.href = "../../index.html";
  });
}
