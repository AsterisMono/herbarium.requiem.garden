---
lastUpdated: 2026-01-17
slug: tailscale-mysterious-derper-bug
draft: false
---
## 症状

搭建 Tailscale Derper 服务，客户端连接到 Derper 时能 ping 通（`tailscale netcheck` 能够显示出延迟），但无法建立实际的 Derper 连接。

`tailscale derper debug 900` 报错：certificate signed by unknown authority。

```json
{
  "Info": [
    "Region 900 == \"wuh\""
  ],
  "Warnings": null,
  "Errors": [
    "Error upgrading connection to node \"10.1.2.3\" @ \"10.1.2.3:443\" to TLS over IPv4: tls: failed to verify certificate: x509: certificate signed by unknown authority"
  ]
}
```

Derper 启动指令：

```bash
derper --hostname="10.1.2.3" --certmode manual --certdir /etc/derper/certs --verify-clients
```

相关功能实现 Issues 和 PR：

- <https://github.com/tailscale/tailscale/issues/11776>
- <https://github.com/tailscale/tailscale/pull/15208>

## 初步分析

和使用常规 CA 签署的域名证书不同，使用自签名证书验证需要提前将 Derper 输出的证书 sha256 hash 写入到 tailnet ACL policy 中，客户端在连接 Derper 时通过这个 hash 认证证书有效性。

例如：

```json
{
  "derpMap": {
    "Regions": {
      "900": {
        "RegionID": 900,
        "RegionCode": "wuh",
        "RegionName": "Wuhan",
        "Nodes": [
          {
            "Name": "Aliyun",
            "RegionID": 900,
            "HostName": "10.1.2.3",
            "IPv4": "10.1.2.3",
            "CertName": "sha256-raw:38cb38778e208445160bcb3edcacecff5310b6d77fdfcb71232904ac31b09821"
          }
        ]
      }
    }
  }
}
```

此处复用了 `CertName` 属性，正常情况下这个属性用于覆盖证书中的实体名字。在 Derp Client 建立连接时会进行特判，检查 `CertName` 是否由 `sha256-raw` 开头（[源代码](https://github.com/tailscale/tailscale/blob/7fac0175c08565076f92b9ae4d2742dc8abda9af/derp/derphttp/derphttp_client.go#L655)）；如果满足这种情况，会调用 `SetConfigExpectedCertHash` 绕开 `crypto/tls` 的证书检查，转而执行以下几项检查：

- 应只提供一个证书

``` go
if len(rawCerts) > 1 {
 return errors.New("unexpected multiple certs presented")
}
```

- 证书 Hash 应当与预期 Hash 相符

```go
if fmt.Sprintf("%02x", sha256.Sum256(rawCerts[0])) != wantFullCertSHA256Hex {
  return fmt.Errorf("cert hash does not match expected cert hash")
}
```

- 证书的 ServerName 应当与预期的 Host（IP 地址）一致，且处于有效期内

```go
if err := cert.VerifyHostname(c.ServerName); err != nil {
  return fmt.Errorf("cert does not match server name %q: %w", c.ServerName, err)
}
now := time.Now()
if now.After(cert.NotAfter) {
  return fmt.Errorf("cert expired %v", cert.NotAfter)
}
if now.Before(cert.NotBefore) {
  return fmt.Errorf("cert not yet valid until %v; is your clock correct?", cert.NotBefore)
}
```

Derper 在设定了手动证书模式 `--certmode manual` 并且选用 IP 作为 hostname 的情况下，如果没有找到证书，Derper 会帮我们生成一个：

> if you run derper with `--certmode=manual` and `--hostname=$IP_ADDRESS`
> we previously permitted, but now we also:
>
> - auto-generate the self-signed cert for you if it doesn't yet exist on disk
> - print out the derpmap configuration you need to use that
> self-signed cert

但 Derper 的 443 端口却发过来了两个 certificate：

```bash
❯ openssl s_client -connect 10.1.2.3:443 -showcerts
CONNECTED(00000003)
depth=0 CN = 10.1.2.3
verify error:num=20:unable to get local issuer certificate
verify return:1
depth=0 CN = 10.1.2.3
verify error:num=21:unable to verify the first certificate
verify return:1
write W BLOCK
---
Certificate chain
 0 s:/CN=10.1.2.3
   i:/CN=10.1.2.3
-----BEGIN CERTIFICATE-----
MIIB...Kbv
-----END CERTIFICATE-----
 1 s:/CN=derpkey5294bb9649526c28a36c976721ff055b8b6a708f2aa58663449e63fb8470b454
   i:/CN=derpkey5294bb9649526c28a36c976721ff055b8b6a708f2aa58663449e63fb8470b454
-----BEGIN CERTIFICATE-----
MIIB...HEQU=
-----END CERTIFICATE-----
---
Server certificate
subject=/CN=10.1.2.3
issuer=/CN=10.1.2.3
---
No client certificate CA names sent
Server Temp Key: ECDH, X25519, 253 bits
---
SSL handshake has read 1093 bytes and written 351 bytes
---
New, TLSv1/SSLv3, Cipher is AEAD-CHACHA20-POLY1305-SHA256
Server public key is 256 bit
Secure Renegotiation IS NOT supported
Compression: NONE
Expansion: NONE
No ALPN negotiated
SSL-Session:
    Protocol  : TLSv1.3
    Cipher    : AEAD-CHACHA20-POLY1305-SHA256
    Session-ID:
    Session-ID-ctx:
    Master-Key:
    Start Time: 1744094442
    Timeout   : 7200 (sec)
    Verify return code: 21 (unable to verify the first certificate)
---
```

Tailscale 控制台也给出了对应的警报，并且拒绝了连接：

![[Pasted image 20260117145931.png]]

引入一个 patch，在处理自签证书的位置尝试打印证书数量，证实了以上猜测。

```diff
diff --git a/net/tlsdial/tlsdial.go b/net/tlsdial/tlsdial.go
index 4d22383ef..1cef31e87 100644
--- a/net/tlsdial/tlsdial.go
+++ b/net/tlsdial/tlsdial.go
@@ -260,6 +260,7 @@ func SetConfigExpectedCertHash(c *tls.Config, wantFullCertSHA256Hex string) {
  c.InsecureSkipVerify = true
  c.VerifyConnection = nil
  c.VerifyPeerCertificate = func(rawCerts [][]byte, _ [][]*x509.Certificate) error {
+  fmt.Println("!!!!!!!!!!!!!! length of rawCerts", len(rawCerts))
   if len(rawCerts) == 0 {
    return errors.New("no certs presented")
   }
@@ -283,6 +284,7 @@ func SetConfigExpectedCertHash(c *tls.Config, wantFullCertSHA256Hex string) {
   if now.Before(cert.NotBefore) {
    return fmt.Errorf("cert not yet valid until %v; is your clock correct?", cert.NotBefore)
   }
+  fmt.Println("!!!!!!!!!!!!!! cert is valid")
   return nil
  }
 }
```

```log
derphttp.Client.Recv: connecting to derp-900 (wuh)
!!!!!!!!!!!!!! length of rawCerts 2
magicsock: [0x14000116000] derp.Recv(derp-900): derphttp.Client.Recv connect to region 900 (wuh): unexpected multiple certs presented
```

## 证书数量之谜

这里就出现了两个问题：

1. 为什么 TLS 握手过程中 Derper 会发过来两个证书？
2. 为什么 `tailscale debug derp 900` 的报错显示的是 `certificate signed by unknown authority`，而不是 `unexpected multiple certs presented`？

第二个问题很好回答：因为 `debug` 命令是另一套代码，这套 [代码](https://github.com/tailscale/tailscale/blob/ad2b075d4f412fa473bcf0ccbbf0d49081570237/ipn/localapi/debugderp.go#L101) 忽视了自签名 IP 证书这个 Feature，直接使用了 `tls.Client` 来验证证书（扶额）。

```go
// Upgrade to TLS and verify that works properly.
tlsConn := tls.Client(conn, &tls.Config{
  ServerName: cmp.Or(derpNode.CertName, derpNode.HostName),
})
if err := tlsConn.HandshakeContext(ctx); err != nil {
  st.Errors = append(st.Errors, fmt.Sprintf("Error upgrading connection to node %q @ %q to TLS over IPv4: %v", derpNode.HostName, addr, err))
} else {
  hasIPv4 = true
}
```

而第一个问题相对复杂一些。检查发来的第二个证书，发现它的 CN 是一个很长的字符串，`derpkey5294bb9649526c28a36c976721ff055b8b6a708f2aa58663449e63fb8470b454`。

在源码中搜索 `derpkey`，发现一个名叫 `parseMetaCert` 的 [方法](https://github.com/tailscale/tailscale/blob/ad2b075d4f412fa473bcf0ccbbf0d49081570237/derp/derphttp/derphttp_client.go#L1151)：

```go
func parseMetaCert(certs []*x509.Certificate) (serverPub key.NodePublic, serverProtoVersion int) {
 for _, cert := range certs {
  // Look for derpkey prefix added by initMetacert() on the server side.
  if pubHex, ok := strings.CutPrefix(cert.Subject.CommonName, "derpkey"); ok {
   var err error
   serverPub, err = key.ParseNodePublicUntyped(mem.S(pubHex))
   if err == nil && cert.SerialNumber.BitLen() <= 8 { // supports up to version 255
    return serverPub, int(cert.SerialNumber.Int64())
   }
  }
 }
 return key.NodePublic{}, 0
}
```

这里提到了一个新概念：`MetaCert`。[tailscale.com/derp](https://pkg.go.dev/tailscale.com/derp#section-readme) 文档中描述如下：

> MetaCert returns the server metadata cert that can be sent by the TLS server to let the client skip a round trip during start-up.

检查 [源码](https://github.com/tailscale/tailscale/blob/ad2b075d4f412fa473bcf0ccbbf0d49081570237/derp/derp_server.go#L611)，在 `initMetaCert` 方法处找到了更为详细的注释。

```go
// initMetacert initialized s.metaCert with a self-signed x509 cert
// encoding this server's public key and protocol version. cmd/derper
// then sends this after the Let's Encrypt leaf + intermediate certs
// after the ServerHello (encrypted in TLS 1.3, not that it matters
// much).
//
// Then the client can save a round trip getting that and can start
// speaking DERP right away. (We don't use ALPN because that's sent in
// the clear and we're being paranoid to not look too weird to any
// middleboxes, given that DERP is an ultimate fallback path). But
// since the post-ServerHello certs are encrypted we can have the
// client also use them as a signal to be able to start speaking DERP
// right away, starting with its identity proof, encrypted to the
// server's public key.
//
// This RTT optimization fails where there's a corp-mandated
// TLS proxy with corp-mandated root certs on employee machines and
// and TLS proxy cleans up unnecessary certs. In that case we just fall
// back to the extra RTT.
func (s *Server) initMetacert() {
```

正常情况下客户端首先与 Derp 服务器进行 TLS 握手，握手成功后还需要再交换一些 metadata（服务器公钥、协议版本等 Derp 协议需要用到的数据）。

由于在 TLS1.3 之后，ServerHello 之后的所有内容（包括证书）[都会被加密](https://datatracker.ietf.org/doc/html/rfc8446#section-1.2:~:text=All%20handshake%20messages%20after%20the%20ServerHello%20are%20now%20encrypted.%0A%20%20%20%20%20%20The%20newly%20introduced%20EncryptedExtensions%20message%20allows%20various%0A%20%20%20%20%20%20extensions%20previously%20sent%20in%20the%20clear%20in%20the%20ServerHello%20to%20also%0A%20%20%20%20%20%20enjoy%20confidentiality%20protection.)，因此可以直接在服务器启动时本地自签一个证书，使用它的 CN 属性传递这些信息，这个证书只相当于信息载体，随着 TLS 握手过程一起发送给 Client，免去了一轮 RTT。

于是乎这里就出现了两个 cert，其中第一个是真正的 HTTPS Certificate，第二个一定是自签的信封～

## 解决方案

两个位置都需要修改：

1. Derp Client 在连接时需要允许最多出现 2 个证书。由于在设置验证规则时还没有真正建立连接，所以很不幸地不能用 TLS 版本做区分。
2. `debug derp` 代码需要改用 Derp Client 定制的 TLS Client，或者单独增加对自签 IP 证书的支持。我最后选择的实现方式是后者，前者耦合太多。

最终提交给 Tailscale 的 PR 在这里：[net/tlsdial, ipn/localapi: fix self-signed IP cert with DERP](https://github.com/tailscale/tailscale/pull/15580)
