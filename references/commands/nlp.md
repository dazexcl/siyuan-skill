# NLP 文本分析命令

> ⚠️ **实验性功能**
> 
> 此功能目前处于实验阶段，API 接口和功能可能会在未来版本中发生变化。建议在非生产环境中测试使用。

对文本进行自然语言处理分析，包括分词、实体识别、关键词提取等。

## 命令格式

```bash
siyuan nlp <text> [options]
```

## 参数说明

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `<text>` | string | ✅ | 需要分析的文本内容 |
| `--tasks <tasks>` | string | ❌ | 分析任务（逗号分隔）：tokenize,entities,keywords,summary |
| `--top-n` | number | ❌ | 返回前 N 个关键词（默认：10） |

## 使用示例

### 基本分析
```bash
# 分析文本（分词、实体识别、关键词提取）
siyuan nlp "这是一段需要分析的文本内容"
```

### 指定分析任务
```bash
# 只进行分词
siyuan nlp "文本内容" --tasks tokenize

# 进行所有分析
siyuan nlp "文本内容" --tasks all

# 指定多个分析任务
siyuan nlp "文本内容" --tasks tokenize,entities,keywords,summary

# 限制关键词数量
siyuan nlp "文本内容" --tasks keywords --top-n 5
```

## NLP 功能特点

### 完全本地实现
无外部依赖，所有功能都在本地实现。

### 支持中英文分词
自动识别中文和英文，进行相应的分词处理。

### 实体识别
识别以下类型的实体：
- 邮箱
- URL
- 手机号
- 日期
- 时间
- IP地址
- 金额

### 关键词提取
基于词频和权重计算，提取文本中的关键词。

### 语言检测
自动识别文本是中文还是英文。

### 摘要生成
基于关键词评分，生成文本摘要。

## 返回格式

```json
{
  "success": true,
  "data": {
    "language": "zh",
    "tokens": ["这是", "一段", "需要", "分析", "的", "文本", "内容"],
    "entities": [
      {
        "type": "email",
        "value": "example@example.com",
        "start": 10,
        "end": 30
      }
    ],
    "keywords": [
      {
        "word": "文本",
        "score": 0.8,
        "count": 2
      }
    ],
    "summary": "这是一段需要分析的文本内容"
  },
  "message": "NLP 分析完成",
  "timestamp": 1646389200000
}
```

## 注意事项

1. **本地实现**：所有功能都在本地实现，无需外部服务
2. **语言支持**：支持中文和英文
3. **性能**：对于超长文本，分析时间可能较长
4. **准确性**：实体识别和关键词提取基于规则和统计，可能存在误差

## 相关文档
- [向量搜索配置](../advanced/vector-search.md)
- [最佳实践](../advanced/best-practices.md)
