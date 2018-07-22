module.exports = {
  application: {
    enabled: true
  },
  plugins: {
    appWebweaver: {
      defaultRedirectUrl: '/example/dashboard',
      errorHandler: {
        mappings: [
          {
            errorName: 'Error',
            statusCode: 402,
            statusMessage: 'Invalid credentials'
          },
          {
            errorName: 'NoCodeError',
            statusCode: 405,
            statusMessage: 'NoCodeError default message'
          }
        ]
      },
      session: {
        cookie: {
          secure: true,
          httpOnly: true,
          domain: 'devebot.com',
          path: 'relative/path',
          expires: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
        }
      }
    },
    appWebserver: {
      host: '0.0.0.0',
      port: 18080
    }
  }
};
