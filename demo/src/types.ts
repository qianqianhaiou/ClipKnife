export type MediaKind = "image" | "video" | "audio";
export type MediaFilter = MediaKind | "all";
export type Orientation = "all" | "landscape" | "portrait";
export interface DemoShot {
  id: string;
  start: number;
  end: number;
  photo: string;
  description: string;
}
export interface DemoAsset {
  id: string;
  name: string;
  kind: MediaKind;
  photo: string;
  folder: string;
  width: number;
  height: number;
  size: string;
  duration: number;
  date: string;
  tags: string[];
  description: string;
  shots: DemoShot[];
  imported?: boolean;
}
export interface MediaRef { assetId: string; shotId?: string }
export interface DemoGroup { id: string; name: string; members: MediaRef[] }
export interface LibraryFilter { kind: MediaFilter; folder: string; query: string }
export interface SearchFilter { kind: MediaFilter; folder: string; orientation: Orientation }
export interface DemoState {
  version: 1;
  page: "library" | "search";
  libraryTab: "overview" | "groups";
  library: LibraryFilter;
  search: SearchFilter;
  query: string;
  similarId: string | null;
  imported: boolean;
  groups: DemoGroup[];
  groupId: string;
  sidebarOpen: boolean;
  selected: MediaRef | null;
}
export interface SearchResult { ref: MediaRef; asset: DemoAsset; score: number; reason: string; evidence: string }
export interface Folder { id: string; name: string; parent?: string }
