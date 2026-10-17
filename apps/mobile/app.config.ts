import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const origin = new URL(
    process.env.EXPO_PUBLIC_WUFF_ORIGIN || "https://wuff-todo.vercel.app",
  );
  const loopback =
    origin.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (
    process.env.EAS_BUILD_PROFILE === "production" &&
    origin.protocol !== "https:"
  )
    throw new Error("Production mobile builds require an HTTPS Wuff server.");
  return {
    ...config,
    name: "Wuff Todo",
    slug: "wuff-todo",
    ios: {
      ...config.ios,
      infoPlist: loopback
        ? { NSAppTransportSecurity: { NSAllowsLocalNetworking: true } }
        : {},
    },
    plugins: [
      ...(config.plugins ?? []).filter(
        (plugin) => plugin !== "expo-build-properties",
      ),
      [
        "expo-build-properties",
        { android: { usesCleartextTraffic: loopback } },
      ],
    ],
  };
};
