import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function getRandomElement<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomDate(start: Date, end: Date): Date {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function getRandomFloat(min: number, max: number, decimals = 2): number {
    return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatTime(hours: number, minutes: number): string {
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

function getRandomDuration(): string {
    const hours = getRandomInt(1, 5);
    const minutes = getRandomInt(0, 59);
    const decimalHours = hours + (minutes / 60);
    return `${decimalHours.toFixed(1)} hrs`;
}

function getPriceRange(min: number, max: number): string {
    const value = getRandomInt(min, max);
    if (value === 1) return "$";
    if (value === 2) return "$$";
    if (value === 3) return "$$$";
    return "$$$$";
}


function generateFlightTimes(count: number) {
    const times = [];

    const timeSlots = [
        { start: 6, end: 11 },
        { start: 12, end: 17 },
        { start: 18, end: 22 }
    ];


    for (let i = 0; i < count; i++) {
        const slot = timeSlots[i % timeSlots.length];
        const hour = getRandomInt(slot.start, slot.end);
        const minute = getRandomInt(0, 59);
        const durationHours = getRandomInt(1, 4);
        const durationMinutes = getRandomInt(0, 59);

        const departureTime = formatTime(hour, minute);
        const duration = `${durationHours}.${Math.floor(durationMinutes / 6)} hrs`;

        const arrivalHour = (hour + durationHours) % 24;
        const arrivalMinute = (minute + durationMinutes) % 60;
        const arrivalTime = formatTime(arrivalHour, arrivalMinute);

        times.push({
            departureTime,
            arrivalTime,
            duration
        });
    }

    return times;
}


function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}


function getDateRange(start: Date, days: number): Date[] {
    const dates = [];
    for (let i = 0; i < days; i++) {
        dates.push(addDays(start, i));
    }
    return dates;
}

async function main() {

    await prisma.flight.deleteMany({});
    await prisma.hotel.deleteMany({});
    await prisma.restaurant.deleteMany({});
    await prisma.searchLog.deleteMany({});
    await prisma.guestLog.deleteMany({});


    const cities = ["Delhi", "Mumbai", "Bangalore", "Chennai", "Kolkata", "Hyderabad", "Pune", "Jaipur", "Ahmedabad", "Goa"];
    const airlines = ["IndiGo", "Air India", "SpiceJet", "Vistara", "AirAsia"];
    const flightNumbers: Record<string, string> = {
        "IndiGo": "6E-",
        "Air India": "AI-",
        "SpiceJet": "SG-",
        "Vistara": "UK-",
        "AirAsia": "I5-"
    };
    const hotelNames = ["Grand", "Royal", "Imperial", "Sunset", "Ocean", "Majestic", "Luxury", "Elite", "Paradise", "Golden"];
    const hotelSuffixes = ["Hotel", "Resort", "Suites", "Inn", "Plaza", "Palace", "Residency", "Towers", "Heights"];
    const cuisines = ["North Indian", "South Indian", "Chinese", "Italian", "Continental", "Japanese", "Mexican", "Thai", "Mediterranean", "Bengali", "Punjabi", "Coastal", "Mughlai"];
    const restaurantPrefixes = ["The", "Royal", "Spice", "Golden", "Blue", "Green", "Red", "Silver", "Urban", "Metro"];
    const restaurantSuffixes = ["Kitchen", "Bistro", "Cafe", "Restaurant", "Diner", "Eatery", "Grill", "Brasserie", "Dining", "Lounge"];

    const today = new Date();
    const dateRange = getDateRange(today, 14);
    const flightsPerDay = 5;

    console.log(`Generating flights for ${cities.length} cities, ${dateRange.length} days, ${flightsPerDay} flights per route...`);

    let flightCount = 0;
    let flightNumberCounter = 1000;

    for (const date of dateRange) {
        for (const origin of cities) {
            for (const destination of cities.filter(city => city !== origin)) {
                const flightTimes = generateFlightTimes(flightsPerDay);

                for (let i = 0; i < flightsPerDay; i++) {
                    const airline = airlines[i % airlines.length];
                    const { departureTime, arrivalTime, duration } = flightTimes[i];

                    await prisma.flight.create({
                        data: {
                            flight_name: airline,
                            flight_number: `${flightNumbers[airline]}${flightNumberCounter++}`,
                            source: origin,
                            destination: destination,
                            departure_time: departureTime,
                            arrival_time: arrivalTime,
                            duration: duration,
                            date: new Date(date),
                            price: getRandomFloat(3000, 15000)
                        }
                    });

                    flightCount++;


                    if (flightCount % 100 === 0) {
                        console.log(`Created ${flightCount} flights...`);
                    }
                }
            }
        }
    }


    console.log("Generating hotels...");
    for (const city of cities) {
        for (let i = 0; i < 10; i++) {
            await prisma.hotel.create({
                data: {
                    name: `${getRandomElement(hotelNames)} ${getRandomElement(hotelSuffixes)}`,
                    city: city,
                    stars: getRandomInt(3, 5),
                    room_price: getRandomFloat(2000, 20000),
                    availability: Math.random() > 0.2
                }
            });
        }
    }


    console.log("Generating restaurants...");
    for (const city of cities) {
        for (let i = 0; i < 10; i++) {
            await prisma.restaurant.create({
                data: {
                    name: `${getRandomElement(restaurantPrefixes)} ${getRandomElement(restaurantSuffixes)}`,
                    location: city,
                    cuisine: getRandomElement(cuisines),
                    rating: getRandomFloat(3.0, 5.0),
                    price_range: getPriceRange(1, 4)
                }
            });
        }
    }

    const totalFlights = cities.length * (cities.length - 1) * dateRange.length * flightsPerDay;
    console.log(`Seed data created successfully!`);
    console.log(`Generated ${flightCount} flights for ${cities.length} cities over ${dateRange.length} days`);
    console.log(`Generated ${cities.length * 10} hotels`);
    console.log(`Generated ${cities.length * 10} restaurants`);
}

main()
    .catch((e) => console.error(e))
    .finally(() => prisma.$disconnect());