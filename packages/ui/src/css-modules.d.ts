declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}

declare module "*.css?raw" {
  const css: string;
  export default css;
}

/** Side-effect import of the package stylesheet (Storybook preview). */
declare module "*/styles.css";
