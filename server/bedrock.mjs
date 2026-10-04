// Minimal Bedrock Converse client. Authenticates with a Bedrock API key (bearer
// token) that belongs to an IAM user allowed to invoke exactly one model, so no
// AWS SDK or long-lived access keys are needed inside the container.

const region = process.env.BEDROCK_REGION ?? 'us-east-1'
export const modelId = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-haiku-4-5-20251001-v1:0'

// Bedrock Guardrail from terraform/guardrail.tf: jailbreak and prompt-attack
// filters, harmful content, secrets and phone numbers, and denied topics.
// The assistant stays offline unless a guardrail is configured.
const guardrail = () => ({
  guardrailIdentifier: process.env.BEDROCK_GUARDRAIL_ID,
  guardrailVersion: process.env.BEDROCK_GUARDRAIL_VERSION,
})

export const bedrockConfigured = () => Boolean(process.env.AWS_BEARER_TOKEN_BEDROCK && process.env.BEDROCK_GUARDRAIL_ID && process.env.BEDROCK_GUARDRAIL_VERSION)

export async function converse({ system, messages, maxTokens = 400, temperature = 0.4, timeoutMs = 20_000 }) {
  const token = process.env.AWS_BEARER_TOKEN_BEDROCK
  if (!bedrockConfigured()) throw Object.assign(new Error('the assistant is offline (Bedrock is not configured)'), { status: 503 })
  const response = await fetch(`https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/converse`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      system: [{ text: system }],
      messages: messages.map((message) => ({ role: message.role, content: [{ text: message.content }] })),
      inferenceConfig: { maxTokens, temperature },
      guardrailConfig: { ...guardrail(), trace: 'disabled' },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.error(`bedrock ${response.status}: ${body.message ?? 'unknown error'}`)
    throw Object.assign(new Error(response.status === 429 ? 'the assistant is busy, try again in a moment' : 'the assistant is unavailable right now'), { status: response.status === 429 ? 429 : 502 })
  }
  const text = (body.output?.message?.content ?? []).map((part) => part.text ?? '').join('').trim()
  if (body.stopReason === 'guardrail_intervened') console.log('guardrail intervened')
  return { text, blocked: body.stopReason === 'guardrail_intervened' }
}

// Screens visitor text (guestbook notes) with the same guardrail, without
// calling a model. Returns null when the text passes, or a broad, visitor-facing
// reason when the guardrail intervenes (never the exact rule that matched).
export async function guardrailVerdict(text, timeoutMs = 8000) {
  if (!bedrockConfigured()) throw Object.assign(new Error('content checks are offline'), { status: 503 })
  const { guardrailIdentifier, guardrailVersion } = guardrail()
  const response = await fetch(`https://bedrock-runtime.${region}.amazonaws.com/guardrail/${encodeURIComponent(guardrailIdentifier)}/version/${encodeURIComponent(guardrailVersion)}/apply`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.AWS_BEARER_TOKEN_BEDROCK}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ source: 'INPUT', content: [{ text: { text } }] }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.error(`guardrail ${response.status}: ${body.message ?? 'unknown error'}`)
    throw Object.assign(new Error('content checks are unavailable right now'), { status: 503 })
  }
  return body.action === 'GUARDRAIL_INTERVENED' ? guardrailReason(body.assessments) : null
}

const filterReasons = {
  PROMPT_ATTACK: 'it reads like instructions for the site\'s AI',
  HATE: 'it reads as hateful',
  INSULTS: 'it reads as insulting',
  SEXUAL: 'it contains sexual content',
  VIOLENCE: 'it contains violent content',
  MISCONDUCT: 'it reads as encouraging harm or wrongdoing',
}

export function guardrailReason(assessments = []) {
  // Most specific first: personal details, prompt attacks, profanity, then the broader filters.
  const found = (Array.isArray(assessments) ? assessments : []).flatMap((assessment) => [
    ...(assessment.sensitiveInformationPolicy?.piiEntities ?? []).concat(assessment.sensitiveInformationPolicy?.regexes ?? []).filter((item) => item.detected !== false).map(() => 'it contains personal or sensitive details'),
    ...(assessment.contentPolicy?.filters ?? []).filter((item) => item.detected !== false && item.type === 'PROMPT_ATTACK').map(() => filterReasons.PROMPT_ATTACK),
    ...(assessment.wordPolicy?.managedWordLists ?? []).concat(assessment.wordPolicy?.customWords ?? []).filter((item) => item.detected !== false).map(() => 'it contains profanity'),
    ...(assessment.contentPolicy?.filters ?? []).filter((item) => item.detected !== false && item.type !== 'PROMPT_ATTACK').map((item) => filterReasons[item.type] ?? 'it breaks the guestbook rules'),
    ...(assessment.topicPolicy?.topics ?? []).filter((item) => item.detected !== false).map(() => 'it strays into advice or politics'),
  ])
  return found[0] ?? 'it breaks the guestbook rules'
}
