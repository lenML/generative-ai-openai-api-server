import fetch from "node-fetch";
import { ProxyAgent } from "proxy-agent";

export default ((url, options, proxyOptions) => {
  const agent = new ProxyAgent(proxyOptions);
  return fetch(url, { agent, ...options });
}) as typeof fetch;
