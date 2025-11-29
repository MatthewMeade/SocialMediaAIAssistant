import { PromptTemplate } from "@langchain/core/prompts";
import z from "zod";
import { chatModel } from "../models";
import { DocType, StoreMetaData, VectorStore } from "../vector-store";
import { BaseMessage, Document } from "langchain";
import { langfuseHandler } from "../../../server/lib/langfuse";

const formatHistory = (history: BaseMessage[]): string => {
    return history
        .slice(-4)
        .map(msg => `${msg.name}: ${msg.content}`)
        .join("\n");
};

const routeQueryResult = z.object({
    queries: z.array(z.object({
        queries: z.array(z.string().describe("An individual search query")).describe("A list of queries to search. Each search string will be queried for individually")
    })).describe("A list of datasources and the queries to search those sources for")
}).describe("Route a user query to the most relevant datasource.")


const routeQueryPrompt = new PromptTemplate({
    template: `You are an export at creating search terms to find relevant information based on a chat. Create search terms from the chat history to use for searching relevant topics in the user's notes.
    If you no search is needed, don't return any queries. Be consise, searches are done using a vector DB using similarity search. Return general concepts and ideas without repeating
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
    try {
        const store = new VectorStore();

        const result = await routeQueryPrompt
            .pipe(chatModel.withStructuredOutput(routeQueryResult))
            .pipe(async (data) => {
                try {
                    const searchPromises = data.queries.map(async (group) => {
                        return store.searchDocuments({ calendarId: params.calendarId, text: group.queries, docType: DocType.Note })
                    }
                    );
                    const results = await Promise.all(searchPromises);

                    const uniqueResultsMap = results.flat().reduce((acc, cur) => ({ ...acc, [cur.metadata.documentType + cur.metadata.documentId]: cur }), {} as Record<string, Document<StoreMetaData>>)
                    return Object.values(uniqueResultsMap);
                } catch (error) {
                    console.log('searchDocuments pipe', { error })
                    throw error;
                }
            })
            .invoke({ history: formatHistory(params.history), input: params.input }, { callbacks: [langfuseHandler] });

        return result;
    } catch (error) {
        console.log('searchDocuments', { error })
        throw error;
    }
}