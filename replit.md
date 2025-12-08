# PosterPOS Mini Apps

## Overview

PosterPOS Mini Apps is a Telegram-based ecosystem for managing restaurant/retail operations across three distinct roles: Owner, Store Manager, and Shop/POS operations. The application integrates with the PosterPOS API for sales and inventory synchronization, and uses Telegram for notifications and communications.

The system is built as a full-stack TypeScript application with a React frontend (using Vite) and Express backend, featuring a PostgreSQL database for data persistence. It supports real-time inventory tracking, sales recording, dispatch logging, and reorder management across multiple user interfaces optimized for mobile devices.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Application Structure

**Monorepo Organization**: The codebase uses a monorepo structure with three primary directories:
- `client/` - React-based frontend with TypeScript and Vite
- `server/` - Express.js backend with TypeScript
- `shared/` - Shared schemas and types used by both client and server

**Rationale**: This architecture enables type safety across the full stack while maintaining clear separation of concerns. The shared directory eliminates duplication and ensures consistency between frontend and backend data models.

### Frontend Architecture

**Framework Choice**: React with TypeScript, built using Vite for development and production builds.

**UI Framework**: shadcn/ui component library built on Radix UI primitives with Tailwind CSS v4 for styling. The components follow the "new-york" style variant.

**Rationale**: shadcn/ui provides accessible, customizable components without the bundle size overhead of full UI libraries. Tailwind CSS offers utility-first styling with excellent mobile optimization, crucial for the Telegram Mini App use case.

**State Management**: TanStack Query (React Query) v5 for server state management with custom query functions.

**Routing**: Wouter for client-side routing - a lightweight alternative to React Router suitable for smaller applications.

**Mobile-First Design**: The application uses a `MobileShell` component wrapper that constrains content to mobile dimensions (`sm:max-w-md`) and provides theme switching between three color schemes (owner/store/shop).

**Rationale**: Telegram Mini Apps are primarily mobile experiences, so the mobile-first constraint ensures optimal UX. The theme system provides visual distinction between different user roles.

### Backend Architecture

**Server Framework**: Express.js with TypeScript, using ES modules (`"type": "module"` in package.json).

**API Design**: RESTful API structure with route handlers in `server/routes.ts`. No authentication middleware is currently implemented (relies on Telegram's built-in auth).

**Development vs Production**: 
- Development mode uses Vite middleware for hot module replacement
- Production builds bundle the server with esbuild, selectively bundling dependencies from an allowlist to reduce cold start times

**Rationale**: This dual-mode approach provides excellent developer experience while optimizing production performance. The selective bundling strategy reduces filesystem operations which can slow cold starts in serverless environments.

### Data Layer

**ORM**: Drizzle ORM v0.39.3 configured for PostgreSQL with the schema defined in `shared/schema.ts`.

**Database**: PostgreSQL with connection pooling via `pg` library.

**Schema Design**: Six primary tables:
- `users` - User authentication (currently minimal)
- `inventoryItems` - Product inventory with PosterPOS integration
- `salesRecords` - Sales transactions synced from PosterPOS
- `despatchLogs` - Manual dispatch/transfer records
- `reorderRequests` - Reorder/purchase requests
- `telegramChats` - Telegram bot chat registrations with role assignments

**Storage Abstraction**: The `server/storage.ts` file provides an `IStorage` interface abstracting database operations. This allows for easier testing and potential database swapping.

**Rationale**: Drizzle provides type-safe database queries with excellent TypeScript integration while remaining lightweight. The schema uses UUIDs for primary keys and maintains referential integrity through foreign keys.

### Build System

**Development**: 
- Client: Vite dev server on port 5000
- Server: tsx watch mode for TypeScript execution

**Production Build**: Custom build script (`script/build.ts`) that:
1. Builds the client with Vite → outputs to `dist/public`
2. Bundles the server with esbuild → outputs to `dist/index.cjs`

**Rationale**: This approach produces a single deployable artifact with the server serving the static client files, simplifying deployment to platforms like Replit.

## External Dependencies

### PosterPOS Integration

**Purpose**: Third-party POS system integration for inventory and sales synchronization.

**Implementation**: Custom client in `server/posterpos.ts` that communicates via REST API with bearer token authentication.

**Key Features**:
- Fetch product catalog
- Retrieve transaction history
- Get stock levels
- Manual sync endpoints for inventory and sales data
- Real-time ingredient usage tracking from transactions

**Ingredient Usage Tracking**:
The system calculates ingredient consumption by combining:
1. **Base Recipe Ingredients**: From `menu.getProduct` API - static ingredients for each dish
2. **Selected Modifiers**: From `dash.getTransactionProducts` API - the `modificator_name` field contains comma-separated modifier names selected by customers
3. **Modifier Recipes**: From `group_modifications` in product recipes - each modifier has `ingredient_id` and `brutto` amount

**Key API Endpoints Used**:
- `dash.getTransactions` - Get transaction list with product IDs
- `dash.getTransactionProducts` - Get detailed product info WITH `modificator_name` for selected modifiers
- `menu.getProduct` - Get product recipes and available modifiers

**Important API Notes**:
- `dash.getTransactions` only returns `modification_id` (combined ID), NOT individual modifier details
- `dash.getTransactionProducts` returns `modificator_name` (e.g., "Oranges, Apples, Ginger") - the key to modifier tracking
- Use date format `Ymd` (e.g., 20251207) for date parameters
- Amounts are in cents/smallest currency unit - divide by 100 for display

**Configuration**: Requires environment variables:
- `POSTERPOS_API_ENDPOINT` - API base URL
- `POSTERPOS_API_TOKEN` - Authentication token

**Rationale**: PosterPOS serves as the source of truth for sales and product data. The integration allows the application to maintain a local cache while periodically syncing with the external system.

### Telegram Bot Integration

**Purpose**: Notifications and role-based chat management for alerts about inventory, sales, and reorders.

**Implementation**: `node-telegram-bot-api` library with custom service wrapper in `server/telegram.ts`.

**Supported Modes**:
- Polling mode for development
- Webhook mode for production (requires `TELEGRAM_WEBHOOK_URL`)

**Features**:
- Chat registration with role assignment (owner/store/shop)
- Command handling (`/start`, `/status`, etc.)
- Notification delivery to registered chats

**Configuration**: Requires environment variables:
- `TELEGRAM_BOT_TOKEN` - Bot authentication token
- `TELEGRAM_WEBHOOK_URL` - (Optional) Webhook endpoint for production

**Rationale**: Telegram provides a free, ubiquitous messaging platform perfect for operations notifications. The bot approach allows push notifications without building a native mobile app.

### UI Component Libraries

**Primary Dependencies**:
- `@radix-ui/*` - Unstyled, accessible component primitives (17+ packages)
- `@tanstack/react-query` - Server state management
- `lucide-react` - Icon library
- `react-hook-form` + `@hookform/resolvers` - Form handling with Zod validation

**Styling**:
- `tailwindcss` - Utility-first CSS framework
- `class-variance-authority` - Variant-based component styling
- `tailwind-merge` + `clsx` - Conditional class merging

**Rationale**: This stack provides maximum flexibility and customization while maintaining accessibility standards. The combination is well-suited for design systems that need to be highly tailored.

### Database & Session Management

**Database**: 
- `drizzle-orm` - Type-safe ORM
- `drizzle-kit` - Migration tooling
- `pg` - PostgreSQL client with connection pooling

**Session Storage**: `connect-pg-simple` for PostgreSQL-backed Express sessions (though sessions aren't currently used extensively).

**Rationale**: PostgreSQL provides ACID guarantees crucial for inventory and financial data. Drizzle's TypeScript-first approach ensures compile-time safety for database operations.

### Development Tools

**Replit-Specific Plugins**:
- `@replit/vite-plugin-runtime-error-modal` - Enhanced error overlay
- `@replit/vite-plugin-cartographer` - Project navigation
- `@replit/vite-plugin-dev-banner` - Development environment indicator

**Build Tools**:
- `vite` - Frontend build tool and dev server
- `esbuild` - Server bundler for production
- `tsx` - TypeScript execution for development

**Rationale**: The Replit plugins enhance the development experience specifically for the Replit platform, while the build tools provide optimal performance for both development and production.