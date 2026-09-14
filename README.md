# luci-theme-prism

A LuCI theme with an animated aurora background, glass cards, and neon (cyan → violet → pink) accents.

## Features

- **Animated background**: three drifting light orbs, a perspective grid, and a noise texture.
- **Glass cards**: `.cbi-section` cards get a gradient hairline border and a glow that follows the pointer.
- **Sidebar**: accordion menu with icons, an active-item glow bar, staggered entry animation, and an off-canvas drawer on mobile.
- **Top bar**: page title, pill-shaped status indicators, and a neon clock.
- **Forms**: glowing focus rings, spectrum-gradient primary buttons, spring-animated toggle switches, and a sticky action bar.
- **Tables and progress bars**: row hover highlight, animated striped progress bars, and cards instead of tables on mobile.
- **Modals and alerts**: blurred overlay, spring pop-in animation, and a colored icon for each alert type.
- **Login page**: rotating conic-gradient border, floating labels, and a light sweep on the button.
- Honors `prefers-reduced-motion`.

## Layout

```
luci-theme-prism/
├─ Makefile
├─ htdocs/luci-static/
│  ├─ prism/              cascade.css → core / layout / forms / widgets, login.css, favicon.svg
│  └─ resources/menu-prism.js
├─ ucode/template/themes/prism/   header.ut, footer.ut, sysauth.ut
├─ root/etc/uci-defaults/30_luci-theme-prism
└─ preview/               index.html, login.html (open without a router)
```

## Requirements

- LuCI 23.05 or newer (ucode templates). Depends on `luci-base`.
- The package is architecture-independent (`all`): the same file installs on any router.

## Install a released package

Download the file for your OpenWrt version from the Releases page and copy it to `/tmp` on the router.

```sh
# OpenWrt 25.12+ (apk)
apk add --allow-untrusted /tmp/luci-theme-prism-*.apk

# OpenWrt 23.05 / 24.10 (opkg)
opkg install /tmp/luci-theme-prism_*_all.ipk
```

Installing makes Prism the active theme. Uninstall with `apk del luci-theme-prism` or `opkg remove luci-theme-prism`, then pick another theme under System → System → Language and Style.

## Build

GitHub Actions (`.github/workflows/build.yml`) builds both formats on every push. Pushing a tag like `v1.0.0` attaches them to a release.

Local build with an SDK or buildroot:

```sh
git clone <this repo> package/luci-theme-prism
make menuconfig   # LuCI → Themes → luci-theme-prism
make package/luci-theme-prism/compile V=s
```

## Quick test on a running router (no build)

```sh
scp -r htdocs/luci-static/prism root@192.168.1.1:/www/luci-static/
scp htdocs/luci-static/resources/menu-prism.js root@192.168.1.1:/www/luci-static/resources/
ssh root@192.168.1.1 mkdir -p /usr/share/ucode/luci/template/themes/prism
scp ucode/template/themes/prism/*.ut root@192.168.1.1:/usr/share/ucode/luci/template/themes/prism/
ssh root@192.168.1.1 "uci set luci.themes.Prism=/luci-static/prism; uci set luci.main.mediaurlbase=/luci-static/prism; uci commit luci"
```

## Customizing

Change the color tokens in `:root` at the top of `core.css` (`--cyan`, `--violet`, `--pink`, `--spectrum`) to recolor the whole theme.
