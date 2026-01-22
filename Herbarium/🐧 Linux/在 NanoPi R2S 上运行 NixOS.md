---
lastUpdated: 2026-01-17
slug: nanopi-r2s-nixos
draft: false
---

Noa 手头有一个 NanoPi R2S。

之前它挂在家庭网络出口做软路由，运行 OpenWRT + OpenClash，但由于实在不稳定（不定时死机）+ 会神秘拖慢 DNS 解析所以被撤了下来吃灰。

直到前两天 Noa 突然想玩 DN42... 希望能跑在家里方便玩，但是缺一台设备做持久在线的服务器（之前的 PVE 迷你主机被我征用来做桌面电脑了），于是打起了 R2S 的主意。因为比起 OpenWRT 我更熟悉 + 更喜欢 NixOS，需要先想办法给 R2S 做一点改造。

## 准备工作

R2S 的资料可以在 [这里](https://wiki.friendlyelec.com/wiki/index.php/NanoPi_R2S/zh) 查阅到，Rockchip RK3328 的 CPU，使用 u-boot 引导。

对于 Rockchip 芯片，在 [这里](https://opensource.rock-chips.com/wiki_Boot_option) 可以了解到它的启动流程：

1. BootROM 加载（固件）
2. BootROM 载入 idbloader.img（TPL/SPL），初始化 DDR 并加载 u-boot
3. u-boot 寻找有效的启动方式（在启动 Linux 的时候可以使用 [Extlinux Bootmeth](https://docs.u-boot.org/en/latest/develop/bootstd/extlinux.html#extlinux-bootmeth)）
4. u-boot 根据 `extlinux.conf` 的内容加载 initrd/kernel image 并引导

![Rockchip boot sequence](https://opensource.rock-chips.com/images/c/cd/Rockchip_bootflow20181122.jpg)

```md
+------------+--------------+--------------+---------------+---------------------------+
| Boot phase | Terminology  | Program name | RK image name | Image location            |
+------------+--------------+--------------+---------------+---------------------------+
| 1          | Primary      | ROM code     | BootRom       |                           |
|            | Program      | Loader       |               |                           |
+------------+--------------+--------------+---------------+---------------------------+
| 2          | Secondary    | U-Boot       | idbloader.img | 0x40                      | pre-loader
|            | Program      | TPL/SPL      |               |                           |
|            | Loader (SPL) |              |               |                           |
+------------+--------------+--------------+---------------+---------------------------+
| 3          | -            | U-Boot       | u-boot.itb    | 0x4000                    | u-boot + ATF
|            |              |              | uboot.img     |                           | only used with miniloader
|            |              | ATF/TEE      | trust.img     | 0x6000                    | only miniloader
+------------+--------------+--------------+---------------+---------------------------+
| 4          | -            | kernel       | boot.img      | 0x8000                    |
+------------+--------------+--------------+---------------+---------------------------+
| 5          | -            | rootfs       | rootfs.img    | 0x40000                   |
+------------+--------------+--------------+---------------+---------------------------+
```

## 配置 binfmt

在编译机的 NixOS Configuration 中配置 [binfmt](https://search.nixos.org/options?channel=unstable&query=boot.binfmt.emulatedSystems) 来支持构建 `aarch64-linux` 产物。

```nix
boot.binfmt.emulatedSystems = [ "aarch64-linux" ];
```

## 准备 NixOS 配置

秉持着先把系统跑起来再折腾其他服务的原则，Noa 准备的是一份极简 NixOS 系统配置（[系统配置](https://github.com/AsterisMono/flake/blob/e66d2bc4b2a87cf0b8ca61fd5e1326f7163d6c36/nixosConfigurations/ivy.nix)、[硬件配置](https://github.com/AsterisMono/flake/blob/794719e2df37a5bbcc5e2340cce7a4b0f244ccd7/hardwares/ivy.nix)）。

大量参（chao）考（xi）了 [EHfive 的 flake](https://github.com/EHfive/flakes)，谢谢您！也请去上游查阅原配置吧～

## 打包/写入 U-boot

nixpkgs 里提供了 `buildUBoot` 函数（[源码](https://github.com/NixOS/nixpkgs/blob/master/pkgs/misc/uboot/default.nix)、[文档](https://wiki.nixos.org/w/index.php?title=U-Boot&mobileaction=toggle_view_desktop)）：

```nix
{
  buildUBoot,
  armTrustedFirmwareRK3328,
  lib,
}@args:
# Taken from: https://github.com/EHfive/flakes/blob/main/packages/uboot-nanopi-r2s/default.nix
let
  armTrustedFirmwareRK3328 = args.armTrustedFirmwareRK3328.overrideAttrs (_: {
    NIX_LDFLAGS = "--no-warn-execstack --no-warn-rwx-segments";
    enableParallelBuilding = true;
  });
in
buildUBoot {
  defconfig = "nanopi-r2s-rk3328_defconfig";
  extraPatches = [
    ./expand-kernel-image-addr-space.patch
  ];
  extraMeta.platforms = [ "aarch64-linux" ];
  BL31 = "${armTrustedFirmwareRK3328}/bl31.elf";
  enableParallelBuilding = true;
  filesToInstall = [
    "u-boot.itb"
    "idbloader.img"
    "u-boot-rockchip.bin"
  ];
}
```

```console
❯ nix build .#packages.aarch64-linux.uboot-nanopi-r2s.default
❯ ls result/
.r--r--r-- 127k nobody  1 1 月   1970 idbloader.img
dr-xr-xr-x    - nobody  1 1 月   1970 nix-support
.r--r--r-- 9.4M nobody  1 1 月   1970 u-boot-rockchip.bin
.r--r--r-- 995k nobody  1 1 月   1970 u-boot.itb
```

将 idbloader.img 写入到 0x40 位置，u-boot.itb 写入到 0x4000 位置：

```console
❯ sudo dd if=idbloader.img of=/dev/sda seek=64 conv=notrunc,fsync
126976 字节 (127 kB, 124 KiB) 已复制，0.00459187 s，27.7 MB/s
❯ sudo dd if=u-boot.itb of=/dev/sda seek=16384 conv=notrunc,fsync
994816 字节 (995 kB, 972 KiB) 已复制，0.250188 s，4.0 MB/s
```

## 分区

使用 `fdisk` 进行分区，第一个分区作为 `/boot`，预留 512MB，其余空间作为 root。由于 [u-boot 支持 ext4](https://u-boot.org/blog/filesystems-in-u-boot/)，这里就不使用 vfat 了：

```console
❯ sudo fdisk /dev/sda

欢迎使用 fdisk (util-linux 2.41.1)。
更改将停留在内存中，直到您决定将更改写入磁盘。
使用写入命令前请三思。

命令（输入 m 获取帮助）：n
分区号 (1-128, 默认  1):
第一个扇区 (2048-61067230, 默认 2048): 32768
最后一个扇区，+/-sectors 或 +size{K,M,G,T,P} (32768-61067230, 默认 61065215): +512M

创建了一个新分区 1，类型为“Linux filesystem”，大小为 512 MiB。

命令（输入 m 获取帮助）：n
分区号 (2-128, 默认  2):
第一个扇区 (2048-61067230, 默认 1081344):
最后一个扇区，+/-sectors 或 +size{K,M,G,T,P} (1081344-61067230, 默认 61065215):

创建了一个新分区 2，类型为“Linux filesystem”，大小为 28.6 GiB。

命令（输入 m 获取帮助）：w
分区表已调整。
将调用 ioctl() 来重新读分区表。
正在同步磁盘。

❯ sudo mkfs.ext4 -L NIXOS_BOOT /dev/sda1

❯ sudo mkfs.ext4 -L NIXOS_SD /dev/sda2
```

## 安装 Nix Store

到这里正常的流程是将 `NIXOS_SD` 挂载到 `/mnt`，`NIXOS_BOOT` 挂载到 `/mnt/boot`，然后使用 `nixos-install` 安装系统。但实际这样操作的时候发现，只要在 `nix build` 这步使用 `--store /mnt` 指定了目标 store 的位置，就会有一些 drv 构建失败：

```console
❯ sudo nix build .#nixosConfigurations.ivy.config.system.build.toplevel --store /mnt
error: builder for '/nix/store/yyap2m1f7dx00my9k8axhlxnc0wza1ha-builder.pl.drv' failed with exit code 255
error: builder for '/nix/store/ip8pwb70j7lxggx5dmaajk0iz6v7gg6w-chfn.pam.drv' failed with exit code 255
error: builder for '/nix/store/qxibnq8vvmg69m61rmzn2hml7651r5pj-mounts.sh.drv' failed with exit code 255
error: 1 dependencies of derivation '/nix/store/i69z3q24hvadgsm48vk3zgkl38mx6ghf-nixos-system-ivy-25.05.20250817.48f4c98.drv' failed to build
```

猜测可能是使用 `binfmt` 模拟 aarch64 结构进行构建，导致了一些神秘的兼容性问题。最后采取了先本地 build，再 `nix copy` 到目标 store 的迂回策略。

```console
❯ sudo nix copy --to /mnt ./result --no-check-sigs
❯ sync
❯ sudo nix store info --store /mnt
Store URL: local
Version: 2.28.4
Trusted: 1
```

:::caution

之前尝试在 root 分区上使用 f2fs，然后翻车了。

```console
❯ sync
❯ sudo nix store info --store /mnt
error: executing SQLite statement 'pragma synchronous = normal': disk I/O error, disk I/O error (in '/mnt/nix/var/nix/db/db.sqlite`)
```

:::

## 安装 Bootloader

Bootloader 安装上遇到了一些问题，`nixos-install` 自动安装会报错：

```console
❯ sudo nixos-install --flake /home/cmiki/Projects/flake#ivy --root /mnt --verbose --show-trace --no-root-passwd
building the flake in git+file:///home/cmiki/Projects/flake?ref=refs/heads/main&rev=12a02d8069985cdd5d7b3a0977c3b57f6254d363...
evaluating file '<nix/derivation-internal.nix>'
installing the boot loader...
chroot: failed to run command ‘/nix/var/nix/profiles/system/activate’: No such file or directory
chroot: failed to run command ‘/nix/var/nix/profiles/system/sw/bin/bash’: No such file or directory
```

看起来像 chroot 问题，由于已经在 NixOS 配置中指定了 `boot.generic-extlinux-compatible.enable = true`，进系统之后的 `nixos-rebuild` 大概率是可以正常生成 boot 配置的。考虑在 bootstrap 阶段手动安装 kernel 和 initrd，并手写一个 `extlinux.conf`。

这里 init 的位置可以放心写死，因为下一次 rebuild 的时候就会被更新替换掉。

```console
❯ nix build .#nixosConfigurations.ivy.config.system.build.toplevel
❯ sudo install -Dm644 "$(readlink -f result/kernel)" /mnt/boot/Image
❯ sudo install -Dm644 "$(readlink -f result/initrd)" /mnt/boot/initrd
❯ sudo install -Dm644 result/dtbs/rockchip/rk3328-nanopi-r2s.dtb /mnt/boot/rk3328-nanopi-r2s.dtb

❯ ls nix/store/crzbn8gb8c1gs54wdw2kgizxmwp1pq0i-nixos-system-ivy-25.05.20250817.48f4c98/init
.r-xr-xr-x 4.4k root  1 1 月   1970 nix/store/crzbn8gb8c1gs54wdw2kgizxmwp1pq0i-nixos-system-ivy-25.05.20250817.48f4c98/init

❯ sudo mkdir -p /mnt/boot/extlinux
❯ sudo touch /mnt/boot/extlinux/extlinux.conf
```

```conf
DEFAULT NixOS
TIMEOUT 1
LABEL NixOS
    KERNEL /Image
    INITRD /initrd
    FDT /rk3328-nanopi-r2s.dtb
    APPEND console=ttyS2,1500000 earlycon=uart8250,mmio32,0xff130000 root=LABEL=NIXOS_SD rootfstype=ext4 rootwait init=/nix/store/crzbn8gb8c1gs54wdw2kgizxmwp1pq0i-nixos-system-ivy-25.05.20250817.48f4c98/init
```

最后检查一下 `/boot` 的布局，并重新运行附加了 `--no-bootloader` 的 `nixos-install`：

```console
❯ tree /mnt/boot
/mnt/boot
├── extlinux
│   └── extlinux.conf
├── Image
├── initrd
└── rk3328-nanopi-r2s.dtb

❯ sudo nixos-install --flake /home/cmiki/Projects/flake#ivy --root /mnt --verbose --show-trace --no-bootloader --no-root-passwd
building the flake in git+file:///home/cmiki/Projects/flake...
evaluating file '<nix/derivation-internal.nix>'
installation finished!
```

## 上电启动

于是它就这样跑起来了～

![[Pasted image 20260117145330.png]]

:::note

EHfive 的 [原配置](https://github.com/EHfive/flakes/blob/5ce77ec77db5ec2d14e29a9b0a8db46282569595/machines/r2s/hardware.nix#L136) 中，两个指示灯配置到了自定义网络接口上。

一般使用可以先将其配置为真实设备（WAN 为 `end0`，LAN 为 `enu1`）。

（[为什么不是 eth0/eth1?](https://www.freedesktop.org/wiki/Software/systemd/PredictableNetworkInterfaceNames/)）

:::

## 接下来要做的事...

- [ ] 配置 root 的 ext4 文件系统参数，照顾 SD 卡寿命
- [ ] 仿照之前做过的 kukui-nixos，写一个能打包出可刷写 SD Image 的 derivation
- [ ] 配置 flake 系统自动更新
- [ ] 用这台小机器试玩 DN42
