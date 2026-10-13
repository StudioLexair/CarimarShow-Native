import { readLocal } from "./storage-local.mjs";
export const state = {
  list: readLocal("cs_list_v1", []),
  follows: readLocal("cs_follow_v2", []),
  history: readLocal("cs_history_v2", []),
  recents: readLocal("cs_recent_v2", []),
  profile: readLocal("cs_profile_v2", { name: "CarimarShow", avatar: "" }),
  seed: {
    catalog: [],
    details: {},
    people: {},
    images: {},
    responses: {},
    generatedAt: "",
  },
  downloadMap: new Map(),
  visible: new Map(),
  routeRevision: 0,
  searchRevision: 0,
  searchType: "multi",
  heroIndex: 0,
  installPrompt: null,
  listTab: "movie",
};

for (const pair of [
  [state.list, "list"],
  [state.follows, "follows"],
  [state.history, "history"],
  [state.recents, "recents"],
])
  if (!Array.isArray(pair[0])) {
    if (pair[1] === "list") state.list = [];
    if (pair[1] === "follows") state.follows = [];
    if (pair[1] === "history") state.history = [];
    if (pair[1] === "recents") state.recents = [];
  }
