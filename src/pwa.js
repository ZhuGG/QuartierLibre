export function mountInstallation(button) {
  if (!import.meta.env.PROD) return;

  let prompt;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    prompt = event;
    button.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    prompt = undefined;
    button.hidden = true;
  });

  button.addEventListener("click", async () => {
    if (!prompt || button.disabled) return;
    button.disabled = true;
    try {
      await prompt.prompt();
    } catch (error) {
      console.warn("Le navigateur n’a pas ouvert la fenêtre d’installation.", error);
    } finally {
      prompt = undefined;
      button.hidden = true;
      button.disabled = false;
    }
  });

  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: "none" })
      .catch((error) => console.warn("Le mode hors connexion est indisponible.", error));
  }, { once: true });
}
