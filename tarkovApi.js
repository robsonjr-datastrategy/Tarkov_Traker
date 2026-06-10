(function () {
  const API_URL = "https://api.tarkov.dev/graphql";

  const TARKOV_BASE_QUERY = `
    query {
      tasks {
        id
        name
        minPlayerLevel
        kappaRequired
        trader {
          name
          imageLink
        }
        wikiLink
        objectives {
          id
          type
          description
          ... on TaskObjectiveItem {
            count
            foundInRaid
            item {
              id
              name
              shortName
              iconLink
              wikiLink
            }
            items {
              id
              name
              shortName
              iconLink
              wikiLink
            }
          }
        }
      }
      hideoutStations {
        id
        name
        imageLink
        levels {
          level
          itemRequirements {
            count
            attributes {
              name
              value
            }
            item {
              id
              name
              shortName
              iconLink
              wikiLink
            }
          }
        }
      }
    }
  `;

  async function fetchTarkovBase() {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: TARKOV_BASE_QUERY })
    });

    if (!response.ok) {
      throw new Error(`tarkov.dev respondeu com HTTP ${response.status}`);
    }

    const payload = await response.json();

    if (payload.errors && payload.errors.length > 0) {
      throw new Error(payload.errors.map((error) => error.message).join("; "));
    }

    return payload.data;
  }

  window.TarkovApi = {
    fetchTarkovBase,
    TARKOV_BASE_QUERY
  };
})();
