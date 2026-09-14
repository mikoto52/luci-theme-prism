#
# Copyright (C) 2026
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=Prism - luminous aurora / glassmorphism theme
LUCI_DEPENDS:=+luci-base
PKG_LICENSE:=Apache-2.0
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

# standalone feed/package: luci.mk comes from the luci feed of the buildroot/SDK
include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
