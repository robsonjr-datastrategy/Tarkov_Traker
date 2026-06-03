(function () {
  const CURRENCY_ITEM_IDS = new Set([
    "5449016a4bdc2d6f028b456f",
    "5696686a4bdc2da3298b456a",
    "569668774bdc2da2298b4568"
  ]);

  function mapTarkovData(data) {
    const grouped = new Map();
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    const hideoutStations = Array.isArray(data.hideoutStations) ? data.hideoutStations : [];

    tasks.forEach((task) => {
      const objectives = Array.isArray(task.objectives) ? task.objectives : [];

      objectives
        .filter((objective) => objective && objective.type && objective.count)
        .forEach((objective) => {
          if (isFlexibleItemObjective(objective)) return;

          const item = objective.item || firstItem(objective.items);
          if (!item || !item.id) return;
          if (isCurrencyItem(item)) return;

          addUsage(grouped, item, {
            type: "quest",
            questId: task.id,
            questName: task.name,
            trader: task.trader ? task.trader.name : "",
            traderImage: task.trader ? task.trader.imageLink : "",
            quantity: Number(objective.count) || 0,
            foundInRaid: Boolean(objective.foundInRaid),
            requiredForKappa: Boolean(task.kappaRequired),
            wikiLink: task.wikiLink || item.wikiLink || "",
            objectiveId: objective.id,
            objectiveDescription: objective.description || "",
            alternativeItems: normalizeAlternativeItems(objective.items)
          });
        });
    });

    hideoutStations.forEach((station) => {
      const levels = Array.isArray(station.levels) ? station.levels : [];

      levels.forEach((level) => {
        const requirements = Array.isArray(level.itemRequirements) ? level.itemRequirements : [];

        requirements.forEach((requirement) => {
          const item = requirement.item;
          if (!item || !item.id) return;
          if (isCurrencyItem(item)) return;

          addUsage(grouped, item, {
            type: "hideout",
            stationId: station.id,
            stationName: station.name,
            stationImage: station.imageLink || "",
            level: Number(level.level) || 0,
            quantity: Number(requirement.count) || 0,
            foundInRaid: false,
            requiredForKappa: false,
            requiredForHideoutProgression: true,
            wikiLink: item.wikiLink || ""
          });
        });
      });
    });

    return Array.from(grouped.values())
      .map((item) => {
        const totalRequired = item.usages.reduce((sum, usage) => sum + Number(usage.quantity || 0), 0);
        const requiredForQuest = item.usages.some((usage) => usage.type === "quest");
        const requiredForHideout = item.usages.some((usage) => usage.type === "hideout");
        const requiredForKappa = item.usages.some((usage) => usage.requiredForKappa);
        const foundInRaidRequired = item.usages.some((usage) => usage.foundInRaid);

        return {
          id: item.id,
          name: item.name,
          shortName: item.shortName,
          icon: item.icon,
          wikiLink: item.wikiLink,
          totalRequired,
          collected: 0,
          remaining: totalRequired,
          requiredForQuest,
          requiredForHideout,
          requiredForKappa,
          foundInRaidRequired,
          usages: item.usages
        };
      })
      .filter((item) => item.totalRequired > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function addUsage(grouped, item, usage) {
    const existing = grouped.get(item.id) || {
      id: item.id,
      name: item.name,
      shortName: item.shortName,
      icon: item.iconLink || item.gridImageLink || "",
      wikiLink: item.wikiLink || "",
      usages: []
    };

    existing.name = existing.name || item.name;
    existing.shortName = existing.shortName || item.shortName;
    existing.icon = existing.icon || item.iconLink || item.gridImageLink || "";
    existing.wikiLink = existing.wikiLink || item.wikiLink || "";
    existing.usages.push(usage);
    grouped.set(item.id, existing);
  }

  function firstItem(items) {
    return Array.isArray(items) && items.length > 0 ? items[0] : null;
  }

  function isCurrencyItem(item) {
    return CURRENCY_ITEM_IDS.has(item.id);
  }

  function isFlexibleItemObjective(objective) {
    const items = Array.isArray(objective.items) ? objective.items : [];
    const uniqueItemIds = new Set(items.map((item) => item && item.id).filter(Boolean));

    return Boolean(objective.item && uniqueItemIds.size > 1);
  }

  function normalizeAlternativeItems(items) {
    if (!Array.isArray(items)) return [];

    return items.map((item) => ({
      id: item.id,
      name: item.name,
      shortName: item.shortName,
      icon: item.iconLink || "",
      wikiLink: item.wikiLink || ""
    }));
  }

  window.TarkovDataMapper = {
    mapTarkovData
  };
})();
