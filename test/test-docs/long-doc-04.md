# 游戏服务器网络架构

## 网络协议选择

### 协议对比

| 特性 | TCP | UDP | KCP |
|-----|-----|-----|-----|
| 可靠性 | ✅ | ❌ | ✅ |
| 延迟 | 高 | 低 | 中 |
| 有序 | ✅ | ❌ | ✅ |
| 流量控制 | ✅ | ❌ | ✅ |
| 适用场景 | 大厅系统 | 战斗系统 | 竞技游戏 |

### TCP协议

**特点**：
- 面向连接的可靠传输
- 有序数据传输
- 流量控制和拥塞控制

**使用场景**：
- 登录认证
- 聊天系统
- 大厅匹配

```c++
// TCP服务器基础实现
class TCPServer {
public:
    TCPServer(int port) : port_(port) {
        socket_ = socket(AF_INET, SOCK_STREAM, 0);
        
        sockaddr_in address;
        address.sin_family = AF_INET;
        address.sin_addr.s_addr = INADDR_ANY;
        address.sin_port = htons(port_);
        
        bind(socket_, (sockaddr*)&address, sizeof(address));
        listen(socket_, 128);
    }
    
    void start() {
        while (running_) {
            sockaddr_in client_addr;
            socklen_t addr_len = sizeof(client_addr);
            
            int client_socket = accept(
                socket_, 
                (sockaddr*)&client_addr, 
                &addr_len
            );
            
            std::thread([this, client_socket]() {
                handleClient(client_socket);
            }).detach();
        }
    }
    
private:
    void handleClient(int socket) {
        char buffer[4096];
        while (true) {
            ssize_t bytes = recv(socket, buffer, sizeof(buffer), 0);
            if (bytes <= 0) break;
            
            // 处理消息
            processMessage(buffer, bytes);
        }
        close(socket);
    }
    
    int socket_;
    int port_;
    bool running_ = true;
};
```

### UDP协议

**特点**：
- 无连接，低延迟
- 不可靠传输
- 适合实时性要求高的场景

**使用场景**：
- 战斗系统
- 位置同步
- 状态广播

```c++
// UDP服务器实现
class UDPServer {
public:
    UDPServer(int port) : port_(port) {
        socket_ = socket(AF_INET, SOCK_DGRAM, 0);
        
        sockaddr_in address;
        address.sin_family = AF_INET;
        address.sin_addr.s_addr = INADDR_ANY;
        address.sin_port = htons(port_);
        
        bind(socket_, (sockaddr*)&address, sizeof(address));
    }
    
    void start() {
        while (running_) {
            char buffer[4096];
            sockaddr_in client_addr;
            socklen_t addr_len = sizeof(client_addr);
            
            ssize_t bytes = recvfrom(
                socket_, 
                buffer, 
                sizeof(buffer), 
                0,
                (sockaddr*)&client_addr, 
                &addr_len
            );
            
            // 处理消息
            processMessage(buffer, bytes, client_addr);
        }
    }
    
private:
    int socket_;
    int port_;
    bool running_ = true;
};
```

### KCP协议

> KCP是一个快速可靠的ARQ协议，解决了TCP的延迟问题。

## 网络优化技术

### 数据压缩

- [x] 协议缓冲区（Protobuf）
- [x] FlatBuffers
- [ ] MessagePack
- [ ] 自定义压缩

### 增量同步

```
完整状态 → 计算差异 → 发送增量 → 应用更新
```

### 预测与插值

<details>
<summary>客户端预测算法</summary>

```javascript
// 客户端预测
class ClientPrediction {
  constructor() {
    this.localState = {};
    this.pendingInputs = [];
  }
  
  sendInput(input) {
    // 应用本地预测
    this.applyInputLocally(input);
    
    // 记录待确认的输入
    this.pendingInputs.push({
      input: input,
      sequence: this.getNextSequence()
    });
    
    // 发送到服务器
    this.sendToServer({
      type: 'INPUT',
      input: input,
      sequence: this.pendingInputs.length - 1
    });
  }
  
  receiveServerUpdate(update) {
    // 检查确认的输入
    const confirmed = update.lastConfirmedInput;
    
    // 移除已确认的输入
    this.pendingInputs = this.pendingInputs.filter(
      input => input.sequence > confirmed
    );
    
    // 重新应用未确认的输入
    this.localState = update.serverState;
    for (const pending of this.pendingInputs) {
      this.applyInputLocally(pending.input);
    }
  }
}
```

</details>

## 服务器架构

### 服务器类型

```
客户端 → 网关服务器 → 逻辑服务器 → 数据库服务器
                  ↓
              聊天服务器
```

### 负载均衡策略

| 策略 | 描述 | 适用场景 |
|-----|------|---------|
| 轮询 | 依次分配 | 服务器性能相近 |
| 加权轮询 | 按权重分配 | 服务器性能不同 |
| 最少连接 | 分配给连接最少的 | 连接时长差异大 |
| 哈希 | 根据用户ID分配 | 需要会话保持 |

## 同步机制

### 帧同步

```
输入收集 → 广播输入 → 所有客户端模拟 → 状态同步
```

### 状态同步

```python
# 状态同步实现
class StateSync:
    def __init__(self, tick_rate=60):
        self.tick_rate = tick_rate
        self.tick_interval = 1.0 / tick_rate
        self.entities = {}
        
    def update(self, delta_time):
        # 更新所有实体
        for entity_id, entity in self.entities.items():
            entity.update(delta_time)
            
        # 发送状态更新
        state_update = self.create_state_update()
        self.broadcast_state(state_update)
        
    def create_state_update(self):
        # 只发送变化的部分
        update = {
            'timestamp': time.time(),
            'entities': {}
        }
        
        for entity_id, entity in self.entities.items():
            if entity.has_changed():
                update['entities'][entity_id] = {
                    'position': entity.position,
                    'rotation': entity.rotation,
                    'velocity': entity.velocity
                }
                entity.clear_changed_flag()
                
        return update
```

### 延迟补偿

- 服务器端回溯
- 客户端预测
- 时间同步
- 插值平滑

## 参考资料

- [Gaffer On Games](https://gafferongames.com/)
- [网络游戏同步](https://developer.nvidia.com/gpugems/gpugems/part-iii-rendering/chapter-42-deferred-shading-tutorial)
- [游戏网络编程](https://gamedevelopment.tutsplus.com/series/networking-for-game-programmers/)

---

**文档结束** 🌐
