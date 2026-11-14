using System;
using System.Collections.Generic;
using System.Linq;

namespace Doorpi
{
    // Builds configuration only. The runtime still selects the actual graphics backend.
    internal static class WebViewRuntimeArguments
    {
        internal static string Build(string renderModeEnvironmentVariable, string defaultRenderMode, string extraArgsEnvironmentVariable = "")
        {
            var args = new List<string> { "--autoplay-policy=no-user-gesture-required" };
            string requestedMode = (Environment.GetEnvironmentVariable(renderModeEnvironmentVariable) ?? "").Trim().ToLowerInvariant();
            string mode = string.IsNullOrWhiteSpace(requestedMode) ? defaultRenderMode : requestedMode;

            switch (mode)
            {
                case "default":
                case "hardware":
                case "gpu":
                case "auto":
                    break;

                case "disable-gpu":
                case "nogpu":
                    args.Add("--disable-gpu");
                    args.Add("--disable-gpu-compositing");
                    break;

                case "disable-direct-composition":
                case "nodcomp":
                    args.Add("--disable-direct-composition");
                    break;

                case "warp":
                    args.Add("--use-angle=warp");
                    break;

                case "software-video":
                    args.Add("--disable-accelerated-video-decode");
                    args.Add("--disable-gpu-memory-buffer-video-frames");
                    break;

                case "safe":
                    args.Add("--disable-gpu");
                    args.Add("--disable-gpu-compositing");
                    args.Add("--disable-direct-composition");
                    args.Add("--disable-accelerated-video-decode");
                    args.Add("--disable-gpu-memory-buffer-video-frames");
                    break;
            }

            string extraArgs = (Environment.GetEnvironmentVariable("DOORPI_WEBVIEW_EXTRA_ARGS") ?? "").Trim();
            if (!string.IsNullOrWhiteSpace(extraArgs))
                args.Add(extraArgs);

            if (!string.IsNullOrWhiteSpace(extraArgsEnvironmentVariable))
            {
                string contextExtraArgs = (Environment.GetEnvironmentVariable(extraArgsEnvironmentVariable) ?? "").Trim();
                if (!string.IsNullOrWhiteSpace(contextExtraArgs))
                    args.Add(contextExtraArgs);
            }

            return string.Join(" ", args.Where(arg => !string.IsNullOrWhiteSpace(arg)));
        }

    }
}
