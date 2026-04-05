# 云原生数据库架构

## 云计算基础

云计算提供了弹性的计算资源，支持按需伸缩和自动部署。**云原生架构**充分利用*云计算*的优势。

### 核心概念

```
传统架构 → 容器化 → 微服务 → 云原生
```

## 存算分离架构

### 分布式存储

| 存储类型 | 特点 | 适用场景 |
|---------|------|---------|
| 对象存储 | 高扩展性 | 非结构化数据 |
| 块存储 | 高性能 | 数据库存储 |
| 文件存储 | 易共享 | 共享文件系统 |

### 数据分片策略

- **水平分片**：按数据行拆分
- **垂直分片**：按列拆分
- **混合分片**：结合两者

### 计算层

```yaml
# Kubernetes配置示例
apiVersion: apps/v1
kind: Deployment
metadata:
  name: database-compute
spec:
  replicas: 3
  selector:
    matchLabels:
      app: db-compute
  template:
    metadata:
      labels:
        app: db-compute
    spec:
      containers:
      - name: compute-node
        image: db-compute:latest
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
```

## 典型实现

### 商业方案对比

<details>
<summary>Aurora 架构特点</summary>

Amazon Aurora 采用存储计算分离架构：
- 存储层：自动扩展到128TB
- 计算层：最多15个只读副本
- 跨区域复制：支持5个只读副本
</details>

| 方案 | 架构 | 扩展性 | 成本 |
|-----|------|-------|------|
| Aurora | 存算分离 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Spanner | 分布式 | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| TiDB | HTAP | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| OceanBase | 分布式 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

### 架构特点

1. **存算分离** - 独立扩展存储和计算
2. **弹性扩展** - 根据负载自动调整
3. **高可用性** - 多副本自动故障转移

## 技术优势

- [x] 按需分配资源
- [x] 自动故障转移
- [x] 跨区域部署
- [ ] 成本优化（需要手动配置）

### 性能指标

```bash
# 性能测试命令
$ sysbench oltp_read_write \
  --db-driver=mysql \
  --mysql-host=aurora-endpoint \
  --mysql-port=3306 \
  --mysql-db=test \
  --mysql-user=admin \
  --mysql-password=secret \
  --tables=10 \
  --table-size=100000 \
  --threads=16 \
  --time=300 \
  run
```

## 参考链接

- [Aurora 官方文档](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/CHAP_AuroraOverview.html)
- [Spanner 白皮书](https://cloud.google.com/spanner/docs/whitepapers)
- [TiDB 架构设计](https://pingcap.com/blog/)

---

**文档结束** 📊
