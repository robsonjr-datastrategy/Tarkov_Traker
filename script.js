(function () {
  const STORAGE_KEY = "tarkovFirTrackerProgress";
  const BASE_CACHE_KEY = "tarkovFirTrackerBase";
  const BASE_DATA_VERSION = 7;

  const state = {
    items: [],
    quests: [],
    hideoutUpgrades: [],
    progress: {},
    filters: new Set(["all"]),
    currentView: "items",
    questFilters: new Set(["all"]),
    hideoutFilters: new Set(["all"]),
    search: "",
    questSearch: "",
    questTrader: "all",
    hideoutSearch: "",
    hideoutStation: "all",
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
    hideoutView: document.getElementById("hideoutView"),
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
    hideoutSearchInput: document.getElementById("hideoutSearchInput"),
    hideoutFilterButtons: document.querySelectorAll(".hideout-filter-button"),
    hideoutStationFilter: document.getElementById("hideoutStationFilter"),
    hideoutVisibleCount: document.getElementById("hideoutVisibleCount"),
    hideoutProgressSummary: document.getElementById("hideoutProgressSummary"),
    hideoutCardsGrid: document.getElementById("hideoutCardsGrid"),
    hideoutEmptyState: document.getElementById("hideoutEmptyState"),
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
    const fallbackHideoutUpgrades = normalizeLoadedHideoutUpgrades(window.TARKOV_HIDEOUT_UPGRADES || []);

    if (cached.length > 0) {
      state.items = cached;
      state.quests = normalizeLoadedQuests(loadCachedQuests());
      state.hideoutUpgrades = normalizeLoadedHideoutUpgrades(loadCachedHideoutUpgrades());
      elements.dataSource.textContent = `Base salva no navegador carregada (${cached.length} itens).`;
      populateTraderFilter();
      populateHideoutStationFilter();
      return;
    }

    state.items = fallback;
    state.quests = fallbackQuests;
    state.hideoutUpgrades = fallbackHideoutUpgrades;
    elements.dataSource.textContent = `Base local carregada (${fallback.length} itens).`;
    populateTraderFilter();
    populateHideoutStationFilter();
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

  function loadCachedHideoutUpgrades() {
    try {
      const cached = JSON.parse(localStorage.getItem(BASE_CACHE_KEY));
      if (!cached || cached.version !== BASE_DATA_VERSION) return [];
      return Array.isArray(cached.hideoutUpgrades) ? cached.hideoutUpgrades : [];
    } catch {
      return [];
    }
  }

  function cacheBase(items, quests, hideoutUpgrades) {
    localStorage.setItem(BASE_CACHE_KEY, JSON.stringify({
      version: BASE_DATA_VERSION,
      savedAt: new Date().toISOString(),
      items,
      quests,
      hideoutUpgrades
    }));
  }

  function normalizeLoadedItems(items) {
    return items.map((item) => {
      const usages = condenseLoadedUsages(Array.isArray(item.usages) ? item.usages : []);
      const sanitizedUsages = usages.map(sanitizeUsageText);
      const totalRequired = usages.reduce((sum, usage) => sum + Number(usage.quantity || 0), 0);

      return {
        ...item,
        name: sanitizeDisplayText(item.name),
        shortName: sanitizeDisplayText(item.shortName),
        totalRequired,
        collected: 0,
        remaining: totalRequired,
        requiredForQuest: sanitizedUsages.some((usage) => usage.type === "quest"),
        requiredForHideout: sanitizedUsages.some((usage) => usage.type === "hideout"),
        requiredForKappa: sanitizedUsages.some((usage) => usage.requiredForKappa),
        foundInRaidRequired: sanitizedUsages.some((usage) => usage.foundInRaid),
        usages: sanitizedUsages
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }

  function normalizeLoadedQuests(quests) {
    return quests.map((quest) => ({
      ...quest,
      name: sanitizeDisplayText(quest.name),
      trader: sanitizeDisplayText(quest.trader),
      requiredItems: condenseLoadedRequiredItems(Array.isArray(quest.requiredItems) ? quest.requiredItems : []).map(sanitizeRequiredItemText)
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  function normalizeLoadedHideoutUpgrades(upgrades) {
    return upgrades.map((upgrade) => ({
      ...upgrade,
      stationName: sanitizeDisplayText(upgrade.stationName),
      requiredItems: (Array.isArray(upgrade.requiredItems) ? upgrade.requiredItems : []).map(sanitizeRequiredItemText)
    })).sort((a, b) => {
      const stationOrder = a.stationName.localeCompare(b.stationName);
      return stationOrder === 0 ? a.level - b.level : stationOrder;
    });
  }

  function sanitizeUsageText(usage) {
    return {
      ...usage,
      questName: sanitizeDisplayText(usage.questName),
      trader: sanitizeDisplayText(usage.trader),
      stationName: sanitizeDisplayText(usage.stationName),
      objectiveDescription: sanitizeDisplayText(usage.objectiveDescription),
      description: sanitizeDisplayText(usage.description)
    };
  }

  function sanitizeRequiredItemText(item) {
    return {
      ...item,
      name: sanitizeDisplayText(item.name),
      shortName: sanitizeDisplayText(item.shortName),
      description: sanitizeDisplayText(item.description)
    };
  }

  function condenseLoadedUsages(usages) {
    const questUsages = condenseLoadedQuestUsages(usages.filter((usage) => usage.type === "quest"));
    const hideoutUsages = condenseLoadedHideoutUsages(usages.filter((usage) => usage.type === "hideout"));
    return questUsages.concat(hideoutUsages);
  }

  function condenseLoadedQuestUsages(usages) {
    const byQuestId = new Map();

    usages.forEach((usage) => {
      const key = usage.questId || `${usage.questName}|${usage.trader}`;
      byQuestId.set(key, [...(byQuestId.get(key) || []), usage]);
    });

    const withoutFindHandPairs = [];

    byQuestId.forEach((questUsages) => {
      const groupedByItemState = new Map();

      questUsages.forEach((usage) => {
        const key = [
          usage.itemId || "",
          usage.questId || "",
          usage.questName || "",
          usage.trader || "",
          Boolean(usage.foundInRaid),
          Boolean(usage.requiredForKappa)
        ].join("|");
        groupedByItemState.set(key, [...(groupedByItemState.get(key) || []), usage]);
      });

      groupedByItemState.forEach((sameItemUsages) => {
        if (hasLoadedFindAndHandOverPair(sameItemUsages)) {
          withoutFindHandPairs.push(preferLoadedHandOverUsage(sameItemUsages));
          return;
        }

        withoutFindHandPairs.push(...sameItemUsages);
      });
    });

    return condenseLoadedDuplicateQuestVariants(withoutFindHandPairs);
  }

  function hasLoadedFindAndHandOverPair(usages) {
    return usages.length > 1
      && usages.some((usage) => isLoadedFindObjective(usage.objectiveDescription || usage.description))
      && usages.some((usage) => isLoadedHandOverObjective(usage.objectiveDescription || usage.description));
  }

  function preferLoadedHandOverUsage(usages) {
    const preferred = usages.find((usage) => isLoadedHandOverObjective(usage.objectiveDescription || usage.description)) || usages[0];
    const quantity = Math.max(...usages.map((usage) => Number(usage.quantity || 0)));
    return {
      ...preferred,
      quantity
    };
  }

  function condenseLoadedDuplicateQuestVariants(usages) {
    const grouped = new Map();

    usages.forEach((usage) => {
      const key = [
        usage.itemId || "",
        usage.questName || "",
        usage.trader || "",
        normalizeLoadedObjectiveDescription(usage.objectiveDescription || usage.description),
        Boolean(usage.foundInRaid),
        Boolean(usage.requiredForKappa)
      ].join("|");
      const existing = grouped.get(key);

      if (!existing || Number(usage.quantity || 0) > Number(existing.quantity || 0)) {
        grouped.set(key, usage);
      }
    });

    return Array.from(grouped.values());
  }

  function condenseLoadedHideoutUsages(usages) {
    const grouped = new Map();

    usages.forEach((usage) => {
      const key = [
        usage.stationId || usage.stationName || "",
        Number(usage.level) || 0
      ].join("|");
      const existing = grouped.get(key);

      if (existing) {
        existing.quantity = Math.max(Number(existing.quantity || 0), Number(usage.quantity || 0));
        return;
      }

      grouped.set(key, { ...usage });
    });

    return Array.from(grouped.values());
  }

  function condenseLoadedRequiredItems(items) {
    const asUsages = items.map((item) => ({
      ...item,
      type: "quest",
      itemId: item.itemId,
      objectiveDescription: item.description
    }));

    return condenseLoadedQuestUsages(asUsages).map((usage) => ({
      objectiveId: usage.objectiveId,
      description: usage.description || usage.objectiveDescription || "",
      itemId: usage.itemId,
      name: usage.name,
      shortName: usage.shortName,
      icon: usage.icon,
      wikiLink: usage.wikiLink,
      quantity: usage.quantity,
      foundInRaid: usage.foundInRaid,
      alternativeItems: usage.alternativeItems
    }));
  }

  function isLoadedFindObjective(description) {
    const text = normalizeLoadedObjectiveDescription(description);
    return text.startsWith("find ") || text.startsWith("locate ") || text.startsWith("obtain ");
  }

  function isLoadedHandOverObjective(description) {
    return normalizeLoadedObjectiveDescription(description).startsWith("hand over ");
  }

  function normalizeLoadedObjectiveDescription(description) {
    return String(description || "").trim().toLowerCase().replace(/\s+/g, " ");
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

    elements.hideoutSearchInput.addEventListener("input", (event) => {
      state.hideoutSearch = event.target.value.trim().toLowerCase();
      render();
    });

    elements.filterButtons.forEach((button) => {
      button.addEventListener("click", (event) => handleFilterClick(button.dataset.filter, event.ctrlKey || event.metaKey));
    });

    elements.questFilterButtons.forEach((button) => {
      button.addEventListener("click", (event) => handleQuestFilterClick(button.dataset.questFilter, event.ctrlKey || event.metaKey));
    });

    elements.hideoutFilterButtons.forEach((button) => {
      button.addEventListener("click", (event) => handleHideoutFilterClick(button.dataset.hideoutFilter, event.ctrlKey || event.metaKey));
    });

    elements.questTraderFilter.addEventListener("change", (event) => {
      state.questTrader = event.target.value;
      render();
    });

    elements.hideoutStationFilter.addEventListener("change", (event) => {
      state.hideoutStation = event.target.value;
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
        questProgress: {},
        hideoutProgress: {}
      };
    }

    if (saved.manualProgress || saved.questProgress || saved.hideoutProgress) {
      return {
        manualProgress: saved.manualProgress && typeof saved.manualProgress === "object" ? saved.manualProgress : {},
        questProgress: saved.questProgress && typeof saved.questProgress === "object" ? saved.questProgress : {},
        hideoutProgress: saved.hideoutProgress && typeof saved.hideoutProgress === "object" ? saved.hideoutProgress : {}
      };
    }

    return {
      manualProgress: { ...saved },
      questProgress: {},
      hideoutProgress: {}
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
      const mappedHideoutUpgrades = window.TarkovDataMapper.mapHideoutData(data);
      state.items = normalizeLoadedItems(mappedItems);
      state.quests = normalizeLoadedQuests(mappedQuests);
      state.hideoutUpgrades = normalizeLoadedHideoutUpgrades(mappedHideoutUpgrades);
      cacheBase(state.items, state.quests, state.hideoutUpgrades);
      saveProgress();
      populateTraderFilter();
      populateHideoutStationFilter();
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
    elements.hideoutView.hidden = view !== "hideout";
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

    const automaticCollected = getAutomaticContribution(itemId);
    const collected = clamp(Number(amount) || 0, automaticCollected, item.totalRequired);
    state.progress.manualProgress[itemId] = Math.max(collected - automaticCollected, 0);
    saveProgress();
    render();
  }

  function getCollected(item) {
    const manual = Number(state.progress.manualProgress[item.id]) || 0;
    const automatic = getAutomaticContribution(item.id);
    return clamp(manual + automatic, 0, item.totalRequired);
  }

  function getManualContribution(itemId) {
    return Number(state.progress.manualProgress[itemId]) || 0;
  }

  function getContextCollected(item, usages) {
    const contextUsages = Array.isArray(usages) ? usages : getContextUsages(item);
    const contextRequired = sumItemUsages(contextUsages);
    const manual = getManualContribution(item.id);
    const automatic = getContextAutomaticContribution(item.id, contextUsages);
    return clamp(manual + automatic, 0, contextRequired);
  }

  function getContextAutomaticContribution(itemId, usages) {
    return (Array.isArray(usages) ? usages : []).reduce((sum, usage) => {
      if (!isUsageCompleted(usage)) return sum;
      const applied = getAppliedQuantityForUsage(itemId, usage);
      const required = Number(usage.quantity || 0);
      return sum + Math.min(applied, required);
    }, 0);
  }

  function getAppliedQuantityForUsage(itemId, usage) {
    if (usage.type === "quest" && usage.questId) {
      const questState = state.progress.questProgress[usage.questId];
      return Number(questState && questState.appliedItems && questState.appliedItems[itemId]) || 0;
    }

    const upgrade = findHideoutUpgradeForUsage(usage);
    if (!upgrade) return 0;
    const upgradeState = state.progress.hideoutProgress[upgrade.id];
    return Number(upgradeState && upgradeState.appliedItems && upgradeState.appliedItems[itemId]) || 0;
  }

  function getAutomaticContribution(itemId) {
    return getQuestContribution(itemId) + getHideoutContribution(itemId);
  }

  function getQuestContribution(itemId) {
    return Object.values(state.progress.questProgress || {}).reduce((sum, questState) => {
      if (!questState || !questState.completed || !questState.appliedItems) return sum;
      return sum + (Number(questState.appliedItems[itemId]) || 0);
    }, 0);
  }

  function getHideoutContribution(itemId) {
    return Object.values(state.progress.hideoutProgress || {}).reduce((sum, upgradeState) => {
      if (!upgradeState || !upgradeState.completed || !upgradeState.appliedItems) return sum;
      return sum + (Number(upgradeState.appliedItems[itemId]) || 0);
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

    if (state.currentView === "hideout") {
      renderHideoutView();
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

  function renderHideoutView() {
    const visibleUpgrades = state.hideoutUpgrades.filter(matchesHideoutView);
    elements.hideoutCardsGrid.innerHTML = "";
    visibleUpgrades.forEach((upgrade) => {
      elements.hideoutCardsGrid.appendChild(createHideoutCard(upgrade));
    });

    const completedCount = state.hideoutUpgrades.filter((upgrade) => isHideoutCompleted(upgrade.id)).length;
    elements.hideoutVisibleCount.textContent = `${visibleUpgrades.length} ${visibleUpgrades.length === 1 ? "upgrade exibido" : "upgrades exibidos"}`;
    elements.hideoutProgressSummary.textContent = `${completedCount} de ${state.hideoutUpgrades.length} completos`;
    elements.hideoutEmptyState.hidden = visibleUpgrades.length > 0;
  }

  function renderSummary(summaryItems) {
    const totalRequired = sumContextUsages(summaryItems);
    const totalCollected = summaryItems.reduce((sum, item) => {
      return sum + getContextCollected(item);
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
      return sum + Math.max(firRequired - getContextCollected(item, getContextUsages(item).filter((use) => use.foundInRaid)), 0);
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
    const contextUsages = getContextUsages(item);
    const contextRequired = sumItemUsages(contextUsages);
    const contextCollected = getContextCollected(item, contextUsages);
    const isComplete = contextRequired > 0 && contextCollected >= contextRequired;
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

  function handleHideoutFilterClick(filter, isMultiSelect) {
    if (!isMultiSelect || filter === "all") {
      state.hideoutFilters = new Set([filter]);
      updateHideoutFilterButtons();
      render();
      return;
    }

    state.hideoutFilters.delete("all");

    if (state.hideoutFilters.has(filter)) {
      state.hideoutFilters.delete(filter);
    } else {
      state.hideoutFilters.add(filter);
    }

    if (state.hideoutFilters.size === 0) {
      state.hideoutFilters.add("all");
    }

    updateHideoutFilterButtons();
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

  function updateHideoutFilterButtons() {
    elements.hideoutFilterButtons.forEach((button) => {
      button.classList.toggle("active", state.hideoutFilters.has(button.dataset.hideoutFilter));
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

  function populateHideoutStationFilter() {
    const selected = state.hideoutStation;
    const stations = Array.from(new Set(state.hideoutUpgrades.map((upgrade) => upgrade.stationName).filter(Boolean))).sort();
    elements.hideoutStationFilter.innerHTML = '<option value="all">Todas as estações</option>';

    stations.forEach((station) => {
      const option = document.createElement("option");
      option.value = station;
      option.textContent = station;
      elements.hideoutStationFilter.appendChild(option);
    });

    elements.hideoutStationFilter.value = stations.includes(selected) ? selected : "all";
    state.hideoutStation = elements.hideoutStationFilter.value;
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

  function matchesHideoutView(upgrade) {
    const completed = isHideoutCompleted(upgrade.id);
    const searchTarget = [
      upgrade.stationName,
      `level ${upgrade.level}`,
      `nível ${upgrade.level}`,
      upgrade.requiredItems.map((item) => `${item.name} ${item.shortName}`).join(" ")
    ].join(" ").toLowerCase();
    const matchesSearch = !state.hideoutSearch || searchTarget.includes(state.hideoutSearch);
    const matchesStation = state.hideoutStation === "all" || upgrade.stationName === state.hideoutStation;

    if (!matchesSearch || !matchesStation) return false;

    return Array.from(state.hideoutFilters).every((filter) => {
      if (filter === "all") return true;
      if (filter === "pending") return !completed;
      if (filter === "complete") return completed;
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
    const contextCollected = getContextCollected(item, contextUsages);
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
      <button class="usage-button" type="button" data-action="open-usages">Ver usos</button>
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

    card.querySelector('[data-action="open-usages"]').addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
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

  function createHideoutCard(upgrade) {
    const completed = isHideoutCompleted(upgrade.id);
    const card = document.createElement("article");

    card.className = `quest-card ${completed ? "complete" : "pending"}`;
    card.innerHTML = `
      <div class="quest-card-header">
        <div class="quest-trader-image">
          ${upgrade.stationImage ? `<img src="${escapeAttribute(upgrade.stationImage)}" alt="${escapeAttribute(upgrade.stationName || "Hideout")}" loading="lazy">` : "<span>H</span>"}
        </div>
        <div class="quest-title-block">
          <h3>${escapeHtml(upgrade.stationName || "Hideout")}</h3>
          <p>Nível ${Number(upgrade.level) || 0}</p>
        </div>
      </div>
      <div class="badge-row">
        <span class="badge hideout">${completed ? "Completo" : "Pendente"}</span>
        <span class="badge">Upgrade nível ${Number(upgrade.level) || 0}</span>
        <span class="badge">${upgrade.itemCount} item${upgrade.itemCount === 1 ? "" : "s"}</span>
      </div>
      <div class="quest-actions">
        <button class="${completed ? "ghost-button" : "primary-button"}" type="button" data-action="toggle-hideout">
          ${completed ? "Desmarcar como completo" : "Marcar como completo"}
        </button>
      </div>
      <details class="quest-items-details">
        <summary>Itens exigidos (${upgrade.requiredItems.length})</summary>
        <div class="quest-required-items">
          ${upgrade.requiredItems.length > 0 ? upgrade.requiredItems.map(renderUpgradeRequiredItem).join("") : '<p class="muted-text">Este upgrade não tem item rastreável.</p>'}
        </div>
      </details>
    `;

    card.querySelector('[data-action="toggle-hideout"]').addEventListener("click", () => {
      toggleHideoutCompletion(upgrade);
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

  function renderUpgradeRequiredItem(item) {
    return `
      <div class="quest-required-item">
        <div class="quest-required-image">
          ${item.icon ? `<img src="${escapeAttribute(item.icon)}" alt="${escapeAttribute(item.name)}" loading="lazy">` : "<span>?</span>"}
        </div>
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <div class="use-tags">
            <span class="use-tag">x${Number(item.quantity || 0)}</span>
            <span class="use-tag">Não FIR</span>
          </div>
        </div>
      </div>
    `;
  }

  function isQuestCompleted(questId) {
    return Boolean(state.progress.questProgress[questId] && state.progress.questProgress[questId].completed);
  }

  function isHideoutCompleted(upgradeId) {
    return Boolean(state.progress.hideoutProgress[upgradeId] && state.progress.hideoutProgress[upgradeId].completed);
  }

  function toggleQuestCompletion(quest, options = {}) {
    if (isQuestCompleted(quest.id)) {
      delete state.progress.questProgress[quest.id];
    } else {
      state.progress.questProgress[quest.id] = {
        completed: true,
        appliedItems: getQuestAppliedItems(quest)
      };
    }

    saveProgress();
    if (options.render === false) return;
    render();
  }

  function toggleHideoutCompletion(upgrade) {
    if (isHideoutCompleted(upgrade.id)) {
      delete state.progress.hideoutProgress[upgrade.id];
    } else {
      state.progress.hideoutProgress[upgrade.id] = {
        completed: true,
        appliedItems: getHideoutAppliedItems(upgrade)
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

      const alreadyAutomatic = getAutomaticContribution(requiredItem.itemId);
      const available = Math.max(item.totalRequired - alreadyAutomatic, 0);
      const quantity = Math.min(Number(requiredItem.quantity) || 0, available);

      if (quantity > 0) {
        appliedItems[requiredItem.itemId] = (appliedItems[requiredItem.itemId] || 0) + quantity;
      }
    });

    return appliedItems;
  }

  function getHideoutAppliedItems(upgrade) {
    const appliedItems = {};

    upgrade.requiredItems.forEach((requiredItem) => {
      const item = state.items.find((entry) => entry.id === requiredItem.itemId);
      if (!item) return;

      const alreadyAutomatic = getAutomaticContribution(requiredItem.itemId);
      const available = Math.max(item.totalRequired - alreadyAutomatic, 0);
      const quantity = Math.min(Number(requiredItem.quantity) || 0, available);

      if (quantity > 0) {
        appliedItems[requiredItem.itemId] = (appliedItems[requiredItem.itemId] || 0) + quantity;
      }
    });

    return appliedItems;
  }

  function openUsageModal(item, usages) {
    const rawUsages = Array.isArray(usages) && usages.length > 0 ? usages : getContextUsages(item);
    const contextUsages = safelyGroupDuplicateUsages(rawUsages);
    elements.usageModalTitle.textContent = item.name;
    elements.modalUsageList.innerHTML = contextUsages.length > 0
      ? contextUsages.map(renderUse).join("")
      : '<p class="muted-text">Nenhum uso encontrado para os filtros atuais.</p>';

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

  function safelyGroupDuplicateUsages(usages) {
    try {
      return groupDuplicateUsages(usages);
    } catch (error) {
      console.error("Erro ao agrupar usos do item:", error);
      return (Array.isArray(usages) ? usages : []).filter(Boolean);
    }
  }

  function closeUsageModal() {
    elements.usageModal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  function groupDuplicateUsages(usages) {
    const grouped = new Map();

    (Array.isArray(usages) ? usages : []).filter(Boolean).forEach((usage) => {
      const key = getDuplicateUsageKey(usage);
      const existing = grouped.get(key);

      if (existing) {
        existing.quantity = Number(existing.quantity || 0) + Number(usage.quantity || 0);
        existing.alternativeItems = mergeUsageAlternatives(existing.alternativeItems, usage.alternativeItems);
        return;
      }

      grouped.set(key, normalizeUsageForModal(usage));
    });

    return Array.from(grouped.values());
  }

  function normalizeUsageForModal(usage) {
    return Object.assign({}, usage, {
      quantity: Number(usage.quantity || 0),
      alternativeItems: Array.isArray(usage.alternativeItems) ? usage.alternativeItems : []
    });
  }

  function getDuplicateUsageKey(usage) {
    if (usage.type === "quest") {
      return [
        usage.type,
        usage.questName || usage.questId || "",
        usage.trader || "",
        Boolean(usage.foundInRaid),
        Boolean(usage.requiredForKappa)
      ].join("|");
    }

    return [
      usage.type,
      usage.stationId || usage.stationName || "",
      Number(usage.level) || 0,
      Boolean(usage.foundInRaid),
      Boolean(usage.requiredForKappa)
    ].join("|");
  }

  function mergeUsageAlternatives(currentItems, nextItems) {
    const merged = new Map();

    const current = Array.isArray(currentItems) ? currentItems : [];
    const next = Array.isArray(nextItems) ? nextItems : [];

    current.concat(next).forEach((item) => {
      if (!item || !item.id) return;
      merged.set(item.id, item);
    });

    return Array.from(merged.values());
  }

  function renderUse(use) {
    const typeLabel = use.type === "hideout" ? "Hideout" : "Quest";
    const completed = isUsageCompleted(use);
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
          ${completed ? '<span class="use-tag completed">&#10003; Concluido</span>' : ""}
        </div>
        <div class="use-title">${escapeHtml(title)} ${link}</div>
        ${alternatives}
        </div>
      </article>
    `;
  }

  function isUsageCompleted(use) {
    if (use.type === "quest") {
      return Boolean(use.questId && isQuestCompleted(use.questId));
    }

    const upgrade = findHideoutUpgradeForUsage(use);
    return Boolean(upgrade && isHideoutCompleted(upgrade.id));
  }

  function findHideoutUpgradeForUsage(use) {
    return state.hideoutUpgrades.find((upgrade) => {
      const sameStation = use.stationId
        ? upgrade.stationId === use.stationId
        : upgrade.stationName === use.stationName;
      return sameStation && Number(upgrade.level) === Number(use.level);
    });
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

        Object.entries(progress.hideoutProgress).forEach(([upgradeId, upgradeState]) => {
          if (upgradeState && upgradeState.completed && upgradeState.appliedItems) {
            nextProgress.hideoutProgress[upgradeId] = upgradeState;
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
    return sanitizeDisplayText(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  function sanitizeDisplayText(value) {
    const text = String(value || "");
    if (!/[\u00c2\u00c3\u00e2][\u0080-\u00bf]/.test(text)) return text;

    try {
      const bytes = Array.from(text).map((char) => {
        const code = char.charCodeAt(0);
        if (code <= 255) {
          return `%${code.toString(16).padStart(2, "0")}`;
        }
        return encodeURIComponent(char);
      }).join("");

      return decodeURIComponent(bytes);
    } catch {
      return text;
    }
  }
})();
