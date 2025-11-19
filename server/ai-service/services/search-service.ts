import { PromptTemplate } from "@langchain/core/prompts";
import z from "zod";
import { chatModel } from "../models";
import { DocType, StoreMetaData, VectorStore } from "../vector-store";
import { Document } from "langchain";


// Helper to format history
const formatHistory = (history: Array<{ role: string; content: string }>): string => {
    return history
        .slice(-4) // Use last 4 messages for context
        .map(msg => `${msg.role}: ${msg.content}`)
        .join("\n");
};

const routeQueryResult = z.object({
    queries: z.array(z.object({
        datasource: z.enum(["note", "support"]).describe(`
            Given the user's messages, choose which datasource would be most relevant for answering 
            their question. 
            
            note: Search the user's organization's database of notes
            support: Search this application's knowledgebase
        `),
        queries: z.array(z.string().describe("An individual search query")).describe("A list of queries to search. Each search string will be queried for individually")
    })).describe("A list of datasources and the queries to search those sources for")
}).describe("Route a user query to the most relevant datasource.")


const routeQueryPrompt = new PromptTemplate({
    template: `You are an expert at routing a user question to the appropriate 
      data source. Create queries for the user's note database, our the application's support articles.

      Prefer searching the user's notes unless they are asking for product support for this app
      
      <Chat History>
        {history}
      </Chat History>

      <User Message>
        {input}
      </User Message>

      `,
    inputVariables: ['history', 'input']
})



export const searchDocuments = async (params: {
    history: Array<{ role: string, content: string }>,
    input: string,
    calendarId: string
}): Promise<Document<StoreMetaData>[]> => {

    const store = new VectorStore();
    return await routeQueryPrompt
        .pipe(chatModel.withStructuredOutput(routeQueryResult))
        .pipe(async (data) => {
            console.log(JSON.stringify({data}, null, 2))
            const searchPromises = data.queries.map(async (group) => {
                return store.searchDocuments({calendarId: params.calendarId, text: group.queries, docType: group.datasource as any as DocType})
                }
            );
            const results = await Promise.all(searchPromises);

            console.log(JSON.stringify({results}, null, 2))

            const uniqueResultsMap = results.flat().reduce((acc, cur) => ({...acc, [cur.metadata.documentType + cur.metadata.documentId] : cur}), {} as Record<string, Document<StoreMetaData>>)
            return Object.values(uniqueResultsMap);
        })
        .invoke({ history: formatHistory(params.history), input: params.input })
}