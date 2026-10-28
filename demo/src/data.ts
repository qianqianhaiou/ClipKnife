import type { DemoAsset, DemoShot, Folder } from "./types";

export const folders: Folder[] = [
  { id: "travel", name: "旅行影像" },
  { id: "travel/coast", name: "海岸日记", parent: "travel" },
  { id: "travel/mountains", name: "山野之间", parent: "travel" },
  { id: "city", name: "城市漫游" },
  { id: "daily", name: "生活片刻" },
  { id: "nature", name: "自然观察" },
  { id: "audio", name: "声音素材" },
  { id: "imported", name: "新加入的示例" },
];

type Row = [id: string, name: string, kind: DemoAsset["kind"], photo: string, folder: string, tags: string[], description: string, duration?: number];
const rows: Row[] = [
  ["coast-film", "海边日落.mp4", "video", "sunset", "travel/coast", ["海边", "日落", "海浪", "旅行"], "夕阳落在海平面上，金色海浪缓缓涌向沙滩，远处礁石勾勒出安静的海岸线。", 48],
  ["street-film", "雨后街景.mp4", "video", "street", "city", ["城市", "雨夜", "街道", "灯光"], "雨后的石板路映着橱窗的暖色灯光，蓝调时刻的城市街道格外安静。", 36],
  ["architecture", "白色美术馆.jpg", "image", "architecture", "city", ["建筑", "几何", "蓝天"], "白色混凝土建筑的几何切面与深蓝天空形成对比，阳光留下利落的阴影。"],
  ["ceramic-film", "陶器与光.mp4", "video", "ceramic", "daily", ["陶器", "静物", "室内", "光影"], "窗边暖光落在手作陶器与亚麻布上，细腻的表面纹理构成安静的生活片刻。", 24],
  ["forest-film", "林间光影.mp4", "video", "forest", "nature", ["森林", "绿植", "阳光", "小径"], "午后的阳光穿过高大的树木，照亮蕨类植物和蜿蜒的林间小径。", 32],
  ["coffee", "一杯拿铁.jpg", "image", "coffee", "daily", ["咖啡", "特写", "室内", "生活"], "一杯热拿铁放在木桌上，细腻的奶泡拉花与温暖的咖啡馆光线相互呼应。"],
  ["mountain", "山脊的清晨.jpg", "image", "mountain", "travel/mountains", ["雪山", "山脉", "日出", "旅行"], "清晨的光线照亮远处的雪山和连绵山脊，天空辽阔，山谷层次分明。"],
  ["piano", "午后钢琴.wav", "audio", "", "audio", ["钢琴", "音乐", "轻柔"], "轻柔的钢琴旋律，适合旅行短片和安静的生活记录。此处展示音频元信息示例。", 156],
  ["traveler", "沿着海岸走.jpg", "image", "traveler", "travel/coast", ["海边", "日落", "人物", "行走", "旅行"], "一位穿浅色衣服的旅行者背对镜头沿着海岸行走，夕阳把身影与浪花染成金色。"],
  ["dog", "草地上的小狗.jpg", "image", "dog", "daily", ["小狗", "宠物", "草地", "动物"], "一只小狗在柔和的自然光下看向镜头，背景是安静的户外草地。"],
  ["maple", "秋日红叶.jpg", "image", "maple", "nature", ["秋天", "枫叶", "红色", "特写"], "秋日阳光穿透橙红色的枫叶，叶脉清晰，背景化作柔和的色彩。"],
  ["city", "城市的蓝调时刻.jpg", "image", "city", "city", ["城市", "夜景", "灯光", "建筑"], "城市在蓝调时刻亮起灯光，建筑与街道留下流动而温暖的生活气息。"],
  ["shore", "海岸线.jpg", "image", "coast", "travel/coast", ["海边", "海岸", "礁石", "旅行"], "沿着海岸延伸的礁石和开阔海面，记录旅行途中片刻的宁静。"],
  ["coast-walk", "海岸漫步_竖版.mp4", "video", "traveler", "travel/coast", ["海边", "人物", "行走", "日落"], "旅行者沿着夕阳下的沙滩漫步，海浪在脚边起伏。", 48],
  ["latte-film", "咖啡馆午后.mp4", "video", "coffee", "daily", ["咖啡", "特写", "室内", "生活"], "咖啡特写与手作陶器串联起一个慢下来的午后。", 24],
  ["pine", "森林深处.jpg", "image", "forest", "nature", ["森林", "绿植", "小径", "自然"], "树林中的小径延伸向光线深处，苔藓和蕨类植物铺满地面。"],
  ["white-wall", "建筑的光与影.jpg", "image", "architecture", "city", ["建筑", "白色", "光影", "几何"], "白色建筑的不同切面呈现丰富明暗关系，蓝天留出清晰的负空间。"],
  ["sunset-photo", "落日海湾.jpg", "image", "sunset", "travel/coast", ["海边", "日落", "海浪", "金色"], "金色夕阳映在海面，海浪轻轻越过礁石，远处的海湾逐渐融入暮色。"],
  ["autumn-film", "秋色小记.mp4", "video", "maple", "nature", ["秋天", "枫叶", "森林", "特写"], "透光的枫叶与林间小径构成一组秋天的自然影像。", 32],
  ["vase", "窗边花器.jpg", "image", "ceramic", "daily", ["陶器", "静物", "室内", "光影"], "粗粝的陶土、细腻的亚麻与稀疏的枝条，在窗边形成柔和的明暗关系。"],
  ["mountain-film", "远山与林海.mp4", "video", "mountain", "travel/mountains", ["雪山", "山脉", "森林", "旅行"], "远山的壮阔与林间的静谧，组成一次山野旅行的视觉记录。", 32],
  ["night-rain", "街角的暖光.jpg", "image", "street", "city", ["城市", "雨夜", "街道", "灯光"], "雨后街角的橱窗亮着暖光，湿润路面映出蓝色天空与金色灯影。"],
  ["voice", "海边旅行旁白.wav", "audio", "", "audio", ["海边", "旅行", "旁白", "日落"], "沿着海岸一直走，直到看见落日。把今天的风和浪，留在这一帧画面里。", 42],
  ["dog-portrait", "小狗肖像_竖幅.jpg", "image", "dog", "daily", ["小狗", "宠物", "肖像", "动物"], "柔和自然光下的小狗肖像，捕捉一个专注而好奇的表情。"],
];
const frames: Record<string, string[]> = {
  "coast-film": ["sunset", "traveler", "coast", "sunset"],
  "coast-walk": ["traveler", "sunset", "coast", "traveler"],
  "street-film": ["street", "city", "architecture", "street"],
  "ceramic-film": ["ceramic", "coffee", "ceramic"],
  "latte-film": ["coffee", "ceramic", "coffee"],
  "forest-film": ["forest", "mountain", "maple", "forest"],
  "autumn-film": ["maple", "forest", "maple", "forest"],
  "mountain-film": ["mountain", "forest", "mountain", "forest"],
};
const shotDescriptions: Record<string, string> = {
  sunset: "金色落日映在海面，海浪涌向岸边。", traveler: "人物沿着夕阳下的海岸缓缓行走。", coast: "海岸礁石与开阔的海面。",
  street: "雨后街道映着温暖的灯光。", city: "城市在蓝调时刻亮起灯光。", architecture: "白色建筑与蓝天的几何构图。",
  ceramic: "侧光勾勒出手作陶器的纹理。", coffee: "咖啡拉花与木桌的暖色特写。", forest: "阳光穿过树林，照亮林间小径。",
  mountain: "辽阔山脊在清晨的光线中展开。", maple: "阳光下的橙红色枫叶特写。",
};
function asset(row: Row, index: number): DemoAsset {
  const [id, name, kind, photo, folder, tags, description, duration = 0] = row;
  const sequence = frames[id] ?? [];
  const shots: DemoShot[] = sequence.map((frame, i) => ({ id: `${id}-shot-${i + 1}`, photo: frame,
    start: duration / sequence.length * i, end: duration / sequence.length * (i + 1), description: shotDescriptions[frame] ?? description }));
  const portrait = id === "coast-walk" || id === "dog-portrait";
  return { id, name, kind, photo, folder, tags, description, duration, shots,
    width: kind === "audio" ? 0 : portrait ? 1080 : 1920,
    height: kind === "audio" ? 0 : portrait ? 1920 : 1080,
    size: kind === "video" ? `${48 + index * 3}.6 MB` : kind === "audio" ? "12.8 MB" : `${4 + index % 6}.2 MB`,
    date: index < 12 ? "2026-10-23" : "2026-10-21" };
}
export const assets: DemoAsset[] = rows.map(asset);
const importRows: Row[] = [
  ["new-coast", "海岸旅行_补充.jpg", "image", "coast", "imported", ["海边", "旅行"], "新加入示例包中的海岸风景。"],
  ["new-coffee", "咖啡时刻_补充.jpg", "image", "coffee", "imported", ["咖啡", "生活"], "新加入示例包中的咖啡特写。"],
  ["new-maple", "秋日_补充.jpg", "image", "maple", "imported", ["秋天", "枫叶"], "新加入示例包中的秋日红叶。"],
];
export const importAssets: DemoAsset[] = importRows.map((row, i) => ({ ...asset(row, i), imported: true, date: "2026-10-24" }));
export const allAssets = [...assets, ...importAssets];
export const sampleQueries = ["海边日落", "雨夜街道", "咖啡特写"];
