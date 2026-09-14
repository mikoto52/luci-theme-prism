#!/bin/sh
# Prism theme installer for OpenWrt LuCI (ucode templates, 23.05+)
#   sh install.sh            install and make Prism the active theme
#   sh install.sh uninstall  restore the previous theme and remove Prism

set -e
cd "$(dirname "$0")"

WWW=/www/luci-static
TPL=/usr/share/ucode/luci/template/themes/prism
PREV=/etc/luci-theme-prism.previous

clear_cache() {
	rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache 2>/dev/null || true
}

if [ "$1" = "uninstall" ]; then
	prev="$(cat "$PREV" 2>/dev/null || echo /luci-static/bootstrap)"
	uci set luci.main.mediaurlbase="$prev"
	uci -q delete luci.themes.Prism || true
	uci commit luci
	rm -rf "$WWW/prism" "$TPL" "$WWW/resources/menu-prism.js" "$PREV"
	clear_cache
	echo "Prism removed, theme restored to $prev"
	exit 0
fi

[ -d /usr/share/ucode/luci/template ] || { echo "LuCI ucode templates not found (needs LuCI 23.05+)"; exit 1; }

# refuse to activate templates that do not compile
if command -v ucode >/dev/null 2>&1; then
	for f in ucode/template/themes/prism/*.ut; do
		ucode -T -c -o /dev/null "$f" || { echo "template check failed: $f"; exit 1; }
	done
fi

mkdir -p "$WWW/prism" "$TPL"
cp -r htdocs/luci-static/prism/. "$WWW/prism/"
cp htdocs/luci-static/resources/menu-prism.js "$WWW/resources/"
cp ucode/template/themes/prism/*.ut "$TPL/"

cur="$(uci -q get luci.main.mediaurlbase || true)"
[ -n "$cur" ] && [ "$cur" != "/luci-static/prism" ] && echo "$cur" > "$PREV"

uci set luci.themes.Prism=/luci-static/prism
uci set luci.main.mediaurlbase=/luci-static/prism
uci commit luci
clear_cache

echo "Prism installed (uninstall restores: $(cat "$PREV" 2>/dev/null || echo /luci-static/bootstrap))"
