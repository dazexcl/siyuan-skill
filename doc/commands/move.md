# 移动文档命令

移动思源笔记文档到新位置，支持同时重命名。

## 命令格式

```bash
siyuan move <docId|path> <targetParentId|path> [options]
```

**别名**：`mv`

## 参数说明

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `<docId\|path>` | string | ✅ | 要移动的文档 ID 或完整路径 |
| `<targetParentId\|path>` | string | ✅ | 目标父目录或笔记本 ID 或路径 |
| `--new-title <title>` | string | ❌ | 移动后重命名文档 |

## 使用示例

### 使用文档 ID 移动
```bash
# 基本用法 - 使用文档 ID 移动文档到新位置
siyuan move <docId> <targetParentId>

# 使用文档 ID 移动文档并同时重命名
siyuan move <docId> <targetParentId> --new-title "新标题"

# 使用别名
siyuan mv <docId> <targetParentId>
```

### 使用路径方式移动（推荐）
```bash
# 使用路径方式移动文档（推荐）
siyuan move /笔记本名称/文档路径 /目标笔记本/目标文档路径

# 路径方式示例
siyuan move /AI/test1 /AI/openclaw/更新记录
```

## 路径格式说明

- 路径以 `/` 开头，例如：`/AI/test1`
- 第一个部分为笔记本名称或 ID
- 后续部分为文档路径
- 支持中文文档名称

## 返回格式

```json
{
  "success": true,
  "data": {
    "id": "20260304051123-doaxgi4",
    "title": "新标题",
    "parent_id": "20260304051123-target",
    "path": "/AI/openclaw/新标题"
  },
  "message": "移动文档成功",
  "timestamp": 1646389200000
}
```

## 注意事项

1. **路径格式**：路径以 `/` 开头，例如：`/AI/openclaw/插件`
2. **重名检测**：如果目标位置存在同名文档，会返回错误
3. **权限限制**：需要相应的权限才能移动文档
4. **文档ID格式**：文档 ID 格式为 15 位数字 + 短横线 + 5 位字母数字
5. **路径方式推荐**：使用路径方式更直观，推荐使用

## 相关文档
- [转换 ID 和路径命令](convert.md)
- [创建文档命令](create.md)
- [最佳实践](../advanced/best-practices.md)
