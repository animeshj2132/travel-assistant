import { PrismaClient, Prisma, User } from '@prisma/client';

const prisma = new PrismaClient();

// Helper functions to generate random data
function getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min: number, max: number, decimals: number = 2): number {
    const random = Math.random() * (max - min) + min;
    return parseFloat(random.toFixed(decimals));
}

function getRandomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

function formatTime(hours: number, minutes: number): string {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function getRandomTime(): string {
    const hours = getRandomInt(0, 23);
    const minutes = getRandomInt(0, 59);
    return formatTime(hours, minutes);
}

function generateRandomDuration(): string {
    const hours = getRandomInt(1, 15);
    const minutes = getRandomInt(0, 59);
    return `${hours}h ${minutes}m`;
}

function generateRandomDate(start: Date, end: Date): Date {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateRandomIP(): string {
    return `${getRandomInt(1, 255)}.${getRandomInt(0, 255)}.${getRandomInt(0, 255)}.${getRandomInt(0, 255)}`;
}

async function main() {
    // Define cities based on the normalized cities in slot extraction
    const cities = [
        'bangalore', 'mumbai', 'delhi', 'kolkata', 'chennai',
        'hyderabad', 'pune', 'ahmedabad', 'jaipur', 'lucknow',
        'tokyo', 'paris', 'new york', 'london', 'sydney'
    ];

    // Define airlines
    const airlines = [
        'Air India', 'IndiGo', 'SpiceJet', 'Vistara', 'GoAir',
        'Japan Airlines', 'Air France', 'United', 'British Airways', 'Qantas'
    ];

    // Define hotel names
    const hotelNames = [
        'Hotel Taj', 'Oberoi', 'ITC Hotels', 'Leela Palace', 'Radisson',
        'Marriott', 'Hyatt', 'Hilton', 'Four Seasons', 'Novotel'
    ];

    // Define cuisines from the slot extraction function
    const cuisines = [
        'italian', 'chinese', 'indian', 'mexican', 'thai',
        'japanese', 'mediterranean', 'french', 'spanish', 'american',
        'north indian', 'south indian', 'punjabi', 'gujarati', 'bengali',
        'vegetarian', 'vegan', 'seafood'
    ];

    // Define restaurant names
    const restaurantNames = [
        'Spice Garden', 'Tandoor Express', 'Mainland China', 'Paradise Biryani',
        'Punjab Grill', 'Royal Thai', 'Little Italy', 'China Town', 'Tokyo Bay',
        'French Corner', 'Mediterranean Delights', 'American Diner', 'Spanish Tapas',
        'Seafood Harbor', 'Vegan Delight', 'Veggie Paradise'
    ];

    // Intent types from intent extraction
    const intents = ['flight', 'hotel', 'restaurant', 'unknown'];

    // Price ranges
    const priceRanges = ['$', '$$', '$$$', '$$$$', '$$$$$'];

    // Prompts that match our intent extraction patterns
    const prompts = [
        'flights from bangalore to mumbai', 'find hotels in delhi',
        'restaurants in chennai', 'I need a flight from pune to kolkata',
        'book a room in taj hotel mumbai', 'suggest me italian restaurants in bangalore',
        'list vegetarian restaurants in delhi', 'find flights from delhi to chennai tomorrow',
        'hotels under 5000 in jaipur', 'best north indian restaurants in hyderabad',
        'flights from mumbai to bangalore next week', 'luxury hotels in kolkata',
        'find me chinese restaurants in pune', 'show me flights from ahmedabad to lucknow',
        'budget hotels in delhi', 'where can I eat south indian food in mumbai'
    ];

    // Create flights with 5 flights per day between destinations
    const today = new Date();
    const startDate = new Date(today);

    // End date: 7 days from today (including today)
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 6); // +6 because today is included

    // Create origin-destination pairs using main Indian cities
    interface Route {
        origin: string;
        destination: string;
    }

    const routes: Route[] = [];
    // Focus on major Indian cities for most of the routes
    const majorIndianCities = ['bangalore', 'mumbai', 'delhi', 'chennai', 'hyderabad', 'kolkata'];

    for (let i = 0; i < majorIndianCities.length; i++) {
        for (let j = 0; j < majorIndianCities.length; j++) {
            if (i !== j) { // Skip same origin-destination
                routes.push({
                    origin: majorIndianCities[i],
                    destination: majorIndianCities[j]
                });
            }
        }
    }

    console.log(`Creating flights for ${routes.length} routes from ${startDate.toDateString()} to ${endDate.toDateString()}`);

    // Generate dates in the range
    const dates: Date[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }

    let flightBatchCount = 0;
    let flightCounter = 1000; 

    for (const route of routes) {
        for (const date of dates) {
            const dateString = date.toISOString().split('T')[0];

            const flightData: Prisma.FlightCreateManyInput[] = [];
            for (let j = 0; j < 5; j++) {
                const airline = getRandomElement(airlines);
                const originCode = route.origin.substring(0, 1).toUpperCase();
                const destCode = route.destination.substring(0, 1).toUpperCase();
                const dayCode = date.getDate().toString().padStart(2, '0');
                const airlineCode = airline.split(' ')[0].substring(0, 2).toUpperCase();

                flightCounter++;

                const flightCode = `${airlineCode}${originCode}${destCode}${dayCode}${flightCounter}`;

                const departureHour = getRandomInt(6, 20);
                const departureMinute = getRandomInt(0, 59);
                const departure_time = formatTime(departureHour, departureMinute);

                const durationHours = route.origin === 'delhi' && route.destination === 'mumbai' ?
                    getRandomInt(2, 3) : getRandomInt(1, 4);
                const durationMinutes = getRandomInt(0, 59);
                const duration = `${durationHours}h ${durationMinutes}m`;

                const arrivalHour = (departureHour + durationHours) % 24;
                const arrivalMinute = (departureMinute + durationMinutes) % 60;
                const arrival_time = formatTime(arrivalHour, arrivalMinute);

                const basePrice = route.origin === 'delhi' && route.destination === 'mumbai' ?
                    getRandomFloat(3000, 7000) : getRandomFloat(4000, 12000);

                flightData.push({
                    destination: route.destination,
                    price: basePrice,
                    arrival_time,
                    departure_time,
                    duration,
                    flight_name: airline,
                    flight_number: flightCode,
                    source: route.origin,
                    date: new Date(dateString),
                });
            }

            await prisma.flight.createMany({
                data: flightData,
            });

            flightBatchCount++;
            if (flightBatchCount % 10 === 0) {
                console.log(`Created ${flightBatchCount} flight batches (5 flights each)`);
            }
        }
    }

    console.log(`Completed creating ${flightBatchCount} flight batches (${flightBatchCount * 5} total flights)`);

    const hotelData: Prisma.HotelCreateManyInput[] = [];
    for (let i = 0; i < 50; i++) {
        const city = getRandomElement(cities);
        const starRating = getRandomInt(3, 5); 

        let priceMin, priceMax;
        if (starRating === 5) {
            priceMin = 4000;
            priceMax = 15000;
        } else if (starRating === 4) {
            priceMin = 2000;
            priceMax = 8000;
        } else {
            priceMin = 500;
            priceMax = 4000;
        }

        hotelData.push({
            city,
            name: `${getRandomElement(hotelNames)} ${city.charAt(0).toUpperCase() + city.slice(1)}`,
            availability: Math.random() > 0.1,
            room_price: getRandomFloat(priceMin, priceMax),
            stars: starRating,
        });
    }

    await prisma.hotel.createMany({
        data: hotelData,
    });
    console.log('Created 50 hotels');

    const restaurantData: Prisma.RestaurantCreateManyInput[] = [];
    for (let i = 0; i < 50; i++) {
        const location = getRandomElement(cities);
        const cuisine = getRandomElement(cuisines);

        const isMajorIndianCity = majorIndianCities.includes(location);
        const actualCuisine = isMajorIndianCity && Math.random() > 0.4 ?
            getRandomElement(['north indian', 'south indian', 'punjabi', 'gujarati', 'bengali']) : cuisine;

        restaurantData.push({
            name: `${getRandomElement(restaurantNames)} ${location.charAt(0).toUpperCase() + location.slice(1)}`,
            cuisine: actualCuisine,
            rating: getRandomFloat(3.5, 4.9, 1),
            location,
            price_range: getRandomElement(priceRanges),
        });
    }

    await prisma.restaurant.createMany({
        data: restaurantData,
    });
    console.log('Created 50 restaurants');

    console.log('Seeding complete');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    }); 