# Travel Assistant Backend

A Node.js backend service powering an intelligent travel assistant chatbot that helps users find flights, hotels, and restaurants with natural language processing capabilities.

## Features

- **Natural Language Understanding**: Process user queries about travel needs
- **Multi-Intent Recognition**: Handle flight, hotel, and restaurant searches
- **Context Maintenance**: Remember user preferences through the conversation 
- **Price Filtering**: Filter results by price for flights, hotels, and restaurants
- **User Authentication**: Secure login and signup with JWT
- **Search History**: Track and save user search history
- **International Flight Support**: Handle various flight routes including international destinations

## Tech Stack

- **Backend**: Node.js, Express.js, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (JSON Web Tokens)
- **API Documentation**: Swagger/OpenAPI
- **Natural Language Processing**: Custom intent recognition system

## Getting Started

### Prerequisites

- Node.js (v14+)
- PostgreSQL database
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/animeshj2132/travel-assistant.git
cd travel-assistant-backend
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
Create a `.env` file in the root directory with the following:
```
DATABASE_URL=postgresql://username:password@localhost:5432/travel_assistant
PORT=3000
JWT_SECRET=your_jwt_secret
```

4. Run database migrations
```bash
npx prisma migrate dev
```

5. Start the development server
```bash
npm run dev
```

The server will be available at http://localhost:3000 by default.

### Database Setup

The application uses a PostgreSQL database with the following models:
- User: Store user information
- SearchLog: Track user search history
- Flight: Store flight details (routes, prices, times)
- Hotel: Store hotel information by city
- Restaurant: Store restaurant details
- GuestLog: Track guest (non-authenticated) interactions

The database should be populated with sample data before use. This is done through the `seed.ts` script which creates travel data including flights between major cities, hotel listings, and restaurant information. Note that the seed file is excluded from the repository (via .gitignore), so you'll need to create your own seed script based on your data requirements or request it from the project maintainers.

## API Endpoints

### Chat API
- `POST /chat`: Process user chat messages and return appropriate travel information

### User API
- `POST /login`: Authenticate a user and return JWT
- `POST /signup`: Register a new user
- `POST /logout`: End a user session

API documentation is available at `/docs` when the server is running.

## Development

### Scripts
- `npm run dev`: Start development server with hot reload
- `npm run build`: Build the TypeScript project
- `npm start`: Run the built project
- `npm run seed`: Seed the database with sample data

## Project Structure

```
travel-assistant-backend/
├── prisma/               # Database schema and migrations
├── public/               # Static files and frontend UI
├── src/
│   ├── config/           # Configuration files
│   ├── controller/       # Request handlers
│   ├── middleware/       # Express middleware
│   ├── routes/           # API routes
│   ├── service/          # Business logic
│   ├── utils/            # Helper functions
│   └── index.ts          # Application entry point
├── .env                  # Environment variables (not in repo)
├── .gitignore            # Git ignore file
├── package.json          # Dependencies and scripts
└── tsconfig.json         # TypeScript configuration
```

## License

[MIT License](LICENSE)

## Contributors

- Your Name - Initial development

## Acknowledgments

- Thanks to all open source projects that made this possible 