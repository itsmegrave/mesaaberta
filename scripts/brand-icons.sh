#!/usr/bin/env bash
# Renders the PNG and ICO icons in apps/web/static/ from the two brand SVGs: apps/web/static/logo.svg (the mark) for
# the home-screen icons and apps/web/static/favicon.svg (the monogram) for the tab-sized ones. Needs
# rsvg-convert (librsvg) and magick (ImageMagick). Run it after changing either SVG.
set -euo pipefail
cd "$(dirname "$0")/.."

bg='#fcfcfc' # the page background, as in site.webmanifest
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# Tab-sized icons: the monogram, on a transparent background.
rsvg-convert -w 16 -h 16 apps/web/static/favicon.svg -o apps/web/static/favicon-16x16.png
rsvg-convert -w 32 -h 32 apps/web/static/favicon.svg -o apps/web/static/favicon-32x32.png
magick apps/web/static/favicon-16x16.png apps/web/static/favicon-32x32.png apps/web/static/favicon.ico

# Home-screen icons: the mark on the page background, with a margin, since the platforms round or
# mask the corners themselves. A maskable icon keeps the mark inside the inner 80% safe zone.
mark() { # canvas size, mark size, output
  rsvg-convert -w "$2" -h "$2" apps/web/static/logo.svg -o "$work/mark.png"
  magick -size "$1x$1" "xc:$bg" "$work/mark.png" -gravity center -composite -depth 8 "$3"
}
mark 180 144 apps/web/static/apple-touch-icon.png
mark 192 154 apps/web/static/android-chrome-192x192.png
mark 512 410 apps/web/static/android-chrome-512x512.png
mark 512 328 apps/web/static/android-chrome-maskable-512x512.png
