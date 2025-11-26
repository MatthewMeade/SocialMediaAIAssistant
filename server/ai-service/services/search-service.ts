import { PromptTemplate } from "@langchain/core/prompts";
import z from "zod";
import { chatModel, nanoModel } from "../models";
import { DocType, StoreMetaData, VectorStore } from "../vector-store";
import { BaseMessage, Document } from "langchain";
import { langfuseHandler } from "../../../server/lib/langfuse";


// Helper to format history
const formatHistory = (history: BaseMessage[]): string => {
    return history
        .slice(-4) // Use last 4 messages for context
        .map(msg => `${msg.name}: ${msg.content}`)
        .join("\n");
};

const routeQueryResult = z.object({
    queries: z.array(z.object({
        // datasource: z.enum(["note", /* "support" */]).describe(`
        //     Given the user's messages, choose which datasource would be most relevant for answering 
        //     their question. 
            
        //     note: Search the user's organization's database of notes
        // `),
        queries: z.array(z.string().describe("An individual search query")).describe("A list of queries to search. Each search string will be queried for individually")
    })).describe("A list of datasources and the queries to search those sources for")
}).describe("Route a user query to the most relevant datasource.")


const routeQueryPrompt = new PromptTemplate({
    template: `You are an export at creating search terms to find relevant information based on a chat. Create search terms from the chat history to use for searching relevant topics in the user's notes
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
    history: BaseMessage[],
    input: string,
    calendarId: string
}): Promise<Document<StoreMetaData>[]> => {

    const store = new VectorStore();
    return await routeQueryPrompt
        .pipe(nanoModel.withStructuredOutput(routeQueryResult))
        .pipe(async (data) => {
            console.log(JSON.stringify({data}, null, 2))
            const searchPromises = data.queries.map(async (group) => {
                return store.searchDocuments({calendarId: params.calendarId, text: group.queries, docType: DocType.Note})
                }
            );
            const results = await Promise.all(searchPromises);


            const uniqueResultsMap = results.flat().reduce((acc, cur) => ({...acc, [cur.metadata.documentType + cur.metadata.documentId] : cur}), {} as Record<string, Document<StoreMetaData>>)
            return Object.values(uniqueResultsMap);
        })
        .invoke({ history: formatHistory(params.history), input: params.input }, { callbacks: [langfuseHandler] })
}