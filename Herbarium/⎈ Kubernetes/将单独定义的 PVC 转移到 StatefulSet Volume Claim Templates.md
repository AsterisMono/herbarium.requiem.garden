---
lastUpdated: 2026-01-29
slug: standalone-pvc-migrate-to-pvc-template
draft: false
---
## 原始设置

`pds-pvc.yaml`

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pds-data
spec:
  accessModes: ["ReadWriteOnce"]
  storageClassName: longhorn
  resources:
    requests:
      storage: 20Gi
```

`pds-stateful-set.yaml`

```yaml
volumes:
  - name: pds-data
    persistentVolumeClaim:
      claimName: pds-data
```

目标是移除单独定义的 PVC（pds-data），使用 StatefulSet 中的 [Volume Claim Templates](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/#volume-claim-templates) 定义存储卷声明。

## 备份数据

:::caution

数据无价，谨慎操作

执行此操作前，请将 PV 对应的 Longhorn Volume Data 备份到 S3 备用

:::

## 关闭服务并移除 StatefulSet

```bash
kubectl delete -n atproto-pds statefulset pds-stateful-set
```

## PVC 替换

1. 将原 PVC 的 `persistentVolumeReclaimPolicy` 修改为 `Retain`，避免删除原 PVC 时 PV 和数据被一并删除。
2. 删除旧 PVC `pds-data`。
	- 完成后 PV 状态应从 `Bound` 变为 `Released`。
3. 移除 PV 的 `claimRef` 字段，将 PV 与已不存在的 PVC 解绑。
	- 完成后 PV 状态应变为 `Available`。
4. 手动创建新 PVC。
	 - 通过 StatefulSet Volume Claim Templates 自动创建的 PVC，命名会自动遵循以下规则：`[volumeClaimTemplate 名字]-[StatefulSet 名字]-[Pod 索引号]`
		 - 这里创建为：`pds-data-pds-stateful-set-0`
	 - `volumeName` 字段指向原 PV。

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pds-data-pds-stateful-set-0
  namespace: atproto-pds
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi
  storageClassName: longhorn
  volumeName: pvc-d5810e3d-60ff-4014-8bcf-0bf8f6213e90
  volumeMode: Filesystem
```

## 修改 StatefulSet 定义并重新部署

```diff
-      volumes:
-        - name: pds-data
-          persistentVolumeClaim:
-            claimName: pds-data
+  volumeClaimTemplates:
+    - apiVersion: v1
+      kind: PersistentVolumeClaim
+      metadata:
+        name: pds-data
+      spec:
+        accessModes: ["ReadWriteOnce"]
+        storageClassName: longhorn
+        resources:
+          requests:
+            storage: 20Gi
```

部署后分别确认原 PV 和新 PVC 的 `Status` 为 `Bound`，新 StatefulSet 运行正常。