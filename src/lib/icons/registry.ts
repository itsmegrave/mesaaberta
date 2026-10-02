// The app's icons, one Svelte component per icon from Iconify's SVG + CSS packages
// (https://iconify.design/docs/usage/svg-css/svelte/). Import the icon here, add it to ICONS, then use it
// by name: `<Icon name="wrench" />`. UI glyphs come from @iconify-svelte/reicon (the filled weight, `-filled`, to sit with the solid Game Icons; line-only for arrows, chevrons, add), Game Icons
// from @iconify-svelte/game-icons (names carry the `game-icons:` prefix).
import TadpoleIcon from '@iconify-svelte/svg-spinners/tadpole';
import GameTabletopPlayersIcon from '@iconify-svelte/game-icons/tabletop-players';
import GameDungeonGateIcon from '@iconify-svelte/game-icons/dungeon-gate';
import GameMeepleIcon from '@iconify-svelte/game-icons/meeple';
import GameScrollQuillIcon from '@iconify-svelte/game-icons/scroll-quill';
import GameExitDoorIcon from '@iconify-svelte/game-icons/exit-door';
import GameTavernSignIcon from '@iconify-svelte/game-icons/tavern-sign';
import GameHouseIcon from '@iconify-svelte/game-icons/house';
import SquarePenIcon from '@iconify-svelte/reicon/edit-filled';
import CalendarIcon from '@iconify-svelte/reicon/calendar-filled';
import CircleXIcon from '@iconify-svelte/reicon/close-circle-filled';
import UserPlusIcon from '@iconify-svelte/reicon/user-add-filled';
import UserCheckIcon from '@iconify-svelte/reicon/user-tick-filled';
import UserXIcon from '@iconify-svelte/reicon/user-remove-filled';
import UserMinusIcon from '@iconify-svelte/reicon/user-minus-filled';
import StarIcon from '@iconify-svelte/reicon/star-filled';
import TagIcon from '@iconify-svelte/reicon/tag-filled';
import ShieldIcon from '@iconify-svelte/reicon/shield-filled';
import MegaphoneIcon from '@iconify-svelte/reicon/notification-status-filled';
import WrenchIcon from '@iconify-svelte/reicon/settings-filled';
import TriangleAlertIcon from '@iconify-svelte/reicon/danger-filled';
import SparklesIcon from '@iconify-svelte/reicon/magic-star-filled';
import GiftIcon from '@iconify-svelte/reicon/gift-filled';
import InfoIcon from '@iconify-svelte/reicon/info-circle-filled';
import ChevronDownIcon from '@iconify-svelte/reicon/chevron-down';

import FlagIcon from '@iconify-svelte/reicon/flag-filled';
import RefreshCwIcon from '@iconify-svelte/reicon/refresh-filled';
import ArrowRightIcon from '@iconify-svelte/reicon/arrow-right';
import ExternalLinkIcon from '@iconify-svelte/reicon/arrow-up-right-square-filled';
import SearchIcon from '@iconify-svelte/reicon/search-normal-filled';
import ChevronLeftIcon from '@iconify-svelte/reicon/chevron-left';
import ChevronRightIcon from '@iconify-svelte/reicon/chevron-right';

import SendIcon from '@iconify-svelte/reicon/send-filled';
import BellOffIcon from '@iconify-svelte/reicon/bell-off-filled';
import BellIcon from '@iconify-svelte/reicon/bell-filled';
import ArrowLeftIcon from '@iconify-svelte/reicon/arrow-left';
import PlusIcon from '@iconify-svelte/reicon/add';
import GlobeIcon from '@iconify-svelte/reicon/globe-filled';
import GameDiceTwentyFacesTwentyIcon from '@iconify-svelte/game-icons/dice-twenty-faces-twenty';

import GameBlackKnightHelmIcon from '@iconify-svelte/game-icons/black-knight-helm';
import PanelLeftOpenIcon from '@iconify-svelte/reicon/sidebar-left-filled';
import PanelLeftCloseIcon from '@iconify-svelte/reicon/sidebar-left-filled';
import BoldIcon from '@iconify-svelte/reicon/text-bold-filled';
import ItalicIcon from '@iconify-svelte/reicon/italic-filled';
import UnderlineIcon from '@iconify-svelte/reicon/underline-filled';

import ListIcon from '@iconify-svelte/reicon/list-filled';

import QuoteIcon from '@iconify-svelte/reicon/quote-up-filled';
import CodeIcon from '@iconify-svelte/reicon/code-filled';
import MinusIcon from '@iconify-svelte/reicon/minus-filled';
import LinkIcon from '@iconify-svelte/reicon/link-filled';
import UnlinkIcon from '@iconify-svelte/reicon/link-broken-filled';
import Undo2Icon from '@iconify-svelte/reicon/undo-filled';
import Redo2Icon from '@iconify-svelte/reicon/redo-filled';
import MapPinIcon from '@iconify-svelte/reicon/location-filled';
import InstagramIcon from '@iconify-svelte/reicon/instagram-filled';

import BrandInstagramIcon from '@iconify-svelte/simple-icons/instagram';
import BrandXIcon from '@iconify-svelte/simple-icons/x';
import BrandBlueskyIcon from '@iconify-svelte/simple-icons/bluesky';
import BrandFacebookIcon from '@iconify-svelte/simple-icons/facebook';
import BrandTiktokIcon from '@iconify-svelte/simple-icons/tiktok';
import BrandYoutubeIcon from '@iconify-svelte/simple-icons/youtube';
import BrandTwitchIcon from '@iconify-svelte/simple-icons/twitch';
import BrandDiscordIcon from '@iconify-svelte/simple-icons/discord';
import BrandLinkedinIcon from '@iconify-svelte/simple-icons/linkedin';
import BrandGithubIcon from '@iconify-svelte/simple-icons/github';

export const ICONS = {
  'svg-spinners:tadpole': TadpoleIcon,
  'brand:instagram': BrandInstagramIcon,
  'brand:x': BrandXIcon,
  'brand:bluesky': BrandBlueskyIcon,
  'brand:facebook': BrandFacebookIcon,
  'brand:tiktok': BrandTiktokIcon,
  'brand:youtube': BrandYoutubeIcon,
  'brand:twitch': BrandTwitchIcon,
  'brand:discord': BrandDiscordIcon,
  'brand:github': BrandGithubIcon,
  'brand:linkedin': BrandLinkedinIcon,
  'game-icons:tabletop-players': GameTabletopPlayersIcon,
  'game-icons:dungeon-gate': GameDungeonGateIcon,
  'game-icons:meeple': GameMeepleIcon,
  'game-icons:scroll-quill': GameScrollQuillIcon,
  'game-icons:exit-door': GameExitDoorIcon,
  'game-icons:house': GameHouseIcon,
  'game-icons:tavern-sign': GameTavernSignIcon,
  'square-pen': SquarePenIcon,
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
  flag: FlagIcon,
  'refresh-cw': RefreshCwIcon,
  'arrow-right': ArrowRightIcon,
  'external-link': ExternalLinkIcon,
  search: SearchIcon,
  'chevron-left': ChevronLeftIcon,
  'chevron-right': ChevronRightIcon,
  send: SendIcon,
  'bell-off': BellOffIcon,
  bell: BellIcon,
  'arrow-left': ArrowLeftIcon,
  plus: PlusIcon,
  globe: GlobeIcon,
  'game-icons:dice-twenty-faces-twenty': GameDiceTwentyFacesTwentyIcon,
  'game-icons:black-knight-helm': GameBlackKnightHelmIcon,
  'panel-left-open': PanelLeftOpenIcon,
  'panel-left-close': PanelLeftCloseIcon,
  bold: BoldIcon,
  italic: ItalicIcon,
  underline: UnderlineIcon,
  list: ListIcon,
  quote: QuoteIcon,
  code: CodeIcon,
  minus: MinusIcon,
  link: LinkIcon,
  unlink: UnlinkIcon,
  'undo-2': Undo2Icon,
  'redo-2': Redo2Icon,
  'map-pin': MapPinIcon,
  instagram: InstagramIcon,
} as const;
