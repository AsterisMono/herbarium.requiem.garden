---
lastUpdated: 2026-01-17
slug: openwrt-mwan3
draft: false
---
## 起因

悲惨的故事

![[Pasted image 20260117145430.png]]

## 写入镜像

使用官方 OpenWRT，x86_64 构建。下载地址在 [这里](https://downloads.openwrt.org/releases/24.10.0/targets/x86/64/)！

随便找个 Linux 发行版的 LiveCD，将镜像写入磁盘。由于这台机器暂时只准备做路由使用，没有做分区扩容。

写入磁盘：

```bash
gunzip -c openwrt-24.10.0-x86-64-generic-squashfs-combined-efi.img.gz | sudo dd of=/dev/nvme0n1 bs=4M status=progress
```

重启进入 OpenWRT 引导，修改默认密码，将电脑连接到路由机的 `eth0` 接口（这里的情况是主板板载的网口），启用 DHCP，拿到 IP 后访问 192.168.1.1 进入 LuCI 界面。

在 Interfaces - Devices 中可以看到所有的网络接口，不需要额外安装驱动，OpenWRT 对这张网卡有内建支持。

![[Pasted image 20260117145453.png]]

## WAN 配置

首先要移除默认的 WAN 口配置，准备将这张网卡的 4 口全部分配为 WAN。

前往 Interfaces 标签，删除原 wan 和 wan6 口，应用一次设置：

![[Pasted image 20260117145507.png]]

点击 Add new interface 建立新的 WAN 口，这个动作需要重复 4 次，接口名分别为 wan1\~wan4，设备对应选择 eth1\~eth4。

在高级设置中有两点需要注意：

- Advanced Settings 中，`Use gateway metric` 应分别设为 10/20/30/40。
  - 这一点非常重要！没有正确设置 metric 会导致 wan 网关规则互相覆盖（？），造成连接失效。
  - 参考：[mwan3文档](https://openwrt.org/docs/guide-user/network/wan/multiwan/mwan3#configure_a_different_metric_for_each_wan_interface)
- Firewall Settings 中，`Assign firewall-zone` 设置为 wan，将接口分配给 wan。

保存并应用：

![[Pasted image 20260117145522.png]]

这时要先将其中一条网线插在 wan1 上，测试下网络联通性。

如果电脑无法上网（或路由器能上网但电脑不能上网），可以重启路由器再试试。

## 负载均衡配置

接下来设置 mwan3 负载均衡，这个包需要额外安装。

替换 Tuna 镜像源：

```bash
sed -i 's_https\?://downloads.openwrt.org_https://mirrors.tuna.tsinghua.edu.cn/openwrt_' /etc/opkg/distfeeds.conf

opkg update
```

安装 mwan3 和 luci 控制面板：

```bash
opkg install mwan3 luci-app-mwan3
```

重新进入 LuCI，转到 Network - MultiWAN Manager，将其中自带的 Interface、Member 全部删除，Policy 除 balanced 外也全部删除，rule 中的 https 删除，然后应用一次设置。

![[Pasted image 20260117145535.png]]

使用页面左下角的输入框重新添加接口：

- 命名分别为 wan1~wan4
- 勾选 `Enabled` 复选框
- 如果对网络质量有信心（即大部分时间这条线路都应该可以即插即用），`Initial state` 选 Online。否则选 Offline
- `Tracking hostname or IP address` 设置为 baidu.com，或者其他你喜欢的网站
- 检测间隔和容忍度，可以根据对线路质量的估测自行调整

![[Pasted image 20260117145546.png]]

接口添加好后，为每个接口创建一个 Member，分别命名为 wan1_m1\~wan4_m1。详细设置中 `metric` 是连接优先级，数值越低，优先级越高；`weight` 是分流权重，推荐根据不同线路的带宽比例来配置。由于实验室四路内网线都是 100M，我这里直接选择了默认值（均为 1）。

![[Pasted image 20260117145554.png]]

最后修改 `balanced` Policy，将 `Member used` 填写为上一步创建的所有 member。

![[Pasted image 20260117145603.png]]

其他内容可以不做修改，点击应用设置，完成后转到 Status - MultiWAN Manager，应该可以看到 4 个配置好的负载均衡接口，其中 wan1 状态显示 Online。

![[Pasted image 20260117145610.png]]

接下来可以接上其余几根网线到 wan2~wan4 口：

![[Pasted image 20260117145622.png]]

确认每个接口状态正常且能正常上网后，将下级路由器接到 eth0 口，配置好 DHCP，就可以使用了。

## 标准结局

![[Pasted image 20260117145632.png]]

![[Pasted image 20260117145640.png]]
