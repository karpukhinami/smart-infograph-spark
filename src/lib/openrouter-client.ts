export async function callOpenRouterChat(params: {
  apiKey: string;
  model: string;
  userMessage: string;
}): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      messages: [{ role: "user", content: params.userMessage }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${text.slice(0, 400)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (data.error?.message) throw new Error(data.error.message);

  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenRouter");
  return content;
}
