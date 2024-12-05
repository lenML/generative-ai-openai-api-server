import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";
import esbuild from "rollup-plugin-esbuild";
import MagicString from "magic-string";
import { typescriptPaths } from "rollup-plugin-typescript-paths";
import copy from "rollup-plugin-copy";

// NOTE: 不知道为什么... nexe 打包的环境没法识别 node:xxx 的模块... 所以这里简单替换一下
function replaceNodePrefix() {
  return {
    name: "replace-node-prefix",
    renderChunk(code) {
      const magicString = new MagicString(code);
      let hasReplaced = false;

      const regex = /require\('node:(\w+)'\)/g;
      let match;

      while ((match = regex.exec(code)) !== null) {
        magicString.overwrite(
          match.index,
          match.index + match[0].length,
          `require('${match[1]}')`
        );
        hasReplaced = true;
      }

      if (!hasReplaced) {
        return null;
      }

      return {
        code: magicString.toString(),
        map: magicString.generateMap({ hires: true }),
      };
    },
  };
}

export default {
  input: "src/main.ts",
  output: {
    dir: "output",
    format: "cjs",
  },
  plugins: [
    json(),
    commonjs({
      include: /node_modules/,
    }),
    typescriptPaths({
      absolute: false,
      preserveExtensions: true,
    }),
    esbuild({
      include: /\.[jt]sx?$/,
      exclude: [],
      sourceMap: false,
      minify: process.env.NODE_ENV === "production",
      target: "node14",
      define: {
        "process.env.NODE_ENV": `"${process.env.NODE_ENV}"`,
        "process.env.IS_PACKED": `true`,
      },
      tsconfig: "tsconfig.json",
      loaders: {
        ".json": "json",
        ".js": "jsx",
      },
    }),

    copy({
      targets: [
        {
          src: "node_modules/@fastify/swagger-ui/static/*",
          dest: "output/static",
        },
      ],
    }),
    resolve(),
    replaceNodePrefix(),
  ],
};
