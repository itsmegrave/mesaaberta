// The app's icons, one Svelte component per icon from Iconify's SVG + CSS packages
// (https://iconify.design/docs/usage/svg-css/svelte/). Import the icon here, add it to ICONS, then use it
// by name: `<Icon name="wrench" />`. Lucide icons come from @iconify-svelte/lucide, Game Icons
// from @iconify-svelte/game-icons (names carry the `game-icons:` prefix).
import GameTabletopPlayersIcon from '@iconify-svelte/game-icons/tabletop-players';
import GameDungeonGateIcon from '@iconify-svelte/game-icons/dungeon-gate';
import GameMeepleIcon from '@iconify-svelte/game-icons/meeple';
import GameScrollQuillIcon from '@iconify-svelte/game-icons/scroll-quill';
import GameExitDoorIcon from '@iconify-svelte/game-icons/exit-door';
import CalendarIcon from '@iconify-svelte/lucide/calendar';
import CircleXIcon from '@iconify-svelte/lucide/circle-x';
import UserPlusIcon from '@iconify-svelte/lucide/user-plus';
import UserCheckIcon from '@iconify-svelte/lucide/user-check';
import UserXIcon from '@iconify-svelte/lucide/user-x';
import UserMinusIcon from '@iconify-svelte/lucide/user-minus';
import StarIcon from '@iconify-svelte/lucide/star';
import TagIcon from '@iconify-svelte/lucide/tag';
import ShieldIcon from '@iconify-svelte/lucide/shield';
import MegaphoneIcon from '@iconify-svelte/lucide/megaphone';
import WrenchIcon from '@iconify-svelte/lucide/wrench';
import TriangleAlertIcon from '@iconify-svelte/lucide/triangle-alert';
import SparklesIcon from '@iconify-svelte/lucide/sparkles';
import GiftIcon from '@iconify-svelte/lucide/gift';
import InfoIcon from '@iconify-svelte/lucide/info';
import ChevronDownIcon from '@iconify-svelte/lucide/chevron-down';
import UsersIcon from '@iconify-svelte/lucide/users';
import DicesIcon from '@iconify-svelte/lucide/dices';
import FlagIcon from '@iconify-svelte/lucide/flag';
import RefreshCwIcon from '@iconify-svelte/lucide/refresh-cw';
import ArrowRightIcon from '@iconify-svelte/lucide/arrow-right';
import ExternalLinkIcon from '@iconify-svelte/lucide/external-link';
import SearchIcon from '@iconify-svelte/lucide/search';
import ChevronLeftIcon from '@iconify-svelte/lucide/chevron-left';
import ChevronRightIcon from '@iconify-svelte/lucide/chevron-right';
import MessageCircleIcon from '@iconify-svelte/lucide/message-circle';
import SendIcon from '@iconify-svelte/lucide/send';
import BellOffIcon from '@iconify-svelte/lucide/bell-off';
import BellIcon from '@iconify-svelte/lucide/bell';
import ArrowLeftIcon from '@iconify-svelte/lucide/arrow-left';
import PlusIcon from '@iconify-svelte/lucide/plus';
import GlobeIcon from '@iconify-svelte/lucide/globe';
import GameDiceTwentyFacesTwentyIcon from '@iconify-svelte/game-icons/dice-twenty-faces-twenty';
import GameCardDrawIcon from '@iconify-svelte/game-icons/card-draw';
import GameBlackKnightHelmIcon from '@iconify-svelte/game-icons/black-knight-helm';
import PanelLeftOpenIcon from '@iconify-svelte/lucide/panel-left-open';
import PanelLeftCloseIcon from '@iconify-svelte/lucide/panel-left-close';
import BoldIcon from '@iconify-svelte/lucide/bold';
import ItalicIcon from '@iconify-svelte/lucide/italic';
import UnderlineIcon from '@iconify-svelte/lucide/underline';
import StrikethroughIcon from '@iconify-svelte/lucide/strikethrough';
import Heading2Icon from '@iconify-svelte/lucide/heading-2';
import Heading3Icon from '@iconify-svelte/lucide/heading-3';
import ListIcon from '@iconify-svelte/lucide/list';
import ListOrderedIcon from '@iconify-svelte/lucide/list-ordered';
import QuoteIcon from '@iconify-svelte/lucide/quote';
import CodeIcon from '@iconify-svelte/lucide/code';
import MinusIcon from '@iconify-svelte/lucide/minus';
import LinkIcon from '@iconify-svelte/lucide/link';
import UnlinkIcon from '@iconify-svelte/lucide/unlink';
import Undo2Icon from '@iconify-svelte/lucide/undo-2';
import Redo2Icon from '@iconify-svelte/lucide/redo-2';
import MapPinIcon from '@iconify-svelte/lucide/map-pin';

export const ICONS = {
  'game-icons:tabletop-players': GameTabletopPlayersIcon,
  'game-icons:dungeon-gate': GameDungeonGateIcon,
  'game-icons:meeple': GameMeepleIcon,
  'game-icons:scroll-quill': GameScrollQuillIcon,
  'game-icons:exit-door': GameExitDoorIcon,
  calendar: CalendarIcon,
  'circle-x': CircleXIcon,
  'user-plus': UserPlusIcon,
  'user-check': UserCheckIcon,
  'user-x': UserXIcon,
  'user-minus': UserMinusIcon,
  star: StarIcon,
  tag: TagIcon,
  shield: ShieldIcon,
  megaphone: MegaphoneIcon,
  wrench: WrenchIcon,
  'triangle-alert': TriangleAlertIcon,
  sparkles: SparklesIcon,
  gift: GiftIcon,
  info: InfoIcon,
  'chevron-down': ChevronDownIcon,
  users: UsersIcon,
  dices: DicesIcon,
  flag: FlagIcon,
  'refresh-cw': RefreshCwIcon,
  'arrow-right': ArrowRightIcon,
  'external-link': ExternalLinkIcon,
  search: SearchIcon,
  'chevron-left': ChevronLeftIcon,
  'chevron-right': ChevronRightIcon,
  'message-circle': MessageCircleIcon,
  send: SendIcon,
  'bell-off': BellOffIcon,
  bell: BellIcon,
  'arrow-left': ArrowLeftIcon,
  plus: PlusIcon,
  globe: GlobeIcon,
  'game-icons:dice-twenty-faces-twenty': GameDiceTwentyFacesTwentyIcon,
  'game-icons:card-draw': GameCardDrawIcon,
  'game-icons:black-knight-helm': GameBlackKnightHelmIcon,
  'panel-left-open': PanelLeftOpenIcon,
  'panel-left-close': PanelLeftCloseIcon,
  bold: BoldIcon,
  italic: ItalicIcon,
  underline: UnderlineIcon,
  strikethrough: StrikethroughIcon,
  'heading-2': Heading2Icon,
  'heading-3': Heading3Icon,
  list: ListIcon,
  'list-ordered': ListOrderedIcon,
  quote: QuoteIcon,
  code: CodeIcon,
  minus: MinusIcon,
  link: LinkIcon,
  unlink: UnlinkIcon,
  'undo-2': Undo2Icon,
  'redo-2': Redo2Icon,
  'map-pin': MapPinIcon,
} as const;
