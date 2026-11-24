import { setupServer } from 'msw/node';

/** The only HTTP stub in component tests (AD-20). Tests add handlers with `server.use`. */
export const server = setupServer();
