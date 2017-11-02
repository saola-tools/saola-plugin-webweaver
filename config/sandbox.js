module.exports = {
  plugins: {
    appWebserver: {
      legacyMode: false
    },
    appWebweaver: {
      sslProtectedUrls: [],
      session: {
        name: 'sessionId',
        secret: 'd0bi3td4y',
        cookie: {},
        store: {
          type: 'redis',
          url: 'redis://localhost:6379'
        }
      },
      jsonBodySizeLimit: '1mb',
      cacheControl: {
        enabled: false,
        pattern: {
          operator: 'or',
          url: /^\/(assets|css|js|picture|font)\/.+/,
          contentType: /^\/(jpeg|png|gif)$/
        },
        maxAge: 3600
      },
      setPoweredBy: false,
      printRequestInfo: false
    }
  }
};
