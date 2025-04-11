import { type CoreMessage } from "ai";
import { querySanity } from "@/lib/sanity";
import { z } from "zod";
import {
  setupAirbender,
  wrappedGenerateText,
  wrappedStreamText,
} from "@airbend3r/client";
import { convertToCoreMessages } from "ai";

const streamText = wrappedStreamText({
  productKey: process.env.AIRBENDER_PRODUCT_KEY,
  logInputs: true,
  logOutputs: true,
  shouldValidateBeforeLogging: false,
});

const airbender = setupAirbender({
  sdks: {
    default: {
      llm: streamText,
      name: "google",
      version: "gemini-1.5-flash-8b",
    },
  },
  productId: process.env.AIRBENDER_PRODUCT_ID,
  modelAvailability: {
    providers: {
      openai: ["gpt-4o-mini", "gpt-4o"],
      google: ["gemini-1.5-flash-8b"],
      anthropic: [],
    },
  },
});

const { llm: streamTextWithLogging } = airbender.sdk("default");

export async function POST(req: Request) {
  const { messages, chatHistory = [] } = await req.json();
  // Combine chat history with current messages
  const combinedMessages = [...chatHistory, ...messages];
  // Get the latest user message
  const latestMessage = combinedMessages[messages.length - 1];
  const userMessage =
    typeof latestMessage.content === "string"
      ? latestMessage.content
      : latestMessage.content.map((c: any) => String(c)).join(" ");

  // Query relevant content from Sanity
  const relevantContent = await querySanity(userMessage);

  // If no relevant content is found, return an error
  if (
    combinedMessages.length < 2 &&
    (!relevantContent || relevantContent.length < 1)
  ) {
    return new Response("ERROR: CONTENT NOT FOUND", {
      status: 404,
    });
  } else {
    const context = relevantContent?.map((page) => {
      const urlMap = {
        blogPost: `https://rangle.io/blog/${page.slug}`,
        careersPage: "https://rangle.io/careers",
        homePage: "https://rangle.io",
        casePage: `https://rangle.io/cases/${page.slug}`,
        caseStudyPage: `https://rangle.io/our-work/${page.slug}`,
        conversionPage: `https://rangle.io/insights/${page.slug}`,
        eventsPage: `https://rangle.io/events/${page.slug}`,
        expertisePage: `https://rangle.io/expertise/${page.slug}`,
        otherPage: `https://rangle.io/${page.slug}`,
        partnerPage: `https://rangle.io/partners/${page.slug}`,
        servicePage: `https://rangle.io/services/${page.slug}`,
        webinarsPage: `https://rangle.io/events/webinars/${page.slug}`,
      };

      return `Title: ${page?.title}. URL: ${
        urlMap[page._type as keyof typeof urlMap] || ""
      } Content: ${page?._markdown}`;
    });

    // Get the user's IP address from the request headers
    const forwardedFor = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    const endUserIpAddress = forwardedFor?.split(",")[0] || realIp || "unknown";

    // Create a session for this user
    const airbenderSession = await airbender.fetchSession({
      productKey: process.env.AIRBENDER_PRODUCT_KEY || "",
      ipAddress: endUserIpAddress,
    });
    const airbenderSessionId = airbenderSession.id;

    const result = await streamTextWithLogging(
      {
        model: { provider: "google", modelId: "gemini-1.5-flash-8b" },
        system: `You are a LinkedIn post writer that creates engaging content using frameworks like PAS (Problem, Agitate, Solve), ACCA (Awareness, Comprehension, Conviction, Action), or QUEST (Question, Unique, Explain, Story, Tie-back). 
  
      Context from website:
      ${context}
  
      Guidelines:
      - Only write about content from Rangle's website. If there isn't relevant context, then say you don't have any information about that topic.
      - Use emojis instead of bullet points for structure (maximum 5 emojis)
      - Avoid using asterisks
      - Keep the tone professional yet engaging
      - Use concise language
      - End with a clear call-to-action or thought-provoking insight
      - Reference specific points from the provided context
      - Begin your response with "Context: " followed by the page URL and a brief summary of the context used, then start a new line for the LinkedIn post
      `,
        messages: convertToCoreMessages(messages),
      },
      {
        sessionID: airbenderSessionId,
        dynamicModel: true, // Enable server-side model control
      }
    );

    return result.toDataStreamResponse();
  }
}
