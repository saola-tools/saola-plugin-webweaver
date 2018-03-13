module.exports = {
  application: {
    enabled: true
  },
  plugins: {
    appWebweaver: {
      defaultRedirectUrl: '/example/dashboard',
      session: {
        cookie: {
          secure: true,
          httpOnly: true,
          domain: 'devebot.com',
          path: 'relative/path',
          expires: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
        }
      }
    }
  }
};
