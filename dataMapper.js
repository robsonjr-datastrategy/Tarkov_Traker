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
            foundInRaid: isRequirementFoundInRaid(requirement),
            requiredForKappa: false,
            requiredForHideoutProgression: true,
            wikiLink: item.wikiLink || ""
          });
        });
      });
    });

    return Array.from(grouped.values())
      .map((item) => {
        const usages = condenseUsages(item.usages);
        const totalRequired = usages.reduce((sum, usage) => sum + Number(usage.quantity || 0), 0);
        const requiredForQuest = usages.some((usage) => usage.type === "quest");
        const requiredForHideout = usages.some((usage) => usage.type === "hideout");
        const requiredForKappa = usages.some((usage) => usage.requiredForKappa);
        const foundInRaidRequired = usages.some((usage) => usage.foundInRaid);

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
          usages
        };
      })
      .filter((item) => item.totalRequired > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function mapQuestData(data) {
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];

    return tasks.map((task) => {
      const objectives = Array.isArray(task.objectives) ? task.objectives : [];
      const requiredItems = condenseRequiredItems(objectives
        .filter((objective) => objective && objective.type && objective.count)
        .filter((objective) => !isFlexibleItemObjective(objective))
        .map((objective) => {
          const item = objective.item || firstItem(objective.items);
          if (!item || !item.id || isCurrencyItem(item)) return null;

          return {
            objectiveId: objective.id,
            description: objective.description || "",
            itemId: item.id,
            name: item.name,
            shortName: item.shortName,
            icon: item.iconLink || "",
            wikiLink: item.wikiLink || "",
            quantity: Number(objective.count) || 0,
            foundInRaid: Boolean(objective.foundInRaid),
            alternativeItems: normalizeAlternativeItems(objective.items)
          };
        })
        .filter(Boolean));

      return {
        id: task.id,
        name: task.name,
        trader: task.trader ? task.trader.name : "",
        traderImage: task.trader ? task.trader.imageLink : "",
        minPlayerLevel: Number(task.minPlayerLevel) || null,
        requiredForKappa: Boolean(task.kappaRequired),
        wikiLink: task.wikiLink || "",
        itemCount: requiredItems.reduce((sum, item) => sum + item.quantity, 0),
        requiredItems
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }

  function mapHideoutData(data) {
    const hideoutStations = Array.isArray(data.hideoutStations) ? data.hideoutStations : [];
    const upgrades = [];

    hideoutStations.forEach((station) => {
      const levels = Array.isArray(station.levels) ? station.levels : [];

      levels.forEach((level) => {
        const requirements = Array.isArray(level.itemRequirements) ? level.itemRequirements : [];
        const requiredItems = requirements
          .map((requirement) => {
            const item = requirement.item;
            if (!item || !item.id || isCurrencyItem(item)) return null;

            return {
              itemId: item.id,
              name: item.name,
              shortName: item.shortName,
              icon: item.iconLink || "",
              wikiLink: item.wikiLink || "",
              quantity: Number(requirement.count) || 0,
              foundInRaid: isRequirementFoundInRaid(requirement)
            };
          })
          .filter(Boolean);

        upgrades.push({
          id: `${station.id}-level-${Number(level.level) || 0}`,
          stationId: station.id,
          stationName: station.name,
          stationImage: station.imageLink || "",
          level: Number(level.level) || 0,
          itemCount: requiredItems.reduce((sum, item) => sum + item.quantity, 0),
          requiredItems
        });
      });
    });

    return upgrades.sort((a, b) => {
      const stationOrder = a.stationName.localeCompare(b.stationName);
      return stationOrder === 0 ? a.level - b.level : stationOrder;
    });
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

  function condenseUsages(usages) {
    const questUsages = condenseQuestUsages(usages.filter((usage) => usage.type === "quest"));
    const hideoutUsages = condenseHideoutUsages(usages.filter((usage) => usage.type === "hideout"));
    return questUsages.concat(hideoutUsages);
  }

  function condenseQuestUsages(usages) {
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
        if (hasFindAndHandOverPair(sameItemUsages)) {
          withoutFindHandPairs.push(preferHandOverUsage(sameItemUsages));
          return;
        }

        withoutFindHandPairs.push(...sameItemUsages);
      });
    });

    return condenseDuplicateQuestVariants(withoutFindHandPairs);
  }

  function hasFindAndHandOverPair(usages) {
    return usages.length > 1
      && usages.some((usage) => isFindObjective(usage.objectiveDescription))
      && usages.some((usage) => isHandOverObjective(usage.objectiveDescription));
  }

  function preferHandOverUsage(usages) {
    const preferred = usages.find((usage) => isHandOverObjective(usage.objectiveDescription)) || usages[0];
    const quantity = Math.max(...usages.map((usage) => Number(usage.quantity || 0)));
    return {
      ...preferred,
      quantity
    };
  }

  function condenseDuplicateQuestVariants(usages) {
    const grouped = new Map();

    usages.forEach((usage) => {
      const key = [
        usage.itemId || "",
        usage.questName || "",
        usage.trader || "",
        normalizeObjectiveDescription(usage.objectiveDescription),
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

  function condenseHideoutUsages(usages) {
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

  function condenseRequiredItems(items) {
    const asUsages = items.map((item) => ({
      ...item,
      type: "quest",
      questId: "",
      questName: "",
      trader: "",
      objectiveDescription: item.description
    }));

    return condenseQuestUsages(asUsages).map((usage) => ({
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

  function isFindObjective(description) {
    const text = normalizeObjectiveDescription(description);
    return text.startsWith("find ") || text.startsWith("locate ") || text.startsWith("obtain ");
  }

  function isHandOverObjective(description) {
    const text = normalizeObjectiveDescription(description);
    return text.startsWith("hand over ");
  }

  function normalizeObjectiveDescription(description) {
    return String(description || "").trim().toLowerCase().replace(/\s+/g, " ");
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

  function isRequirementFoundInRaid(requirement) {
    const attributes = Array.isArray(requirement.attributes) ? requirement.attributes : [];
    const foundInRaidAttribute = attributes.find((attribute) => attribute && attribute.name === "foundInRaid");

    return String(foundInRaidAttribute && foundInRaidAttribute.value).toLowerCase() === "true";
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
    mapTarkovData,
    mapQuestData,
    mapHideoutData
  };
})();
