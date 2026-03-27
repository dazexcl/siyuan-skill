# 块控制命令

思源笔记支持精细化的块级别操作，包括插入、更新、删除、移动、获取、属性管理和折叠展开等功能。

## 命令列表

| 命令 | 别名 | 说明 |
|------|------|------|
| `block-insert` | `bi` | 插入新块 |
| `block-update` | `bu` | 更新块内容 |
| `block-delete` | `bd` | 删除块 |
| `block-move` | `bm` | 移动块 |
| `block-get` | `bg` | 获取块信息 |
| `block-attrs` | `ba`, `attrs` | 管理块属性 |
| `tags` | `st` | 设置块/文档标签 |
| `block-fold` | `bf` | 折叠/展开块 |
| `block-transfer-ref` | `btr` | 转移块引用 |

## 位置参数支持

所有块命令都支持位置参数，使命令更简洁：

```bash
# 完整格式
siyuan block-get --id <blockId>
siyuan block-delete --id <blockId>

# 位置参数格式（推荐）
siyuan bg <blockId>
siyuan bd <blockId>
```

---

## block-insert (bi)

插入新块到文档中。

### 命令格式

```bash
siyuan block-insert <content> --parent-id <parentId> [--data-type <type>]
siyuan block-insert <content> --previous-id <blockId>
siyuan block-insert <content> --next-id <blockId>
```

### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `<content>` | string | ✅ | 块内容（位置参数） |
| `--parent-id` | string | ⚡ | 父块ID（位置参数三选一） |
| `--previous-id` | string | ⚡ | 前一个块ID，插入到其后（位置参数三选一） |
| `--next-id` | string | ⚡ | 后一个块ID，插入到其前（位置参数三选一） |
| `--data-type` | string | ❌ | 数据类型：markdown/dom（默认：markdown） |

> ⚡ 必须提供 `--parent-id`、`--previous-id` 或 `--next-id` 中的一个

### 使用示例

```bash
# 在文档末尾插入块（推荐方式）
siyuan bi "新段落内容" --parent-id <docId>

# 在指定块后插入
siyuan bi "新段落内容" --previous-id <blockId>

# 在指定块前插入
siyuan bi "新段落内容" --next-id <blockId>
```

---

## block-update (bu)

更新指定块的内容。

**重要限制**：此命令仅接受**块ID**，不接受文档ID。如果传入文档ID，将返回错误并提示使用 `update` 命令。

### 命令格式

```bash
siyuan block-update <blockId> <content>
siyuan bu <blockId> <content>
```

### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `blockId` | string | ✅ | 块ID（不能是文档ID） |
| `content` | string | ✅ | 新的块内容 |
| `--data-type` | string | ❌ | 数据类型：markdown/dom（默认：markdown） |

### 使用示例

```bash
# 简写形式（推荐）
siyuan bu <blockId> "更新后的内容"

# 完整命令
siyuan block-update <blockId> "更新后的内容"

# 使用命名参数
siyuan bu --id <blockId> --data "更新后的内容"
```

### 错误处理

当传入文档 ID 时，命令会返回错误：

```json
{
  "success": false,
  "error": "参数类型错误",
  "message": "传入的ID是文档。请使用 update 命令更新文档内容"
}
```

---

## block-delete (bd)

删除指定的块。

**注意**：此命令仅用于删除普通块。如果传入的是文档 ID，将返回错误并提示使用 `delete` 命令。

### 命令格式

```bash
siyuan block-delete <blockId>
```

### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `<blockId>` | string | ✅ | 块ID（位置参数，不能是文档ID） |

### 错误处理

当传入文档 ID 时，命令会返回错误：

```json
{
  "success": false,
  "error": "无效操作",
  "message": "传入的 ID \"xxx\" 是文档而非普通块。删除文档请使用 delete 命令：siyuan delete --doc-id xxx",
  "hint": "文档标题: \"文档名称\"",
  "blockType": "document"
}
```

### 使用示例

```bash
# 删除普通块
siyuan bd <blockId>
siyuan block-delete <blockId>

# 如果需要删除文档，请使用 delete 命令
siyuan delete --doc-id <docId>
```

---

## block-move (bm)

移动块到新位置。

### 命令格式

```bash
siyuan block-move <blockId> [--parent-id <parentId>] [--previous-id <previousId>]
```

### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `<blockId>` | string | ✅ | 要移动的块ID（位置参数） |
| `--parent-id` | string | ❌ | 目标父块ID |
| `--previous-id` | string | ❌ | 目标前一个块ID |

### 使用示例

```bash
# 移动到新父块下
siyuan bm <blockId> --parent-id <targetParentId>

# 移动到指定块后
siyuan bm <blockId> --previous-id <targetBlockId>
```

---

## block-get (bg)

获取块信息，支持获取块内容和子块列表。

### 命令格式

```bash
siyuan block-get <blockId> [--mode <mode>]
```

### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `<blockId>` | string | ✅ | 块ID（位置参数） |
| `--mode` | string | ❌ | 查询模式：kramdown/children（默认：kramdown） |

### 使用示例

```bash
# 获取块内容（kramdown格式）
siyuan bg <blockId>

# 获取文档的子块列表
siyuan bg <docId> --mode children
```

### 返回格式

**kramdown 模式**：
```json
{
  "success": true,
  "data": {
    "id": "<blockId>",
    "mode": "kramdown",
    "result": "块内容..."
  }
}
```

**children 模式**：
```json
{
  "success": true,
  "data": {
    "id": "<docId>",
    "mode": "children",
    "result": [
      { "id": "block-1", "type": "h", "content": "标题" },
      { "id": "block-2", "type": "p", "content": "段落" }
    ]
  }
}
```

---

## block-attrs (ba, attrs)

管理块属性，支持设置、获取和移除属性。

**重要说明**：
- 默认情况下，属性会自动添加 `custom-` 前缀（在思源笔记界面可见）
- 使用 `--hide` 标记可以设置内部属性（不带 `custom-` 前缀，在界面不可见）

### 命令格式

```bash
siyuan block-attrs <docId|blockId> (--set <attrs> | --get [key] | --remove <keys>) [--hide]
```

### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `<docId|blockId>` | string | ✅ | 块ID/文档ID（位置参数，必传） |
| `--set` | string | ⚡ | 设置属性（key=value格式，多个用逗号分隔） |
| `--get` | string | ⚡ | 获取属性（不带参数取所有，带参数取指定属性） |
| `--remove` | string | ⚡ | 移除属性（传入属性键名，多个用逗号分隔） |
| `--hide` | boolean | ❌ | 操作内部属性（不带 custom- 前缀，在界面不可见） |

> ⚡ `--set`、`--get`、`--remove` 三者必须选其一

### 使用示例

#### 设置属性

```bash
# 设置可见属性（自动添加 custom- 前缀，在界面可见）
siyuan attrs <docId> --set "status=draft,priority=high"

# 设置内部属性（不带 custom- 前缀，在界面不可见）
siyuan attrs <blockId> --set "internal=true" --hide
```

#### 获取属性

```bash
# 获取所有属性（自动移除 custom- 前缀显示）
siyuan attrs <docId> --get

# 获取指定属性
siyuan attrs <blockId> --get "status"

# 获取内部属性
siyuan attrs <docId> --get "internal" --hide
```

#### 移除属性

```bash
# 移除单个属性
siyuan attrs <docId> --remove "status"

# 移除多个属性
siyuan attrs <blockId> --remove "status,priority"

# 移除内部属性
siyuan attrs <docId> --remove "internal" --hide
```

---

## block-fold (bf)

折叠或展开块。

### 命令格式

```bash
siyuan block-fold <blockId> [--action <fold|unfold>]
```

### 别名

- `bf` - 默认折叠
- `buu` - 默认展开
- `block-unfold` - 默认展开

### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `<blockId>` | string | ✅ | 块ID（位置参数） |
| `--action` | string | ❌ | 操作类型：fold（折叠）或 unfold（展开），默认 fold |

### 使用示例

```bash
# 折叠块
siyuan bf <blockId>

# 展开块
siyuan buu <blockId>

# 使用 --action 参数
siyuan bf <blockId> --action unfold
```

---

## block-transfer-ref (btr)

转移块引用，将一个块的引用转移到另一个块。

### 命令格式

```bash
siyuan block-transfer-ref --from-id <fromId> --to-id <toId> [--ref-ids <refIds>]
```

### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `--from-id` | string | ✅ | 定义块ID |
| `--to-id` | string | ✅ | 目标块ID |
| `--ref-ids` | string | ❌ | 引用块ID（逗号分隔） |

### 使用示例

```bash
# 转移所有引用
siyuan btr --from-id <fromId> --to-id <toId>

# 转移指定引用
siyuan btr --from-id <fromId> --to-id <toId> --ref-ids "ref1,ref2"
```

---

## 使用块模式操作文档更新流程

### 典型工作流程

当需要修改文档中的特定内容时，推荐使用块模式进行精确更新：

```
┌─────────────────────────────────────────────────────────────┐
│                    块模式文档更新流程                          │
├─────────────────────────────────────────────────────────────┤
│  1. 获取文档块列表                                            │
│     siyuan bg <docId> --mode children                        │
│                         ↓                                    │
│  2. 识别目标块ID                                              │
│     从返回结果中找到需要修改的块                                │
│                         ↓                                    │
│  3. 执行块操作                                                │
│     - 更新: siyuan bu <blockId> "新内容"                      │
│     - 插入: siyuan bi "新块" --parent-id <docId>              │
│     - 删除: siyuan bd <blockId>                               │
│     - 移动: siyuan bm <blockId> --previous-id <targetId>      │
│                         ↓                                    │
│  4. 验证结果                                                  │
│     siyuan cat <docId> --raw                                 │
└─────────────────────────────────────────────────────────────┘
```

### 完整示例：修改文档中的某个段落

**场景**：文档中有一段需要修改，但不想影响其他内容。

**步骤 1：获取文档块列表**

```bash
siyuan bg 20260311033152-2lldhes --mode children
```

**返回结果**：
```json
{
  "success": true,
  "data": {
    "id": "20260311033152-2lldhes",
    "mode": "children",
    "result": [
      { "id": "20260311033152-abc123", "type": "h", "content": "文档标题" },
      { "id": "20260311033152-def456", "type": "p", "content": "第一段内容" },
      { "id": "20260311033152-ghi789", "type": "p", "content": "需要修改的第二段" },
      { "id": "20260311033152-jkl012", "type": "p", "content": "第三段内容" }
    ]
  }
}
```

**步骤 2：更新目标块**

```bash
# 只更新第二段，不影响其他内容
siyuan bu 20260311033152-ghi789 "这是修改后的第二段内容"
```

**步骤 3：验证结果**

```bash
siyuan cat 20260311033152-2lldhes --raw
```

### 常见操作场景

#### 场景 1：在文档末尾追加内容

```bash
# 获取文档ID作为父块ID
siyuan bi "追加的新段落" --parent-id <docId>
```

#### 场景 2：在特定段落后插入内容

```bash
# 先获取块列表，找到目标段落ID
siyuan bg <docId> --mode children

# 在该段落后插入新块
siyuan bi "新插入的段落" --previous-id <targetBlockId>
```

#### 场景 3：删除不需要的段落

```bash
# 删除指定块
siyuan bd <blockId>
```

#### 场景 4：调整段落顺序

```bash
# 将某个块移动到另一个块后面
siyuan bm <blockId> --previous-id <targetBlockId>
```

#### 场景 5：批量更新多个块

```bash
# 获取块列表
siyuan bg <docId> --mode children

# 依次更新每个需要修改的块
siyuan bu <blockId1> "更新内容1"
siyuan bu <blockId2> "更新内容2"
siyuan bu <blockId3> "更新内容3"
```

### 与全文档更新的对比

| 操作 | 全文档更新 | 块模式更新 |
|------|-----------|-----------|
| 修改一个段落 | 重新处理所有块 | 只处理1个块 |
| 追加内容 | 需要完整内容 | 只需新内容 |
| 保留块属性 | 可能丢失 | 完全保留 |
| 操作复杂度 | 简单（1步） | 稍复杂（2步） |

### 最佳实践

1. **局部修改优先使用块模式**：只修改需要改动的部分
2. **大规模重写使用全文档更新**：文档结构变化大时更高效
3. **保留属性时使用块模式**：避免丢失自定义属性
4. **批量操作时缓存块ID**：减少重复查询

---

## 相关文档

- [更新文档命令](update.md) - 全文档更新
- [标签命令](tags.md) - 标签详细文档
- [最佳实践](../advanced/best-practices.md) - 使用建议
- [SKILL.md](../../SKILL.md#全文档更新-vs-块更新) - 全文档更新 vs 块更新详细对比
