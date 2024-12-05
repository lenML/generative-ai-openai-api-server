# generative-ai-openai-api-server
converts Gemini API to OpenAI API format.

# release
WIP

# Why dont using `/v1beta/openai/`?
首先，其实 google 提供了兼容 open api 的接口，其实简单使用的话，完全可以用 `/v1beta/openai/` 即可。
但是， `/v1beta/openai/` 有几个问题：
1. 很多接口不支持，包括 `/v1/models`
2. 很多参数不支持，包括 `"frequency_penalty", "presence_penalty", "stop"`，并且，不支持的时候是报错，而不是忽略它...
3. 缺少 gemini api 的高级功能设定，比如 `上下文缓存` `安全设置`

所以，我开发这个简单的服务用来处理这些问题。

# usage

0. 下载 release bin 文件
1. 修改创建配置文件 (genai.config.json) 
2. 运行，即可 默认端口为 4949

## configure
本系统使用json配置文件，配置一个简单的json即可，下面是一个示例
```json
{
  "api_key": "sk-xxx",
  "server": {
    "port": 4949
  }
}
```

完整可配置参数如下:
```ts
type Params = {
  api_key: string;
  server?: {
    port?: number;
  };
  no_docs?: boolean;
  retry?: {
    enabled?: boolean;
    retries?: number;
    factor?: number;
    minTimeout?: number;
    maxTimeout?: number;
  };
  debug?: {
    stream?: {
      log?: boolean;
    };
  };
}
```

# support endpoints

- `/v1/models`: 获取模型列表
- `/v1/embeddings`: 文本向量化
- `/v1/chat/completions`: chat文本补全
- ~~`/v1/completions`~~ (难以支持，因为 gemini 系列模型都不支持 completion)

# How to build?
WIP

# LICENSE
MIT
