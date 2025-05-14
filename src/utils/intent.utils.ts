export function extractIntent(prompt: string) {
    const lower = prompt.toLowerCase();
    console.log(`Extracting intent from: "${lower}"`);

    
    if (lower.includes("flight") ||
        lower.match(/\b(from|to)\b.*\b(from|to)\b/i) || 
        lower.match(/\b[a-z]+\s+to\s+[a-z]+\b/i) ||    
        lower.includes("airline") ||
        lower.includes("airways") ||
        lower.includes("airport")) {
        console.log("Intent detected: flight");
        return "flight";
    }

    
    if (lower.includes("hotel") ||
        lower.includes("room") ||
        lower.includes("stay") ||
        lower.includes("accommodation") ||
        lower.includes("lodge") ||
        lower.includes("resort")) {
        console.log("Intent detected: hotel");
        return "hotel";
    }

    
    if (lower.includes("restaurant") ||
        lower.includes("restaurent") ||  
        lower.includes("restauraunt") ||  
        lower.includes("restuarant") ||  
        lower.includes("food") ||
        lower.includes("eat") ||
        lower.includes("dining") ||
        lower.includes("cuisine") ||
        lower.includes("dinner") ||
        lower.includes("lunch") ||
        lower.includes("breakfast") ||
        lower.match(/\b(show|list|find|get|suggest)\s+.*(restaurants?|places?|food|dining)\b/i) ||
        (lower.includes("list") && (lower.includes("place") || lower.includes("places") || lower.includes("restaurants")))) {
        console.log("Intent detected: restaurant");
        return "restaurant";
    }

    console.log("Intent detected: unknown");
    return "unknown";
}
