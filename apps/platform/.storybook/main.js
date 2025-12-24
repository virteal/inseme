export default {
  framework: { name: "@storybook/react-vite", options: {} },
  stories: ["../src/components/**/*.stories.@(js|jsx|ts|tsx)"],
  addons: ["@storybook/addon-essentials", "@storybook/addon-interactions"],
};
