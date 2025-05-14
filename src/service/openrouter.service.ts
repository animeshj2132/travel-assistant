import axios from "axios";

export interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

const DEFAULT_SYSTEM_MESSAGE: ChatMessage = {
    role: "system",
    content: "You are a travel assistant that helps users with hotels, flights, and restaurants. Maintain conversation context and remember important details like cities, dates, price preferences, and other specifications throughout the conversation. If a user asks about filtering results by price, respond naturally without mentioning technical details. If a user responds with just a date or time (like 'tomorrow', 'next week', or 'May 15th'), assume they are continuing the previous conversation about flights, hotels, or travel plans and respond accordingly, without starting a new topic. Always be conversational and helpful, even with misspelled city names, informal date specifications, or ambiguous requests."
};

const conversationStore: Record<string, ChatMessage[]> = {};

export const callOpenRouter = async (prompt: string): Promise<string> => {
    const messages: ChatMessage[] = [{ role: "user", content: prompt }];
    return callOpenRouterWithMessages(messages);
};

export const callOpenRouterWithMessages = async (messages: ChatMessage[], conversationId?: string): Promise<string> => {
    const apiKey = process.env.OPENROUTER_API_KEY!;

    if (!messages.some(msg => msg.role === "system")) {
        messages = [DEFAULT_SYSTEM_MESSAGE, ...messages];
    }

    if (conversationId && conversationStore[conversationId]) {
        const existingMessages = conversationStore[conversationId];

        if (existingMessages[0].role !== "system") {
            messages = [DEFAULT_SYSTEM_MESSAGE, ...existingMessages, ...messages.filter(msg => msg.role !== "system")];
        } else {
            messages = [...existingMessages, ...messages.filter(msg => msg.role !== "system")];
        }


        if (messages.length > 11) {
            messages = [
                messages[0],
                ...messages.slice(messages.length - 10)
            ];
        }
    }

    const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
            model: "openai/gpt-3.5-turbo",
            messages,
        },
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost",
                "X-Title": "TravelAssistant",
            },
        }
    );

    const assistantResponse = res.data.choices?.[0]?.message?.content || "No AI response.";


    if (conversationId) {

        const assistantMessage: ChatMessage = {
            role: "assistant",
            content: assistantResponse
        };


        conversationStore[conversationId] = [
            ...(conversationStore[conversationId] || [DEFAULT_SYSTEM_MESSAGE]),
            ...messages.filter(msg => msg.role !== "system"),
            assistantMessage
        ];


        if (conversationStore[conversationId].length > 21) {
            conversationStore[conversationId] = [
                conversationStore[conversationId][0],
                ...conversationStore[conversationId].slice(-20)
            ];
        }
    }

    return assistantResponse;
};
