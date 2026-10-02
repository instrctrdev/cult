/**
 * Loads .env for the standalone CLI scripts (seed, import, admin:create).
 *
 * Next.js does this itself, but `tsx` does not. dotenv never overwrites a
 * variable that is already set, so values injected by the Hostinger panel
 * always take precedence over a stray .env file on the server.
 */
import { config } from 'dotenv';

config({ path: '.env' });
config({ path: '.env.local', override: false });
