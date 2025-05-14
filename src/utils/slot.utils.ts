import * as chrono from "chrono-node";

interface SlotValues {
    origin: string | null;
    destination: string | null;
    city: string | null;
    maxPrice: number | null;
    cuisine: string | null;
    date: string | null;
    lastResults?: string;
    lastIntent?: string;
}

export function extractSlots(prompt: string): SlotValues {
    let lower = prompt.toLowerCase();
    console.log(`Extracting slots from: "${lower}"`);

    
    const slots: SlotValues = {
        origin: null,
        destination: null,
        city: null,
        maxPrice: null,
        cuisine: null,
        date: null
    };

    
    const normalizeCity = (cityName: string): string => {
        if (!cityName) return cityName;

        
        const corrections: Record<string, string> = {
            "banaglore": "bangalore",
            "banglore": "bangalore",
            "bengaluru": "bangalore",
            "bangalroe": "bangalore",
            "bangloe": "bangalore",
            "bombay": "mumbai",
            "mubai": "mumbai",
            "calcutta": "kolkata",
            "madras": "chennai",
            "chenai": "chennai",
            "dilli": "delhi",
            "newdelhi": "delhi",
            "new delhi": "delhi",
            "deli": "delhi",
            "dilhi": "delhi",
            "hydrabad": "hyderabad",
            "hiderabad": "hyderabad"
        };

        const normalized = cityName.toLowerCase().trim();
        return corrections[normalized] || normalized;
    };

    
    
    const cityMatch = lower.match(/(?:in|at|for|near)\s+([a-z\s]+?)(?:\s|$|,|\.)/i);
    if (cityMatch && cityMatch[1]) {
        slots.city = normalizeCity(cityMatch[1].trim());
        console.log(`Extracted city: ${slots.city}`);
    }

    
    const restaurantPatterns = [
        
        /list\s+(?:restaurants|restaurant|places|place|food)\s+(?:in|at|for|near)\s+([a-z\s]+?)(?:\s|$|,|\.)/i,
        
        /show\s+(?:me\s+)?(?:restaurants|restaurents|restuarants|restauraunts|places|place|food)\s+(?:in|at|for|near)\s+([a-z\s]+?)(?:\s|$|,|\.)/i,
        
        /find\s+(?:me\s+)?(?:restaurants|restaurents|restuarants|restauraunts|places|place|food)\s+(?:in|at|for|near)\s+([a-z\s]+?)(?:\s|$|,|\.)/i,
        
        /suggest\s+(?:me\s+)?(?:restaurants|restaurents|restuarants|restauraunts|places|place|food)\s+(?:in|at|for|near)\s+([a-z\s]+?)(?:\s|$|,|\.)/i
    ];

    for (const pattern of restaurantPatterns) {
        const match = lower.match(pattern);
        if (match && match[1]) {
            slots.city = normalizeCity(match[1].trim());
            console.log(`Extracted city from restaurant pattern: ${slots.city}`);
            break; 
        }
    }

    
    
    const flightMatch = lower.match(/from\s+([a-z\s]+?)\s+to\s+([a-z\s]+?)(?:\s|$|,|\.)/i);
    if (flightMatch && flightMatch[1] && flightMatch[2]) {
        slots.origin = normalizeCity(flightMatch[1].trim());
        slots.destination = normalizeCity(flightMatch[2].trim());
        console.log(`Extracted origin: ${slots.origin}, destination: ${slots.destination}`);
    }

    
    const originOnlyMatch = lower.match(/(?:flights|flight)\s+from\s+([a-z\s]+?)(?:\s|$|,|\.)/i);
    if (originOnlyMatch && originOnlyMatch[1] && !slots.origin) {
        slots.origin = normalizeCity(originOnlyMatch[1].trim());
        console.log(`Extracted origin only: ${slots.origin}`);
    }

    
    const priceMatch = lower.match(/(?:under|less than|below|max|maximum|up to|not more than)\s+(?:rs\.?|inr|₹)?\s*(\d+)/i);
    if (priceMatch && priceMatch[1]) {
        slots.maxPrice = parseInt(priceMatch[1], 10);
        console.log(`Extracted max price: ${slots.maxPrice}`);
    }

    
    const cuisineTypes = ['italian', 'chinese', 'indian', 'mexican', 'thai', 'japanese', 'mediterranean', 'french', 'spanish', 'american', 'greek', 'turkish', 'lebanese', 'korean', 'vietnamese', 'german', 'brazilian', 'argentine', 'african', 'caribbean', 'british', 'russian', 'middle eastern', 'north indian', 'south indian', 'bengali', 'punjabi', 'gujarati', 'maharashtrian', 'goan', 'kerala', 'mughlai', 'rajasthani', 'andhra', 'chettinad', 'hyderabadi', 'kashmiri', 'awadhi', 'biryani', 'kebab', 'tandoor', 'vegetarian', 'vegan', 'seafood', 'steakhouse', 'barbecue', 'sushi', 'pizza', 'burger', 'fast food', 'fine dining', 'buffet', 'street food', 'deli', 'bakery', 'cafe', 'bistro', 'pub', 'bar', 'lounge', 'fusion'];

    for (const cuisine of cuisineTypes) {
        if (lower.includes(cuisine)) {
            slots.cuisine = cuisine;
            console.log(`Extracted cuisine: ${slots.cuisine}`);
            break;
        }
    }

    
    
    const chronoDates = chrono.parse(prompt);
    if (chronoDates.length > 0) {
        slots.date = chronoDates[0].start.date().toISOString().split('T')[0];
        console.log(`Extracted date via chrono: ${slots.date}`);
    } else {
        

        
        const informalDateMatch = lower.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]+)/i);
        if (informalDateMatch) {
            const day = informalDateMatch[1];
            const month = informalDateMatch[2];
            const year = new Date().getFullYear();

            const dateStr = `${day} ${month} ${year}`;
            const parsedDate = chrono.parseDate(dateStr);

            if (parsedDate) {
                slots.date = parsedDate.toISOString().split('T')[0];
                console.log(`Extracted informal date: ${slots.date}`);
            }
        }

        
        const relativeDateSpellings: Record<string, string> = {
            "tommrow": "tomorrow",
            "tommorow": "tomorrow",
            "tomorro": "tomorrow",
            "tomorrw": "tomorrow",
            "tomorow": "tomorrow",
            "tmrw": "tomorrow",
            "tmw": "tomorrow",
            "2moro": "tomorrow",
            "2morrow": "tomorrow",
            "2mrw": "tomorrow",
            "tomorroow": "tomorrow",
            "tomoroo": "tomorrow",
            "tomoro": "tomorrow",
            "tommorrow": "tomorrow",
            "nextwek": "next week",
            "nxtweek": "next week",
            "nextweek": "next week",
            "nextmonth": "next month",
            "next mnth": "next month",
            "nxt month": "next month",
            "nxtmonth": "next month"
        };

        
        for (const [typo, correct] of Object.entries(relativeDateSpellings)) {
            if (lower === typo || lower.includes(` ${typo}`) || lower.includes(`${typo} `)) {
                console.log(`Detected date typo: ${typo} -> ${correct}`);
                lower = lower.replace(typo, correct);
                
                const reparsedDates = chrono.parse(lower);
                if (reparsedDates.length > 0) {
                    slots.date = reparsedDates[0].start.date().toISOString().split('T')[0];
                    console.log(`Extracted date from corrected typo: ${slots.date}`);
                    break;
                }
            }
        }

        
        const relativeTimeMatch = lower.match(/\b(today|tomorrow|next day|next week|weekend|day after tomorrow)\b/i);
        if (relativeTimeMatch) {
            const relativeTime = relativeTimeMatch[1].toLowerCase();
            const now = new Date();

            if (relativeTime === "today") {
                slots.date = now.toISOString().split('T')[0];
            } else if (relativeTime === "tomorrow") {
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                slots.date = tomorrow.toISOString().split('T')[0];
            } else if (relativeTime === "day after tomorrow") {
                const dayAfterTomorrow = new Date(now);
                dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
                slots.date = dayAfterTomorrow.toISOString().split('T')[0];
            } else if (relativeTime === "next week") {
                const nextWeek = new Date(now);
                nextWeek.setDate(nextWeek.getDate() + 7);
                slots.date = nextWeek.toISOString().split('T')[0];
            } else if (relativeTime === "weekend") {
                
                const weekend = new Date(now);
                const currentDay = weekend.getDay(); 
                const daysToSaturday = (6 - currentDay) % 7;
                weekend.setDate(weekend.getDate() + daysToSaturday);
                slots.date = weekend.toISOString().split('T')[0];
            }

            console.log(`Extracted relative date: ${slots.date}`);
        }

        
        if (!slots.date && lower.trim().length < 15) {
            
            if (/^(tomorrow|today|tmrw|tmw|tomorow|tommrow)$/i.test(lower.trim())) {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                slots.date = tomorrow.toISOString().split('T')[0];
                console.log(`Extracted single-word date (tomorrow): ${slots.date}`);
            }
            
            else if (/^(today)$/i.test(lower.trim())) {
                slots.date = new Date().toISOString().split('T')[0];
                console.log(`Extracted single-word date (today): ${slots.date}`);
            }
        }
    }

    return slots;
}
