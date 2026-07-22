export type IngredientCategory =
  | 'base'
  | 'liqueur'
  | 'citrus'
  | 'mixer'
  | 'sweetener'
  | 'garnish'
  | 'tool';

export type Ingredient = {
  id: string;
  name: string;
  category: IngredientCategory;
  isSelected?: boolean;
};

export type CocktailIngredient = Ingredient & {
  amount: string;
};

export type CocktailRecipe = {
  id: string;
  name: string;
  englishName: string;
  description: string;
  tags: string[];
  ingredients: CocktailIngredient[];
  steps: string[];
  imageKey: string;
  difficulty: '入门' | '进阶' | '专业';
  prepMinutes: number;
};

export type RecommendationInput = {
  prompt: string;
  selectedIngredientIds: string[];
};

export type RecommendationResult = {
  message: string;
  recipes: CocktailRecipe[];
};

export type HeroSlide = {
  id: string;
  brand: string;
  title: string;
  subtitle: string;
  scriptLabel: string;
  ctaLabel: string;
  imageKey: string;
};

export type HomeShortcut = {
  id: 'blind-box' | 'drink-knowledge' | 'classic-series' | 'shared-cellar';
  title: string;
  description: string;
  icon: 'box' | 'book' | 'cards' | 'cellar';
  route: string;
};

export type FeedCategory = 'recommended' | 'following' | 'nearby';

export type CommunityComment = {
  id: string;
  authorName: string;
  authorAvatarKey: string;
  text: string;
  date: string;
};

// 笔记图片：asset = 内置图库 key；uri = 相册上传的本地 uri
export type PostImage =
  | { id: string; kind: 'asset'; assetKey: string }
  | { id: string; kind: 'uri'; uri: string };

export type PostVisibility = 'public' | 'private';

export type CommunityPost = {
  id: string;
  category: FeedCategory;
  title: string;
  authorId: string;
  authorName: string;
  authorAvatarKey: string;
  // 封面图（冗余字段：取 images 第一张 asset 图或兜底图，保证旧数据/瀑布流渲染简单）
  imageKey: string;
  body: string;
  date: string;
  likes: number;
  comments: CommunityComment[];
  venueId?: string;
  // 多图（含上传 uri），空表示单封面图
  images?: PostImage[];
  // 话题标签（不含 # 前缀）
  topics?: string[];
  // 可见性，缺省视为 public
  visibility?: PostVisibility;
  // 缺省视为 true
  allowComments?: boolean;
};

// 发布页草稿（本地持久化）
export type PostDraft = {
  title: string;
  body: string;
  images: PostImage[];
  topics: string[];
  venueId?: string;
  visibility: PostVisibility;
  allowComments: boolean;
  savedAt: string; // ISO date
};

export type BarMenuItem = {
  id: string;
  name: string;
  imageKey: string;
  likes: number;
  badge?: string;
};

export type BarReview = {
  id: string;
  authorName: string;
  authorAvatarKey: string;
  text: string;
  date: string;
  likes: number;
  imageKeys?: string[];
};

export type BarVenue = {
  id: string;
  name: string;
  imageKey: string;
  rating: number;
  reviewCount: number;
  averageSpend: number;
  distanceLabel: string;
  metroHint: string;
  address: string;
  openHours: string;
  description: string;
  tags: string[];
  tasteScore: number;
  environmentScore: number;
  serviceScore: number;
  phone: string;
  menu: BarMenuItem[];
  reviews: BarReview[];
};

export type SharedCellarCard = {
  id: string;
  name: string;
  englishName: string;
  imageKey: string;
  authorName: string;
  likes: number;
  comments: number;
  borderColor: string;
  ingredients: CocktailIngredient[];
  steps: string[];
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  recipeIds?: string[];
};

export type LocalInteractionState = {
  likedPostIds: string[];
  followedAuthorIds: string[];
  likedCellarCardIds: string[];
  favoriteVenueIds: string[];
  // 本地新增的社区帖子（用户自己发布的）
  localCommunityPosts: CommunityPost[];
  // 本地新增的帖子评论 { postId: comments[] }
  localPostComments: Record<string, CommunityComment[]>;
  // 搜索历史
  searchHistory: string[];
  // 经典盲盒：当天已抽日期（YYYY-MM-DD），null 表示今天还没抽
  lastDrawDate: string | null;
  // 抽卡历史
  drawnCards: DrawnCardRecord[];
};

export type PrivacySettings = {
  localOnlyMode: boolean;
  analyticsOptIn: boolean;
  syncWhenLoggedIn: boolean;
};

export type LocalState = {
  ageVerified: boolean;
  cellarIngredientIds: string[];
  privacySettings: PrivacySettings;
};

// 经典盲盒抽卡
export type CardRarity = 'common' | 'rare' | 'legendary';

export type BlindBoxCard = {
  id: string;
  recipeId: string;
  rarity: CardRarity;
  // 展示数据（从 recipe 派生，冗余存储便于分享/历史）
  name: string;
  englishName: string;
  bartender: string;
  imageKey: string;
  ingredients: CocktailIngredient[];
  steps: string[];
};

export type DrawnCardRecord = {
  card: BlindBoxCard;
  drawnAt: string; // ISO date
};

// 用户资料（本地身份，未来可映射到后端账号）
export type UserProfile = {
  nickname: string; // ≤16 字
  avatarKey: string; // 预设头像 key，avatarUri 为空时的回退
  avatarUri: string | null; // 相册上传的本地 uri，优先于 avatarKey
  signature: string; // ≤60 字
  city: string; // ≤12 字
};

// 酒品知识（寓意与故事，区别于酒单的风味描述）
export type DrinkKnowledgeEntry = {
  id: string;
  recipeId?: string;
  name: string;
  englishName: string;
  imageKey: string;
  // 年代与发源地，如 '1948 · 墨西哥阿卡普尔科'
  era: string;
  // 寓意（一句话点题）
  meaning: string;
  // 起源故事
  story: string;
  // 象征标签
  symbols: string[];
};

// 搜索相关
export type SearchResultType = 'recipe' | 'venue' | 'post';

export type SearchResult = {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  imageKey: string;
};
