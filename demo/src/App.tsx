import { useEffect, useMemo, useReducer, useRef, useState, type Dispatch, type RefObject } from "react";
import { ArrowDownToLine, ArrowLeft, ArrowRight, AudioLines, Check, ChevronRight,
  Compass, Expand, Film, FolderClosed, FolderOpen, FolderPlus, Image, Info, LayoutGrid, Maximize2,
  Music2, PanelLeftClose, PanelLeftOpen, Play, Plus, RefreshCw, RotateCcw, Search, Settings, SlidersHorizontal,
  Sparkles, Tag, Trash2, X } from "lucide-react";
import { assets, folders, importAssets, sampleQueries } from "./data";
import { assetFor, demoReducer, filterLibrary, inFolder, initialState, libraryAssets, refKey, restoreState, searchAssets, shotFor, STORAGE_KEY, timeLabel, type Action } from "./model";
import type { DemoAsset, DemoGroup, DemoState, MediaFilter, MediaRef, SearchResult } from "./types";
import { NavigationIcon } from "./components/NavigationIcon";
import { MaterialLibraryIcon } from "./components/MaterialLibraryIcon";
import { Choice, Empty, Modal, Photo } from "./components/ui";
import { VideoPreview } from "./components/VideoPreview";
import previewUrl from "./assets/preview.webp";

type ControlDialog = "import" | "reset" | "stats" | "advanced" | "create" | { title: string; text: string };
const types: { kind: MediaFilter; label: string }[] = [{ kind: "all", label: "全部" }, { kind: "video", label: "视频" }, { kind: "image", label: "图片" }, { kind: "audio", label: "音频" }];
const kindLabel = (kind: DemoAsset["kind"]) => kind === "video" ? "视频" : kind === "audio" ? "音频" : "图片";
function loadSession() {
  try { return restoreState(sessionStorage.getItem(STORAGE_KEY)); } catch { return initialState(); }
}
function useWidth(query: string) {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => { const media = matchMedia(query); const listener = () => setMatches(media.matches); media.addEventListener("change", listener); return () => media.removeEventListener("change", listener); }, [query]);
  return matches;
}

export function App({ embed }: { embed: boolean }) {
  const [state, dispatch] = useReducer(demoReducer, undefined, loadSession);
  const [dialog, setDialog] = useState<ControlDialog | null>(null);
  const [preview, setPreview] = useState<MediaRef | null>(null);
  const [groupTarget, setGroupTarget] = useState<MediaRef | null>(null);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState(state.query);
  const [searching, setSearching] = useState(false);
  const [searchVersion, setSearchVersion] = useState(0);
  const [editing, setEditing] = useState(false);
  const [roaming, setRoaming] = useState(0);
  const desktop = useWidth(embed ? "(min-width: 960px)" : "(min-width: 1024px)");
  const compactInspector = useWidth("(max-width: 1160px)");
  const dialogTrigger = useRef<HTMLElement | null>(null);
  const previewTrigger = useRef<HTMLElement | null>(null);
  const groupTrigger = useRef<HTMLElement | null>(null);
  const selectionTrigger = useRef<HTMLElement | null>(null);
  const inspectorClose = useRef<HTMLButtonElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const galleryScroll = useRef<HTMLDivElement | null>(null);
  const latestSearch = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const items = useMemo(() => libraryAssets(state), [state.imported]);
  const selectedAsset = state.selected ? assetFor(state.selected) : undefined;
  const group = state.groups.find(item => item.id === state.groupId) ?? state.groups[0];
  const isGroups = state.page === "library" && state.libraryTab === "groups";
  const results = useMemo(() => searchAssets(items, state.query, state.search, state.similarId), [items, state.query, state.search, state.similarId]);
  const filtered = useMemo(() => filterLibrary(items, state.library), [items, state.library]);
  const displayed = isGroups ? group?.members ?? [] : state.page === "search" ? results.map(result => result.ref) : filtered.map(asset => ({ assetId: asset.id }));
  const galleryItems = roaming && state.page === "library" && !isGroups ? displayed.filter(ref => assetFor(ref)?.kind !== "audio").slice(roaming % 4).concat(displayed.filter(ref => assetFor(ref)?.kind !== "audio").slice(0, roaming % 4)) : displayed;
  const explored = state.page === "search" && !state.query && !state.similarId;

  useEffect(() => {
    document.documentElement.dataset.demoReady = "true";
    // Local files have opaque origins; the parent still checks this frame's identity.
    const target = window.location.protocol === "file:" ? "*" : window.location.origin;
    if (window.parent !== window) window.parent.postMessage({ type: "clipknife-demo-ready" }, target);
  }, []);
  useEffect(() => { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Memory state remains fully usable when storage is denied or full. */ } }, [state]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 3500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current); latestSearch.current++; }, []);
  useEffect(() => { if (state.selected && !compactInspector) inspectorClose.current?.focus({ preventScroll: true }); }, [state.selected, compactInspector]);
  useEffect(() => { setEditing(false); setRoaming(0); }, [state.page, state.libraryTab]);
  useEffect(() => { galleryScroll.current?.scrollTo({ top: 0 }); }, [state.page, state.libraryTab, state.library.query, state.library.kind, state.library.folder, state.groupId, state.query, state.search]);
  useEffect(() => { if (!desktop) { setDialog(null); setPreview(null); setGroupTarget(null); } }, [desktop]);
  useEffect(() => {
    if (!state.selected || compactInspector || dialog || preview || groupTarget) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      dispatch({ type: "select", ref: null });
      selectionTrigger.current?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state.selected, compactInspector, dialog, preview, groupTarget]);

  function control(value: ControlDialog, trigger?: HTMLElement) { dialogTrigger.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null); setDialog(value); }
  function showPreview(ref: MediaRef, trigger?: HTMLElement) { previewTrigger.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null); setPreview(ref); }
  function addToGroup(ref: MediaRef, trigger?: HTMLElement) { groupTrigger.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null); setGroupTarget(ref); }
  function closeInspector() { dispatch({ type: "select", ref: null }); requestAnimationFrame(() => selectionTrigger.current?.isConnected && selectionTrigger.current.focus({ preventScroll: true })); }
  function select(ref: MediaRef, trigger: HTMLElement) { selectionTrigger.current = trigger; dispatch({ type: "select", ref }); }
  function runSearch(query: string, similarId?: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const version = ++latestSearch.current;
    setDraft(query); dispatch({ type: "search", query, similarId }); setSearching(Boolean(query.trim() || similarId));
    searchTimer.current = setTimeout(() => { if (latestSearch.current === version) { setSearching(false); setSearchVersion(value => value + 1); } }, 220);
  }
  function clearSearch() { runSearch(""); searchInput.current?.focus(); }
  function reset() {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    latestSearch.current++; dispatch({ type: "reset" }); setDraft(""); setSearching(false); setRoaming(0); setEditing(false); setPreview(null); setGroupTarget(null); setDialog(null); setNotice("演示已重置，重新开始探索吧");
  }
  function createGroup(name: string) {
    if (!name.trim() || state.groups.length >= 20) return null;
    const id = `group-${crypto.randomUUID()}`;
    dispatch({ type: "create-group", id, name });
    return id;
  }
  const countByKind = (kind: MediaFilter) => items.filter(asset => kind === "all" || asset.kind === kind).length;

  return <>
    <div className={`demo-app${embed ? " is-embedded" : ""}`} hidden={!desktop} data-view={state.page} data-library-tab={state.libraryTab}>
      <header className="experience-bar">
        <div>{!embed && <a className="back-home" href="../index.html#demo"><ArrowLeft />返回官网</a>}<span className="demo-label"><span />在线体验</span><span className="experience-note">示例数据 · 不读取本机文件</span></div>
        <div><button type="button" className="text-button" onClick={event => control("reset", event.currentTarget)}><RotateCcw />重置演示</button>{embed ? <a href="./index.html" target="_top" className="text-button"><Maximize2 />展开体验</a> : <a className="download-link" href="../index.html#download"><ArrowDownToLine />下载桌面版</a>}</div>
      </header>
      <section className="desktop-shell" aria-label="素刀示例工作区">
        <header className="desktop-titlebar"><nav className="desktop-nav" aria-label="软件主导航">
          {([{ id: "library", label: "素材库" }, { id: "search", label: "智能搜索" }, { id: "toolbox", label: "创作工具" }, { id: "taskcenter", label: "任务中心" }] as const).map(item => <button key={item.id} type="button" className={`desktop-nav-link${state.page === item.id ? " is-active" : ""}`} aria-current={state.page === item.id ? "page" : undefined}
            onClick={event => { if (item.id === "library" || item.id === "search") dispatch({ type: "navigate", page: item.id }); else control({ title: item.label, text: item.id === "toolbox" ? "在桌面版中使用视频分镜、图片清晰化等创作工具。本次在线体验开放素材浏览、搜索和分组整理。" : "桌面版任务中心展示扫描、索引、转写等后台任务的进度。在线示例已准备好，可以直接开始检索。" }, event.currentTarget); }}>
            <NavigationIcon name={item.id} active={state.page === item.id} />{item.label}
          </button>)}
        </nav><div className="titlebar-spacer" /><span className="shell-demo-badge">交互示例</span><button type="button" className="icon-button settings-button" aria-label="系统设置" onClick={event => control({ title: "系统设置", text: "在桌面版中配置本地模型、素材源、语音转写和其他运行选项。此处使用已准备好的示例素材，不需要安装或配置。" }, event.currentTarget)}><Settings /></button></header>

        {state.page === "library" && <div className="library-tabs" role="tablist" aria-label="素材库视图" onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
          const current = buttons.findIndex(button => button === document.activeElement);
          event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? 2 : (current + (event.key === "ArrowRight" ? 1 : -1) + 3) % 3; buttons[next]?.focus();
        }}>
          <button type="button" role="tab" aria-selected={!isGroups} tabIndex={isGroups ? -1 : 0} className={!isGroups ? "is-active" : ""} onClick={() => dispatch({ type: "navigate", page: "library", tab: "overview" })}><MaterialLibraryIcon kind="overview" />总览</button>
          <button type="button" role="tab" aria-selected={false} tabIndex={-1} onClick={event => control({ title: "人物分组", text: "桌面版可按已建立的人物索引浏览人物与相关素材。在线体验可以先从素材总览或智能搜索探索，再添加到自己的分组。" }, event.currentTarget)}><MaterialLibraryIcon kind="people" />人物分组</button>
          <button type="button" role="tab" aria-selected={isGroups} tabIndex={isGroups ? 0 : -1} className={isGroups ? "is-active" : ""} onClick={() => dispatch({ type: "navigate", page: "library", tab: "groups" })}><MaterialLibraryIcon kind="organization" />智能分类</button>
          <button type="button" className="button primary import-trigger" onClick={event => control("import", event.currentTarget)}><Plus />添加素材</button>
        </div>}

        <div className="workspace">
          {state.page === "library" && !isGroups && state.sidebarOpen && <aside className="material-sidebar"><LibrarySidebar state={state} items={items} dispatch={dispatch} onClose={() => dispatch({ type: "toggle-sidebar" })} /></aside>}
          {isGroups && <aside className="material-sidebar groups-sidebar"><div className="sidebar-section-title"><span>我的分组</span><button type="button" className="icon-button" aria-label="新建分组" onClick={event => control("create", event.currentTarget)}><Plus /></button></div>
            <p className="sidebar-caption">把找到的灵感，整理在一起。</p>
            <div className="group-list">{state.groups.map(item => <button type="button" key={item.id} className={`folder-row${state.groupId === item.id ? " selected" : ""}`} onClick={() => dispatch({ type: "select-group", id: item.id })} aria-pressed={state.groupId === item.id}><MaterialLibraryIcon kind="folder" /><span title={item.name}>{item.name}</span><small>{item.members.length}</small></button>)}</div>
            <button type="button" className="new-group-link" onClick={event => control("create", event.currentTarget)}><Plus />新建分组</button>
            <div className="group-explainer"><FolderPlus /><p>素材或分镜都可以加入分组，同一项也可以属于多个分组。</p><span>本次演示支持手动整理</span></div>
          </aside>}

          <main className={`main-workspace${state.selected && !compactInspector ? " has-inspector" : ""}${explored ? " is-discovery" : ""}`}>
            {state.page === "library" && !isGroups && <>
              <div className="library-toolbar">{!state.sidebarOpen && <button type="button" className="icon-button" aria-label="展开筛选与目录" onClick={() => dispatch({ type: "toggle-sidebar" })}><PanelLeftOpen /></button>}
                <div className="search-field library-query"><Search /><input aria-label="搜索文件名、标签" placeholder="搜索文件名、标签" value={state.library.query} maxLength={160} onChange={event => dispatch({ type: "library-filter", value: { query: event.target.value } })} />{state.library.query && <button type="button" className="icon-button" aria-label="清除素材关键词" onClick={() => dispatch({ type: "library-filter", value: { query: "" } })}><X /></button>}</div>
                <button type="button" className="text-button" onClick={event => control("stats", event.currentTarget)}><LayoutGrid />统计</button>
                <button type="button" className="text-button" onClick={() => setNotice("示例素材已是最新状态")}><RefreshCw />刷新</button>
                <button type="button" className={`text-button${roaming ? " active-text" : ""}`} aria-pressed={Boolean(roaming)} onClick={() => { setRoaming(value => value ? 0 : 1); dispatch({ type: "select", ref: null }); }}><Compass />{roaming ? "退出漫游" : "灵感漫游"}</button>
              </div>
              <div className="library-summary"><span>{roaming ? "灵感漫游" : folders.find(folder => folder.id === state.library.folder)?.name ?? "全部素材"}{state.library.kind !== "all" && <b> / {types.find(type => type.kind === state.library.kind)?.label}</b>}</span><div>{Boolean(roaming) && <button type="button" className="text-button" onClick={() => setRoaming(value => value + 1)}><RefreshCw />换一组</button>}{(state.library.folder || state.library.query || state.library.kind !== "all") && <button type="button" className="clear-filter" onClick={() => dispatch({ type: "library-filter", value: { folder: "", query: "", kind: "all" } })}>清除筛选</button>}<span>共 {galleryItems.length} 项</span></div></div>
            </>}

            {isGroups && <header className="group-header"><div><span className="eyebrow">智能分类 / 我的分组</span><h1>{group?.name}</h1><p>{group?.members.length ?? 0} 项素材 · 手动整理</p></div><div className="group-header-actions"><button type="button" className="button" onClick={() => { setEditing(value => !value); dispatch({ type: "select", ref: null }); }} aria-pressed={editing}>{editing ? <Check /> : <SlidersHorizontal />}{editing ? "完成编辑" : "编辑"}</button><button type="button" className="button primary" onClick={() => { dispatch({ type: "navigate", page: "library", tab: "overview" }); setNotice("点击素材旁的添加按钮，把灵感加入分组"); }}><Plus />添加素材</button></div></header>}

            {state.page === "search" && <>
              {explored && <div className="search-intro"><span className="eyebrow">从记得的画面，找到想用的素材</span><h1>你的灵感，<span>都有迹可循。</span></h1></div>}
              <form className={`search-command${explored ? " centered" : ""}`} onSubmit={event => { event.preventDefault(); runSearch(draft); }}>
                <div className="search-command-input"><span className="search-library-label"><FolderClosed />示例素材库</span><Search /><input ref={searchInput} aria-label="描述你想找的画面" placeholder="描述你想找的画面，例如：海边日落" value={draft} maxLength={160} onChange={event => setDraft(event.target.value)} />{(draft || state.similarId) && <button type="button" className="icon-button" aria-label="清空搜索" onClick={clearSearch}><X /></button>}<button type="button" className="image-search-button" onClick={event => control({ title: "从一张图片开始", text: "点击下方任意示例图片，或在图片详情中选择“查找相似”，即可体验示例图片搜索。在线演示不读取或上传你的图片。" }, event.currentTarget)}><Image />以图搜图</button></div>
                <button type="submit" className="button primary search-submit"><Search />搜索</button>
              </form>
              {explored ? <div className="search-discovery"><p className="search-disclaimer">仅搜索内置示例素材，试试这些画面</p><div className="query-suggestions">{sampleQueries.map(query => <button type="button" key={query} onClick={() => runSearch(query)}>{query}<ArrowRight /></button>)}</div><div className="discovery-heading"><span>从一张图片开始</span><small>点击图片，查找相似素材</small></div><div className="discovery-photos">{["mountain", "traveler", "city", "dog", "coffee"].map((id, i) => {
                const asset = assets.find(item => item.id === id); return asset ? <button type="button" key={id} className={`discovery-photo discovery-photo-${i}`} onClick={() => runSearch("", id)} aria-label={`查找相似：${asset.name}`}><Photo name={asset.photo} alt={asset.description} /><span><Image />查找相似<ArrowRight /></span></button> : null;
              })}</div><div className="discovery-footer"><span><Image />图片</span><span><Film />视频分镜</span><span><AudioLines />语音内容示例</span></div></div> : <div className="search-filterbar"><div className="type-pills">{types.map(type => <button type="button" key={type.kind} aria-pressed={state.search.kind === type.kind} className={state.search.kind === type.kind ? "selected" : ""} onClick={() => dispatch({ type: "search-filter", value: { kind: type.kind } })}><MaterialLibraryIcon kind={type.kind} />{type.label}</button>)}</div><span className="result-count" role="status">{searching ? "正在检索示例素材…" : `${results.length} 条示例结果`}</span><button type="button" className="button advanced-button" onClick={event => control("advanced", event.currentTarget)}><SlidersHorizontal />高级检索{(state.search.folder || state.search.orientation !== "all") && <i />}</button></div>}
              {!explored && (state.similarId || state.search.folder || state.search.orientation !== "all") && <div className="active-filters">{state.similarId && <button type="button" onClick={clearSearch}><Image />相似：{items.find(asset => asset.id === state.similarId)?.name}<X /></button>}{state.search.folder && <button type="button" onClick={() => dispatch({ type: "search-filter", value: { folder: "" } })}>{folders.find(folder => folder.id === state.search.folder)?.name}<X /></button>}{state.search.orientation !== "all" && <button type="button" onClick={() => dispatch({ type: "search-filter", value: { orientation: "all" } })}>{state.search.orientation === "portrait" ? "竖屏" : "横屏"}<X /></button>}</div>}
            </>}

            {!explored && <div className="gallery-scroll" ref={galleryScroll} tabIndex={-1} aria-label={isGroups ? "分组成员" : "素材结果"} aria-busy={searching && state.page === "search"}>
              {searching && state.page === "search" ? <div className="media-grid skeleton-grid" aria-label="正在加载示例结果">{Array.from({ length: 8 }, (_, i) => <div className="skeleton-card" key={i}><div /><span /><small /></div>)}</div> : galleryItems.length ? <>
                {state.page === "library" && !isGroups && <h2 className="date-heading">{state.library.folder === "imported" ? "新加入的示例" : roaming ? "发现素材里的另一种可能" : "10月23日"}</h2>}
                <div className="media-grid" key={state.page === "search" ? `search-${searchVersion}` : "library"}>{galleryItems.map((ref, index) => {
                  const asset = assetFor(ref); if (!asset) return null;
                  const result = state.page === "search" ? results.find(item => refKey(item.ref) === refKey(ref)) : undefined;
                  return <MediaCard key={refKey(ref)} item={asset} reference={ref} result={result} selected={Boolean(state.selected && refKey(state.selected) === refKey(ref))} index={index}
                    onSelect={trigger => select(ref, trigger)} onPreview={trigger => showPreview(ref, trigger)} onAdd={trigger => addToGroup(ref, trigger)}
                    onRemove={editing && isGroups && group ? () => { dispatch({ type: "remove-member", id: group.id, ref }); setNotice("已从分组移出，示例素材仍在素材库中"); } : undefined} />;
                })}</div>
                <p className="gallery-end">{state.page === "search" ? "已展示全部示例结果 · 搜索仅匹配内置素材" : "已展示全部示例素材"}</p>
              </> : <Empty title={isGroups ? "把第一份灵感放进来" : "没有找到匹配的素材"} text={isGroups ? "从素材库或搜索结果中，将图片、视频或分镜添加到这个分组。" : "换一个关键词，或清除筛选后继续探索。"}>
                <button type="button" className="button primary" onClick={() => { if (isGroups) dispatch({ type: "navigate", page: "library", tab: "overview" }); else if (state.page === "search") { dispatch({ type: "search-filter", value: { kind: "all", folder: "", orientation: "all" } }); runSearch("海边日落"); } else dispatch({ type: "library-filter", value: { kind: "all", folder: "", query: "" } }); }}>{isGroups ? "浏览素材库" : state.page === "search" ? "试试“海边日落”" : "清除筛选"}</button>
              </Empty>}
            </div>}
          </main>

          {state.selected && selectedAsset && !compactInspector && <aside className="inspector" aria-label="素材详情"><Inspector reference={state.selected} asset={selectedAsset} onClose={closeInspector} closeRef={inspectorClose} onPreview={() => { if (state.selected) showPreview(state.selected); }} onAdd={() => { if (state.selected) addToGroup(state.selected); }} onSimilar={() => { runSearch("", selectedAsset.id); }} onShot={ref => showPreview(ref)} /></aside>}
        </div>
        <footer className="desktop-statusbar"><span className="status-ready"><i />示例素材已就绪</span><span className="status-hint">{state.page === "search" ? "描述画面，发现相关素材" : isGroups ? "分组只整理关系，不改变素材" : "点击素材查看详情，点击分组按钮整理素材"}</span><div><span>{items.length} 项素材</span><span>{state.groups.length} 个分组</span><button type="button" onClick={event => control({ title: "关于在线体验", text: "这是按素刀当前开发界面制作的交互示例。所有文件名、索引、描述和搜索结果均为示例数据；视频以分镜静帧模拟动态播放，音频仅展示元信息。完整功能以下载的桌面版本为准。" }, event.currentTarget)}><Info />演示说明</button></div></footer>
      </section>
      {notice && <div className="toast" role="status"><Check />{notice}<button type="button" aria-label="关闭提示" onClick={() => setNotice("")}><X /></button></div>}
    </div>

    {!desktop && <main className="demo-fallback"><a className="fallback-brand" href="../index.html">素刀 <span>ClipKnife</span></a><span className="eyebrow">交互体验 · 示例数据</span><h1>先试着，找回一帧灵感。</h1><p>浏览素材、搜索画面、查看分镜，再把喜欢的素材放进分组。</p><div className="fallback-visual"><img src={previewUrl} width="1440" height="900" alt="素刀素材库交互演示预览" /></div><p>请在电脑上打开此页，体验完整操作。</p><a className="fallback-download" href="../index.html#download">下载 Windows 版 ↗</a></main>}

    <Modal open={desktop && compactInspector && Boolean(state.selected)} title="素材详情" description="查看示例素材信息与静帧" onClose={closeInspector} returnFocus={selectionTrigger} className="compact-inspector-dialog">
      {state.selected && selectedAsset && <Inspector reference={state.selected} asset={selectedAsset} onPreview={() => { if (state.selected) showPreview(state.selected); }} onAdd={() => { if (state.selected) addToGroup(state.selected); }} onSimilar={() => runSearch("", selectedAsset.id)} onShot={ref => showPreview(ref)} />}
    </Modal>
    <Preview reference={preview} onClose={() => setPreview(null)} suspended={Boolean(groupTarget)} onAdd={ref => addToGroup(ref)} onSimilar={id => { setPreview(null); dispatch({ type: "select", ref: null }); runSearch("", id); }} returnFocus={previewTrigger} />
    <Modal open={Boolean(groupTarget)} title="添加到分组" description="选择分组立即添加，重复添加不会产生重复成员。" onClose={() => setGroupTarget(null)} returnFocus={groupTrigger}>
      {groupTarget && <GroupPicker groups={state.groups} reference={groupTarget} create={createGroup} onAdd={id => {
        const existing = state.groups.find(group => group.id === id)?.members.some(member => refKey(member) === refKey(groupTarget));
        dispatch({ type: "add-member", id, ref: groupTarget }); setNotice(existing ? "这项素材已在分组中" : "已添加到分组，可在“智能分类”中查看");
      }} />}
    </Modal>
    <Modal open={dialog !== null} title={dialog === "import" ? "添加示例素材" : dialog === "reset" ? "重新开始体验？" : dialog === "stats" ? "素材库统计" : dialog === "advanced" ? "高级检索" : dialog === "create" ? "新建分组" : typeof dialog === "object" ? dialog?.title ?? "" : ""}
      description={dialog === "import" ? "加入一组准备好的示例照片，无需选择本机文件。" : dialog === "reset" ? "恢复初始素材、搜索条件和分组，仅重置本次演示。" : dialog === "stats" ? "根据当前示例素材计算，不代表你的设备或素材库。" : dialog === "advanced" ? "条件立即应用于当前示例结果。" : dialog === "create" ? "给这一组灵感起个名字。" : "完整功能可在桌面版中体验。"} onClose={() => setDialog(null)} returnFocus={dialogTrigger} className={dialog === "advanced" ? "advanced-dialog" : ""}>
      {dialog === "import" && <><div className="import-samples">{importAssets.map(asset => <div key={asset.id}><Photo name={asset.photo} alt={asset.description} /><span>{asset.name}</span></div>)}</div><div className="dialog-actions"><button type="button" className="button" onClick={() => setDialog(null)}>取消</button><button type="button" className="button primary" disabled={state.imported} onClick={() => { dispatch({ type: "import" }); setDialog(null); setNotice("已加入 3 项示例素材"); }}>{state.imported ? "已加入示例素材" : "添加 3 项示例素材"}</button></div></>}
      {dialog === "reset" && <div className="dialog-actions"><button type="button" className="button" onClick={() => setDialog(null)}>继续体验</button><button type="button" className="button primary" onClick={reset}>重置演示</button></div>}
      {dialog === "stats" && <div className="stats-grid">{types.map(type => <div key={type.kind}><MaterialLibraryIcon kind={type.kind} /><span>{type.label === "全部" ? "全部素材" : type.label}</span><strong>{countByKind(type.kind)}</strong></div>)}</div>}
      {dialog === "advanced" && <><div className="advanced-fields"><label>素材来源<Choice label="素材来源" value={state.search.folder} onChange={folder => dispatch({ type: "search-filter", value: { folder } })} options={[{ value: "", label: "全部来源" }, ...folders.filter(folder => !folder.parent && (folder.id !== "imported" || state.imported)).map(folder => ({ value: folder.id, label: folder.name }))]} /></label><label>画面方向<Choice label="画面方向" value={state.search.orientation} onChange={orientation => { if (orientation === "all" || orientation === "landscape" || orientation === "portrait") dispatch({ type: "search-filter", value: { orientation } }); }} options={[{ value: "all", label: "不限方向" }, { value: "landscape", label: "横屏" }, { value: "portrait", label: "竖屏" }]} /></label></div><p className="inline-note"><Info />示例搜索按内容相关性排列，不运行真实模型推理。</p><div className="dialog-actions"><button type="button" className="button" onClick={() => dispatch({ type: "search-filter", value: { folder: "", orientation: "all", kind: "all" } })}>清除条件</button><button type="button" className="button primary" onClick={() => setDialog(null)}>完成</button></div></>}
      {dialog === "create" && <GroupForm limit={state.groups.length >= 20} onCreate={name => { const id = createGroup(name); if (id) { dispatch({ type: "select-group", id }); setDialog(null); setNotice("分组已创建"); } }} />}
      {typeof dialog === "object" && dialog && <><p className="info-description">{dialog.text}</p>{dialog.title === "从一张图片开始" && <div className="sample-picker">{assets.filter(asset => ["mountain", "traveler", "coffee", "dog"].includes(asset.id)).map(asset => <button type="button" key={asset.id} onClick={() => { setDialog(null); runSearch("", asset.id); }}><Photo name={asset.photo} alt={asset.name} /><span>{asset.name}</span></button>)}</div>}<div className="dialog-actions"><button type="button" className="button" onClick={() => setDialog(null)}>继续体验</button><a className="button primary" href="../index.html#download" target={embed ? "_top" : undefined}>下载桌面版<ArrowRight /></a></div></>}
    </Modal>
  </>;
}

function LibrarySidebar({ state, items, dispatch, onClose }: { state: DemoState; items: DemoAsset[]; dispatch: Dispatch<Action>; onClose?: () => void }) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(new Set(["travel"]));
  const folderCount = (id: string) => items.filter(asset => inFolder(asset, id)).length;
  function toggle(id: string) { setExpanded(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  return <><section className="type-section"><div className="sidebar-section-title"><span>素材类型</span>{onClose && <button type="button" className="icon-button" aria-label="收起筛选与目录" onClick={onClose}><PanelLeftClose /></button>}</div><div className="type-grid">{types.map(type => <button type="button" key={type.kind} aria-pressed={state.library.kind === type.kind} className={state.library.kind === type.kind ? "selected" : ""} onClick={() => dispatch({ type: "library-filter", value: { kind: type.kind } })}><MaterialLibraryIcon kind={type.kind} /><span>{type.label}</span><small>{items.filter(asset => type.kind === "all" || asset.kind === type.kind).length}</small></button>)}</div></section>
    <section className="folder-section"><div className="sidebar-section-title"><span>文件夹</span><span className="folder-count">{items.length} 项</span></div><div className="search-field folder-query"><Search /><input aria-label="查找文件夹" placeholder="查找文件夹" value={query} maxLength={60} onChange={event => setQuery(event.target.value)} />{query && <button type="button" className="icon-button" aria-label="清除目录查询" onClick={() => setQuery("")}><X /></button>}</div>
      <button type="button" className={`folder-row${!state.library.folder ? " selected" : ""}`} aria-pressed={!state.library.folder} onClick={() => dispatch({ type: "library-filter", value: { folder: "" } })}><FolderOpen /><span>全部素材</span><small>{items.length}</small></button>
      <div className="folder-tree" aria-label="示例文件夹">{folders.filter(folder => folder.id !== "imported" || state.imported).filter(folder => query ? folder.name.includes(query.trim()) : !folder.parent || expanded.has(folder.parent)).map(folder => {
        const branch = folders.some(item => item.parent === folder.id);
        return <div key={folder.id} className={`tree-row${state.library.folder === folder.id ? " selected" : ""}`} style={{ paddingLeft: folder.parent && !query ? 25 : 0 }}>
          {branch ? <button type="button" className="tree-toggle" aria-label={`${expanded.has(folder.id) ? "收起" : "展开"}${folder.name}`} aria-expanded={expanded.has(folder.id)} onClick={() => toggle(folder.id)}><ChevronRight className={expanded.has(folder.id) ? "expanded" : ""} /></button> : <span className="tree-spacer" />}
          <button type="button" className="folder-row" aria-pressed={state.library.folder === folder.id} onClick={() => { dispatch({ type: "library-filter", value: { folder: folder.id } }); if (branch) toggle(folder.id); }}><MaterialLibraryIcon kind="folder" /><span>{folder.name}</span><small>{folderCount(folder.id)}</small></button>
        </div>;
      })}{query && !folders.some(folder => (folder.id !== "imported" || state.imported) && folder.name.includes(query.trim())) && <p className="folder-empty">没有匹配的文件夹</p>}</div>
    </section><div className="sidebar-bottom"><span className="tiny-dot" />内置示例素材库<span>本页体验</span></div></>;
}

function MediaCard({ item, reference, selected, result, index, onSelect, onPreview, onAdd, onRemove }: {
  item: DemoAsset; reference: MediaRef; selected: boolean; result?: SearchResult; index: number;
  onSelect: (trigger: HTMLElement) => void; onPreview: (trigger: HTMLElement) => void; onAdd: (trigger: HTMLElement) => void; onRemove?: () => void;
}) {
  const shot = shotFor(reference);
  return <article className={`media-card${selected ? " is-selected" : ""}`} data-asset={item.id} data-ref={refKey(reference)} style={{ animationDelay: `${Math.min(index, 8) * 22}ms` }}>
    <div className={`media-visual${item.height > item.width ? " portrait" : ""}${item.kind === "audio" ? " audio-visual" : ""}`}>
      {item.kind === "audio" ? <AudioArt /> : <Photo key={`${item.id}-${shot?.id ?? ""}`} name={shot?.photo ?? item.photo} alt={shot?.description ?? item.description} eager={index < 8} />}
      <button type="button" className="tile-hit" onClick={event => onSelect(event.currentTarget)} aria-label={`查看详情：${item.name}`} aria-pressed={selected} />
      {item.kind !== "image" && <span className="duration-badge">{item.kind === "audio" ? <AudioLines /> : <Film />}{shot ? `${timeLabel(shot.start)}–${timeLabel(shot.end)}` : timeLabel(item.duration)}</span>}
      <button type="button" className="preview-button" aria-label={`预览：${item.name}`} onClick={event => onPreview(event.currentTarget)}>{item.kind === "video" ? <Play /> : <Expand />}{item.kind === "video" ? "播放演示" : "预览"}</button>
      {selected && <span className="selection-check"><Check /></span>}
    </div>
    <div className="media-caption"><button type="button" className="file-title" title={item.name} onClick={event => onSelect(event.currentTarget)}>{item.name}</button>{onRemove ? <button type="button" className="card-action remove-member" aria-label={`从分组移出：${item.name}`} onClick={onRemove}><Trash2 /></button> : <button type="button" className="card-action" aria-label={`添加到分组：${item.name}`} onClick={event => onAdd(event.currentTarget)}><FolderPlus /></button>}</div>
    <div className="media-meta">{shot ? `分镜 ${item.shots.indexOf(shot) + 1} · ${timeLabel(shot.start)} – ${timeLabel(shot.end)}` : item.kind === "audio" ? `${item.size} · 音频示例` : `${item.width} × ${item.height} · ${item.size}`}</div>
    {result && <div className="match-evidence"><span>{result.reason}</span><p title={result.evidence}>{result.evidence}</p></div>}
  </article>;
}
function AudioArt() { return <div className="audio-art"><span><Music2 /></span><svg viewBox="0 0 160 46" aria-hidden="true">{Array.from({ length: 40 }, (_, i) => { const height = 8 + (i * 17 % 29); return <rect key={i} x={i * 4} y={(46 - height) / 2} width="2" height={height} rx="1" />; })}</svg></div>; }

function Inspector({ reference, asset, onClose, closeRef, onPreview, onAdd, onSimilar, onShot }: {
  reference: MediaRef; asset: DemoAsset; onClose?: () => void; closeRef?: RefObject<HTMLButtonElement | null>;
  onPreview: () => void; onAdd: () => void; onSimilar: () => void; onShot: (ref: MediaRef) => void;
}) {
  const shot = shotFor(reference);
  return <><div className="inspector-title"><span>素材详情</span>{onClose && <button ref={closeRef} type="button" className="icon-button" aria-label="关闭素材详情" onClick={onClose}><X /></button>}</div><div className="inspector-scroll">
    <div className="inspector-preview">{asset.kind === "audio" ? <AudioArt /> : <Photo key={asset.id} name={shot?.photo ?? asset.photo} alt={asset.description} full retry />}<button type="button" onClick={onPreview} className="button preview-inspector">{asset.kind === "video" ? <Play /> : <Expand />}{asset.kind === "video" ? "播放视频演示" : asset.kind === "audio" ? "查看音频信息" : "放大预览"}</button></div>
    <div className="inspector-name"><h2>{asset.name}</h2><span className="indexed"><Check />示例已索引</span></div>
    <dl className="file-information"><div><dt>类型</dt><dd>{kindLabel(asset.kind)}</dd></div>{asset.kind !== "audio" && <div><dt>分辨率</dt><dd>{asset.width} × {asset.height}</dd></div>}<div><dt>大小</dt><dd>{asset.size}</dd></div>{asset.duration > 0 && <div><dt>时长</dt><dd>{timeLabel(asset.duration)}</dd></div>}<div><dt>所在目录</dt><dd>{folders.find(folder => folder.id === asset.folder)?.name}</dd></div></dl>
    <section className="inspector-section"><h3><Tag />自定义标签</h3><div className="tags">{asset.tags.map(tag => <span key={tag}>{tag}</span>)}</div></section>
    <section className="inspector-section"><h3><Sparkles />{asset.kind === "audio" ? "内容说明" : "画面描述"}<small>示例</small></h3><p>{shot?.description ?? asset.description}</p></section>
    {asset.shots.length > 0 && <section className="inspector-section"><h3><Film />视频分镜<small>{asset.shots.length} 个 · 静帧</small></h3><div className="inspector-shots">{asset.shots.map((item, i) => <button type="button" key={item.id} className="inspector-shot" onClick={() => onShot({ assetId: asset.id, shotId: item.id })}><Photo name={item.photo} alt={`分镜 ${i + 1}：${item.description}`} /><span><strong>分镜 {String(i + 1).padStart(2, "0")}</strong><small>{timeLabel(item.start)} – {timeLabel(item.end)}</small></span><ChevronRight /></button>)}</div></section>}
    {asset.kind === "audio" && <p className="inline-note"><Info />在线演示仅展示音频信息，不播放音频。</p>}
  </div><footer className="inspector-actions"><button type="button" className="button primary" onClick={onAdd}><FolderPlus />添加到分组</button>{asset.kind !== "audio" && <button type="button" className="button" onClick={onSimilar}><Search />查找相似</button>}</footer></>;
}

function Preview({ reference, suspended, onClose, onAdd, onSimilar, returnFocus }: {
  reference: MediaRef | null; suspended: boolean; onClose: () => void; onAdd: (ref: MediaRef) => void;
  onSimilar: (id: string) => void; returnFocus: RefObject<HTMLElement | null>;
}) {
  const asset = reference ? assetFor(reference) : undefined;
  const [zoom, setZoom] = useState(false);
  useEffect(() => setZoom(false), [reference?.assetId]);
  return <Modal open={Boolean(asset)} title={asset?.name ?? "素材预览"} description={asset?.kind === "video"
    ? "动态演示 · 播放、拖动进度或选择分镜" : asset?.kind === "audio" ? "音频元信息示例，不播放音频" : "示例图片预览"}
    onClose={onClose} returnFocus={returnFocus} className={`preview-dialog${asset?.kind === "audio" ? " audio-dialog" : ""}`}>
    {asset && reference && (asset.kind === "video" ? <VideoPreview key={`${asset.id}:${reference.shotId ?? ""}`} asset={asset}
      initialShotId={reference.shotId} suspended={suspended} onAdd={onAdd} onSimilar={onSimilar} /> : <>
      <div className="preview-workspace"><div className="preview-main">
        <div className={`preview-stage${zoom ? " zoomed" : ""}`}>{asset.kind === "audio" ? <AudioArt /> : <Photo key={asset.id} name={asset.photo} alt={asset.description} full eager retry />}</div>
        <div className="preview-controls">{asset.kind === "image" ? <><span>{asset.width} × {asset.height} · {asset.size}</span>
          <button type="button" className="text-button" aria-pressed={zoom} onClick={() => setZoom(value => !value)}><Maximize2 />{zoom ? "适应窗口" : "放大查看"}</button></>
          : <span>{timeLabel(asset.duration)} · {asset.size} · 音频示例</span>}</div>
        <div className="preview-description"><span>{asset.kind === "audio" ? "内容说明" : "画面描述"}</span><p>{asset.description}</p></div>
      </div></div>
      <footer className="preview-footer"><span><Info />示例素材，不读取本机文件</span><div>
        {asset.kind !== "audio" && <button type="button" className="button" onClick={() => onSimilar(asset.id)}><Search />查找相似</button>}
        <button type="button" className="button primary" onClick={() => onAdd(reference)}><FolderPlus />添加到分组</button>
      </div></footer>
    </>)}
  </Modal>;
}
function GroupPicker({ groups, reference, create, onAdd }: { groups: DemoGroup[]; reference: MediaRef; create: (name: string) => string | null; onAdd: (id: string) => void }) {
  const [creating, setCreating] = useState(false);
  useEffect(() => setCreating(false), [reference]);
  return <><div className="group-picker">{groups.map(group => { const exists = group.members.some(member => refKey(member) === refKey(reference)); return <button type="button" key={group.id} onClick={() => onAdd(group.id)} aria-label={`${exists ? "已在分组" : "添加到"}：${group.name}`}><MaterialLibraryIcon kind="folder" /><span><strong>{group.name}</strong><small>{group.members.length} 项素材</small></span>{exists ? <span className="group-added"><Check />已添加</span> : <Plus />}</button>; })}</div>{creating ? <GroupForm limit={groups.length >= 20} onCreate={name => { const id = create(name); if (id) { onAdd(id); setCreating(false); } }} /> : <button type="button" className="button new-group-picker" onClick={() => setCreating(true)}><Plus />新建分组并添加</button>}</>;
}
function GroupForm({ onCreate, limit }: { onCreate: (name: string) => void; limit: boolean }) {
  const [name, setName] = useState("");
  return <form className="group-form" onSubmit={event => { event.preventDefault(); if (name.trim() && !limit) onCreate(name.trim()); }}><label>分组名称<input autoFocus value={name} maxLength={60} placeholder="例如：下一支旅行短片" onChange={event => setName(event.target.value)} /></label>{limit && <p role="status" className="inline-note">演示最多创建 20 个分组，可以重置后重新体验。</p>}<button type="submit" className="button primary" disabled={!name.trim() || limit}><Plus />创建分组</button></form>;
}
