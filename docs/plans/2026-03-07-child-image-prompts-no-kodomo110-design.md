# Child Image Prompts Without Kodomo 110 Design

**Goal:** Remove references to `子ども110番の家` from child-oriented image generation prompts so generated outputs rely only on clearly observable scene information.

**Scope**
- `lib/gemini-hazard.ts` child-oriented image generation prompts
- `lib/disaster-scenario-prompts.ts` child audience preset prompts

**Approach**
- Delete explicit references to `子ども110番の家` / `こども110番の家`.
- Tighten wording so child prompts only refer to information verifiable from the uploaded image.
- Add regression tests that fail if child image prompts contain either phrase again.

**Non-Goals**
- Changing parent or administration prompts
- Rewriting unrelated child safety guidance
- Introducing broad prompt sanitization middleware

**Testing**
- Add focused unit tests for child prompt content.
- Run only the prompt-related Vitest targets plus `typecheck`.
