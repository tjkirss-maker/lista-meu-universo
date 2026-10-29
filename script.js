
"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const STORAGE_KEY = "lista_app_v1";
const CATEGORIES = ["Compras", "Mercado", "Roupas", "Estudos", "Viagem", "Casa", "Geral"];

const CATEGORY_ICONS = {
  Compras: "🛍",
  Mercado: "🛒",
  Roupas: "👗",
  Estudos: "📚",
  Viagem: "✈",
  Casa: "⌂",
  Geral: "✦"
};

const DEFAULT_STATE = {
  items: [],
  lists: [],
  budget: 0,
  discount: 0,
  settings: {
    accent: "#9474ed",
    background: "#f7f5fb",
    dark: false
  }
};

let state = loadState();
let activeCategory = "Todas";
let searchTerm = "";
let statusFilter = "all";
let toastTimer;
let pendingSettings = null;

function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(DEFAULT_STATE);

    const data = JSON.parse(saved);
    if (!data || typeof data !== "object") return structuredClone(DEFAULT_STATE);

    return {
      items: Array.isArray(data.items)
        ? data.items.filter(item =>
            item && typeof item.id === "string" &&
            typeof item.name === "string" &&
            CATEGORIES.includes(item.category)
          ).map(item => ({
            id: item.id,
            name: item.name.slice(0, 100),
            category: item.category,
            quantity: validNumber(item.quantity, 1, 100000, 1),
            price: validNumber(item.price, 0, 100000000, 0),
            notes: typeof item.notes === "string" ? item.notes.slice(0, 500) : "",
            completed: item.completed === true,
            createdAt: Number(item.createdAt) || Date.now()
          }))
        : [],
      lists: Array.isArray(data.lists)
        ? data.lists.filter(list =>
            list && typeof list.id === "string" &&
            typeof list.name === "string" &&
            CATEGORIES.includes(list.category)
          ).map(list => ({
            id: list.id,
            name: list.name.slice(0, 60),
            category: list.category
          }))
        : [],
      budget: validNumber(data.budget, 0, 1000000000, 0),
      discount: validNumber(data.discount, 0, 100, 0),
      settings: {
        accent: validColor(data.settings?.accent, DEFAULT_STATE.settings.accent),
        background: validColor(data.settings?.background, DEFAULT_STATE.settings.background),
        dark: data.settings?.dark === true
      }
    };
  } catch (error) {
    console.warn("Não foi possível carregar os dados salvos.", error);
    return structuredClone(DEFAULT_STATE);
  }
}

function validNumber(value, min, max, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function validColor(value, fallback) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : fallback;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error("Não foi possível salvar os dados.", error);
    showToast("Não foi possível salvar. Verifique o espaço do navegador.", true);
    return false;
  }
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function showToast(message, isError = false) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2800);
}

function getItemTotal(item) {
  return item.quantity * item.price;
}

function getPendingItems() {
  return state.items.filter(item => !item.completed);
}

function getPendingTotal() {
  const subtotal = getPendingItems().reduce((sum, item) => sum + getItemTotal(item), 0);
  return subtotal * (1 - state.discount / 100);
}

function getCategoryItems(category) {
  return state.items.filter(item => item.category === category);
}

function formatDate() {
  const now = new Date();
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(now);
}

function renderGreeting() {
  const hour = new Date().getHours();
  let greeting = "Olá! Vamos organizar?";
  if (hour < 12) greeting = "Bom dia! Vamos organizar?";
  else if (hour < 18) greeting = "Boa tarde! Vamos organizar?";
  else greeting = "Boa noite! Vamos organizar?";

  $("#greeting").innerHTML = `${greeting} <span>✦</span>`;
  $("#todayDate").textContent = formatDate();
}

function renderStats() {
  const total = state.items.length;
  const completed = state.items.filter(item => item.completed).length;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  $("#totalItems").textContent = total;
  $("#completedItems").textContent = completed;
  $("#allCount").textContent = total;
  $("#progressFill").style.width = `${percent}%`;
  $("#progressText").textContent = `${percent}% concluído`;
  $("#totalMoney").textContent = money(getPendingTotal());

  $$(".nav-item[data-category]").forEach(button => {
    const category = button.dataset.category;
    if (category === "Todas") {
      button.querySelector(".nav-count")?.remove();
      const count = document.createElement("span");
      count.className = "nav-count";
      count.textContent = total;
      button.append(count);
    } else {
      const count = getCategoryItems(category).length;
      let badge = button.querySelector(".nav-count");
      if (count > 0 && !badge) {
        badge = document.createElement("span");
        badge.className = "nav-count";
        button.append(badge);
      }
      if (badge) {
        badge.textContent = count;
        badge.hidden = count === 0;
      }
    }
  });
}

function getVisibleItems() {
  return state.items.filter(item => {
    const categoryMatches =
      activeCategory === "Todas" || item.category === activeCategory;
    const statusMatches =
      statusFilter === "all" ||
      (statusFilter === "completed" && item.completed) ||
      (statusFilter === "pending" && !item.completed);
    const query = searchTerm.toLocaleLowerCase("pt-BR");
    const textMatches =
      !query ||
      item.name.toLocaleLowerCase("pt-BR").includes(query) ||
      item.category.toLocaleLowerCase("pt-BR").includes(query) ||
      item.notes.toLocaleLowerCase("pt-BR").includes(query);

    return categoryMatches && statusMatches && textMatches;
  });
}

function renderItems() {
  const collection = $("#listCollection");
  const visibleItems = getVisibleItems();
  const visibleLists = state.lists.filter(list => {
    const categoryMatches = activeCategory === "Todas" || list.category === activeCategory;
    const textMatches = !searchTerm ||
      list.name.toLocaleLowerCase("pt-BR").includes(searchTerm.toLocaleLowerCase("pt-BR"));
    return categoryMatches && textMatches;
  });

  const categoriesToRender = activeCategory === "Todas"
    ? CATEGORIES
    : [activeCategory];

  let html = "";

  for (const category of categoriesToRender) {
    const categoryItems = visibleItems.filter(item => item.category === category);
    const customLists = visibleLists.filter(list => list.category === category);

    if (categoryItems.length === 0 && customLists.length === 0) continue;

    const categoryTotal = categoryItems.reduce((sum, item) => sum + getItemTotal(item), 0);

    html += `
      <section class="list-group">
        <div class="list-group-header">
          <span class="category-icon">${CATEGORY_ICONS[category] || "✦"}</span>
          <div class="list-group-heading">
            <strong>${escapeHTML(category)}</strong>
            <small>${categoryItems.length} ${categoryItems.length === 1 ? "item" : "itens"} · ${money(categoryTotal)}</small>
          </div>
          <div class="group-actions">
            <button class="small-button" data-action="add" data-category="${category}" title="Adicionar item" aria-label="Adicionar item em ${category}">＋</button>
          </div>
        </div>
        ${customLists.map(list => `
          <div class="item-row">
            <span class="category-icon">☷</span>
            <div class="item-main">
              <span class="item-name">${escapeHTML(list.name)}</span>
              <span class="item-details">Lista personalizada</span>
            </div>
            <div class="item-actions">
              <button class="small-button" data-action="add-list-item" data-id="${list.id}" title="Adicionar item à lista" aria-label="Adicionar item à lista ${escapeHTML(list.name)}">＋</button>
              <button class="small-button" data-action="delete-list" data-id="${list.id}" title="Excluir lista" aria-label="Excluir lista ${escapeHTML(list.name)}">×</button>
            </div>
          </div>
        `).join("")}
        ${categoryItems.map(item => `
          <div class="item-row ${item.completed ? "completed" : ""}">
            <input class="item-check" type="checkbox" data-action="toggle" data-id="${item.id}" ${item.completed ? "checked" : ""} aria-label="Marcar ${escapeHTML(item.name)} como concluído">
            <div class="item-main">
              <span class="item-name">${escapeHTML(item.name)}</span>
              <span class="item-details">Qtd.: ${item.quantity}${item.notes ? ` · ${escapeHTML(item.notes)}` : ""}</span>
            </div>
            <div class="item-price">
              ${money(getItemTotal(item))}
              <small>${money(item.price)} / un.</small>
            </div>
            <div class="item-actions">
              <button class="small-button" data-action="edit" data-id="${item.id}" title="Editar item" aria-label="Editar ${escapeHTML(item.name)}">✎</button>
              <button class="small-button" data-action="delete" data-id="${item.id}" title="Excluir item" aria-label="Excluir ${escapeHTML(item.name)}">×</button>
            </div>
          </div>
        `).join("")}
      </section>
    `;
  }

  collection.innerHTML = html;
  const isEmpty = html === "";
  $("#emptyState").hidden = !isEmpty;
  collection.hidden = isEmpty;

  if (isEmpty) {
    $("#emptyState h3").textContent = searchTerm ? "Nenhum resultado encontrado" : "Seu espaço está esperando!";
    $("#emptyState p").textContent = searchTerm
      ? "Tente pesquisar com outro nome ou mudar o filtro."
      : "Adicione seu primeiro item e comece a se organizar.";
  }

  $("#visibleCount").textContent =
    `${visibleItems.length} ${visibleItems.length === 1 ? "item" : "itens"}`;

  $("#clearCompletedButton").disabled = !state.items.some(item => item.completed);
}

function renderBudget() {
  const subtotal = getPendingItems().reduce((sum, item) => sum + getItemTotal(item), 0);
  const discounted = subtotal * (1 - state.discount / 100);
  const remaining = state.budget - discounted;
  const percent = state.budget > 0 ? Math.min(100, (discounted / state.budget) * 100) : 0;

  $("#budgetDisplay").textContent = money(state.budget);
  $("#budgetSpent").textContent = money(discounted);
  $("#discountDisplay").textContent = `${state.discount.toLocaleString("pt-BR")}%`;
  $("#budgetRemaining").textContent = money(remaining);
  $("#budgetRemaining").style.color = remaining < 0 ? "#ffb1c0" : "#b8f1d8";
  $("#budgetFill").style.width = `${percent}%`;
  $("#budgetFill").style.background = remaining < 0 ? "#ff8197" : "#b8f1d8";

  if (state.budget <= 0) {
    $("#budgetNote").textContent = "Defina um orçamento para acompanhar seus gastos.";
  } else if (remaining < 0) {
    $("#budgetNote").textContent = `Você ultrapassou seu orçamento em ${money(Math.abs(remaining))}.`;
  } else {
    $("#budgetNote").textContent = `${money(remaining)} disponíveis do seu orçamento.`;
  }
}

function renderNavigation() {
  $$(".nav-item[data-category]").forEach(button => {
    button.classList.toggle("active", button.dataset.category === activeCategory);
  });
  const label = activeCategory === "Todas" ? "Todas as listas" : activeCategory;
  $("#breadcrumbCategory").textContent = label;
  $("#listHeading").textContent = label;
  $("#listSubheading").textContent = activeCategory === "Todas"
    ? "Tudo o que você precisa lembrar."
    : `Organize seus itens de ${activeCategory.toLocaleLowerCase("pt-BR")}.`;
}

function applySettings() {
  document.documentElement.style.setProperty("--accent", state.settings.accent);
  document.documentElement.style.setProperty("--accent-dark", darkenColor(state.settings.accent));
  document.documentElement.style.setProperty("--page", state.settings.background);
  document.body.classList.toggle("dark", state.settings.dark);
  $("#themeIcon").textContent = state.settings.dark ? "☀" : "☾";
  $("#themeText").textContent = state.settings.dark ? "Modo claro" : "Modo escuro";
}

function darkenColor(hex) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const darker = [r, g, b].map(channel =>
    Math.max(0, Math.round(channel * 0.78)).toString(16).padStart(2, "0")
  );
  return `#${darker.join("")}`;
}

function renderAll() {
  applySettings();
  renderGreeting();
  renderNavigation();
  renderStats();
  renderItems();
  renderBudget();
}

function openModal(backdrop, focusSelector) {
  backdrop.hidden = false;
  document.body.style.overflow = "hidden";
  setTimeout(() => $(focusSelector)?.focus(), 30);
}

function closeModal(backdrop) {
  backdrop.hidden = true;
  const anyOpen = $$(".modal-backdrop").some(modal => !modal.hidden);
  document.body.style.overflow = anyOpen ? "hidden" : "";
}

function openItemForm(category = CATEGORIES.includes(activeCategory) ? activeCategory : "Compras", item = null) {
  $("#itemForm").reset();
  $("#itemId").value = item?.id || "";
  $("#itemName").value = item?.name || "";
  $("#itemCategory").value = item?.category || category;
  $("#itemQuantity").value = item?.quantity ?? 1;
  $("#itemPrice").value = item?.price ?? 0;
  $("#itemStatus").value = item?.completed ? "completed" : "pending";
  $("#itemNotes").value = item?.notes || "";
  $("#modalTitle").textContent = item ? "Editar item" : "Adicionar item";
  $("#modalEyebrow").textContent = item ? "ATUALIZE SUA LISTA" : "ORGANIZE-SE";
  $("#saveItemButton").textContent = item ? "Salvar alterações" : "Salvar item";
  openModal($("#modalBackdrop"), "#itemName");
}

function saveItem(event) {
  event.preventDefault();

  const name = $("#itemName").value.trim();
  const quantity = Number($("#itemQuantity").value);
  const price = Number($("#itemPrice").value);
  const category = $("#itemCategory").value;

  if (!name) {
    showToast("Digite o nome do item.", true);
    return;
  }
  if (!CATEGORIES.includes(category)) {
    showToast("Escolha uma categoria válida.", true);
    return;
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
    showToast("A quantidade precisa ser um número inteiro válido.", true);
    return;
  }
  if (!Number.isFinite(price) || price < 0 || price > 100000000) {
    showToast("Informe um preço válido.", true);
    return;
  }

  const id = $("#itemId").value;
  const existing = state.items.find(item => item.id === id);

  const item = {
    id: existing?.id || makeId(),
    name: name.slice(0, 100),
    category,
    quantity,
    price,
    notes: $("#itemNotes").value.trim().slice(0, 500),
    completed: $("#itemStatus").value === "completed",
    createdAt: existing?.createdAt || Date.now()
  };

  if (existing) {
    state.items = state.items.map(old => old.id === id ? item : old);
  } else {
    state.items.unshift(item);
  }

  activeCategory = category;
  saveState();
  renderAll();
  closeModal($("#modalBackdrop"));
  showToast(existing ? "Item atualizado!" : "Item adicionado!");
}

function deleteItem(id) {
  const item = state.items.find(entry => entry.id === id);
  if (!item) return;

  if (!confirm(`Excluir "${item.name}"?`)) return;

  state.items = state.items.filter(entry => entry.id !== id);
  saveState();
  renderAll();
  showToast("Item excluído.");
}

function toggleItem(id, completed) {
  const item = state.items.find(entry => entry.id === id);
  if (!item) return;

  item.completed = completed;
  saveState();
  renderAll();
  showToast(completed ? "Item concluído!" : "Item voltou para pendentes.");
}

function createList(event) {
  event.preventDefault();

  const name = $("#listName").value.trim();
  const category = $("#listCategory").value;

  if (!name) {
    showToast("Digite o nome da lista.", true);
    return;
  }

  if (state.lists.some(list =>
    list.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR") &&
    list.category === category
  )) {
    showToast("Já existe uma lista com esse nome nessa categoria.", true);
    return;
  }

  state.lists.unshift({ id: makeId(), name: name.slice(0, 60), category });
  activeCategory = category;
  saveState();
  renderAll();
  $("#listForm").reset();
  closeModal($("#listBackdrop"));
  showToast("Lista criada!");
}

function deleteList(id) {
  const list = state.lists.find(entry => entry.id === id);
  if (!list) return;
  if (!confirm(`Excluir a lista "${list.name}"? Os itens da categoria serão mantidos.`)) return;

  state.lists = state.lists.filter(entry => entry.id !== id);
  saveState();
  renderAll();
  showToast("Lista excluída. Os itens foram mantidos.");
}

function exportData() {
  const lines = [
    "MINHAS LISTAS — APLICATIVO LISTA",
    `Exportado em: ${new Date().toLocaleString("pt-BR")}`,
    `Orçamento: ${money(state.budget)}`,
    `Desconto: ${state.discount}%`,
    "",
    "ITENS:"
  ];

  for (const category of CATEGORIES) {
    const items = state.items.filter(item => item.category === category);
    if (!items.length) continue;

    lines.push("", `=== ${category.toLocaleUpperCase("pt-BR")} ===`);

    for (const item of items) {
      lines.push(
        `${item.completed ? "[X]" : "[ ]"} ${item.name}`,
        `  Quantidade: ${item.quantity}`,
        `  Preço unitário: ${money(item.price)}`,
        `  Total: ${money(getItemTotal(item))}`,
        ...(item.notes ? [`  Observações: ${item.notes}`] : []),
        ""
      );
    }
  }

  if (state.lists.length) {
    lines.push("", "LISTAS PERSONALIZADAS:");
    state.lists.forEach(list => lines.push(`- ${list.name} (${list.category})`));
  }

  lines.push("", `Total pendente com desconto: ${money(getPendingTotal())}`);

  const blob = new Blob(["\uFEFF" + lines.join("\n")], {
    type: "text/plain;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `minhas-listas-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Arquivo exportado!");
}

function openBudgetForm() {
  $("#budgetInput").value = state.budget;
  $("#discountInput").value = state.discount;
  openModal($("#budgetBackdrop"), "#budgetInput");
}

function saveBudget(event) {
  event.preventDefault();
  const budget = Number($("#budgetInput").value);
  const discount = Number($("#discountInput").value);

  if (!Number.isFinite(budget) || budget < 0 || budget > 1000000000) {
    showToast("Informe um orçamento válido.", true);
    return;
  }
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
    showToast("O desconto deve ficar entre 0% e 100%.", true);
    return;
  }

  state.budget = budget;
  state.discount = discount;
  saveState();
  renderAll();
  closeModal($("#budgetBackdrop"));
  showToast("Orçamento atualizado!");
}

function openSettings() {
  pendingSettings = { ...state.settings };
  $("#accentColor").value = pendingSettings.accent;
  $("#backgroundColor").value = pendingSettings.background;
  openModal($("#settingsBackdrop"), "#accentColor");
}

function closeSettings() {
  pendingSettings = null;
  closeModal($("#settingsBackdrop"));
}

function applyPendingSettings() {
  if (!pendingSettings) return;
  state.settings = { ...pendingSettings };
  saveState();
  renderAll();
  closeSettings();
  showToast("Personalização aplicada!");
}

function restoreSettings() {
  pendingSettings = {
    accent: DEFAULT_STATE.settings.accent,
    background: DEFAULT_STATE.settings.background,
    dark: state.settings.dark
  };
  $("#accentColor").value = pendingSettings.accent;
  $("#backgroundColor").value = pendingSettings.background;
}

function handleCollectionClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id;
  const category = button.dataset.category;

  if (action === "add") {
    openItemForm(category);
  } else if (action === "edit") {
    const item = state.items.find(entry => entry.id === id);
    if (item) openItemForm(item.category, item);
  } else if (action === "delete") {
    deleteItem(id);
  } else if (action === "delete-list") {
    deleteList(id);
  } else if (action === "add-list-item") {
    const list = state.lists.find(entry => entry.id === id);
    if (list) openItemForm(list.category);
  }
}

function handleCollectionChange(event) {
  const checkbox = event.target.closest('[data-action="toggle"]');
  if (checkbox) toggleItem(checkbox.dataset.id, checkbox.checked);
}

function bindEvents() {
  $("#itemForm").addEventListener("submit", saveItem);
  $("#listForm").addEventListener("submit", createList);
  $("#budgetForm").addEventListener("submit", saveBudget);

  $("#newListButton").addEventListener("click", () => {
    $("#listForm").reset();
    $("#listCategory").value = CATEGORIES.includes(activeCategory) ? activeCategory : "Compras";
    openModal($("#listBackdrop"), "#listName");
  });

  $("#quickAddButton").addEventListener("click", () => openItemForm());
  $("#emptyAddButton").addEventListener("click", () => openItemForm());
  $("#editBudgetButton").addEventListener("click", openBudgetForm);
  $("#quickBudgetButton").addEventListener("click", openBudgetForm);
  $("#exportButton").addEventListener("click", exportData);
  $("#quickExportButton").addEventListener("click", exportData);
  $("#settingsButton").addEventListener("click", openSettings);

  $("#themeButton").addEventListener("click", () => {
    state.settings.dark = !state.settings.dark;
    saveState();
    renderAll();
  });

  $("#searchInput").addEventListener("input", event => {
    searchTerm = event.target.value.trim();
    renderItems();
  });

  $("#statusFilter").addEventListener("change", event => {
    statusFilter = event.target.value;
    renderItems();
  });

  $("#categoryNav").addEventListener("click", event => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    activeCategory = button.dataset.category;
    renderNavigation();
    renderItems();
    $("#sidebar").classList.remove("open");
  });

  $("#listCollection").addEventListener("click", handleCollectionClick);
  $("#listCollection").addEventListener("change", handleCollectionChange);

  $("#clearCompletedButton").addEventListener("click", () => {
    const count = state.items.filter(item => item.completed).length;
    if (!count) return;
    if (!confirm(`Excluir os ${count} itens concluídos?`)) return;

    state.items = state.items.filter(item => !item.completed);
    saveState();
    renderAll();
    showToast("Itens concluídos removidos.");
  });

  $("#closeModalButton").addEventListener("click", () => closeModal($("#modalBackdrop")));
  $("#cancelModalButton").addEventListener("click", () => closeModal($("#modalBackdrop")));
  $("#closeSettingsButton").addEventListener("click", closeSettings);
  $("#closeBudgetButton").addEventListener("click", () => closeModal($("#budgetBackdrop")));
  $("#cancelBudgetButton").addEventListener("click", () => closeModal($("#budgetBackdrop")));
  $("#closeListButton").addEventListener("click", () => closeModal($("#listBackdrop")));
  $("#cancelListButton").addEventListener("click", () => closeModal($("#listBackdrop")));

  $("#saveSettingsButton").addEventListener("click", applyPendingSettings);
  $("#resetSettingsButton").addEventListener("click", restoreSettings);

  $("#accentColor").addEventListener("input", event => {
    if (pendingSettings) pendingSettings.accent = validColor(event.target.value, "#9474ed");
  });
  $("#backgroundColor").addEventListener("input", event => {
    if (pendingSettings) pendingSettings.background = validColor(event.target.value, "#f7f5fb");
  });

  $$(".palette-option").forEach(button => {
    button.addEventListener("click", () => {
      if (!pendingSettings) return;
      pendingSettings.accent = button.dataset.accent;
      pendingSettings.background = button.dataset.bg;
      $("#accentColor").value = pendingSettings.accent;
      $("#backgroundColor").value = pendingSettings.background;
    });
  });

  $$(".modal-backdrop").forEach(backdrop => {
    backdrop.addEventListener("click", event => {
      if (event.target !== backdrop) return;
      if (backdrop === $("#settingsBackdrop")) closeSettings();
      else closeModal(backdrop);
    });
  });

  $("#menuButton").addEventListener("click", () => {
    $("#sidebar").classList.toggle("open");
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      $$(".modal-backdrop").filter(modal => !modal.hidden).forEach(modal => {
        if (modal === $("#settingsBackdrop")) closeSettings();
        else closeModal(modal);
      });
      $("#sidebar").classList.remove("open");
    }

    if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
      event.preventDefault();
      $("#searchInput").focus();
    }
  });
}

bindEvents();
renderAll();
