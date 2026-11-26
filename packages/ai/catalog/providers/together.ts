import type { OpenAICompletionsCompat, ThinkingLevelMap } from "../../src/types.ts";
import { defineProvider, modelsDevModels } from "../define.ts";

const BASE_COMPAT: OpenAICompletionsCompat = {
	supportsStore: false,
	supportsReasoningEffort: false,
	maxTokensField: "max_tokens",
	supportsStrictMode: false,
	supportsLongCacheRetention: false,
};
const TOGGLE_REASONING_COMPAT: OpenAICompletionsCompat = { ...BASE_COMPAT, thinkingFormat: "together" };

const TOGGLE_REASONING_LEVELS: ThinkingLevelMap = { minimal: null, low: null, medium: null };

export default defineProvider({
	id: "together",
	models: (ctx) =>
		modelsDevModels(ctx, "togetherai", {
			api: "openai-completions",
			baseUrl: "https://api.together.ai/v1",
			skipDeprecated: true,
			// Every reasoning model in the pinned togetherai catalog uses the toggle
			// surface (`thinkingFormat: "together"`), not OpenAI's `reasoning_effort`,
			// so no per-model override is needed. The two overrides this file used to
			// carry were keyed on `openai/gpt-oss-20b`, `openai/gpt-oss-120b` and
			// `deepseek-ai/DeepSeek-V4-Pro-0813`; the catalog lists none of them, so
			// they could not match a model and the shape they asserted is gone.
			map: (model) =>
				model.reasoning
					? { ...model, compat: TOGGLE_REASONING_COMPAT, thinkingLevelMap: { ...TOGGLE_REASONING_LEVELS } }
					: { ...model, compat: BASE_COMPAT },
		}),
	compat: {
		"openai-completions": {
			supportsStore: false,
			supportsReasoningEffort: false,
			maxTokensField: "max_tokens",
			thinkingFormat: "together",
			supportsLongCacheRetention: false,
		},
	},
});
