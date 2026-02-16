module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.test.ts'
  ],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  testTimeout: 10000,
  transformIgnorePatterns: [
    'node_modules/(?!(chalk|execa|uuid))/'
  ]
};
