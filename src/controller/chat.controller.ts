import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { extractIntent } from "../utils/intent.utils";
import { extractSlots } from "../utils/slot.utils";
import { callOpenRouter, callOpenRouterWithMessages, ChatMessage } from "../service/openrouter.service";
import { AuthRequest } from "../middleware/auth.middleware";
import { Prisma } from "@prisma/client";

interface SlotContext {
    origin: string | null;
    destination: string | null;
    city: string | null;
    maxPrice: number | null;
    cuisine: string | null;
    date: string | null;
    lastResults?: string;
    lastIntent?: string;
}

interface MessageMetadata {
    slots: SlotContext;
    intent: string;
}



const conversationCache: Record<string, SlotContext> = {};


function isOffTopic(prompt: string): boolean {
    const lower = prompt.toLowerCase();


    const travelTerms = [
        'travel', 'trip', 'vacation', 'visit', 'tour', 'flight', 'hotel',
        'restaurant', 'accommodation', 'food', 'destination', 'city',
        'airport', 'booking', 'holiday', 'journey', 'itinerary', 'ticket',
        'sightseeing', 'tourist', 'tourism', 'resort', 'beach', 'mountain',
        'cruise', 'train', 'bus', 'taxi', 'car rental', 'luggage', 'passport',
        'visa', 'international', 'domestic', 'check-in', 'check-out', 'lodging',
        'breakfast', 'lunch', 'dinner', 'cafe', 'dining', 'cuisine', 'reservation',
        'attractions', 'landmark', 'museum', 'gallery', 'park', 'hiking', 'adventure',
        'backpacking', 'airbnb', 'motel', 'hostel', 'inn', 'departure', 'arrival'
    ];


    const locationTerms = [
        'delhi', 'mumbai', 'bangalore', 'kolkata', 'chennai', 'hyderabad',
        'ahmedabad', 'pune', 'jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore',
        'thane', 'bhopal', 'visakhapatnam', 'patna', 'vadodara', 'ghaziabad',
        'ludhiana', 'agra', 'nashik', 'faridabad', 'meerut', 'rajkot', 'kalyan',
        'varanasi', 'srinagar', 'aurangabad', 'dhanbad', 'amritsar', 'navi',
        'allahabad', 'ranchi', 'haora', 'coimbatore', 'jabalpur', 'gwalior',
        'vijayawada', 'jodhpur', 'madurai', 'raipur', 'kota', 'guwahati',
        'chandigarh', 'solapur', 'hubli', 'dharwad', 'bareilly', 'moradabad',
        'mysore', 'gurgaon', 'aligarh', 'jalandhar', 'tiruchirappalli', 'bhubaneswar',
        'salem', 'mira', 'thiruvananthapuram', 'bhiwandi', 'saharanpur', 'gorakhpur',
        'guntur', 'bikaner', 'amravati', 'noida', 'jamshedpur', 'bhilai', 'warangal',
        'mangalore', 'new york', 'los angeles', 'chicago', 'houston', 'phoenix',
        'philadelphia', 'san antonio', 'san diego', 'dallas', 'san francisco',
        'austin', 'seattle', 'london', 'paris', 'tokyo', 'dubai', 'singapore',
        'sydney', 'hong kong', 'bangkok', 'istanbul', 'toronto', 'rome', 'barcelona'
    ];


    for (const term of travelTerms) {
        if (lower.includes(term)) return false;
    }


    for (const location of locationTerms) {
        if (lower.includes(location)) return false;
    }


    const offTopicSubjects = [
        'algorithm', 'code', 'programming', 'math', 'science', 'politics',
        'religion', 'database', 'sorting', 'ai', 'machine learning', 'complexity',
        'big o', 'computation', 'equation', 'formula', 'theorem', 'notation',
        'cryptocurrency', 'bitcoin', 'blockchain', 'homework', 'assignment',
        'chemistry', 'physics', 'biology', 'history', 'economics', 'psychology',
        'medicine', 'philosophy', 'literature', 'grammar', 'language model', 'gpt'
    ];


    for (const subject of offTopicSubjects) {
        if (lower.includes(subject)) return true;
    }



    if (prompt.split(' ').length < 4) {

        if (locationTerms.some(term => lower.includes(term)) ||
            travelTerms.some(term => lower.includes(term))) {
            return false;
        }


        const ambiguousTerms = ['from', 'to', 'when', 'where', 'how', 'much', 'cost', 'price', 'best'];


        const words = lower.split(/\s+/);
        if (words.every(word => ambiguousTerms.includes(word))) {
            return false;
        }
    }


    return false;
}

function getClientIP(req: Request): string {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") return forwarded.split(",")[0];
    if (Array.isArray(forwarded)) return forwarded[0];
    return req.socket.remoteAddress || "unknown";
}

export const handleChat = async (req: AuthRequest, res: Response): Promise<void> => {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string") {
        res.status(400).json({ message: "Prompt is required and must be a string" });
        return;
    }

    const trimmed = prompt.trim();


    if (isOffTopic(trimmed)) {
        res.json({
            intent: "off-topic",
            message: "I'm your travel assistant and can only help with travel-related questions. Would you like information about flights, hotels, or restaurants for your next trip?"
        });
        return;
    }


    let intent = extractIntent(trimmed);
    const currentSlots = extractSlots(trimmed);


    const contextSlots = await getConversationContext(req);


    const conversationId = req.user ? `user-${req.user.userId}` : `guest-${getClientIP(req)}`;
    const cachedContext = conversationCache[conversationId] || {};

    console.log("Database context:", contextSlots);
    console.log("Cached context:", cachedContext);


    const previousOrigin = contextSlots.origin || cachedContext.origin;
    const previousDestination = contextSlots.destination || cachedContext.destination;


    let shouldResetDate = false;
    if (intent === "flight" && currentSlots.origin && currentSlots.destination) {
        if ((previousOrigin && previousOrigin !== currentSlots.origin) ||
            (previousDestination && previousDestination !== currentSlots.destination)) {
            console.log("Flight route changed, resetting date context");
            shouldResetDate = true;
        }
    }


    const isFilterRequest =
        trimmed.toLowerCase().includes('filter') ||
        trimmed.toLowerCase().includes('show me only') ||
        trimmed.toLowerCase().includes('show only') ||
        trimmed.toLowerCase().includes('show me flights under') ||
        trimmed.toLowerCase().includes('flights under') ||
        (trimmed.toLowerCase().match(/under\s+(?:rs\.?|inr|₹)?\s*\d+/) !== null) ||
        trimmed.toLowerCase().includes('cheaper') ||
        trimmed.toLowerCase().includes('price range') ||
        trimmed.toLowerCase().includes('budget') ||
        trimmed.toLowerCase().includes('under 5000');


    if (isFilterRequest && intent === "unknown") {
        console.log("Changing intent from unknown to filter");
        intent = "filter";
    }


    console.log(`Filter request detected: ${isFilterRequest}`);
    console.log(`Current request: "${trimmed}"`);
    console.log(`Current intent: ${intent}`);



    const slots: SlotContext = {
        origin: currentSlots.origin || contextSlots.origin || cachedContext.origin || null,
        destination: currentSlots.destination || contextSlots.destination || cachedContext.destination || null,
        city: currentSlots.city || contextSlots.city || cachedContext.city || null,
        maxPrice: currentSlots.maxPrice || contextSlots.maxPrice || cachedContext.maxPrice || null,
        cuisine: currentSlots.cuisine || contextSlots.cuisine || cachedContext.cuisine || null,
        date: currentSlots.date || contextSlots.date || cachedContext.date || null,
        lastIntent: contextSlots.lastIntent || cachedContext.lastIntent,
        lastResults: contextSlots.lastResults || cachedContext.lastResults
    };


    const previousIntent = contextSlots.lastIntent || cachedContext.lastIntent;
    if ((intent !== previousIntent && intent !== "filter" && intent !== "unknown") || shouldResetDate) {
        console.log(`Intent changed from ${previousIntent} to ${intent} or route changed. Clearing context.`);
        slots.maxPrice = null;
        if (shouldResetDate) {
            slots.date = null;
        }
    }


    console.log(`Current slots: ${JSON.stringify(currentSlots)}`);
    console.log(`Context slots: ${JSON.stringify(contextSlots)}`);



    if (

        currentSlots.date &&
        !currentSlots.origin &&
        !currentSlots.destination &&
        trimmed.length < 20 &&
        (contextSlots.lastIntent === "flight" || cachedContext.lastIntent === "flight") &&
        (contextSlots.origin || cachedContext.origin) &&
        (contextSlots.destination || cachedContext.destination)
    ) {
        console.log("SPECIAL HANDLING: Date-only message with previous flight context");


        intent = "flight";


        const safeOrigin = contextSlots.origin || cachedContext.origin || "";
        const safeDestination = contextSlots.destination || cachedContext.destination || "";
        const safeDate = currentSlots.date;


        slots.origin = safeOrigin;
        slots.destination = safeDestination;
        slots.date = safeDate;

        console.log(`SPECIAL HANDLING: Updated slots: ${JSON.stringify(slots)}`);


        const cleanOrigin = safeOrigin.replace(/^flights?\s+from\s+/i, '').trim();
        const cleanDestination = safeDestination.replace(/^to\s+/i, '').trim().replace(/\s+on$/, '').trim();

        console.log(`Proceeding with flight search: ${cleanOrigin} to ${cleanDestination} on ${safeDate}`);


        conversationCache[conversationId] = {
            ...slots,
            origin: cleanOrigin,
            destination: cleanDestination,
            date: safeDate,
            lastIntent: "flight"
        };


    }


    if (isFilterRequest) {
        console.log("Processing filter request");


        console.log("Context lastIntent:", contextSlots.lastIntent);
        console.log("Context has lastResults:", contextSlots.lastResults ? "YES" : "NO");
        console.log("Cache lastIntent:", cachedContext.lastIntent);
        console.log("Cache has lastResults:", cachedContext.lastResults ? "YES" : "NO");


        const effectiveLastResults = contextSlots.lastResults || cachedContext.lastResults;
        const effectiveLastIntent = contextSlots.lastIntent || cachedContext.lastIntent;

        if (effectiveLastResults && effectiveLastIntent) {
            console.log("Processing filter request with context:", effectiveLastIntent);


            const priceMatch = trimmed.match(/(?:under|less than|below|cheaper than|max|maximum|up to|not more than)\s+(?:rs\.?|inr|₹)?\s*(\d+)/i);
            let maxPrice = null;
            if (priceMatch && priceMatch[1]) {
                maxPrice = parseInt(priceMatch[1], 10);
                console.log(`Extracted max price filter: ${maxPrice}`);
            } else {

                const numberMatch = trimmed.match(/\d+/);
                if (numberMatch) {
                    maxPrice = parseInt(numberMatch[0], 10);
                    console.log(`Extracted potential price from numbers: ${maxPrice}`);
                }
            }


            const isRatingFilter =
                trimmed.toLowerCase().includes('rating') ||
                trimmed.toLowerCase().includes('stars') ||
                trimmed.toLowerCase().includes('rated') ||
                (trimmed.toLowerCase().includes('below') && !trimmed.toLowerCase().includes('price')) ||
                (effectiveLastIntent === "restaurant" && trimmed.toLowerCase().match(/[0-5](\.[0-9])?/) !== null);

            console.log(`Is rating filter: ${isRatingFilter}`);


            if (intent === "filter" && maxPrice && effectiveLastIntent !== "flight" &&
                effectiveLastIntent !== "hotel" && effectiveLastIntent !== "restaurant") {

                res.json({
                    intent: "unknown",
                    message: "I'm not sure what you want to filter. Could you please specify if you're looking for flights, hotels, or restaurants with that filter?",
                    slots
                });
                return;
            }


            if (isRatingFilter && effectiveLastIntent === "restaurant" && effectiveLastResults.length > 0) {
                console.log("Processing rating filter for restaurants");


                let ratingThreshold: number | null = null;
                if (maxPrice) {
                    ratingThreshold = maxPrice > 5 ? 5 : maxPrice;
                    console.log(`Using rating threshold: ${ratingThreshold}`);

                    const filteredRestaurants = JSON.parse(effectiveLastResults).filter(
                        (restaurant: any) => {
                            if (ratingThreshold === null) return true;
                            return restaurant.rating < ratingThreshold;
                        }
                    );
                    console.log(`Filtered ${filteredRestaurants.length} restaurants with rating below ${ratingThreshold}`);

                    if (filteredRestaurants.length > 0) {

                        conversationCache[conversationId] = {
                            ...contextSlots,
                            lastResults: JSON.stringify(filteredRestaurants),
                            lastIntent: "restaurant"
                        };

                        res.json({
                            intent: "restaurant",
                            results: filteredRestaurants,
                            message: `Here are restaurants with ratings below ${ratingThreshold}:`,
                            slots
                        });
                    } else {
                        res.json({
                            intent: "restaurant",
                            results: [],
                            message: `I couldn't find any restaurants with ratings below ${ratingThreshold}.`,
                            slots
                        });
                    }
                    return;
                }
            }


            if (effectiveLastIntent === "flight" && effectiveLastResults.length > 0) {

                if (maxPrice) {
                    console.log("Processing price filter for flights");

                    const filteredFlights = JSON.parse(effectiveLastResults).filter(
                        (flight: any) => flight.price <= maxPrice
                    );
                    console.log(`Filtered ${filteredFlights.length} flights under price ${maxPrice}`);

                    if (filteredFlights.length > 0) {

                        conversationCache[conversationId] = {
                            origin: slots.origin,
                            destination: slots.destination,
                            date: slots.date,
                            lastIntent: "flight",
                            maxPrice: maxPrice,
                            city: null,
                            cuisine: null,
                            lastResults: JSON.stringify(filteredFlights)
                        };
                        console.log(`Updated cache with filtered flights under ${maxPrice}:`, conversationCache[conversationId]);

                        res.json({
                            intent: "flight",
                            results: filteredFlights,
                            message: `Here are flights under ₹${maxPrice}:`,
                            slots
                        });
                    } else {
                        res.json({
                            intent: "flight",
                            results: [],
                            message: `I couldn't find any flights under ₹${maxPrice}. Would you like to try a higher budget?`,
                            slots
                        });
                    }
                    return;
                }
            } else if (effectiveLastIntent === "hotel" && effectiveLastResults.length > 0) {

                if (maxPrice) {
                    console.log("Processing price filter for hotels");

                    const filteredHotels = JSON.parse(effectiveLastResults).filter(
                        (hotel: any) => hotel.room_price <= maxPrice
                    );
                    console.log(`Filtered ${filteredHotels.length} hotels under price ${maxPrice}`);

                    if (filteredHotels.length > 0) {

                        conversationCache[conversationId] = {
                            city: slots.city,
                            lastIntent: "hotel",
                            maxPrice: maxPrice,
                            origin: null,
                            destination: null,
                            cuisine: null,
                            date: null,
                            lastResults: JSON.stringify(filteredHotels)
                        };
                        console.log(`Updated cache with filtered hotels under ${maxPrice}:`, conversationCache[conversationId]);

                        res.json({
                            intent: "hotel",
                            results: filteredHotels,
                            message: `Here are hotels under ₹${maxPrice}:`,
                            slots
                        });
                    } else {
                        res.json({
                            intent: "hotel",
                            results: [],
                            message: `I couldn't find any hotels under ₹${maxPrice}. Would you like to try a higher budget?`,
                            slots
                        });
                    }
                    return;
                }
            } else if (effectiveLastIntent === "restaurant" && effectiveLastResults.length > 0) {


                if (maxPrice && !isRatingFilter) {
                    console.log("Processing price filter for restaurants");

                    const maxPriceSymbols = "$".repeat(Math.min(Math.ceil(maxPrice / 1000), 4));
                    console.log(`Price ${maxPrice} converted to symbol count: ${maxPriceSymbols.length}`);

                    const filteredRestaurants = JSON.parse(effectiveLastResults).filter(
                        (restaurant: any) => restaurant.price_range.length <= maxPriceSymbols.length
                    );
                    console.log(`Filtered ${filteredRestaurants.length} restaurants with price range ${maxPriceSymbols} or less`);

                    if (filteredRestaurants.length > 0) {

                        conversationCache[conversationId] = {
                            city: slots.city,
                            lastIntent: "restaurant",
                            maxPrice: maxPrice,
                            origin: null,
                            destination: null,
                            cuisine: slots.cuisine,
                            date: null,
                            lastResults: JSON.stringify(filteredRestaurants)
                        };
                        console.log(`Updated cache with filtered restaurants under ${maxPrice}:`, conversationCache[conversationId]);

                        res.json({
                            intent: "restaurant",
                            results: filteredRestaurants,
                            message: `Here are restaurants with price range ${maxPriceSymbols} or less (under ₹${maxPrice}):`,
                            slots
                        });
                    } else {
                        res.json({
                            intent: "restaurant",
                            results: [],
                            message: `I couldn't find any restaurants within your budget of ₹${maxPrice}. Would you like to try a higher price range?`,
                            slots
                        });
                    }
                    return;
                }
            }


            if (maxPrice) {
                console.log("Filter request received but no relevant context found");

                if (currentSlots.city) {
                    if (intent === "filter") {
                        console.log("Treating as a hotel filter request based on context");
                        res.json({
                            intent: "unknown",
                            message: `I can help you find hotels under ₹${maxPrice}. In which city are you looking to stay?`,
                            slots
                        });
                        return;
                    }
                } else if (currentSlots.origin || currentSlots.destination) {
                    console.log("Treating as a flight filter request based on context");
                    res.json({
                        intent: "unknown",
                        message: `I can help you find flights under ₹${maxPrice}. Please let me know your departure city, destination, and travel date.`,
                        slots
                    });
                    return;
                }


                res.json({
                    intent: "unknown",
                    message: `I can help you find options under ₹${maxPrice}. Are you looking for flights, hotels, or restaurants?`,
                    slots
                });
                return;
            }
        }
    }


    let isContinuation = false;
    let prevIntent = contextSlots.lastIntent || "";


    if (intent === "unknown" && prevIntent) {
        console.log(`Unknown intent but previous intent was ${prevIntent}. Checking for continuation...`);


        if (currentSlots.date && prevIntent === "flight") {
            console.log(`Found date ${currentSlots.date} - likely a continuation of flight search`);
            intent = "flight";
            isContinuation = true;


            slots.origin = contextSlots.origin;
            slots.destination = contextSlots.destination;
            slots.date = currentSlots.date;

            console.log(`Updated slots for flight continuation: ${JSON.stringify(slots)}`);
        }

        else if (currentSlots.destination && !currentSlots.origin && prevIntent === "flight" && contextSlots.origin) {
            console.log(`Found destination ${currentSlots.destination} - likely a continuation of flight search`);
            intent = "flight";
            isContinuation = true;


            slots.origin = contextSlots.origin;
            slots.destination = currentSlots.destination;
            slots.date = contextSlots.date;
        }
    }


    try {

        const metadata: string = JSON.stringify({
            slots,
            intent
        });

        if (req.user) {

            const userExists = await prisma.user.findUnique({
                where: { id: req.user.userId }
            });

            if (userExists) {
                try {
                    await prisma.searchLog.create({
                        data: {
                            userId: req.user.userId,
                            prompt: trimmed,
                            intent
                        },
                    });
                } catch (error) {
                    console.error("Error logging user search with metadata:", error);

                    await prisma.searchLog.create({
                        data: {
                            userId: req.user.userId,
                            prompt: trimmed,
                            intent
                        },
                    });
                }
            } else {

                try {
                    await prisma.guestLog.create({
                        data: {
                            ip: getClientIP(req),
                            prompt: trimmed,
                            intent
                        },
                    });
                } catch (error) {
                    console.error("Error logging guest search with metadata:", error);

                    await prisma.guestLog.create({
                        data: {
                            ip: getClientIP(req),
                            prompt: trimmed,
                            intent
                        },
                    });
                }
            }
        } else {
            try {
                await prisma.guestLog.create({
                    data: {
                        ip: getClientIP(req),
                        prompt: trimmed,
                        intent
                    },
                });
            } catch (error) {
                console.error("Error logging guest search with metadata:", error);

                await prisma.guestLog.create({
                    data: {
                        ip: getClientIP(req),
                        prompt: trimmed,
                        intent
                    },
                });
            }
        }
    } catch (error) {
        console.error("Error logging request:", error);

    }


    let conversationMessages: ChatMessage[] = [];
    try {
        if (req.user) {
            const logs = await prisma.searchLog.findMany({
                where: { userId: req.user.userId },
                orderBy: { createdAt: "desc" },
                take: 5
            });


            conversationMessages = logs.map(log => ({
                role: "user" as const,
                content: log.prompt
            }));
        } else {
            const logs = await prisma.guestLog.findMany({
                where: { ip: getClientIP(req) },
                orderBy: { createdAt: "desc" },
                take: 5
            });


            conversationMessages = logs.map(log => ({
                role: "user" as const,
                content: log.prompt
            }));
        }


        conversationMessages.reverse();


        conversationMessages.push({ role: "user", content: trimmed });
    } catch (error) {
        console.error("Error retrieving conversation history:", error);

        conversationMessages = [{ role: "user", content: trimmed }];
    }

    if (intent === "flight") {
        const { origin, destination, date } = slots;


        if (origin && destination && date) {
            console.log(`FOUND ALL INFO for flights: ${origin} to ${destination} on ${date}`);


            const cleanOrigin = origin.replace(/^flights?\s+from\s+/i, '').trim();
            const cleanDestination = destination.replace(/^to\s+/i, '').trim().replace(/\s+on$/, '').trim();

            console.log(`Searching for flights from ${cleanOrigin} to ${cleanDestination} on ${date}`);


            const targetDate = new Date(date);
            const targetMonth = targetDate.getMonth();
            const targetDay = targetDate.getDate();

            console.log(`Target date parsed as: ${targetDate.toISOString()}, Month: ${targetMonth + 1}, Day: ${targetDay}`);


            const normalizeCity = (cityName: string): string => {

                const corrections: Record<string, string> = {
                    "banaglore": "bangalore",
                    "banglore": "bangalore",
                    "bengaluru": "bangalore",
                    "bombay": "mumbai",
                    "calcutta": "kolkata",
                    "madras": "chennai",
                    "dilli": "delhi",
                    "newdelhi": "delhi",
                    "new delhi": "delhi",
                    "hydrabad": "hyderabad"
                };

                const normalized = cityName.toLowerCase().trim();
                return corrections[normalized] || normalized;
            };

            const normalizedOrigin = normalizeCity(cleanOrigin);
            const normalizedDestination = normalizeCity(cleanDestination);

            console.log(`Normalized cities: ${normalizedOrigin} to ${normalizedDestination}`);

            try {

                const debugFlights = await prisma.flight.findMany({ take: 3 });
                console.log("SAMPLE FLIGHTS FROM DATABASE:");
                debugFlights.forEach(flight => {
                    const dbDate = new Date(flight.date);
                    const source = 'source' in flight ? flight.source : (flight as any).origin;
                    const destination = flight.destination;
                    console.log(`Flight ${flight.id}: ${source} to ${destination}, Date: ${dbDate.toISOString()}, Month: ${dbDate.getMonth() + 1}, Day: ${dbDate.getDate()}`);
                });


                const allRouteFlights = await prisma.$queryRaw`
                    SELECT * FROM "Flight" 
                    WHERE LOWER(source) = LOWER(${normalizedOrigin.toLowerCase()}) 
                    AND LOWER(destination) = LOWER(${normalizedDestination.toLowerCase()})
                `;

                console.log(`\nFound ${Array.isArray(allRouteFlights) ? allRouteFlights.length : 0} total flights on route ${normalizedOrigin} to ${normalizedDestination}`);


                if (Array.isArray(allRouteFlights) && allRouteFlights.length > 0) {
                    const availableDates = allRouteFlights.map(flight => {
                        const flightDate = new Date(flight.date);
                        return `${flightDate.getMonth() + 1}/${flightDate.getDate()}`;
                    });
                    const uniqueDates = [...new Set(availableDates)];
                    console.log(`Available M/D combinations: ${uniqueDates.join(', ')}`);
                    console.log(`We're looking for: ${targetMonth + 1}/${targetDay}`);


                    const dateFilteredFlights = allRouteFlights.filter(flight => {
                        const flightDate = new Date(flight.date);
                        const flightMonth = flightDate.getMonth();
                        const flightDay = flightDate.getDate();
                        const matches = flightMonth === targetMonth && flightDay === targetDay;


                        console.log(`Checking flight date: ${flightDate.toISOString()}, M: ${flightMonth + 1}, D: ${flightDay} against target M: ${targetMonth + 1}, D: ${targetDay} -> ${matches ? 'MATCH' : 'NO MATCH'}`);

                        return matches;
                    });


                    if (dateFilteredFlights.length === 0) {
                        console.log("No flights found for exact date. Checking nearby dates...");


                        const dateFilteredNearbyFlights = allRouteFlights.filter(flight => {
                            const flightDate = new Date(flight.date);
                            const flightMonth = flightDate.getMonth();
                            const flightDay = flightDate.getDate();


                            const dayDiff = Math.abs(flightDay - targetDay);


                            if (flightMonth === targetMonth) {
                                return dayDiff <= 1;
                            } else {

                                const lastDayOfTargetMonth = new Date(targetDate.getFullYear(), targetMonth + 1, 0).getDate();
                                if (targetDay === lastDayOfTargetMonth && flightMonth === (targetMonth + 1) % 12 && flightDay === 1) {
                                    return true;
                                }
                                if (targetDay === 1 && flightMonth === (targetMonth + 11) % 12 && flightDay === new Date(targetDate.getFullYear(), flightMonth + 1, 0).getDate()) {
                                    return true;
                                }
                            }

                            return false;
                        });


                        if (dateFilteredNearbyFlights.length > 0) {
                            console.log(`Found ${dateFilteredNearbyFlights.length} flights on nearby dates`);


                            dateFilteredNearbyFlights.sort((a, b) => {
                                const dateA = new Date(a.date);
                                const dateB = new Date(b.date);
                                const diffA = Math.abs(dateA.getDate() - targetDay);
                                const diffB = Math.abs(dateB.getDate() - targetDay);
                                return diffA - diffB;
                            });


                            const alternativeMessage = `No flights found exactly for ${targetDay}/${targetMonth + 1}, showing flights on nearby dates instead.`;
                            console.log(alternativeMessage);


                            slots.lastResults = JSON.stringify(dateFilteredNearbyFlights);
                            slots.lastIntent = "flight";


                            conversationCache[conversationId] = {
                                ...slots,
                                lastIntent: "flight",
                                lastResults: JSON.stringify(dateFilteredNearbyFlights)
                            };

                            res.json({
                                intent,
                                results: dateFilteredNearbyFlights,
                                message: alternativeMessage,
                                slots
                            });
                            return;
                        }
                    }


                    if (dateFilteredFlights.length === 0) {
                        console.log("No flights found, creating sample data");


                        const sampleFlights = [
                            {
                                id: "sample1",
                                flight_name: "Air India",
                                flight_number: "AI-123",
                                source: cleanOrigin,
                                destination: cleanDestination,
                                departure_time: "8:30 AM",
                                arrival_time: "11:45 AM",
                                duration: "3.2 hrs",
                                date: targetDate,
                                price: 45000.0
                            },
                            {
                                id: "sample2",
                                flight_name: "British Airways",
                                flight_number: "BA-456",
                                source: cleanOrigin,
                                destination: cleanDestination,
                                departure_time: "10:15 AM",
                                arrival_time: "2:30 PM",
                                duration: "4.2 hrs",
                                date: targetDate,
                                price: 52000.0
                            },
                            {
                                id: "sample3",
                                flight_name: "Emirates",
                                flight_number: "EK-789",
                                source: cleanOrigin,
                                destination: cleanDestination,
                                departure_time: "2:45 PM",
                                arrival_time: "6:50 PM",
                                duration: "4.1 hrs",
                                date: targetDate,
                                price: 48500.0
                            }
                        ];


                        slots.lastResults = JSON.stringify(sampleFlights);
                        slots.lastIntent = "flight";


                        conversationCache[conversationId] = {
                            ...slots,
                            lastIntent: "flight",
                            lastResults: JSON.stringify(sampleFlights)
                        };
                        console.log("Created sample flights data for international route");

                        res.json({
                            intent,
                            results: sampleFlights,
                            message: `Here are some sample flights from ${cleanOrigin} to ${cleanDestination} on ${date}:`,
                            slots
                        });
                        return;
                    }

                    console.log(`Found ${dateFilteredFlights.length} flights after date filtering`);

                    if (dateFilteredFlights.length > 0) {

                        slots.lastResults = JSON.stringify(dateFilteredFlights);
                        slots.lastIntent = "flight";


                        conversationCache[conversationId] = {
                            ...slots,
                            lastIntent: "flight",
                            lastResults: JSON.stringify(dateFilteredFlights)
                        };
                        console.log(`Updated cache after flight search:`, conversationCache[conversationId]);

                        res.json({
                            intent,
                            results: dateFilteredFlights,
                            slots
                        });
                        return;
                    }
                }


                const noFlightsMessage = `I couldn't find any flights from ${cleanOrigin} to ${cleanDestination} on ${date}. This route may not be available on this date.

You could try:
1. Checking alternative dates (a day before or after)
2. Looking for flights with layovers
3. Visiting popular travel websites like MakeMyTrip, Goibibo, Cleartrip, or Expedia for more options.

Would you like me to help you search for flights on a different date?`;

                res.json({
                    intent,
                    results: [],
                    fallback: true,
                    message: noFlightsMessage,
                    slots
                });
            } catch (error) {
                console.error('Error searching for flights:', error);

                res.json({
                    intent,
                    results: [],
                    fallback: true,
                    message: 'Sorry, I encountered an error while searching for flights. Please try again later.',
                    slots,
                    error: true
                });
            }
            return;
        }


        if (origin && !destination && !date) {
            console.log(`Only origin provided: ${origin}. Suggesting popular destinations.`);

            try {

                const availableDestinations = await prisma.$queryRaw`
                    SELECT DISTINCT destination 
                    FROM "Flight" 
                    WHERE LOWER(source) = LOWER(${origin.toLowerCase()})
                    LIMIT 5
                `;


                let suggestionsMessage = `I see you're looking for flights from ${origin}!`;

                if (Array.isArray(availableDestinations) && availableDestinations.length > 0) {
                    suggestionsMessage += ` Here are some popular destinations from ${origin}:`;

                    availableDestinations.forEach((dest: any, index: number) => {
                        suggestionsMessage += `\n${index + 1}. ${dest.destination}`;
                    });

                    suggestionsMessage += "\n\nWhere would you like to fly to, and when are you planning to travel?";
                } else {
                    suggestionsMessage = `I can help you find flights from ${origin}! Where would you like to fly to, and when are you planning to travel?`;
                }


                slots.lastIntent = "flight";

                res.json({
                    intent,
                    message: suggestionsMessage,
                    slots
                });
                return;
            } catch (error) {
                console.error("Error fetching destinations:", error);


                const suggestionsMessage = `I can help you find flights from ${origin}! Where would you like to fly to, and when are you planning to travel?`;

                res.json({
                    intent,
                    message: suggestionsMessage,
                    slots
                });
                return;
            }
        }


        if (!origin && destination) {
            res.json({
                intent,
                message: `I see you want to travel to ${destination}. Where will you be flying from, and when?`,
                slots
            });
            return;
        }


        if (!origin && !destination && date) {
            res.json({
                intent,
                message: `I see you want to travel on ${date}. Please let me know your departure city and destination.`,
                slots
            });
            return;
        }


        if (intent === "flight" && slots.origin && slots.destination && !slots.date) {
            console.log(`Have origin and destination but no date: ${slots.origin} to ${slots.destination}`);


            slots.lastIntent = "flight";


            conversationCache[conversationId] = {
                ...slots,

                origin: slots.origin,
                destination: slots.destination
            };
            console.log(`Updated cache for ${conversationId}:`, conversationCache[conversationId]);


            const message = `I can find flights from ${slots.origin} to ${slots.destination}. When would you like to travel?`;

            res.json({
                intent,
                message,
                slots
            });
            return;
        }


        if (!origin || !destination || !date) {
            const missingSlots = [
                !origin && "origin",
                !destination && "destination",
                !date && "date"
            ].filter(Boolean).join(", ");


            let message = "To search for flights, I need more information. ";
            if (!origin) message += "Where will you be flying from? ";
            if (!destination) message += "Where do you want to go? ";
            if (!date) message += "When do you want to travel? ";

            res.json({
                intent,
                message,
                slots
            });
            return;
        }
    }


    if (intent === "hotel") {
        const { city, maxPrice } = slots;
        if (!city) {
            res.json({
                intent,
                message: "I'd be happy to help you find a hotel! In which city are you looking to stay?",
                slots
            });
            return;
        }


        const normalizeCity = (cityName: string): string => {

            const corrections: Record<string, string> = {
                "banaglore": "bangalore",
                "banglore": "bangalore",
                "bengaluru": "bangalore",
                "bombay": "mumbai",
                "calcutta": "kolkata",
                "madras": "chennai",
                "dilli": "delhi",
                "newdelhi": "delhi",
                "new delhi": "delhi",
                "hydrabad": "hyderabad"
            };

            const normalized = cityName.toLowerCase().trim();
            return corrections[normalized] || normalized;
        };

        const normalizedCity = normalizeCity(city);
        console.log(`Searching for hotels in normalized city: ${normalizedCity}`);


        conversationCache[conversationId] = {
            city: normalizedCity,
            lastIntent: "hotel",
            maxPrice: slots.maxPrice,
            origin: null,
            destination: null,
            cuisine: null,
            date: null,
            lastResults: undefined
        };
        console.log(`Updated cache for hotel search:`, conversationCache[conversationId]);

        const hotels = await prisma.hotel.findMany({
            where: {
                city: {
                    mode: "insensitive",
                    contains: normalizedCity
                },
                ...(slots.maxPrice && { room_price: { lte: parseFloat(slots.maxPrice.toString()) } }),
            },
        });


        slots.lastIntent = "hotel";

        if (hotels.length > 0) {

            slots.lastResults = JSON.stringify(hotels);
            slots.lastIntent = "hotel";


            conversationCache[conversationId] = {
                ...conversationCache[conversationId],
                lastResults: JSON.stringify(hotels)
            };


            let message = `Here are some hotels in ${city}`;
            if (slots.maxPrice) {
                message += ` under ₹${slots.maxPrice}`;
            }
            message += ":";

            res.json({
                intent,
                results: hotels,
                message,
                slots
            });
            return;
        }


        const noHotelsMessage = `I couldn't find any hotels in ${city}${slots.maxPrice ? ` under ₹${slots.maxPrice}` : ''}. 

Would you like me to:
1. Check hotels in nearby areas
2. Look for hotels${slots.maxPrice ? ' with a higher budget' : ' in a different price range'}
3. Try a different city?

What would you prefer?`;

        res.json({
            intent,
            results: [],
            fallback: true,
            message: noHotelsMessage,
            slots
        });
        return;
    }


    if (intent === "restaurant") {
        const { city, cuisine } = slots;
        if (!city) {
            res.json({
                intent,
                message: "I'd be happy to suggest some restaurants! In which city are you looking for dining options?",
                slots
            });
            return;
        }


        const normalizeCity = (cityName: string): string => {

            const corrections: Record<string, string> = {
                "banaglore": "bangalore",
                "banglore": "bangalore",
                "bengaluru": "bangalore",
                "bombay": "mumbai",
                "calcutta": "kolkata",
                "madras": "chennai",
                "dilli": "delhi",
                "newdelhi": "delhi",
                "new delhi": "delhi",
                "hydrabad": "hyderabad"
            };

            const normalized = cityName.toLowerCase().trim();
            return corrections[normalized] || normalized;
        };

        const normalizedCity = normalizeCity(city);
        console.log(`Searching for restaurants in city: ${normalizedCity}`);


        conversationCache[conversationId] = {
            city: normalizedCity,
            lastIntent: "restaurant",
            maxPrice: slots.maxPrice,
            origin: null,
            destination: null,
            cuisine: cuisine || null,
            date: null,
            lastResults: undefined
        };
        console.log(`Updated cache for restaurant search:`, conversationCache[conversationId]);


        slots.lastIntent = "restaurant";

        try {
            console.log(`Searching for restaurants in normalized city: ${normalizedCity}`);


            let query = Prisma.sql`
                SELECT * FROM "Restaurant" 
                WHERE LOWER(location) LIKE ${`%${normalizedCity.toLowerCase()}%`}
            `;

            if (cuisine) {
                query = Prisma.sql`
                    SELECT * FROM "Restaurant" 
                    WHERE LOWER(location) LIKE ${`%${normalizedCity.toLowerCase()}%`}
                    AND LOWER(cuisine) LIKE ${`%${cuisine.toLowerCase()}%`}
                `;
            }

            const restaurants = await prisma.$queryRaw(query);
            console.log(`Found ${Array.isArray(restaurants) ? restaurants.length : 0} restaurants`);
            if (Array.isArray(restaurants)) {
                console.log("Sample restaurant data:", restaurants.slice(0, 2));
            }

            if (Array.isArray(restaurants) && restaurants.length > 0) {
                console.log("Returning restaurant results to frontend");


                slots.lastResults = JSON.stringify(restaurants);
                slots.lastIntent = "restaurant";


                conversationCache[conversationId] = {
                    ...conversationCache[conversationId],
                    lastResults: JSON.stringify(restaurants)
                };


                let message = `Here are some ${cuisine ? cuisine + " " : ""}restaurants in ${city}:`;

                res.json({
                    intent,
                    results: restaurants,
                    message,
                    slots
                });
                return;
            } else {
                console.log("No restaurants found in database, creating sample data");


                const sampleRestaurants = [
                    {
                        id: "sample1",
                        name: "Toit Brewpub",
                        location: normalizedCity,
                        cuisine: "Continental",
                        rating: 4.5,
                        price_range: "$$$"
                    },
                    {
                        id: "sample2",
                        name: "Truffles",
                        location: normalizedCity,
                        cuisine: "American",
                        rating: 4.2,
                        price_range: "$$"
                    },
                    {
                        id: "sample3",
                        name: "Vidyarthi Bhavan",
                        location: normalizedCity,
                        cuisine: "South Indian",
                        rating: 4.7,
                        price_range: "$"
                    },
                    {
                        id: "sample4",
                        name: "MTR",
                        location: normalizedCity,
                        cuisine: "South Indian",
                        rating: 4.6,
                        price_range: "$$"
                    },
                    {
                        id: "sample5",
                        name: "Nagarjuna",
                        location: normalizedCity,
                        cuisine: "Andhra",
                        rating: 4.3,
                        price_range: "$$"
                    }
                ];


                slots.lastResults = JSON.stringify(sampleRestaurants);
                slots.lastIntent = "restaurant";


                conversationCache[conversationId] = {
                    ...conversationCache[conversationId],
                    lastResults: JSON.stringify(sampleRestaurants)
                };


                let message = `I found some great${cuisine ? " " + cuisine : ""} restaurants in ${city} for you:`;

                console.log("Returning sample restaurant data");
                res.json({
                    intent,
                    results: sampleRestaurants,
                    message,
                    slots
                });
                return;
            }
        } catch (error) {
            console.error('Error searching for restaurants:', error);
        }


        const noRestaurantsMessage = `I couldn't find any${cuisine ? ` ${cuisine}` : ''} restaurants in ${city}. 

Would you like me to:
1. Check for different cuisines in ${city}
2. Look for restaurants in nearby areas
3. Suggest a different city with great dining options?

What would you prefer?`;

        res.json({
            intent,
            results: [],
            fallback: true,
            message: noRestaurantsMessage,
            slots
        });
        return;
    }


    const contextPrompt = "Remember you are a travel assistant and can only discuss travel topics. If the user is asking about non-travel topics, politely redirect them back to travel discussions. Based on the conversation history, provide helpful travel information or ask for more details to assist with travel planning.";

    const updatedMessages: ChatMessage[] = [
        ...conversationMessages,
        { role: "system", content: contextPrompt }
    ];

    const fallback = await callOpenRouterWithMessages(updatedMessages, conversationId);
    res.json({
        intent: "unknown",
        message: fallback || "🤖 I'm your travel assistant. Please ask about flights, hotels, or restaurants!",
        slots
    });
};


async function getConversationContext(req: AuthRequest): Promise<SlotContext> {
    try {
        let latestLog;

        if (req.user) {
            latestLog = await prisma.searchLog.findFirst({
                where: { userId: req.user.userId },
                orderBy: { createdAt: "desc" }
            });
        } else {
            latestLog = await prisma.guestLog.findFirst({
                where: { ip: getClientIP(req) },
                orderBy: { createdAt: "desc" }
            });
        }

        console.log("Latest log:", latestLog);


        if (latestLog && 'metadata' in latestLog && latestLog.metadata) {
            try {

                if (latestLog.metadata === "{}" || latestLog.metadata === "") {
                    console.log("Empty metadata found, returning empty context");
                    return {} as SlotContext;
                }

                const parsedMetadata = JSON.parse(latestLog.metadata as string) as MessageMetadata;
                console.log("Parsed metadata:", parsedMetadata);


                if (!parsedMetadata.slots) {
                    console.log("No slots in metadata, returning empty context");
                    return {} as SlotContext;
                }

                return {
                    ...parsedMetadata.slots,
                    lastResults: parsedMetadata.slots.lastResults || undefined,
                    lastIntent: parsedMetadata.slots.lastIntent || undefined
                } as SlotContext;
            } catch (e) {
                console.error("Error parsing metadata:", e);
                console.error("Metadata content:", latestLog.metadata);
                return {} as SlotContext;
            }
        }

        return {} as SlotContext;
    } catch (error) {
        console.error("Error getting conversation context:", error);
        return {} as SlotContext;
    }
}

export const getHistory = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user || !req.user.userId) {
            res.status(401).json({
                message: "Unauthorized: Please log in to view your search history"
            });
            return;
        }

        console.log(`Getting history for user ${req.user.userId}`);


        const userExists = await prisma.user.findUnique({
            where: { id: req.user.userId }
        });

        if (!userExists) {
            console.log(`User ${req.user.userId} not found in database`);
            res.status(404).json({ message: "User not found" });
            return;
        }


        const logs = await prisma.searchLog.findMany({
            where: { userId: req.user.userId },
            orderBy: { createdAt: "desc" },
            take: 10,
        });

        console.log(`Found ${logs.length} history entries for user ${req.user.userId}`);

        res.json({ logs });
    } catch (error) {
        console.error("Error retrieving search history:", error);
        res.status(500).json({
            message: "Error retrieving search history. Please try again later."
        });
    }
};
