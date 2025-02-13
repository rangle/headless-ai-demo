export interface GroqDocument {
  _id: string;
  score?: number;
  seo?: { metaTitle?: string };
  title?: string;
  blogTitle?: string;
  eventTitle?: string;
  summary?: string;
  content?: Array<{ style: string; children: Array<{ text: string }> }>;
  _markdown?: string;
  _type: string;
  slug: string;
  caseStudyCard?: {
    cardTitle: string;
    content: string;
    heading: string;
  };
  caseStudyEditorial?: {
    editorialContent: Array<{
      children: Array<{ text: string }>;
      style: string;
    }>;
  };
}

export async function querySanity(
  query: string
): Promise<GroqDocument[] | null> {
  const projectId = process.env.SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_DATASET;
  const token = process.env.SANITY_API_KEY;

  if (!projectId || !dataset || !token) {
    console.error("Missing required environment variables for Sanity.");
    return null;
  }

  // Construct the URL for the embeddings query
  const embeddingUrl = `https://${projectId}.api.sanity.io/vX/embeddings-index/query/${dataset}/headless-ai-demo`;

  // Set up headers for the request
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // Call Sanity’s embeddings API
  const embeddingResponse = await fetch(embeddingUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, maxResults: 3 }),
  });

  // Check if the request was successful
  if (!embeddingResponse.ok) {
    console.error(`Error querying embeddings: ${embeddingResponse.status}`);
    return null;
  }

  // Parse the embedding results
  const embeddingResults = await embeddingResponse.json();

  // Check if we got a valid array of results
  if (Array.isArray(embeddingResults) && embeddingResults.length > 0) {
    // Filter out irrelevant results
    const filteredResults = embeddingResults.filter(
      (res: any) => res.score >= 0.78
    );
    if (filteredResults.length === 0) {
      // If no results pass the threshold, return an empty array
      return [];
    }
    console.log("filteredResults", filteredResults);

    // Extract document IDs (from the filtered results only)
    const documentIds = filteredResults.map(
      (result: any) => `"${result.value.documentId}"`
    );

    // Build a map of docId -> score
    const documentScores: Record<string, number> = filteredResults.reduce(
      (acc: Record<string, number>, result: any) => {
        acc[result.value.documentId] = result.score;
        return acc;
      },
      {}
    );

    // Construct the GROQ query to fetch documents
    const groqQuery = `*[_id in [${documentIds.join(",")}]]`;
    // Encode special characters (brackets, quotes) for the query string
    const encodedGroqQuery = groqQuery
      .replace("[", "%5B")
      .replace("]", "%5D")
      .replace(/"/g, "%22");

    // Construct the URL for fetching the actual documents
    const groqUrl = `https://${projectId}.api.sanity.io/v2021-10-21/data/query/${dataset}?query=${encodedGroqQuery}`;

    // Fetch the matching documents
    const groqResponse = await fetch(groqUrl);

    if (!groqResponse.ok) {
      console.error(`Error querying GROQ: ${groqResponse.status}`);
      return null;
    }

    const groqJson = await groqResponse.json();
    const pageData: GroqDocument[] = groqJson.result || [];

    // Attach the scores to the documents
    for (const document of pageData) {
      const docId = document._id;
      if (docId in documentScores) {
        document.score = documentScores[docId];
      }
      document.title =
        document.seo?.metaTitle ||
        document.blogTitle ||
        document.eventTitle ||
        "";
      console.log(document.title);
      document._markdown = document?.content
        ? document.content
            .map(
              (section) =>
                section.children?.map((child) => child.text).join(" ") // Combine child texts with spaces
            )
            .filter(Boolean) // Remove any undefined or empty sections
            .join("\n") // Combine sections with double newlines
        : (document.caseStudyCard?.heading || "") +
          " " +
          (document.caseStudyCard?.content || "") +
          " " +
          document.caseStudyEditorial?.editorialContent
            ?.map(
              (content) =>
                content.children?.map((child) => child.text).join(" ") // Combine child texts with spaces
            )
            .filter(Boolean) // Remove any undefined or null results
            .join(" "); // Combine all content with spaces
    }
    // Return the matched documents with their scores
    return pageData;
  }

  // If no embedding results were returned
  return null;
}
