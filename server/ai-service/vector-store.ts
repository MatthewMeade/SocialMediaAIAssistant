import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "langchain";
import { createClient } from "server/lib/supabase/server";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { SupabaseClient } from "@supabase/supabase-js";

export enum DocType {
    Note = 'note',
    Knowledgebase = 'knowledgebase'
}

const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 100;

export type StoreMetaData = {
    documentId: string,
    documentType: DocType,
    calendarId: string
}

export class VectorStore {
    vectorStore: SupabaseVectorStore;
    client: SupabaseClient;

    constructor() {
        const embeddings = new OpenAIEmbeddings({
            model: "text-embedding-3-small",
        });

        this.client = createClient()

        this.vectorStore = new SupabaseVectorStore(embeddings, {
            client: this.client,
            tableName: "documents",
            queryName: "match_documents",
        });
    }

    async upsertDocument(docType: DocType, doc: { id: string, calendarId: string, content: string }) {

        await this.deleteDocument(docType, doc.id)

        const splitter = new RecursiveCharacterTextSplitter({ chunkSize: CHUNK_SIZE, chunkOverlap: CHUNK_OVERLAP })
        const texts = await splitter.splitText(doc.content)

        const metadata = {
            documentId: doc.id,
            documentType: docType,
            calendarId: doc.calendarId,
        };

        const docs = texts.map((t: string) => new Document({ pageContent: t, metadata }))

        await this.vectorStore.addDocuments(docs)
    }

    async deleteDocument(docType: DocType, docId: string) {
        await this.client.from('documents')
            .delete()
            .eq('metadata->>documentType', docType)
            .eq('metadata->>documentId', docId)
    }

    async searchDocuments(query: {
        text: string[],
        calendarId: string,
        docType: DocType
    }): Promise<Document<StoreMetaData>[]> {

        const retriever = this.vectorStore.asRetriever({ k: 5, filter: { calendarId: query.calendarId, documentType: query.docType } })

        const batchResult = await retriever.batch(query.text)


        return batchResult.flat() as Document<StoreMetaData>[]
    }
}