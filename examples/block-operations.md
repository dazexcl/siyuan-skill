# 块操作示例

## 查看块内容

```bash
# 获取块信息
node scripts/block-get.js <blockId>

# 指定模式
node scripts/block-get.js <blockId> --mode kramdown
node scripts/block-get.js <blockId> --mode children
```

## 修改块

```bash
# 更新块内容
node scripts/block-update.js <blockId> --content "新的块内容"

# 插入新块
node scripts/block-insert.js "插入的文本" --parent-id <parentId>

# 在特定块后面插入
node scripts/block-insert.js "新段落" --previous-id <blockId>
```

## 移动和删除

```bash
# 移动块到新的父块下
node scripts/block-move.js <blockId> --parent-id <newParentId>

# 移动到某个块之后
node scripts/block-move.js <blockId> --parent-id <parentId> --previous-id <afterBlockId>

# 删除块
node scripts/block-delete.js <blockId>
```

## 折叠和展开

```bash
# 折叠
node scripts/block-fold.js <blockId> --action fold

# 展开
node scripts/block-fold.js <blockId> --action unfold
```

## 块属性

```bash
# 设置属性
node scripts/block-attrs.js <blockId> --set "key=value"

# 设置多个属性
node scripts/block-attrs.js <blockId> --set "status=draft,priority=high"

# 获取所有属性
node scripts/block-attrs.js <blockId> --get

# 获取指定属性
node scripts/block-attrs.js <blockId> --get "status"

# 删除属性
node scripts/block-attrs.js <blockId> --remove "key"
```

## 转移引用

```bash
# 将源块的所有引用转移到目标块
node scripts/block-transfer.js <sourceId> <targetId>
```
