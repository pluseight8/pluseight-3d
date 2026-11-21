(() => {
  const themes = [
    ["cobalt", "Кобальт"],
    ["swiss", "Швейцарский постер"],
    ["terminal", "Терминал"],
    ["chrome", "Хром Y2K"],
    ["bauhaus", "Баухаус"],
    ["obsidian", "Обсидиан"],
    ["risograph", "Ризография"],
    ["porcelain", "Фарфор"],
    ["arcade", "Пиксельная аркада"],
    ["sumi", "Тушь"],
    ["blueprint", "Чертёж"],
    ["desert", "Терракота"],
    ["deco", "Ар-деко"],
    ["ultraviolet", "Ультрафиолет"],
    ["forest", "Ботаника"],
    ["vaporwave", "Vaporwave"],
    ["seventies", "Семидесятые"],
    ["candy", "Бабл-гам"],
    ["opart", "Оп-арт"],
    ["xerox", "Ксерокс"],
  ];
  const key = "pluseight-style";
  const first = themes[0][0];
  const root = document.documentElement;
  const positions = new Map(themes.map(([id], index) => [id, index]));

  function savedStyle() {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function styleFromLocation() {
    const requested = new URLSearchParams(location.search).get("style");
    if (positions.has(requested)) return requested;
    const saved = savedStyle();
    return positions.has(saved) ? saved : first;
  }

  let current = styleFromLocation();
  root.dataset.theme = current;

  document.addEventListener("DOMContentLoaded", () => {
    const tools = document.querySelector(".style-tools");
    const opener = document.querySelector("#style-open");
    const dialog = document.querySelector("#style-dialog");
    const gallery = document.querySelector("#style-gallery");
    const status = document.querySelector("#style-status");
    const position = document.querySelector("#style-position");
    const themeColor = document.querySelector("meta[name='theme-color']");
    const cards = new Map();
    const count = String(themes.length);

    function updateInterface(announce = false) {
      const index = positions.get(current);
      const [, name] = themes[index];
      const number = String(index + 1).padStart(2, "0");
      position.textContent = `${number} / ${count}`;
      opener.setAttribute("aria-label", `Стили. Текущее оформление: ${name}`);
      opener.title = name;
      for (const [id, card] of cards) {
        card.setAttribute("aria-pressed", String(id === current));
      }
      const paper = getComputedStyle(root).getPropertyValue("--paper").trim();
      if (paper) themeColor.content = paper;
      if (announce) status.textContent = `Оформление: ${name}. ${index + 1} из ${count}.`;
    }

    function selectStyle(id, persist = true) {
      current = id;
      root.dataset.theme = current;
      if (persist) {
        try {
          localStorage.setItem(key, current);
        } catch {
          // The URL still holds the selection when storage is unavailable.
        }
        const url = new URL(location.href);
        url.searchParams.set("style", current);
        history.replaceState(history.state, "", url);
      }
      updateInterface(persist);
    }

    function buildGallery() {
      if (cards.size) return;
      const fragment = document.createDocumentFragment();
      for (const [id, name] of themes) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "style-card";
        button.setAttribute("aria-pressed", String(id === current));

        const image = document.createElement("img");
        image.src = `./assets/style-previews/${id}.webp`;
        image.width = 352;
        image.height = 220;
        image.loading = "lazy";
        image.decoding = "async";
        image.alt = "";

        const caption = document.createElement("span");
        caption.className = "style-card-name";
        caption.textContent = name;

        button.append(image, caption);
        button.addEventListener("click", () => {
          selectStyle(id);
          dialog.close();
        });
        fragment.append(button);
        cards.set(id, button);
      }
      gallery.append(fragment);
    }

    function step(offset) {
      const index = (positions.get(current) + offset + themes.length) % themes.length;
      selectStyle(themes[index][0]);
    }

    opener.addEventListener("click", () => {
      buildGallery();
      dialog.showModal();
      cards.get(current).scrollIntoView({ block: "nearest", behavior: "instant" });
    });
    document.querySelector("#style-close").addEventListener("click", () => dialog.close());
    document.querySelector("#style-prev").addEventListener("click", () => step(-1));
    document.querySelector("#style-next").addEventListener("click", () => step(1));
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => opener.focus({ preventScroll: true }));
    window.addEventListener("popstate", () => selectStyle(styleFromLocation(), false));

    updateInterface();
    tools.hidden = false;
  }, { once: true });
})();
