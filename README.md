# Generative AI OpenAI API Server

A lightweight server that translates Gemini API calls into OpenAI API-compatible format.

## Features
This project provides an alternative to using Google's `/v1beta/openai/` endpoint by addressing its limitations, offering enhanced functionality, and extending support for key features.

### Why not use `/v1beta/openai/` directly?
While Google does provide a partially OpenAI-compatible API, there are significant limitations:
1. **Unsupported Endpoints**: Many endpoints, such as `/v1/models`, are not available.
2. **Limited Parameters**: Important parameters like `"frequency_penalty"`, `"presence_penalty"`, and `"stop"` are not supported. When unsupported parameters are included, the API throws an error instead of gracefully ignoring them.
3. **Missing Advanced Features**: Features like context caching and advanced safety configurations from Gemini API are absent.

This server addresses these issues by acting as a middleware between your application and the Gemini API.


## Getting Started

### Prerequisites
- Download the latest release binary.

### Steps to Use
1. Create a configuration file (`genai.config.json`).
2. Run the server. The default port is `4949`.

#### Custom Config
```
main.exe -c my_owner.config.json
```

## Configuration

The server uses a JSON-based configuration file. Below is a basic example:  
```json
{
  "api_key": "sk-xxx",
  "server": {
    "port": 4949
  }
}
```  

### Full Configuration Options
Here is a complete list of configurable parameters:
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
  bodyLimit?: number;
};
```

## Supported Endpoints

The server currently supports the following endpoints:
- **`/v1/models`**: Retrieve available model list.
- **`/v1/embeddings`**: Generate vector embeddings for input text.
- **`/v1/chat/completions`**: Chat-based text completions.

> **Note**: `/v1/completions` is not supported because Gemini models do not support completion functionality, and Google's PaLM model (which does) is likely to be deprecated.


## Roadmap

- [x] v1
- [ ] 支持配置多个 api key ，并且可以轮询、分配权限、重试等调度操作
- [ ] 支持配置和切换代理

## Building the Project

```
pnpm run build:ci
```


## License

This project is licensed under the **MIT License**.
