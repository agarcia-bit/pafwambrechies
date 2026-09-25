import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';

import { useTheme } from '@/theme';

// SF Symbols on iOS, Material Symbols on Android and web.
const ICONS = {
  newspaper: { ios: 'newspaper', android: 'newspaper' },
  people: { ios: 'person.2', android: 'groups' },
  tag: { ios: 'tag', android: 'sell' },
  calendar: { ios: 'calendar', android: 'calendar_month' },
  calendarAdd: { ios: 'calendar.badge.plus', android: 'edit_calendar' },
  more: { ios: 'ellipsis.circle', android: 'more_horiz' },
  lightbulb: { ios: 'lightbulb', android: 'lightbulb' },
  link: { ios: 'link', android: 'link' },
  person: { ios: 'person.crop.circle', android: 'account_circle' },
  heart: { ios: 'heart', android: 'favorite' },
  heartFill: { ios: 'heart.fill', android: 'favorite' },
  comment: { ios: 'bubble.left', android: 'chat_bubble' },
  phone: { ios: 'phone', android: 'call' },
  mail: { ios: 'envelope', android: 'mail' },
  location: { ios: 'mappin.and.ellipse', android: 'location_on' },
  clock: { ios: 'clock', android: 'schedule' },
  external: { ios: 'arrow.up.right.square', android: 'open_in_new' },
  chevron: { ios: 'chevron.right', android: 'chevron_right' },
  bell: { ios: 'bell', android: 'notifications' },
  logout: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout' },
  trash: { ios: 'trash', android: 'delete' },
  send: { ios: 'arrow.up.circle.fill', android: 'send' },
  plus: { ios: 'plus', android: 'add' },
  camera: { ios: 'camera', android: 'photo_camera' },
  briefcase: { ios: 'briefcase', android: 'work' },
  lock: { ios: 'lock', android: 'lock' },
  info: { ios: 'info.circle', android: 'info' },
  hand: { ios: 'hand.raised', android: 'badge' },
  check: { ios: 'checkmark', android: 'check' },
  gear: { ios: 'gearshape', android: 'settings' },
  photo: { ios: 'photo', android: 'image' },
  share: { ios: 'square.and.arrow.up', android: 'share' },
  refresh: { ios: 'arrow.triangle.2.circlepath', android: 'autorenew' },
  shield: { ios: 'checkmark.shield', android: 'admin_panel_settings' },
  palette: { ios: 'paintpalette', android: 'palette' },
} satisfies Record<string, { ios: SFSymbol; android: AndroidSymbol }>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const { colors } = useTheme();
  const { ios, android } = ICONS[name];
  return <SymbolView name={{ ios, android, web: android }} size={size} tintColor={color ?? colors.primary} />;
}
