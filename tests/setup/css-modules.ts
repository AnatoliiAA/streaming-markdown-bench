Bun.plugin({
  name: "css-modules",
  setup(build) {
    build.onLoad({ filter: /\.module\.css$/ }, () => ({
      exports: { default: new Proxy({}, { get: (_, key) => String(key) }) },
      loader: "object",
    }));
  },
});
