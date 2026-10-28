import { describe, expect, it } from "vitest";
import { assets, allAssets, importAssets } from "./data";
import { demoReducer, filterLibrary, initialState, inFolder, libraryAssets, refKey, restoreState, searchAssets, validRef } from "./model";

describe("示例素材筛选与检索", () => {
  it("类型、父目录和关键词共同生效", () => {
    const results = filterLibrary(assets, { kind: "image", folder: "travel", query: "海" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(item => item.kind === "image" && item.folder.startsWith("travel/"))).toBe(true);
    expect(inFolder(assets[0]!, "trav")).toBe(false);
    expect(filterLibrary(assets, { kind: "video", folder: "audio", query: "" })).toEqual([]);
  });
  it("文件名搜索处理空白与全角字符", () => {
    expect(filterLibrary(assets, { kind: "all", folder: "", query: "  ＭＰ４ " }).every(item => item.kind === "video")).toBe(true);
  });
  it("示例语义检索使用画面描述，返回相关静帧和命中依据", () => {
    const matches = searchAssets(assets, "夕阳下的海岸", initialState().search);
    expect(matches.map(item => item.asset.id)).toContain("coast-film");
    expect(matches.every(item => item.score > 0 && item.evidence && item.reason)).toBe(true);
    expect(matches.find(item => item.asset.id === "coast-film")?.ref.shotId).toBeTruthy();
    expect(matches).toEqual(searchAssets(assets, "夕阳下的海岸", initialState().search));
  });
  it("空白和无匹配查询返回空结果", () => {
    expect(searchAssets(assets, "  ", initialState().search)).toEqual([]);
    expect(searchAssets(assets, "深空飞船9837", initialState().search)).toEqual([]);
  });
  it("搜索只返回同时满足类型、来源和方向的内容", () => {
    const result = searchAssets(assets, "海边", { kind: "video", folder: "travel", orientation: "portrait" });
    expect(result.map(item => item.asset.id)).toEqual(["coast-walk"]);
    expect(searchAssets(assets, "钢琴", { kind: "audio", folder: "", orientation: "portrait" })).toEqual([]);
  });
  it("相似查询排除自身与音频，损坏的引用不产生结果", () => {
    const result = searchAssets(assets, "", initialState().search, "traveler");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(item => item.asset.kind !== "audio" && item.asset.id !== "traveler")).toBe(true);
    expect(searchAssets(assets, "", initialState().search, "missing")).toEqual([]);
  });
});

describe("演示操作与分组关系", () => {
  it("重复导入保持幂等并将视图切到新增目录", () => {
    const state = demoReducer(demoReducer(initialState(), { type: "import" }), { type: "import" });
    expect(libraryAssets(state)).toHaveLength(assets.length + importAssets.length);
    expect(filterLibrary(libraryAssets(state), state.library)).toEqual(importAssets);
  });
  it("拒绝缺失素材、未导入素材和不属于素材的分镜", () => {
    for (const ref of [{ assetId: "missing" }, { assetId: "new-coast" }, { assetId: "dog", shotId: "coast-film-shot-1" }]) {
      expect(demoReducer(initialState(), { type: "select", ref }).selected).toBeNull();
      expect(demoReducer(initialState(), { type: "add-member", id: "travel-edit", ref }).groups).toEqual(initialState().groups);
    }
    expect(validRef({ assetId: "coast-film", shotId: "coast-film-shot-1" })).toBe(true);
  });
  it("相同素材或静帧重复添加不增加成员；不同静帧可独立保存", () => {
    const ref = { assetId: "coast-film", shotId: "coast-film-shot-2" };
    let state = demoReducer(initialState(), { type: "add-member", id: "travel-edit", ref });
    state = demoReducer(state, { type: "add-member", id: "travel-edit", ref });
    expect(state.groups[0]?.members).toHaveLength(4);
    expect(new Set(state.groups[0]?.members.map(refKey)).size).toBe(4);
    const removed = demoReducer(state, { type: "remove-member", id: "travel-edit", ref });
    expect(removed.groups[0]?.members).toHaveLength(3);
    expect(libraryAssets(removed)).toEqual(assets);
  });
  it("分组创建限制名称和数量，不接受空名或重复 id", () => {
    let state = initialState();
    expect(demoReducer(state, { type: "create-group", id: "empty", name: " " })).toEqual(state);
    expect(demoReducer(state, { type: "create-group", id: "travel-edit", name: "重复" })).toEqual(state);
    for (let i = 0; i < 25; i++) state = demoReducer(state, { type: "create-group", id: `test-${i}`, name: "长".repeat(80) });
    expect(state.groups).toHaveLength(20);
    expect(state.groups.at(-1)?.name).toHaveLength(60);
  });
  it("切换页面与筛选关闭详情，重置仅恢复演示状态", () => {
    const selected = demoReducer(initialState(), { type: "select", ref: { assetId: "dog" } });
    expect(demoReducer(selected, { type: "search", query: "  海边  " }).selected).toBeNull();
    expect(demoReducer(selected, { type: "library-filter", value: { kind: "audio" } }).selected).toBeNull();
    expect(demoReducer(demoReducer(selected, { type: "import" }), { type: "reset" })).toEqual(initialState());
  });
});

describe("会话恢复与不可信输入", () => {
  it("恢复已导入素材、分镜和分组", () => {
    let state = demoReducer(initialState(), { type: "import" });
    state = demoReducer(state, { type: "create-group", id: "mine", name: "下一支旅行短片" });
    state = demoReducer(state, { type: "add-member", id: "mine", ref: { assetId: "new-coast" } });
    expect(restoreState(JSON.stringify(state))).toEqual(state);
    expect(allAssets).toHaveLength(27);
  });
  it.each([null, "{broken", "null", "[]", " ".repeat(150001), JSON.stringify({ ...initialState(), version: 99 })])("异常存储回退到可操作的初始状态", text => {
    expect(restoreState(text)).toEqual(initialState());
  });
  it("清除多余字段及重复关系，拒绝跨素材引用", () => {
    const state = initialState();
    const member = { assetId: "dog", url: "https://untrusted.example/" };
    const restored = restoreState(JSON.stringify({ ...state, injected: true, groups: [{ id: "a", name: "安全示例", members: [member, member] }] }));
    expect(restored.groups[0]?.members).toEqual([{ assetId: "dog" }]);
    expect(restored).not.toHaveProperty("injected");
    expect(restoreState(JSON.stringify({ ...state, groups: [{ id: "a", name: "异常", members: [{ assetId: "dog", shotId: "bad" }] }] }))).toEqual(initialState());
  });
  it("拒绝重复分组、未知筛选及超长字段", () => {
    const state = initialState();
    for (const invalid of [
      { ...state, groups: [state.groups[0], state.groups[0]] },
      { ...state, library: { ...state.library, kind: "unknown" } },
      { ...state, search: { ...state.search, folder: "../private" } },
      { ...state, query: "x".repeat(161) },
    ]) expect(restoreState(JSON.stringify(invalid))).toEqual(initialState());
  });
});
