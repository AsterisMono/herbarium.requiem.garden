---
title: 'Bug Tracking: Tailscale Derper Self-Signed IP Certificate Connection Problem'
editUrl: false
slug: en/tailscale-mysterious-derper-bug
lastUpdated: 2026-01-17T00:00:00.000Z
draft: false
banner:
  content: This content is translated by an LLM and may contain inaccuracies.
---

## Symptoms

When setting up Tailscale Derper service, the client can ping when connected to Derper (`tailscale netcheck` shows latency), but it cannot establish an actual Derper connection.

`tailscale derper debug 900` error: certificate signed by unknown authority.

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

Derper startup command:

```bash
derper --hostname="10.1.2.3" --certmode manual --certdir /etc/derper/certs --verify-clients
```

Related Issues and PRs for feature implementation:

* [https://github.com/tailscale/tailscale/issues/11776](https://github.com/tailscale/tailscale/issues/11776)
* [https://github.com/tailscale/tailscale/pull/15208](https://github.com/tailscale/tailscale/pull/15208)

## Preliminary Analysis

Unlike using domain certificates signed by regular CAs, self-signed certificate verification requires writing the sha256 hash of the certificate output by Derper into the tailnet ACL policy in advance for the client to verify the validity of the certificate when connecting to Derper.

For example:

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

Here the `CertName` attribute is reused; normally, this attribute is used to override the entity name in the certificate. When Derp Client establishes a connection, a special check is made to see if `CertName` begins with `sha256-raw` ([source code](https://github.com/tailscale/tailscale/blob/7fac0175c08565076f92b9ae4d2742dc8abda9af/derp/derphttp/derphttp_client.go#L655)); if so, `SetConfigExpectedCertHash` is used to bypass `crypto/tls` certificate checks in favor of the following checks:

* Only one certificate should be provided

```go
if len(rawCerts) > 1 {
 return errors.New("unexpected multiple certs presented")
}
```

* Certificate hash should match the expected hash

```go
if fmt.Sprintf("%02x", sha256.Sum256(rawCerts[0])) != wantFullCertSHA256Hex {
  return fmt.Errorf("cert hash does not match expected cert hash")
}
```

* Certificate's ServerName should match the expected Host (IP address) and be within the valid period

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

If Derper is set in manual certificate mode `--certmode manual` and IP is selected as the hostname, if no certificate is found, Derper will generate one for us:

> if you run derper with `--certmode=manual` and `--hostname=$IP_ADDRESS`
> we previously permitted, but now we also:
>
> * auto-generate the self-signed cert for you if it doesn't yet exist on disk
> * print out the derpmap configuration you need to use that
>   self-signed cert

But two certificates are sent from Derper's 443 port:

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

Tailscale console also provided corresponding alerts and rejected the connection:

![Pasted image 20260117145931.png](../../../../../assets/notes/附件/pasted-image-20260117145931.png)

A patch was introduced to attempt to print the number of certificates in the location handling the self-signed certificate, confirming the above suspicion.

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

## The Mystery of Certificate Quantity

Two questions arise here:

1. Why are two certificates being sent by Derper during the TLS handshake?
2. Why does the `tailscale debug derp 900` error show `certificate signed by unknown authority` instead of `unexpected multiple certs presented`?

The second question is easy to answer: because the `debug` command is a different set of code, this [code](https://github.com/tailscale/tailscale/blob/ad2b075d4f412fa473bcf0ccbbf0d49081570237/ipn/localapi/debugderp.go#L101) ignores the self-signed IP certificate feature and directly uses `tls.Client` to verify the certificate (facepalm).

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

The first question is relatively more complex. Examining the second certificate sent reveals a very long string in its CN, `derpkey5294bb9649526c28a36c976721ff055b8b6a708f2aa58663449e63fb8470b454`.

Searching the source code for `derpkey` reveals a method called `parseMetaCert` ([here](https://github.com/tailscale/tailscale/blob/ad2b075d4f412fa473bcf0ccbbf0d49081570237/derp/derphttp/derphttp_client.go#L1151)):

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

Here a new concept is introduced: `MetaCert`. The [tailscale.com/derp](https://pkg.go.dev/tailscale.com/derp#section-readme) documentation describes it as follows:

> MetaCert returns the server metadata cert that can be sent by the TLS server to let the client skip a round trip during start-up.

Checking the [source code](https://github.com/tailscale/tailscale/blob/ad2b075d4f412fa473bcf0ccbbf0d49081570237/derp/derp_server.go#L611), more detailed comments are found in the `initMetaCert` method.

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

Under normal circumstances, the client first performs a TLS handshake with the Derp server, and after a successful handshake, additional metadata still needs to be exchanged (server public key, protocol version, and other data required for the Derp protocol).

Since in TLS1.3, all content after ServerHello (including the certificate) [is encrypted](https://datatracker.ietf.org/doc/html/rfc8446#section-1.2:~:text=All%20handshake%20messages%20after%20the%20ServerHello%20are%20now%20encrypted.%0A%20%20%20%20%20%20The%20newly%20introduced%20EncryptedExtensions%20message%20allows%20various%0A%20%20%20%20%20%20extensions%20previously%20sent%20in%20the%20clear%20in%20the%20ServerHello%20to%20also%0A%20%20%20%20%20%20enjoy%20confidentiality%20protection.), it is possible to directly sign a certificate locally when the server starts, using its CN attribute to transfer this information. This certificate acts only as an information carrier, sent together with the TLS handshake process to the Client, eliminating an RTT.

Thus, two certs appear here, the first being the real HTTPS Certificate, and the second is definitely a self-signed envelope.

## Solution

Two changes are needed:

1. Derp Client needs to allow up to 2 certificates to appear during connection. Unfortunately, TLS version cannot be used to distinguish because the verification rules must be set before the actual connection is established.
2. The `debug derp` code needs to switch to the Derp Client customized TLS Client or separately add support for self-signed IP certificates. I chose the latter in the end because the former is too coupled.

The final PR submitted to Tailscale is here: [net/tlsdial, ipn/localapi: fix self-signed IP cert with DERP](https://github.com/tailscale/tailscale/pull/15580)
