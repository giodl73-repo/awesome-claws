const INPUT_TOKEN = /\{\{\s*input\.([a-z][a-z0-9_]{0,63})\s*\}\}/g;

export function validateSetupTemplateDeclarations(inputs, seeds) {
  if (!Array.isArray(inputs) || !Array.isArray(seeds)) {
    throw new Error("Setup inputs and personalization seeds must be arrays.");
  }
  const declared = new Set();
  for (const input of inputs) {
    if (typeof input?.id !== "string" || declared.has(input.id)) {
      throw new Error("Setup input ids must be present and unique.");
    }
    declared.add(input.id);
  }
  const referenced = new Set();
  for (const seed of seeds) {
    if (typeof seed?.content !== "string" || !seed.content.trim()) {
      throw new Error("Personalization seed templates must contain text.");
    }
    const withoutTokens = seed.content.replace(INPUT_TOKEN, (_token, id) => {
      if (!declared.has(id)) {
        throw new Error(`Personalization template references undeclared input ${id}.`);
      }
      referenced.add(id);
      return "";
    });
    if (withoutTokens.includes("{{") || withoutTokens.includes("}}")) {
      throw new Error("Personalization templates support only scalar input interpolation.");
    }
  }
  for (const id of declared) {
    if (!referenced.has(id)) {
      throw new Error(`Setup input ${id} is not referenced by a personalization template.`);
    }
  }
}
