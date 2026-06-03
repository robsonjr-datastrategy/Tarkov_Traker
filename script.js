(function () {
  const STORAGE_KEY = "tarkovFirTrackerProgress";
  const BASE_CACHE_KEY = "tarkovFirTrackerBase";
  const BASE_DATA_VERSION = 5;

  const state = {
    items: [],
    progress: {},
    filters: new Set(["all"]),
    search: "",
    loading: false
  };

  const elements = {
    totalRequired: document.getElementById("totalRequired"),
    totalCollected: document.getElementById("totalCollected"),
    totalRemaining: document.getElementById("totalRemaining"),
    totalPercent: document.getElementById("totalPercent"),
    questRequired: document.getElementById("questRequired"),
    hideoutRequired: document.getElementById("hideoutRequired"),
    kappaRequired: document.getElementById("kappaRequired"),
    firRemaining: document.getElementById("firRemaining"),
    progressLabel: document.getElementById("progressLabel"),
    progressFill: document.getElementById("progressFill"),
    dataSource: document.getElementById("dataSource"),
    searchInput: document.getElementById("searchInput"),
    filterButtons: document.querySelectorAll(".filter-button"),
    visibleCount: document.getElementById("visibleCount"),
    saveState: document.getElementById("saveState"),
    refreshBaseBtn: document.getElementById("refreshBaseBtn"),
    resetBtn: document.getElementById("resetBtn"),
    exportBtn: document.getElementById("exportBtn"),
    importBtn: document.getElementById("importBtn"),
    importFile: document.getElementById("importFile"),
    sharedSection: document.getElementById("sharedSection"),
    questSection: document.getElementById("questSection"),
    hideoutSection: document.getElementById("hideoutSection"),
    sharedGrid: document.getElementById("sharedGrid"),
    questGrid: document.getElementById("questGrid"),
    hideoutGrid: document.getElementById("hideoutGrid"),
    emptyState: document.getElementById("emptyState"),
    usageModal: document.getElementById("usageModal"),
    usageModalTitle: document.getElementById("usageModalTitle"),
    modalItemIcon: document.getElementById("modalItemIcon"),
    modalUsageList: document.getElementById("modalUsageList"),
    closeUsageModal: document.getElementById("closeUsageModal")
  };

  loadProgress();
  loadInitialBase();
  bindEvents();
  render();

  function loadInitialBase() {
    const cached = loadCachedBase();
    const fallback = normalizeLoadedItems(window.TARKOV_ITEMS || []);

    if (cached.length > 0) {
      state.items = cached;
      elements.dataSource.textContent = `Base salva no navegador carregada (${cached.length} itens).`;
      return;
    }

    state.items = fallback;
    elements.dataSource.textContent = `Base local carregada (${fallback.length} itens).`;
  }

  function loadCachedBase() {
    try {
      const cached = JSON.parse(localStorage.getItem(BASE_CACHE_KEY));
      if (!cached || cached.version !== BASE_DATA_VERSION) return [];
      return normalizeLoadedItems(cached && Array.isArray(cached.items) ? cached.items : []);
    } catch {
      return [];
    }
  }

  function cacheBase(items) {
    localStorage.setItem(BASE_CACHE_KEY, JSON.stringify({
      version: BASE_DATA_VERSION,
      savedAt: new Date().toISOString(),
      items
    }));
  }

  function normalizeLoadedItems(items) {
    return items.map((item) => ({
      ...item,
      collected: 0,
      remaining: item.totalRequired,
      usages: Array.isArray(item.usages) ? item.usages : []
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  function bindEvents() {
    elements.searchInput.addEventListener("input", (event) => {
      state.search = event.target.value.trim().toLowerCase();
      render();
    });

    elements.filterButtons.forEach((button) => {
      button.addEventListener("click", (event) => handleFilterClick(button.dataset.filter, event.ctrlKey || event.metaKey));
    });

    elements.refreshBaseBtn.addEventListener("click", refreshBase);
    elements.resetBtn.addEventListener("click", resetProgress);
    elements.exportBtn.addEventListener("click", exportProgress);
    elements.importBtn.addEventListener("click", () => elements.importFile.click());
    elements.importFile.addEventListener("change", importProgress);
    elements.closeUsageModal.addEventListener("click", closeUsageModal);
    elements.usageModal.addEventListener("click", (event) => {
      if (event.target === elements.usageModal) closeUsageModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !elements.usageModal.hidden) closeUsageModal();
    });
  }

  function loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      state.progress = saved && typeof saved === "object" ? saved : {};
    } catch {
      state.progress = {};
    }
  }

  function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
    elements.saveState.textContent = "Salvo localmente";
  }

  async function refreshBase() {
    if (!window.TarkovApi || !window.TarkovDataMapper) return;

    setLoading(true);
    elements.dataSource.textContent = "Consultando tarkov.dev...";

    try {
      const data = await window.TarkovApi.fetchTarkovBase();
      const mappedItems = window.TarkovDataMapper.mapTarkovData(data);
      state.items = normalizeLoadedItems(mappedItems);
      cacheBase(state.items);
      saveProgress();
      render();
      elements.dataSource.textContent = `Base atualizada via tarkov.dev (${state.items.length} itens). Progresso preservado.`;
    } catch (error) {
      console.error(error);
      elements.dataSource.textContent = "API indisponível. Usando a base local/cache salva.";
      window.alert("Não foi possível atualizar a base agora. O app continuará usando a base local ou salva.");
    } finally {
      setLoading(false);
    }
  }

  function setLoading(isLoading) {
    state.loading = isLoading;
    elements.refreshBaseBtn.disabled = isLoading;
    elements.refreshBaseBtn.textContent = isLoading ? "Atualizando..." : "Atualizar base Tarkov";
  }

  function resetProgress() {
    const confirmed = window.confirm("Resetar todo o progresso salvo localmente?");
    if (!confirmed) return;

    state.progress = {};
    saveProgress();
    render();
  }

  function setCollected(itemId, amount) {
    const item = state.items.find((entry) => entry.id === itemId);
    if (!item) return;

    const collected = clamp(Number(amount) || 0, 0, item.totalRequired);
    state.progress[itemId] = collected;
    saveProgress();
    render();
  }

  function getCollected(item) {
    return clamp(Number(state.progress[item.id]) || 0, 0, item.totalRequired);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function render() {
    const visibleItems = state.items.filter(matchesCurrentView);
    const sharedItems = visibleItems.filter((item) => {
      const usages = getContextUsages(item);
      return hasUsageType(usages, "quest") && hasUsageType(usages, "hideout");
    });
    const questItems = visibleItems.filter((item) => {
      const usages = getContextUsages(item);
      return hasUsageType(usages, "quest") && !hasUsageType(usages, "hideout");
    });
    const hideoutItems = visibleItems.filter((item) => {
      const usages = getContextUsages(item);
      return hasUsageType(usages, "hideout") && !hasUsageType(usages, "quest");
    });

    renderSummary(visibleItems);
    renderSection(elements.sharedGrid, elements.sharedSection, sharedItems);
    renderSection(elements.questGrid, elements.questSection, questItems);
    renderSection(elements.hideoutGrid, elements.hideoutSection, hideoutItems);

    elements.visibleCount.textContent = `${visibleItems.length} ${visibleItems.length === 1 ? "item exibido" : "itens exibidos"}`;
    elements.emptyState.hidden = visibleItems.length > 0;
  }

  function renderSummary(summaryItems) {
    const totalRequired = sumContextUsages(summaryItems);
    const totalCollected = summaryItems.reduce((sum, item) => {
      return sum + Math.min(getCollected(item), sumItemUsages(getContextUsages(item)));
    }, 0);
    const totalRemaining = totalRequired - totalCollected;
    const percent = totalRequired === 0 ? 0 : Math.round((totalCollected / totalRequired) * 100);
    const questRequired = sumContextUsages(summaryItems, (use) => use.type === "quest");
    const hideoutRequired = sumContextUsages(summaryItems, (use) => use.type === "hideout");
    const kappaRequired = sumContextUsages(summaryItems, (use) => use.requiredForKappa);
    const firRemaining = summaryItems.reduce((sum, item) => {
      const firRequired = getContextUsages(item)
        .filter((use) => use.foundInRaid)
        .reduce((usageSum, usage) => usageSum + Number(usage.quantity || 0), 0);
      return sum + Math.max(firRequired - getCollected(item), 0);
    }, 0);

    elements.totalRequired.textContent = totalRequired;
    elements.totalCollected.textContent = totalCollected;
    elements.totalRemaining.textContent = totalRemaining;
    elements.totalPercent.textContent = `${percent}%`;
    elements.questRequired.textContent = questRequired;
    elements.hideoutRequired.textContent = hideoutRequired;
    elements.kappaRequired.textContent = kappaRequired;
    elements.firRemaining.textContent = firRemaining;
    elements.progressLabel.textContent = `${totalCollected} de ${totalRequired}`;
    elements.progressFill.style.width = `${percent}%`;
  }

  function sumUsages(items, predicate) {
    return items.reduce((sum, item) => {
      if (!predicate) return sum + item.totalRequired;
      return sum + item.usages
        .filter(predicate)
        .reduce((usageSum, usage) => usageSum + Number(usage.quantity || 0), 0);
    }, 0);
  }

  function sumContextUsages(items, predicate) {
    return items.reduce((sum, item) => {
      const usages = getContextUsages(item);
      const relevantUsages = predicate ? usages.filter(predicate) : usages;
      return sum + sumItemUsages(relevantUsages);
    }, 0);
  }

  function sumItemUsages(usages) {
    return usages.reduce((sum, usage) => sum + Number(usage.quantity || 0), 0);
  }

  function matchesCurrentView(item) {
    const collected = getCollected(item);
    const contextRequired = sumItemUsages(getContextUsages(item));
    const isComplete = contextRequired > 0 && Math.min(collected, contextRequired) >= contextRequired;
    const searchTarget = [
      item.name,
      item.shortName,
      item.usages.map((use) => [
        use.questName,
        use.trader,
        use.stationName,
        use.level,
        use.type
      ].join(" ")).join(" ")
    ].join(" ").toLowerCase();
    const matchesSearch = !state.search || searchTarget.includes(state.search);

    if (!matchesSearch) return false;
    if (hasActiveUsageFilters() && contextRequired === 0) return false;
    return Array.from(state.filters).every((filter) => matchesItemStateFilter(filter, isComplete));
  }

  function handleFilterClick(filter, isMultiSelect) {
    if (!isMultiSelect || filter === "all") {
      state.filters = new Set([filter]);
      updateFilterButtons();
      render();
      return;
    }

    state.filters.delete("all");

    if (state.filters.has(filter)) {
      state.filters.delete(filter);
    } else {
      state.filters.add(filter);
    }

    if (state.filters.size === 0) {
      state.filters.add("all");
    }

    updateFilterButtons();
    render();
  }

  function updateFilterButtons() {
    elements.filterButtons.forEach((button) => {
      button.classList.toggle("active", state.filters.has(button.dataset.filter));
    });
  }

  function matchesItemStateFilter(filter, isComplete) {
    if (filter === "all") return true;
    if (filter === "pending") return !isComplete;
    if (filter === "complete") return isComplete;
    return true;
  }

  function hasActiveUsageFilters() {
    return Array.from(state.filters).some((filter) => {
      return ["quest", "hideout", "kappa", "non-kappa", "fir", "non-fir"].includes(filter);
    });
  }

  function getContextUsages(item) {
    const usages = Array.isArray(item.usages) ? item.usages : [];
    const selectedFilters = Array.from(state.filters);
    const typeFilters = selectedFilters.filter((filter) => filter === "quest" || filter === "hideout");
    const kappaFilters = selectedFilters.filter((filter) => filter === "kappa" || filter === "non-kappa");
    const firFilters = selectedFilters.filter((filter) => filter === "fir" || filter === "non-fir");

    if (state.filters.has("all") || (typeFilters.length === 0 && kappaFilters.length === 0 && firFilters.length === 0)) {
      return usages;
    }

    return usages.filter((usage) => {
      const matchesType = typeFilters.length === 0 || typeFilters.includes(usage.type);
      const matchesKappa = kappaFilters.length === 0 || kappaFilters.some((filter) => {
        if (filter === "kappa") return Boolean(usage.requiredForKappa);
        return usage.type === "quest" && !usage.requiredForKappa;
      });
      const matchesFir = firFilters.length === 0 || firFilters.some((filter) => {
        if (filter === "fir") return Boolean(usage.foundInRaid);
        return !usage.foundInRaid;
      });

      return matchesType && matchesKappa && matchesFir;
    });
  }

  function hasUsageType(usages, type) {
    return usages.some((usage) => usage.type === type);
  }

  function renderSection(grid, section, sectionItems) {
    grid.innerHTML = "";
    section.hidden = sectionItems.length === 0;
    sectionItems.forEach((item) => grid.appendChild(createCard(item)));
  }

  function createCard(item) {
    const collected = getCollected(item);
    const contextUsages = getContextUsages(item);
    const contextRequired = sumItemUsages(contextUsages);
    const contextCollected = Math.min(collected, contextRequired);
    const remaining = contextRequired - contextCollected;
    const complete = contextRequired > 0 && contextCollected >= contextRequired;
    const card = document.createElement("article");

    card.className = `item-card ${complete ? "complete" : "pending"}`;
    card.innerHTML = `
      <div class="card-top">
        <a class="item-image-link" href="${escapeAttribute(item.wikiLink || "#")}" target="_blank" rel="noreferrer">
          ${item.icon ? `<img src="${escapeAttribute(item.icon)}" alt="${escapeAttribute(item.name)}" loading="lazy">` : "<span>?</span>"}
        </a>
        <div class="card-title-block">
          <h3>${escapeHtml(item.name)}</h3>
          <p>${escapeHtml(item.shortName || item.id)}</p>
        </div>
      </div>
      <div class="badge-row">
        ${item.requiredForQuest ? '<span class="badge quest">Quest</span>' : ""}
        ${item.requiredForHideout ? '<span class="badge hideout">Hideout</span>' : ""}
        ${item.requiredForKappa ? '<span class="badge kappa">Kappa</span>' : ""}
        ${hasNonKappaQuestUsage(item) ? '<span class="badge non-kappa">Não Kappa</span>' : ""}
        ${item.foundInRaidRequired ? '<span class="badge fir">Find in Raid</span>' : '<span class="badge">Não FIR</span>'}
        <span class="badge ${complete ? "done" : ""}">${complete ? "Completo" : "Pendente"}</span>
      </div>
      <div class="card-counter">
        <button class="counter-button" type="button" data-action="decrease" aria-label="Diminuir" ${collected <= 0 ? "disabled" : ""}>-</button>
        <div class="counter-value">
          <strong>${contextCollected}/${contextRequired}</strong>
          <span>${remaining} restante${remaining === 1 ? "" : "s"}</span>
        </div>
        <button class="counter-button" type="button" data-action="increase" aria-label="Aumentar" ${collected >= item.totalRequired ? "disabled" : ""}>+</button>
      </div>
      <div class="meta-row">
        <span>Total no filtro: ${contextRequired}</span>
        <span>${contextUsages.length} uso${contextUsages.length === 1 ? "" : "s"}</span>
      </div>
      <button class="usage-button" type="button" data-action="open-usages">Ver usos (${contextUsages.length})</button>
    `;

    card.addEventListener("click", (event) => {
      if (!event.shiftKey || event.target.closest("button, a")) return;
      setCollected(item.id, item.totalRequired);
    });

    card.querySelector('[data-action="decrease"]').addEventListener("click", (event) => {
      setCollected(item.id, event.shiftKey ? 0 : collected - 1);
    });

    card.querySelector('[data-action="increase"]').addEventListener("click", (event) => {
      setCollected(item.id, event.shiftKey ? item.totalRequired : collected + 1);
    });

    card.querySelector('[data-action="open-usages"]').addEventListener("click", () => {
      openUsageModal(item, contextUsages);
    });

    return card;
  }

  function openUsageModal(item, usages) {
    const contextUsages = usages && usages.length > 0 ? usages : getContextUsages(item);
    elements.usageModalTitle.textContent = item.name;
    elements.modalUsageList.innerHTML = contextUsages.map(renderUse).join("");

    if (item.icon) {
      elements.modalItemIcon.src = item.icon;
      elements.modalItemIcon.alt = item.name;
      elements.modalItemIcon.hidden = false;
    } else {
      elements.modalItemIcon.removeAttribute("src");
      elements.modalItemIcon.hidden = true;
    }

    elements.usageModal.hidden = false;
    document.body.classList.add("modal-open");
    elements.closeUsageModal.focus();
  }

  function closeUsageModal() {
    elements.usageModal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  function renderUse(use) {
    const typeLabel = use.type === "hideout" ? "Hideout" : "Quest";
    const title = use.type === "hideout"
      ? `${use.stationName || "Hideout"} nível ${use.level || "?"}`
      : `${use.questName || "Quest"} - ${use.trader || "Trader"}`;
    const link = use.wikiLink ? `<a href="${escapeAttribute(use.wikiLink)}" target="_blank" rel="noreferrer">Wiki</a>` : "";
    const alternatives = Array.isArray(use.alternativeItems) && use.alternativeItems.length > 1
      ? `<small>Aceita alternativas: ${escapeHtml(use.alternativeItems.slice(0, 6).map((item) => item.shortName || item.name).join(", "))}${use.alternativeItems.length > 6 ? "..." : ""}</small>`
      : "";

    return `
      <article class="usage-row">
        <div class="usage-media">
          ${renderUsageImage(use)}
        </div>
        <div class="usage-content">
        <div class="use-tags">
          <span class="use-tag">${typeLabel}</span>
          <span class="use-tag">x${Number(use.quantity || 0)}</span>
          <span class="use-tag">${use.foundInRaid ? "FIR" : "Não FIR"}</span>
          ${use.requiredForKappa ? '<span class="use-tag kappa">Kappa</span>' : '<span class="use-tag">Não Kappa</span>'}
        </div>
        <div class="use-title">${escapeHtml(title)} ${link}</div>
        ${alternatives}
        </div>
      </article>
    `;
  }

  function renderUsageImage(use) {
    if (use.type === "quest" && use.traderImage) {
      return `<img src="${escapeAttribute(use.traderImage)}" alt="${escapeAttribute(use.trader || "Trader")}" loading="lazy">`;
    }

    if (use.type === "hideout" && use.stationImage) {
      return `<img src="${escapeAttribute(use.stationImage)}" alt="${escapeAttribute(use.stationName || "Hideout")}" loading="lazy">`;
    }

    return `<div class="usage-placeholder">${use.type === "hideout" ? "H" : "Q"}</div>`;
  }

  function hasNonKappaQuestUsage(item) {
    return item.usages.some((use) => use.type === "quest" && !use.requiredForKappa);
  }

  function exportProgress() {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      progress: state.progress
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "tarkov-progress.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function importProgress(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        const progress = imported.progress && typeof imported.progress === "object" ? imported.progress : imported;
        const nextProgress = { ...state.progress };

        state.items.forEach((item) => {
          if (Object.prototype.hasOwnProperty.call(progress, item.id)) {
            nextProgress[item.id] = clamp(Number(progress[item.id]) || 0, 0, item.totalRequired);
          }
        });

        state.progress = nextProgress;
        saveProgress();
        render();
      } catch {
        window.alert("Arquivo JSON inválido.");
      } finally {
        elements.importFile.value = "";
      }
    };

    reader.readAsText(file);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }
})();
