import { allAssets, assets, folders } from "./data";
import type { DemoAsset, DemoState, LibraryFilter, MediaRef, SearchFilter, SearchResult } from "./types";

export const STORAGE_KEY = "clipknife:website-demo:v1";
export const timeLabel = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
export const refKey = (ref: MediaRef) => ref.shotId ? `${ref.assetId}:${ref.shotId}` : ref.assetId;
export const assetFor = (ref: MediaRef) => allAssets.find(asset => asset.id === ref.assetId);
export const shotFor = (ref: MediaRef) => assetFor(ref)?.shots.find(shot => shot.id === ref.shotId);
export const libraryAssets = (state: Pick<DemoState, "imported">) => state.imported ? allAssets : assets;
export const inFolder = (asset: DemoAsset, folder: string) => !folder || asset.folder === folder || asset.folder.startsWith(`${folder}/`);
export const normalized = (text: string) => text.normalize("NFKC").trim().toLocaleLowerCase("zh-CN");

export function initialState(): DemoState {
  return { version: 1, page: "library", libraryTab: "overview", imported: false,
    library: { kind: "all", folder: "", query: "" }, search: { kind: "all", folder: "", orientation: "all" },
    query: "", similarId: null, groupId: "travel-edit", sidebarOpen: true, selected: null,
    groups: [
      { id: "travel-edit", name: "旅行短片", members: [{ assetId: "traveler" }, { assetId: "mountain" }, { assetId: "coast-film", shotId: "coast-film-shot-1" }] },
      { id: "city-edit", name: "城市随拍", members: [{ assetId: "street-film" }, { assetId: "architecture" }] },
    ] };
}
export function filterLibrary(items: DemoAsset[], filter: LibraryFilter) {
  const query = normalized(filter.query);
  return items.filter(asset => (filter.kind === "all" || asset.kind === filter.kind) && inFolder(asset, filter.folder)
    && (!query || normalized(`${asset.name} ${asset.tags.join(" ")}`).includes(query)));
}
const synonyms = [
  ["海边", "海岸", "沙滩", "海湾", "海浪", "beach", "ocean", "sea"],
  ["日落", "夕阳", "落日", "sunset"], ["雨夜", "雨后", "雨天", "下雨", "rain"],
  ["街道", "街景", "街角", "城市", "street", "city"], ["咖啡", "拿铁", "coffee", "latte"],
  ["人物", "人像", "旅行者", "行走", "漫步", "走路", "person"], ["森林", "树林", "小径", "forest"],
  ["山脉", "雪山", "山野", "山脊", "远山", "mountain"], ["小狗", "狗", "宠物", "dog"],
  ["枫叶", "红叶", "秋天", "秋日", "autumn"], ["建筑", "美术馆", "architecture"], ["陶器", "花器", "静物", "ceramic"],
];
function scoreText(query: string, text: string) {
  const q = normalized(query);
  const body = normalized(text);
  if (!q) return 0;
  let score = body.includes(q) ? 12 : 0;
  for (const terms of synonyms) {
    if (terms.some(term => q.includes(term)) && terms.some(term => body.includes(term))) score += 4;
  }
  for (const token of q.split(/[\s，,。.!！?？]+/).filter(word => word.length >= 2)) {
    if (body.includes(token)) score += 3;
  }
  return score;
}
export function searchAssets(items: DemoAsset[], query: string, filter: SearchFilter, similarId: string | null = null): SearchResult[] {
  const reference = items.find(asset => asset.id === similarId);
  if (!reference && !normalized(query)) return [];
  return items.filter(asset => (filter.kind === "all" || filter.kind === asset.kind) && inFolder(asset, filter.folder)
    && (filter.orientation === "all" || asset.kind !== "audio" && (filter.orientation === "portrait" ? asset.height > asset.width : asset.width >= asset.height))
    && (!reference || asset.kind !== "audio" && asset.id !== reference.id))
    .flatMap(asset => {
      const matchText = `${asset.tags.join(" ")} ${asset.description}`;
      const score = reference ? asset.tags.filter(tag => reference.tags.includes(tag)).length * 4 : scoreText(query, matchText);
      if (!score) return [];
      const shot = asset.shots.reduce<DemoAsset["shots"][number] | undefined>((best, current) => {
        return !best || scoreText(query, current.description) > scoreText(query, best.description) ? current : best;
      }, undefined);
      const tag = asset.tags.find(tag => scoreText(query, tag) > 0);
      return [{ asset, ref: { assetId: asset.id, ...(shot ? { shotId: shot.id } : {}) }, score,
        reason: reference ? "相似画面示例" : asset.kind === "audio" ? "语音命中" : tag ? "标签命中" : "描述命中",
        evidence: reference ? asset.tags.filter(tag => reference.tags.includes(tag)).join(" · ") : tag ? asset.tags.filter(item => scoreText(query, item) > 0).join(" · ") : shot?.description ?? asset.description }];
    }).sort((a, b) => b.score - a.score || a.asset.id.localeCompare(b.asset.id));
}

export type Action =
  | { type: "navigate"; page: DemoState["page"]; tab?: DemoState["libraryTab"] }
  | { type: "library-filter"; value: Partial<LibraryFilter> }
  | { type: "search-filter"; value: Partial<SearchFilter> }
  | { type: "search"; query: string; similarId?: string }
  | { type: "select"; ref: MediaRef | null }
  | { type: "toggle-sidebar" }
  | { type: "import" }
  | { type: "select-group"; id: string }
  | { type: "create-group"; id: string; name: string }
  | { type: "add-member"; id: string; ref: MediaRef }
  | { type: "remove-member"; id: string; ref: MediaRef }
  | { type: "reset" };

export function validRef(value: unknown, imported = true): value is MediaRef {
  if (!record(value) || typeof value.assetId !== "string" || value.shotId !== undefined && typeof value.shotId !== "string") return false;
  const asset = (imported ? allAssets : assets).find(item => item.id === value.assetId);
  return Boolean(asset && (value.shotId === undefined || asset.shots.some(shot => shot.id === value.shotId)));
}
export function demoReducer(state: DemoState, action: Action): DemoState {
  switch (action.type) {
    case "navigate": return { ...state, page: action.page, libraryTab: action.tab ?? state.libraryTab, selected: null };
    case "library-filter": return { ...state, library: { ...state.library, ...action.value }, selected: null };
    case "search-filter": return { ...state, search: { ...state.search, ...action.value }, selected: null };
    case "search": return { ...state, page: "search", query: action.query.trim().slice(0, 160), similarId: action.similarId ?? null, selected: null };
    case "select": return action.ref === null || validRef(action.ref, state.imported) ? { ...state, selected: action.ref } : state;
    case "toggle-sidebar": return { ...state, sidebarOpen: !state.sidebarOpen };
    case "import": return { ...state, imported: true, page: "library", libraryTab: "overview", library: { kind: "all", query: "", folder: "imported" }, selected: null };
    case "select-group": return state.groups.some(group => group.id === action.id) ? { ...state, page: "library", libraryTab: "groups", groupId: action.id, selected: null } : state;
    case "create-group": {
      const name = action.name.trim().slice(0, 60);
      if (!name || state.groups.length >= 20 || state.groups.some(group => group.id === action.id)) return state;
      return { ...state, groups: [...state.groups, { id: action.id, name, members: [] }], groupId: action.id };
    }
    case "add-member": {
      if (!validRef(action.ref, state.imported)) return state;
      return { ...state, groups: state.groups.map(group => group.id !== action.id || group.members.some(member => refKey(member) === refKey(action.ref))
        ? group : { ...group, members: [...group.members, action.ref] }) };
    }
    case "remove-member": return { ...state, selected: null, groups: state.groups.map(group => group.id !== action.id ? group : { ...group, members: group.members.filter(member => refKey(member) !== refKey(action.ref)) }) };
    case "reset": return initialState();
  }
}
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function validFolder(value: unknown): value is string { return value === "" || typeof value === "string" && folders.some(folder => folder.id === value); }
function validKind(value: unknown): value is LibraryFilter["kind"] { return value === "all" || value === "image" || value === "video" || value === "audio"; }
function shortText(value: unknown, max: number): value is string { return typeof value === "string" && value.length <= max; }

export function restoreState(text: string | null): DemoState {
  const fallback = initialState();
  if (!text || text.length > 150000) return fallback;
  try {
    const data: unknown = JSON.parse(text);
    if (!record(data) || data.version !== 1 || !record(data.library) || !record(data.search)
      || data.page !== "library" && data.page !== "search" || data.libraryTab !== "overview" && data.libraryTab !== "groups"
      || !validKind(data.library.kind) || !validFolder(data.library.folder) || !shortText(data.library.query, 160)
      || !validKind(data.search.kind) || !validFolder(data.search.folder) || !["all", "landscape", "portrait"].includes(String(data.search.orientation))
      || !shortText(data.query, 160) || typeof data.imported !== "boolean" || typeof data.sidebarOpen !== "boolean"
      || !Array.isArray(data.groups) || data.groups.length === 0 || data.groups.length > 20) return fallback;
    const imported = data.imported;
    const ids = new Set<string>();
    const groups = [];
    for (const group of data.groups) {
      if (!record(group) || !shortText(group.id, 80) || !group.id || ids.has(group.id) || !shortText(group.name, 60) || !group.name.trim()
        || !Array.isArray(group.members) || group.members.length > 150 || !group.members.every(member => validRef(member, imported))) return fallback;
      ids.add(group.id);
      const members = Array.from(new Map(group.members.map(member => [refKey(member), { assetId: member.assetId, ...(member.shotId ? { shotId: member.shotId } : {}) }])).values());
      groups.push({ id: group.id, name: group.name, members });
    }
    return { version: 1, page: data.page, libraryTab: data.libraryTab, imported, groups,
      library: { kind: data.library.kind, folder: data.library.folder, query: data.library.query },
      search: { kind: data.search.kind, folder: data.search.folder, orientation: data.search.orientation === "landscape" ? "landscape" : data.search.orientation === "portrait" ? "portrait" : "all" },
      query: data.query, similarId: typeof data.similarId === "string" && libraryAssets({ imported }).some(asset => asset.id === data.similarId && asset.kind !== "audio") ? data.similarId : null,
      selected: validRef(data.selected, imported) ? { assetId: data.selected.assetId, ...(data.selected.shotId ? { shotId: data.selected.shotId } : {}) } : null,
      groupId: typeof data.groupId === "string" && ids.has(data.groupId) ? data.groupId : groups[0]?.id ?? fallback.groupId,
      sidebarOpen: data.sidebarOpen };
  } catch { return fallback; }
}
