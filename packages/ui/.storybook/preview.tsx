import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./preview.css";
import type { Decorator, Preview } from "@storybook/react-vite";
import { useEffect } from "react";

/** Mirror the dashboard: tokens on :root, light/dark via data-theme, canvas background. */
const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme as string;
  useEffect(() => {
    if (theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  return (
    <div className="bg-canvas p-6 text-ink">
      <Story />
    </div>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: "Colour theme",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
          { value: "auto", title: "System" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light" },
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true, matchers: { color: /(background|color)$/i } },
    a11y: { test: "todo" },
  },
  tags: ["autodocs"],
};

export default preview;
