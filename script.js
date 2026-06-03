(function () {
  const STORAGE_KEY = "tarkovFirTrackerProgress";
  const BASE_CACHE_KEY = "tarkovFirTrackerBase";
  const BASE_DATA_VERSION = 6;

  const state = {
    items: [],
    quests: [],
    progress: {},
    filters: new Set(["all"]),
    currentView: "items",
    questFilters: new Set(["all"]),
    search: "",
    questSearch: "",
    questTrader: "all",
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
    itemsView: document.getElementById("itemsView"),
    questsView: document.getElementById("questsView"),
    tabButtons: document.querySelectorAll(".tab-button"),
    searchInput: document.getElementById("searchInput"),
    filterButtons: document.querySelectorAll(".filter-button"),
    questSearchInput: document.getElementById("questSearchInput"),
    questFilterButtons: document.querySelectorAll(".quest-filter-button"),
    questTraderFilter: document.getElementById("questTraderFilter"),
    questVisibleCount: document.getElementById("questVisibleCount"),
    questProgressSummary: document.getElementById("questProgressSummary"),
    questCardsGrid: document.getElementById("questCardsGrid"),
    questEmptyState: document.getElementById("questEmptyState"),
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
    const fallbackQuests = normalizeLoadedQuests(window.TARKOV_QUESTS || []);

    if (cached.length > 0) {
      state.items = cached;
      state.quests = normalizeLoadedQuests(loadCachedQuests());
      elements.dataSource.textContent = `Base salva no navegador carregada (${cached.length} itens).`;
      populateTraderFilter();
      return;
    }

    state.items = fallback;
    state.quests = fallbackQuests;
    elements.dataSource.textContent = `Base local carregada (${fallback.length} itens).`;
    populateTraderFilter();
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

  function loadCachedQuests() {
    try {
      const cached = JSON.parse(localStorage.getItem(BASE_CACHE_KEY));
      if (!cached || cached.version !== BASE_DATA_VERSION) return [];
      return Array.isArray(cached.quests) ? cached.quests : [];
    } catch {
      return [];
    }
  }

  function cacheBase(items, quests) {
    localStorage.setItem(BASE_CACHE_KEY, JSON.stringify({
      version: BASE_DATA_VERSION,
      savedAt: new Date().toISOString(),
      items,
      quests
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

  function normalizeLoadedQuests(quests) {
    return quests.map((quest) => ({
      ...quest,
      requiredItems: Array.isArray(quest.requiredItems) ? quest.requiredItems : []
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  function bindEvents() {
    elements.tabButtons.forEach((button) => {
      button.addEventListener("click", () => setView(button.dataset.view));
    });

    elements.searchInput.addEventListener("input", (event) => {
      state.search = event.target.value.trim().toLowerCase();
      render();
    });

    elements.questSearchInput.addEventListener("input", (event) => {
      state.questSearch = event.target.value.trim().toLowerCase();
      render();
    });

    elements.filterButtons.forEach((button) => {
      button.addEventListener("click", (event) => handleFilterClick(button.dataset.filter, event.ctrlKey || event.metaKey));
    });

    elements.questFilterButtons.forEach((button) => {
      button.addEventListener("click", (event) => handleQuestFilterClick(button.dataset.questFilter, event.ctrlKey || event.metaKey));
    });

    elements.questTraderFilter.addEventListener("change", (event) => {
      state.questTrader = event.target.value;
      render();
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
      state.progress = normalizeProgress(saved);
    } catch {
      state.progress = normalizeProgress(null);
    }
  }

  function normalizeProgress(saved) {
    if (!saved || typeof saved !== "object") {
      return {
        manualProgress: {},
        questProgress: {}
      };
    }

    if (saved.manualProgress || saved.questProgress) {
      return {
        manualProgress: saved.manualProgress && typeof saved.manualProgress === "object" ? saved.manualProgress : {},
        questProgress: saved.questProgress && typeof saved.questProgress === "object" ? saved.questProgress : {}
      };
    }

    return {
      manualProgress: { ...saved },
      questProgress: {}
    };
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
      const mappedQuests = window.TarkovDataMapper.mapQuestData(data);
      state.items = normalizeLoadedItems(mappedItems);
      state.quests = normalizeLoadedQuests(mappedQuests);
      cacheBase(state.items, state.quests);
      saveProgress();
      populateTraderFilter();
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

  function setView(view) {
    state.currentView = view;
    elements.itemsView.hidden = view !== "items";
    elements.questsView.hidden = view !== "quests";
    elements.tabButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.view === view);
    });
    render();
  }

  function resetProgress() {
    const confirmed = window.confirm("Resetar todo o progresso salvo localmente?");
    if (!confirmed) return;

    state.progress = normalizeProgress(null);
    saveProgress();
    render();
  }

  function setCollected(itemId, amount) {
    const item = state.items.find((entry) => entry.id === itemId);
    if (!item) return;

    const questCollected = getQuestContribution(itemId);
    const collected = clamp(Number(amount) || 0, questCollected, item.totalRequired);
    state.progress.manualProgress[itemId] = Math.max(collected - questCollected, 0);
    saveProgress();
    render();
  }

  function getCollected(item) {
    const manual = Number(state.progress.manualProgress[item.id]) || 0;
    const quest = getQuestContribution(item.id);
    return clamp(manual + quest, 0, item.totalRequired);
  }

  function getQuestContribution(itemId) {
    return Object.values(state.progress.questProgress).reduce((sum, questState) => {
      if (!questState || !questState.completed || !questState.appliedItems) return sum;
      return sum + (Number(questState.appliedItems[itemId]) || 0);
    }, 0);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function render() {
    if (state.currentView === "quests") {
      renderQuestsView();
      return;
    }

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

  function renderQuestsView() {
    const visibleQuests = state.quests.filter(matchesQuestView);
    elements.questCardsGrid.innerHTML = "";
    visibleQuests.forEach((quest) => {
      elements.questCardsGrid.appendChild(createQuestCard(quest));
    });

    const completedCount = state.quests.filter((quest) => isQuestCompleted(quest.id)).length;
    elements.questVisibleCount.textContent = `${visibleQuests.length} ${visibleQuests.length === 1 ? "quest exibida" : "quests exibidas"}`;
    elements.questProgressSummary.textContent = `${completedCount} de ${state.quests.length} completas`;
    elements.questEmptyState.hidden = visibleQuests.length > 0;
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

  function handleQuestFilterClick(filter, isMultiSelect) {
    if (!isMultiSelect || filter === "all") {
      state.questFilters = new Set([filter]);
      updateQuestFilterButtons();
      render();
      return;
    }

    state.questFilters.delete("all");

    if (state.questFilters.has(filter)) {
      state.questFilters.delete(filter);
    } else {
      state.questFilters.add(filter);
    }

    if (state.questFilters.size === 0) {
      state.questFilters.add("all");
    }

    updateQuestFilterButtons();
    render();
  }

  function updateFilterButtons() {
    elements.filterButtons.forEach((button) => {
      button.classList.toggle("active", state.filters.has(button.dataset.filter));
    });
  }

  function updateQuestFilterButtons() {
    elements.questFilterButtons.forEach((button) => {
      button.classList.toggle("active", state.questFilters.has(button.dataset.questFilter));
    });
  }

  function populateTraderFilter() {
    const selected = state.questTrader;
    const traders = Array.from(new Set(state.quests.map((quest) => quest.trader).filter(Boolean))).sort();
    elements.questTraderFilter.innerHTML = '<option value="all">Todos os traders</option>';

    traders.forEach((trader) => {
      const option = document.createElement("option");
      option.value = trader;
      option.textContent = trader;
      elements.questTraderFilter.appendChild(option);
    });

    elements.questTraderFilter.value = traders.includes(selected) ? selected : "all";
    state.questTrader = elements.questTraderFilter.value;
  }

  function matchesQuestView(quest) {
    const completed = isQuestCompleted(quest.id);
    const searchTarget = [
      quest.name,
      quest.trader,
      quest.requiredItems.map((item) => `${item.name} ${item.shortName}`).join(" ")
    ].join(" ").toLowerCase();
    const matchesSearch = !state.questSearch || searchTarget.includes(state.questSearch);
    const matchesTrader = state.questTrader === "all" || quest.trader === state.questTrader;

    if (!matchesSearch || !matchesTrader) return false;

    return Array.from(state.questFilters).every((filter) => {
      if (filter === "all") return true;
      if (filter === "pending") return !completed;
      if (filter === "complete") return completed;
      if (filter === "kappa") return quest.requiredForKappa;
      if (filter === "non-kappa") return !quest.requiredForKappa;
      return true;
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
    const questCollected = getQuestContribution(item.id);
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
        <button class="counter-button" type="button" data-action="decrease" aria-label="Diminuir" ${collected <= questCollected ? "disabled" : ""}>-</button>
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
      setCollected(item.id, event.shiftKey ? questCollected : collected - 1);
    });

    card.querySelector('[data-action="increase"]').addEventListener("click", (event) => {
      setCollected(item.id, event.shiftKey ? item.totalRequired : collected + 1);
    });

    card.querySelector('[data-action="open-usages"]').addEventListener("click", () => {
      openUsageModal(item, contextUsages);
    });

    return card;
  }

  function createQuestCard(quest) {
    const completed = isQuestCompleted(quest.id);
    const card = document.createElement("article");

    card.className = `quest-card ${completed ? "complete" : "pending"}`;
    card.innerHTML = `
      <div class="quest-card-header">
        <div class="quest-trader-image">
          ${quest.traderImage ? `<img src="${escapeAttribute(quest.traderImage)}" alt="${escapeAttribute(quest.trader || "Trader")}" loading="lazy">` : "<span>?</span>"}
        </div>
        <div class="quest-title-block">
          <h3>${escapeHtml(quest.name)}</h3>
          <p>${escapeHtml(quest.trader || "Trader não informado")}</p>
        </div>
      </div>
      <div class="badge-row">
        <span class="badge quest">${completed ? "Completa" : "Pendente"}</span>
        ${quest.requiredForKappa ? '<span class="badge kappa">Kappa</span>' : '<span class="badge non-kappa">Não Kappa</span>'}
        ${quest.minPlayerLevel ? `<span class="badge">Nível ${quest.minPlayerLevel}</span>` : ""}
        <span class="badge">${quest.itemCount} item${quest.itemCount === 1 ? "" : "s"}</span>
      </div>
      <div class="quest-actions">
        <button class="${completed ? "ghost-button" : "primary-button"}" type="button" data-action="toggle-quest">
          ${completed ? "Desmarcar como completa" : "Marcar como completa"}
        </button>
        ${quest.wikiLink ? `<a class="quest-link" href="${escapeAttribute(quest.wikiLink)}" target="_blank" rel="noreferrer">Wiki</a>` : ""}
      </div>
      <details class="quest-items-details">
        <summary>Itens exigidos (${quest.requiredItems.length})</summary>
        <div class="quest-required-items">
          ${quest.requiredItems.length > 0 ? quest.requiredItems.map(renderQuestRequiredItem).join("") : '<p class="muted-text">Esta quest não tem entrega de item rastreável.</p>'}
        </div>
      </details>
    `;

    card.querySelector('[data-action="toggle-quest"]').addEventListener("click", () => {
      toggleQuestCompletion(quest);
    });

    return card;
  }

  function renderQuestRequiredItem(item) {
    return `
      <div class="quest-required-item">
        <div class="quest-required-image">
          ${item.icon ? `<img src="${escapeAttribute(item.icon)}" alt="${escapeAttribute(item.name)}" loading="lazy">` : "<span>?</span>"}
        </div>
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <div class="use-tags">
            <span class="use-tag">x${Number(item.quantity || 0)}</span>
            <span class="use-tag">${item.foundInRaid ? "FIR" : "Não FIR"}</span>
          </div>
        </div>
      </div>
    `;
  }

  function isQuestCompleted(questId) {
    return Boolean(state.progress.questProgress[questId] && state.progress.questProgress[questId].completed);
  }

  function toggleQuestCompletion(quest) {
    if (isQuestCompleted(quest.id)) {
      delete state.progress.questProgress[quest.id];
    } else {
      state.progress.questProgress[quest.id] = {
        completed: true,
        appliedItems: getQuestAppliedItems(quest)
      };
    }

    saveProgress();
    render();
  }

  function getQuestAppliedItems(quest) {
    const appliedItems = {};

    quest.requiredItems.forEach((requiredItem) => {
      const item = state.items.find((entry) => entry.id === requiredItem.itemId);
      if (!item) return;

      const alreadyFromQuests = getQuestContribution(requiredItem.itemId);
      const available = Math.max(item.totalRequired - alreadyFromQuests, 0);
      const quantity = Math.min(Number(requiredItem.quantity) || 0, available);

      if (quantity > 0) {
        appliedItems[requiredItem.itemId] = (appliedItems[requiredItem.itemId] || 0) + quantity;
      }
    });

    return appliedItems;
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
      version: 3,
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
        const progress = normalizeProgress(imported.progress && typeof imported.progress === "object" ? imported.progress : imported);
        const nextProgress = normalizeProgress(state.progress);

        state.items.forEach((item) => {
          if (Object.prototype.hasOwnProperty.call(progress.manualProgress, item.id)) {
            nextProgress.manualProgress[item.id] = clamp(Number(progress.manualProgress[item.id]) || 0, 0, item.totalRequired);
          }
        });

        Object.entries(progress.questProgress).forEach(([questId, questState]) => {
          if (questState && questState.completed && questState.appliedItems) {
            nextProgress.questProgress[questId] = questState;
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
