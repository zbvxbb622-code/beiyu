import { LinearGradient } from 'expo-linear-gradient';
import { type Href, useRouter } from 'expo-router';
import { Camera, ChevronLeft, ChevronRight, MapPin, Search } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { ScreenShell } from '@/components/mixology/ScreenShell';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getImageAsset } from '@/data/imageAssets';
import { pickAvatarFromLibrary } from '@/services/avatarPickerService';
import { useMixology } from '@/state/MixologyState';
import { colors, radii, spacing } from '@/styles/mixologyTheme';
import type { UserProfile } from '@/types/mixology';
import { resolveAvatarSource } from '@/utils/profileFeed';

type RowProps = {
  label: string;
  value?: string | null;
  placeholder?: string;
  onPress?: () => void;
  inputProps?: TextInputProps;
  last?: boolean;
  testID?: string;
};

function ProfileRow({ label, value, placeholder, onPress, inputProps, last, testID }: RowProps) {
  const isInput = !!inputProps;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, last ? null : styles.rowBorder]}
      testID={testID}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValueWrap}>
        {isInput ? (
          <TextInput
            {...inputProps}
            style={styles.rowInput}
            placeholderTextColor={colors.textMuted}
          />
        ) : (
          <Text style={[styles.rowValue, !value && styles.rowPlaceholder]} numberOfLines={1}>
            {value || placeholder}
          </Text>
        )}
      </View>
      {onPress ? <ChevronRight color={colors.textMuted} size={18} /> : null}
    </Pressable>
  );
}

function ProfileGroup({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.group, style]}>{children}</View>;
}

function GroupTitle({ text }: { text: string }) {
  return <Text style={styles.groupTitle}>{text}</Text>;
}

const GENDER_OPTIONS = ['男', '女', '保密'];

const CITIES = [
  // 直辖市
  '北京', '上海', '天津', '重庆',
  // 河北
  '石家庄', '唐山', '秦皇岛', '邯郸', '邢台', '保定', '张家口', '承德', '沧州', '廊坊', '衡水',
  // 山西
  '太原', '大同', '阳泉', '长治', '晋城', '朔州', '晋中', '运城', '忻州', '临汾', '吕梁',
  // 内蒙古
  '呼和浩特', '包头', '乌海', '赤峰', '通辽', '鄂尔多斯', '呼伦贝尔', '巴彦淖尔', '乌兰察布', '兴安盟', '锡林郭勒盟', '阿拉善盟',
  // 辽宁
  '沈阳', '大连', '鞍山', '抚顺', '本溪', '丹东', '锦州', '营口', '阜新', '辽阳', '盘锦', '铁岭', '朝阳', '葫芦岛',
  // 吉林
  '长春', '吉林', '四平', '辽源', '通化', '白山', '松原', '白城', '延边朝鲜族自治州',
  // 黑龙江
  '哈尔滨', '齐齐哈尔', '鸡西', '鹤岗', '双鸭山', '大庆', '伊春', '佳木斯', '七台河', '牡丹江', '黑河', '绥化', '大兴安岭地区',
  // 江苏
  '南京', '无锡', '徐州', '常州', '苏州', '南通', '连云港', '淮安', '盐城', '扬州', '镇江', '泰州', '宿迁',
  // 浙江
  '杭州', '宁波', '温州', '嘉兴', '湖州', '绍兴', '金华', '衢州', '舟山', '台州', '丽水',
  // 安徽
  '合肥', '芜湖', '蚌埠', '淮南', '马鞍山', '淮北', '铜陵', '安庆', '黄山', '滁州', '阜阳', '宿州', '六安', '亳州', '池州', '宣城',
  // 福建
  '福州', '厦门', '莆田', '三明', '泉州', '漳州', '南平', '龙岩', '宁德',
  // 江西
  '南昌', '景德镇', '萍乡', '九江', '新余', '鹰潭', '赣州', '吉安', '宜春', '抚州', '上饶',
  // 山东
  '济南', '青岛', '淄博', '枣庄', '东营', '烟台', '潍坊', '济宁', '泰安', '威海', '日照', '临沂', '德州', '聊城', '滨州', '菏泽',
  // 河南
  '郑州', '开封', '洛阳', '平顶山', '安阳', '鹤壁', '新乡', '焦作', '濮阳', '许昌', '漯河', '三门峡', '南阳', '商丘', '信阳', '周口', '驻马店', '济源',
  // 湖北
  '武汉', '黄石', '十堰', '宜昌', '襄阳', '鄂州', '荆门', '孝感', '荆州', '黄冈', '咸宁', '随州', '恩施土家族苗族自治州', '神农架林区',
  // 湖南
  '长沙', '株洲', '湘潭', '衡阳', '邵阳', '岳阳', '常德', '张家界', '益阳', '郴州', '永州', '怀化', '娄底', '湘西土家族苗族自治州',
  // 广东
  '广州', '韶关', '深圳', '珠海', '汕头', '佛山', '江门', '湛江', '茂名', '肇庆', '惠州', '梅州', '汕尾', '河源', '阳江', '清远', '东莞', '中山', '潮州', '揭阳', '云浮',
  // 广西
  '南宁', '柳州', '桂林', '梧州', '北海', '防城港', '钦州', '贵港', '玉林', '百色', '贺州', '河池', '来宾', '崇左',
  // 海南
  '海口', '三亚', '三沙', '儋州', '五指山', '琼海', '文昌', '万宁', '东方',
  // 四川
  '成都', '自贡', '攀枝花', '泸州', '德阳', '绵阳', '广元', '遂宁', '内江', '乐山', '南充', '眉山', '宜宾', '广安', '达州', '雅安', '巴中', '资阳', '阿坝藏族羌族自治州', '甘孜藏族自治州', '凉山彝族自治州',
  // 贵州
  '贵阳', '六盘水', '遵义', '安顺', '毕节', '铜仁', '黔西南布依族苗族自治州', '黔东南苗族侗族自治州', '黔南布依族苗族自治州',
  // 云南
  '昆明', '曲靖', '玉溪', '保山', '昭通', '丽江', '普洱', '临沧', '楚雄彝族自治州', '红河哈尼族彝族自治州', '文山壮族苗族自治州', '西双版纳傣族自治州', '大理白族自治州', '德宏傣族景颇族自治州', '怒江傈僳族自治州', '迪庆藏族自治州',
  // 西藏
  '拉萨', '日喀则', '昌都', '林芝', '山南', '那曲', '阿里地区',
  // 陕西
  '西安', '铜川', '宝鸡', '咸阳', '渭南', '延安', '汉中', '榆林', '安康', '商洛',
  // 甘肃
  '兰州', '嘉峪关', '金昌', '白银', '天水', '武威', '张掖', '平凉', '酒泉', '庆阳', '定西', '陇南', '临夏回族自治州', '甘南藏族自治州',
  // 青海
  '西宁', '海东', '海北藏族自治州', '黄南藏族自治州', '海南藏族自治州', '果洛藏族自治州', '玉树藏族自治州', '海西蒙古族藏族自治州',
  // 宁夏
  '银川', '石嘴山', '吴忠', '固原', '中卫',
  // 新疆
  '乌鲁木齐', '克拉玛依', '吐鲁番', '哈密', '昌吉回族自治州', '博尔塔拉蒙古自治州', '巴音郭楞蒙古自治族自治州', '克孜勒苏柯尔克孜自治州', '伊犁哈萨克自治州', '塔城地区', '阿勒泰地区', '石河子', '阿拉尔', '图木舒克', '五家渠', '北屯', '铁门关', '双河', '可克达拉', '昆玉', '胡杨河', '白杨', '新星',
  // 港澳台
  '中国香港', '中国澳门', '中国台湾',
];

// 大城市开放「市 → 区/县」二级选择；未列出的城市点击即直接选中（存城市名）
const CITY_DISTRICTS: Record<string, string[]> = {
  北京: ['东城区', '西城区', '朝阳区', '丰台区', '石景山区', '海淀区', '门头沟区', '房山区', '通州区', '顺义区', '昌平区', '大兴区', '怀柔区', '平谷区', '密云区', '延庆区'],
  上海: ['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区', '闵行区', '宝山区', '嘉定区', '浦东新区', '金山区', '松江区', '青浦区', '奉贤区', '崇明区'],
  天津: ['和平区', '河东区', '河西区', '南开区', '河北区', '红桥区', '东丽区', '西青区', '津南区', '北辰区', '武清区', '宝坻区', '滨海新区', '宁河区', '静海区', '蓟州区'],
  重庆: ['万州区', '涪陵区', '渝中区', '大渡口区', '江北区', '沙坪坝区', '九龙坡区', '南岸区', '北碚区', '綦江区', '大足区', '渝北区', '巴南区', '黔江区', '长寿区', '江津区', '合川区', '永川区', '南川区', '璧山区', '铜梁区', '潼南区', '荣昌区', '开州区'],
  广州: ['荔湾区', '越秀区', '海珠区', '天河区', '白云区', '黄埔区', '番禺区', '花都区', '南沙区', '从化区', '增城区'],
  深圳: ['福田区', '罗湖区', '盐田区', '南山区', '宝安区', '龙岗区', '龙华区', '坪山区', '光明区'],
  成都: ['锦江区', '青羊区', '金牛区', '武侯区', '成华区', '龙泉驿区', '青白江区', '新都区', '温江区', '双流区', '郫都区', '新津区', '简阳市', '都江堰市', '彭州市', '邛崃市', '崇州市', '金堂县', '大邑县', '蒲江县'],
  杭州: ['上城区', '拱墅区', '西湖区', '滨江区', '萧山区', '余杭区', '富阳区', '临安区', '临平区', '钱塘区', '桐庐县', '淳安县', '建德市'],
  南京: ['玄武区', '秦淮区', '建邺区', '鼓楼区', '浦口区', '栖霞区', '雨花台区', '江宁区', '六合区', '溧水区', '高淳区'],
  武汉: ['江岸区', '江汉区', '硚口区', '汉阳区', '武昌区', '青山区', '洪山区', '东西湖区', '汉南区', '蔡甸区', '江夏区', '黄陂区', '新洲区'],
  西安: ['新城区', '碑林区', '莲湖区', '雁塔区', '未央区', '灞桥区', '阎良区', '临潼区', '长安区', '高陵区', '鄠邑区', '蓝田县', '周至县'],
  苏州: ['姑苏区', '虎丘区', '吴中区', '相城区', '吴江区', '苏州工业园区', '常熟市', '张家港市', '昆山市', '太仓市'],
  青岛: ['市南区', '市北区', '李沧区', '崂山区', '城阳区', '黄岛区', '即墨区', '胶州市', '平度市', '莱西市'],
  沈阳: ['和平区', '沈河区', '大东区', '皇姑区', '铁西区', '苏家屯区', '浑南区', '沈北新区', '于洪区', '辽中区', '康平县', '法库县', '新民市'],
  大连: ['中山区', '西岗区', '沙河口区', '甘井子区', '旅顺口区', '金州区', '普兰店区', '瓦房店市', '庄河市', '长海县'],
  厦门: ['思明区', '海沧区', '湖里区', '集美区', '同安区', '翔安区'],
  宁波: ['海曙区', '江北区', '北仑区', '镇海区', '鄞州区', '奉化区', '余姚市', '慈溪市', '宁海县', '象山县'],
  无锡: ['梁溪区', '锡山区', '惠山区', '滨湖区', '新吴区', '江阴市', '宜兴市'],
  佛山: ['禅城区', '南海区', '顺德区', '三水区', '高明区'],
  东莞: ['莞城街道', '南城街道', '东城街道', '万江街道', '石碣镇', '虎门镇', '长安镇', '厚街镇', '寮步镇', '大朗镇', '塘厦镇', '松山湖'],
  长沙: ['芙蓉区', '天心区', '岳麓区', '开福区', '雨花区', '望城区', '长沙县', '浏阳市', '宁乡市'],
  郑州: ['中原区', '二七区', '管城回族区', '金水区', '上街区', '惠济区', '中牟县', '巩义市', '荥阳市', '新密市', '新郑市', '登封市'],
  济南: ['历下区', '市中区', '槐荫区', '天桥区', '历城区', '长清区', '章丘区', '济阳区', '莱芜区', '钢城区', '平阴县', '商河县'],
  合肥: ['瑶海区', '庐阳区', '蜀山区', '包河区', '长丰县', '肥东县', '肥西县', '庐江县', '巢湖市'],
  福州: ['鼓楼区', '台江区', '仓山区', '晋安区', '马尾区', '长乐区', '闽侯县', '连江县', '罗源县', '闽清县', '永泰县', '平潭县', '福清市'],
  南昌: ['东湖区', '西湖区', '青云谱区', '青山湖区', '新建区', '红谷滩区', '南昌县', '安义县', '进贤县'],
  昆明: ['五华区', '盘龙区', '官渡区', '西山区', '东川区', '呈贡区', '晋宁区', '富民县', '宜良县', '石林彝族自治县', '嵩明县', '禄劝彝族苗族自治县', '寻甸回族彝族自治县', '安宁市'],
  哈尔滨: ['道里区', '南岗区', '道外区', '平房区', '松北区', '香坊区', '呼兰区', '阿城区', '双城区', '依兰县', '方正县', '宾县', '巴彦县', '木兰县', '通河县', '延寿县', '尚志市', '五常市'],
  长春: ['南关区', '宽城区', '朝阳区', '二道区', '绿园区', '双阳区', '九台区', '农安县', '榆树市', '德惠市'],
  石家庄: ['长安区', '桥西区', '新华区', '裕华区', '藁城区', '鹿泉区', '栾城区', '井陉县', '正定县', '行唐县', '灵寿县', '高邑县', '深泽县', '赞皇县', '无极县', '平山县', '元氏县', '赵县', '辛集市', '晋州市', '新乐市'],
  太原: ['小店区', '迎泽区', '杏花岭区', '尖草坪区', '万柏林区', '晋源区', '清徐县', '阳曲县', '娄烦县', '古交市'],
  南宁: ['兴宁区', '青秀区', '江南区', '西乡塘区', '良庆区', '邕宁区', '武鸣区', '隆安县', '马山县', '上林县', '宾阳县', '横州市'],
  贵阳: ['南明区', '云岩区', '花溪区', '乌当区', '白云区', '观山湖区', '开阳县', '息烽县', '修文县', '清镇市'],
  兰州: ['城关区', '七里河区', '西固区', '安宁区', '红古区', '永登县', '皋兰县', '榆中县'],
  海口: ['秀英区', '龙华区', '琼山区', '美兰区'],
  三亚: ['海棠区', '吉阳区', '天涯区', '崖州区'],
};

// —— 生日内联选择器 ——
const ITEM_HEIGHT = 44;

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatDateValue(date: { year: number; month: number; day: number }) {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

function parseDateValue(value: string | null) {
  if (!value) {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() };
  }
  const [y, m, d] = value.split('-').map(Number);
  return { year: y || 2000, month: m || 1, day: d || 1 };
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function formatDisplayDate(value: string | null) {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  return `${y}年${pad(m)}月${pad(d)}日`;
}

function getZodiac(month: number, day: number) {
  const startDays = [20, 19, 21, 20, 21, 22, 23, 23, 23, 24, 23, 22];
  const signs = ['摩羯座', '水瓶座', '双鱼座', '白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座'];
  return day < startDays[month - 1] ? signs[month - 1] : signs[month];
}

function formatAge(value: string | null) {
  if (!value) return null;
  const birth = new Date(value);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return `${age}岁`;
}

function WheelPicker({ options, selectedIndex, onChange }: {
  options: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const initialY = selectedIndex * ITEM_HEIGHT;
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: initialY, animated: false });
    }, 50);
    return () => clearTimeout(timer);
  }, [initialY]);
  return (
    <View style={styles.wheel}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          const index = Math.max(0, Math.min(options.length - 1, Math.round(y / ITEM_HEIGHT)));
          onChange(index);
        }}
      >
        <View style={{ height: ITEM_HEIGHT * 2 }} />
        {options.map((option, index) => {
          const selected = index === selectedIndex;
          return (
            <View
              key={`${option}-${index}`}
              style={[styles.wheelItemWrap, { height: ITEM_HEIGHT }, selected && styles.wheelItemWrapSelected]}
            >
              <Text style={[styles.wheelItem, selected && styles.wheelItemSelected]}>{option}</Text>
            </View>
          );
        })}
        <View style={{ height: ITEM_HEIGHT * 2 }} />
      </ScrollView>
      {/* 选中行上下两条高亮分割线 */}
      <View pointerEvents="none" style={styles.wheelSelectorTopLine} />
      <View pointerEvents="none" style={styles.wheelSelectorBottomLine} />
    </View>
  );
}

type SwitchRowProps = {
  label: string;
  value: boolean;
  onToggle: () => void;
  last?: boolean;
  testID?: string;
};

function SwitchRow({ label, value, onToggle, last, testID }: SwitchRowProps) {
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.switchPressable, pressed ? styles.pressed : null]}
      testID={testID}
    >
      <View style={[styles.switchRow, last ? null : styles.switchRowBorder]}>
        <Text style={styles.switchLabel}>{label}</Text>
        <View style={[styles.switchTrack, value ? styles.switchTrackOn : styles.switchTrackOff]}>
          <View style={[styles.switchThumb, value ? styles.switchThumbOn : styles.switchThumbOff]} />
        </View>
      </View>
    </Pressable>
  );
}

export default function EditProfileScreen() {
  const router = useRouter();
  const { userProfile, updateUserProfile } = useMixology();
  const [draft, setDraft] = useState<UserProfile>(userProfile);
  const [saving, setSaving] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [regionModalVisible, setRegionModalVisible] = useState(false);
  const [regionQuery, setRegionQuery] = useState('');
  const [activeCity, setActiveCity] = useState<string | null>(null);
  const [districtQuery, setDistrictQuery] = useState('');

  // 生日内联编辑面板
  const [birthdayEditorVisible, setBirthdayEditorVisible] = useState(false);
  const [birthdayPickerVisible, setBirthdayPickerVisible] = useState(false);
  const [birthdayPickerState, setBirthdayPickerState] = useState(() =>
    parseDateValue(draft.birthday)
  );

  const openBirthdayEditor = () => {
    setBirthdayPickerState(parseDateValue(draft.birthday));
    setBirthdayEditorVisible(true);
  };
  const closeBirthdayEditor = () => {
    setBirthdayEditorVisible(false);
    setBirthdayPickerVisible(false);
  };
  const openBirthdayPicker = () => {
    setBirthdayPickerState(parseDateValue(draft.birthday));
    setBirthdayPickerVisible(true);
  };
  const confirmBirthdayPicker = () => {
    const maxDay = getDaysInMonth(birthdayPickerState.year, birthdayPickerState.month);
    const day = Math.min(birthdayPickerState.day, maxDay);
    update('birthday', formatDateValue({ year: birthdayPickerState.year, month: birthdayPickerState.month, day }));
    setBirthdayPickerVisible(false);
  };
  const cancelBirthdayPicker = () => setBirthdayPickerVisible(false);

  const birthdayDisplay = draft.birthday ? formatDisplayDate(draft.birthday) : '选择你的生日';
  const previewDate = draft.birthday || formatDateValue({ year: new Date().getFullYear(), month: 1, day: 1 });
  const previewParsed = parseDateValue(previewDate);
  const zodiac = getZodiac(previewParsed.month, previewParsed.day);
  const age = formatAge(previewDate);

  const bYears = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: current - 1900 + 1 }, (_, i) => `${1900 + i}年`).reverse();
  }, []);
  const bMonths = useMemo(() => Array.from({ length: 12 }, (_, i) => `${pad(i + 1)}月`), []);
  const bDays = useMemo(() => {
    const count = getDaysInMonth(birthdayPickerState.year, birthdayPickerState.month);
    return Array.from({ length: count }, (_, i) => `${pad(i + 1)}日`);
  }, [birthdayPickerState.year, birthdayPickerState.month]);
  const bYearIndex = useMemo(() => {
    const target = `${birthdayPickerState.year}年`;
    const idx = bYears.indexOf(target);
    return idx >= 0 ? idx : 0;
  }, [bYears, birthdayPickerState.year]);
  const bMonthIndex = birthdayPickerState.month - 1;
  const bDayIndex = birthdayPickerState.day - 1;

  const dirty = Object.keys(userProfile).some(
    (key) => (draft as Record<string, unknown>)[key] !== (userProfile as Record<string, unknown>)[key]
  );

  const handleSave = async () => {
    if (!dirty || saving) return;
    if (!draft.nickname.trim()) {
      Alert.alert('提示', '昵称不能为空');
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile({
        ...draft,
        nickname: draft.nickname.trim(),
        signature: draft.signature.trim(),
        city: draft.city.trim(),
      });
      router.replace('/profile' as Href);
    } finally {
      setSaving(false);
    }
  };

  const handlePickAvatar = async () => {
    const uri = await pickAvatarFromLibrary();
    if (uri) {
      setDraft((current) => ({ ...current, avatarUri: uri }));
      setAvatarLoadFailed(false);
    }
  };

  const avatarSource = avatarLoadFailed ? getImageAsset('avatarOne') : resolveAvatarSource(draft);

  const update = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const closeRegionPicker = () => {
    setRegionModalVisible(false);
    setRegionQuery('');
    setDistrictQuery('');
    setActiveCity(null);
  };

  // 点城市：有区县数据则进入二级选区，否则直接选中该城市
  const handlePickCity = (city: string) => {
    if (CITY_DISTRICTS[city]) {
      setActiveCity(city);
      setDistrictQuery('');
    } else {
      setDraft((current) => ({ ...current, city }));
      closeRegionPicker();
    }
  };

  // 二级选区县：存为「城市·区」
  const handleSelectDistrict = (district: string) => {
    if (!activeCity) return;
    setDraft((current) => ({ ...current, city: `${activeCity}·${district}` }));
    closeRegionPicker();
  };

  const cityOptions = useMemo(() => {
    const sorted = CITIES.slice().sort((a, b) =>
      a.localeCompare(b, 'zh-Hans-CN', { sensitivity: 'base' })
    );
    const q = regionQuery.trim();
    if (!q) return sorted;
    return sorted.filter((city) => city.includes(q));
  }, [regionQuery]);

  const pickGender = () => {
    Alert.alert('选择性别', undefined, [
      ...GENDER_OPTIONS.map((option) => ({
        text: option,
        onPress: () => update('gender', option === '保密' ? null : option),
      })),
      { text: '取消', style: 'cancel' },
    ]);
  };

  return (
    <ScreenShell>
      {/* 顶部导航：返回 / 标题 / 保存 */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.replace('/profile' as Href)} style={styles.topButton} testID="edit-cancel-button">
          <ChevronLeft color={colors.text} size={28} />
        </Pressable>
        <Text style={styles.topTitle}>编辑资料</Text>
        <View style={styles.topButton} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* 头像区 */}
        <View style={styles.avatarSection}>
          <Pressable onPress={handlePickAvatar} style={styles.avatarPressable} testID="upload-avatar-button">
            <View style={styles.avatarRing}>
              <Image
                testID="edit-avatar-preview"
                source={avatarSource}
                style={styles.avatarPreview}
                onError={() => setAvatarLoadFailed(true)}
              />
            </View>
            <View style={styles.cameraBadge}>
              <Camera color="#fff" size={13} />
            </View>
          </Pressable>
          <Text style={styles.avatarHint}>修改头像</Text>
        </View>

        <GroupTitle text="编辑个人资料" />
        <ProfileGroup>
          <ProfileRow
            label="名字"
            inputProps={{
              value: draft.nickname,
              onChangeText: (nickname) => update('nickname', nickname),
              maxLength: 16,
              placeholder: '给自己起个名字',
              testID: 'nickname-input',
            }}
          />
          <ProfileRow
            label="简介"
            inputProps={{
              value: draft.signature,
              onChangeText: (signature) => update('signature', signature),
              maxLength: 60,
              placeholder: '介绍一下自己',
              testID: 'signature-input',
            }}
          />
          <ProfileRow
            label="背景图"
            value=""
            placeholder="点击更换"
            onPress={handlePickAvatar}
            testID="edit-bg-image-row"
            last
          />
        </ProfileGroup>

        <GroupTitle text="个人信息" />
        <ProfileGroup>
          <ProfileRow
            label="性别"
            value={draft.gender || undefined}
            placeholder="编辑性别"
            onPress={pickGender}
            testID="gender-row"
          />
          <ProfileRow
            label="生日"
            value={draft.birthday ? formatDisplayDate(draft.birthday) : undefined}
            placeholder="选择生日"
            onPress={openBirthdayEditor}
            testID="birthday-row"
          />
          <ProfileRow
            label="地区"
            value={draft.city || undefined}
            placeholder="选择你的地区"
            onPress={() => {
              const base = draft.city.includes('·') ? draft.city.split('·')[0] : '';
              setActiveCity(base && CITY_DISTRICTS[base] ? base : null);
              setRegionQuery('');
              setDistrictQuery('');
              setRegionModalVisible(true);
            }}
            testID="region-row"
            last
          />
        </ProfileGroup>
      </ScrollView>

      <View style={styles.saveBarWrap}>
        <Pressable
          onPress={handleSave}
          disabled={!dirty || saving}
          style={({ pressed }) => [
            styles.saveBarPressable,
            !dirty || saving ? styles.saveBarDisabled : null,
            pressed ? styles.pressed : null,
          ]}
          testID="edit-save-button"
        >
          <LinearGradient
            colors={[colors.pink, colors.pinkDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveBar}
          >
            <Text style={styles.saveBarText}>{saving ? '保存中' : '保存'}</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <Modal
        visible={regionModalVisible}
        animationType="slide"
        presentationStyle="overFullScreen"
        transparent
        statusBarTranslucent
        onRequestClose={closeRegionPicker}
        testID="region-picker"
      >
        <SafeAreaView style={styles.regionPickerBackdrop} edges={['bottom']}>
          <Pressable style={styles.regionPickerOverlay} onPress={closeRegionPicker} />
          <View style={styles.regionPickerSheet}>
            <View style={styles.regionSheetHeader}>
              <Text style={styles.regionSheetTitle}>
                {activeCity ? `选择 ${activeCity} 的区` : '选择你的地区'}
              </Text>
              <Pressable
                onPress={() => {
                  if (activeCity) {
                    setActiveCity(null);
                    setDistrictQuery('');
                  } else {
                    closeRegionPicker();
                  }
                }}
                style={({ pressed }) => [styles.regionSheetClose, pressed ? styles.pressed : null]}
                testID="region-picker-close"
              >
                <Text style={styles.regionSheetCloseText}>完成</Text>
              </Pressable>
            </View>

            {!activeCity ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.regionScrollContent}>
                <View style={styles.regionCard}>
                  <View style={styles.regionSectionRow}>
                    <MapPin color={colors.textMuted} size={13} />
                    <Text style={styles.regionSectionLabel}>定位到的位置</Text>
                  </View>
                  <Pressable
                    onPress={() => handleSelectDistrict('青浦区')}
                    style={({ pressed }) => [styles.locatedCardPressable, pressed ? styles.pressed : null]}
                    testID="region-located-option"
                  >
                    <View style={styles.locatedCard}>
                      <View style={styles.locatedDot} />
                      <Text style={styles.locatedText}>上海·青浦区</Text>
                    </View>
                  </Pressable>

                  <View style={styles.regionSearchWrap}>
                    <View style={styles.regionSearchBox}>
                      <Search color={colors.textMuted} size={16} />
                      <TextInput
                        value={regionQuery}
                        onChangeText={setRegionQuery}
                        placeholder="搜索城市"
                        placeholderTextColor={colors.textMuted}
                        style={styles.regionSearchInput}
                        testID="region-search-input"
                      />
                    </View>
                  </View>

                  <Text style={[styles.regionSectionLabel, styles.allLabel]}>全部</Text>
                  <View style={styles.regionListInner}>
                    {cityOptions.map((item, index) => {
                      const selected = draft.city === item;
                      const isLast = index === cityOptions.length - 1;
                      return (
                        <Pressable
                          key={item}
                          onPress={() => handlePickCity(item)}
                          style={({ pressed }) => [styles.regionOptionPressable, pressed ? styles.pressed : null]}
                          testID={`region-option-${item}`}
                        >
                          <View style={[styles.regionOptionInner, !isLast ? styles.regionOptionBorder : null]}>
                            <Text
                              style={[styles.regionOptionText, selected ? styles.regionOptionSelected : null]}
                            >
                              {item}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.regionScrollContent}>
                <View style={styles.regionCard}>
                  <View style={styles.regionListInner}>
                    {CITY_DISTRICTS[activeCity]
                      .filter((d) => d.includes(districtQuery.trim()))
                      .map((district, index, arr) => {
                        const value = `${activeCity}·${district}`;
                        const selected = draft.city === value;
                        const isLast = index === arr.length - 1;
                        return (
                          <Pressable
                            key={district}
                            onPress={() => handleSelectDistrict(district)}
                            style={({ pressed }) => [styles.regionOptionPressable, pressed ? styles.pressed : null]}
                            testID={`region-option-${district}`}
                          >
                            <View style={[styles.regionOptionInner, !isLast ? styles.regionOptionBorder : null]}>
                              <Text
                                style={[styles.regionOptionText, selected ? styles.regionOptionSelected : null]}
                              >
                                {district}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* 生日内联编辑面板 */}
      <Modal
        visible={birthdayEditorVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={closeBirthdayEditor}
        testID="birthday-editor-modal"
      >
        <SafeAreaView style={styles.birthdayEditor} edges={['top', 'bottom']}>
          <View style={styles.topBar}>
            <Pressable onPress={closeBirthdayEditor} style={styles.topButton} testID="birthday-editor-back">
              <ChevronLeft color={colors.text} size={28} />
            </Pressable>
            <Text style={styles.topTitle}>编辑生日</Text>
            <Pressable onPress={closeBirthdayEditor} style={styles.saveTextButton} testID="birthday-editor-save">
              <Text style={styles.saveTextButtonLabel}>保存</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.birthdayEditorContent}>
            <Text style={styles.groupTitle}>生日信息</Text>
            <View style={styles.group}>
              <Pressable
                onPress={openBirthdayPicker}
                style={({ pressed }) => [styles.infoPressable, pressed ? styles.pressed : null]}
                testID="birthday-info-row"
              >
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>生日信息</Text>
                  <View style={styles.infoValueWrap}>
                    <Text style={styles.infoValue}>{birthdayDisplay}</Text>
                    <ChevronRight color={colors.textMuted} size={18} />
                  </View>
                </View>
              </Pressable>
            </View>

            <Text style={styles.groupTitle}>是否公开展示</Text>
            <View style={styles.group}>
              <SwitchRow
                label="展示生日标签"
                value={draft.showBirthdayTag}
                onToggle={() => update('showBirthdayTag', !draft.showBirthdayTag)}
                testID="toggle-show-birthday-tag"
              />
              <SwitchRow
                label="展示年龄"
                value={draft.showAge}
                onToggle={() => update('showAge', !draft.showAge)}
                testID="toggle-show-age"
              />
              <SwitchRow
                label="展示星座"
                value={draft.showZodiac}
                onToggle={() => update('showZodiac', !draft.showZodiac)}
                last
                testID="toggle-show-zodiac"
              />
            </View>

            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>预览</Text>
              <View style={styles.previewRow}>
                {draft.showBirthdayTag && draft.birthday ? (
                  <View style={styles.previewTag}>
                    <Text style={styles.previewTagText}>{formatDisplayDate(draft.birthday)}</Text>
                  </View>
                ) : null}
                {draft.showAge && age ? (
                  <View style={styles.previewTag}>
                    <Text style={styles.previewTagText}>{age}</Text>
                  </View>
                ) : null}
                {draft.showZodiac ? (
                  <View style={styles.previewTag}>
                    <Text style={styles.previewTagText}>{zodiac}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </ScrollView>

          {/* 面板内底部日期选择器 */}
          <Modal
            visible={birthdayPickerVisible}
            animationType="slide"
            presentationStyle="overFullScreen"
            transparent
            statusBarTranslucent
            onRequestClose={cancelBirthdayPicker}
            testID="birthday-picker-modal"
          >
            <SafeAreaView style={styles.birthdayPickerBackdrop} edges={['bottom']}>
              <Pressable style={styles.pickerBackdropPressable} onPress={cancelBirthdayPicker} />
              <View style={styles.pickerSheet}>
                <View style={styles.pickerHeader}>
                  <Pressable onPress={cancelBirthdayPicker} style={styles.pickerHeaderButton} testID="birthday-picker-cancel">
                    <Text style={styles.pickerHeaderAction}>取消</Text>
                  </Pressable>
                  <Text style={styles.pickerHeaderTitle}>选择你的生日</Text>
                  <Pressable onPress={confirmBirthdayPicker} style={styles.pickerHeaderButton} testID="birthday-picker-confirm">
                    <Text style={[styles.pickerHeaderAction, styles.pickerHeaderActionPrimary]}>保存</Text>
                  </Pressable>
                </View>
                <View style={styles.wheelContainer}>
                  <WheelPicker
                    options={bYears}
                    selectedIndex={bYearIndex}
                    onChange={(index) => {
                      const y = Number(bYears[index].replace('年', ''));
                      setBirthdayPickerState((s) => ({ ...s, year: y }));
                    }}
                  />
                  <WheelPicker
                    options={bMonths}
                    selectedIndex={bMonthIndex}
                    onChange={(index) => setBirthdayPickerState((s) => ({ ...s, month: index + 1 }))}
                  />
                  <WheelPicker
                    options={bDays}
                    selectedIndex={bDayIndex >= bDays.length ? bDays.length - 1 : bDayIndex}
                    onChange={(index) => setBirthdayPickerState((s) => ({ ...s, day: index + 1 }))}
                  />
                </View>
              </View>
            </SafeAreaView>
          </Modal>
        </SafeAreaView>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  topBar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  topButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  saveBarWrap: {
    paddingHorizontal: spacing.pageX,
    paddingTop: 16,
    paddingBottom: 28,
  },
  saveBarPressable: {
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  saveBarDisabled: {
    opacity: 0.45,
  },
  saveBar: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  saveBarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  content: {
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 28,
  },
  avatarPressable: {
    position: 'relative',
    width: 112,
    height: 112,
  },
  avatarRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
    backgroundColor: colors.panel,
  },
  avatarPreview: {
    width: '100%',
    height: '100%',
  },
  cameraBadge: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.pink,
    borderWidth: 2.5,
    borderColor: colors.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 14,
  },
  groupTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 22,
    marginBottom: 8,
    marginHorizontal: spacing.pageX,
  },
  group: {
    borderRadius: radii.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginHorizontal: spacing.pageX,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    width: 64,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  rowValueWrap: {
    flex: 1,
    alignItems: 'flex-end',
    marginHorizontal: 10,
  },
  rowValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  rowPlaceholder: {
    color: colors.textMuted,
  },
  rowInput: {
    width: '100%',
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'right',
    padding: 0,
  },
  regionPickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  regionPickerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  regionPickerSheet: {
    maxHeight: '85%',
    backgroundColor: colors.bgDeep,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingBottom: 10,
  },
  regionSheetHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.pageX,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  regionSheetTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  regionSheetClose: {
    position: 'absolute',
    right: spacing.pageX,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  regionSheetCloseText: {
    color: colors.pink,
    fontSize: 16,
    fontWeight: '800',
  },
  regionScrollContent: {
    paddingBottom: 30,
  },
  regionCard: {
    marginHorizontal: spacing.pageX,
    marginTop: 12,
    borderRadius: radii.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  regionSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  regionSectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 5,
  },
  allLabel: {
    marginTop: 22,
    marginBottom: 8,
  },
  regionSearchWrap: {
    marginTop: 18,
  },
  regionSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radii.pill,
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  regionSearchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    padding: 0,
    marginLeft: 8,
  },
  locatedCardPressable: {
    // 视觉样式下沉到内部 View，避免原生端 Pressable 丢样式
  },
  locatedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: radii.md,
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  pressed: {
    opacity: 0.75,
  },
  locatedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.cyan,
    marginRight: 10,
  },
  locatedText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  regionListInner: {
    marginTop: 6,
  },
  regionOptionPressable: {
    // 视觉样式下沉到内部 View，避免原生端 Pressable 丢样式
  },
  regionOptionInner: {
    paddingVertical: 15,
  },
  regionOptionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.25)',
  },
  regionOptionText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  regionOptionSelected: {
    color: colors.pink,
    fontWeight: '900',
  },
  birthdayEditor: {
    flex: 1,
    backgroundColor: colors.bgDeep,
  },
  birthdayEditorContent: {
    paddingBottom: 40,
  },
  saveTextButton: {
    minHeight: 36,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveTextButtonLabel: {
    color: colors.pink,
    fontSize: 16,
    fontWeight: '800',
  },
  infoPressable: {
    // 视觉样式下沉到内部 View
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  infoLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  infoValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoValue: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '500',
    marginRight: 4,
  },
  switchPressable: {
    // 视觉样式下沉到内部 View
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  switchRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  switchLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchTrackOn: {
    backgroundColor: colors.pink,
  },
  switchTrackOff: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  switchThumbOn: {
    alignSelf: 'flex-end',
  },
  switchThumbOff: {
    alignSelf: 'flex-start',
  },
  previewCard: {
    marginHorizontal: spacing.pageX,
    marginTop: 24,
    borderRadius: radii.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  previewLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  previewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  previewTag: {
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,47,159,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,47,159,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  previewTagText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  birthdayPickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  pickerBackdropPressable: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  pickerSheet: {
    backgroundColor: colors.bgDeep,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingBottom: 10,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerHeaderButton: {
    minWidth: 44,
    paddingVertical: 4,
  },
  pickerHeaderAction: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  pickerHeaderActionPrimary: {
    color: colors.pink,
  },
  pickerHeaderTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  wheelContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  wheel: {
    flex: 1,
    height: ITEM_HEIGHT * 5,
  },
  wheelItemWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelItemWrapSelected: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  wheelItem: {
    color: colors.textMuted,
    fontSize: 20,
    fontWeight: '700',
  },
  wheelItemSelected: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  wheelSelectorTopLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM_HEIGHT * 2,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  wheelSelectorBottomLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM_HEIGHT * 3,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
});
