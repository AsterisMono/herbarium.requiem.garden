---
title: Transferring Separately Defined PVC to StatefulSet Volume Claim Templates
editUrl: false
slug: en/standalone-pvc-migrate-to-pvc-template
lastUpdated: 2026-01-29T00:00:00.000Z
draft: false
banner:
  content: This content is translated by an LLM and may contain inaccuracies.
---

## Original Setup

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

The goal is to remove the separately defined PVC (pds-data) and define the storage volume claim using [Volume Claim Templates](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/#volume-claim-templates) in the StatefulSet.

## Backup Data

:::caution

Data is invaluable, proceed with caution

Before executing this operation, please back up the Longhorn Volume Data corresponding to the PV to S3 for backup

:::

## Shut Down Services and Remove StatefulSet

```bash
kubectl delete -n atproto-pds statefulset pds-stateful-set
```

## PVC Replacement

1. Change the `persistentVolumeReclaimPolicy` of the original PVC to `Retain` to avoid deleting the PV and data when the original PVC is deleted.
2. Delete the old PVC `pds-data`.
   * After completion, the PV status should go from `Bound` to `Released`.
3. Remove the `claimRef` field from the PV to unbind the PV from the non-existent PVC.
   * After completion, the PV status should change to `Available`.
4. Manually create a new PVC.
   * PVC created automatically through StatefulSet Volume Claim Templates will be named following this rule: `[volumeClaimTemplate name]-[StatefulSet name]-[Pod index]`
     * Here it is created as: `pds-data-pds-stateful-set-0`
   * The `volumeName` field points to the original PV.

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

## Modify StatefulSet Definition and Redeploy

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

After deployment, confirm separately that the `Status` of the original PV and new PVC is `Bound`, and that the new StatefulSet is operating normally.
