// Test configuration and constants
export const TEST_CONFIG = {
  baseUrl: process.env.BASE_URL || 'https://creator-club.vercel.app',

  // Timeouts
  defaultTimeout: 30000,
  stripeTimeout: 60000, // Longer for Stripe redirects

  // Test Credentials
  creator: {
    email: process.env.TEST_CREATOR_EMAIL || 'test-creator@creatorclub.test',
    password: process.env.TEST_CREATOR_PASSWORD || 'TestCreator123!',
  },
  student: {
    email: process.env.TEST_STUDENT_EMAIL || 'test-student@creatorclub.test',
    password: process.env.TEST_STUDENT_PASSWORD || 'TestStudent123!',
  },

  // Stripe Test Cards
  stripe: {
    success: {
      number: '4242424242424242',
      expiry: '12/34',
      cvc: '123',
      zip: '12345',
    },
    decline: {
      number: '4000000000009995',
      expiry: '12/34',
      cvc: '123',
      zip: '12345',
    },
    threeDSecure: {
      number: '4000000000003220',
      expiry: '12/34',
      cvc: '123',
      zip: '12345',
    },
  },

  // Expected prices (in EUR)
  prices: {
    activationFee: '€2.90',
    proPlan: '€30.00',
    scalePlan: '€99.00',
    studentPlus: '€9.90',
  },
};

export type TestCard = keyof typeof TEST_CONFIG.stripe;
